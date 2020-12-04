import { QueryType } from 'components/data/queries';
import { QueryInput } from 'components/data/types';
import { useConditionalQuery } from 'components/hooks/useConditionalQuery';
import { isEqual, some } from 'lodash';
import {
    endNodeId,
    getNodeExecution,
    listNodeExecutions,
    listTaskExecutionChildren,
    NodeExecution,
    NodeExecutionIdentifier,
    nodeExecutionQueryParams,
    RequestConfig,
    startNodeId,
    TaskExecutionIdentifier,
    WorkflowExecutionIdentifier
} from 'models';
import { QueryClient, QueryObserverResult, useQueryClient } from 'react-query';
import { fetchTaskExecutionList } from './taskExecutionQueries';
import { formatRetryAttempt } from './TaskExecutionsList/utils';
import { NodeExecutionGroup } from './types';
import { isParentNode, nodeExecutionIsTerminal } from './utils';

const ignoredNodeIds = [startNodeId, endNodeId];
function removeSystemNodes(nodeExecutions: NodeExecution[]): NodeExecution[] {
    return nodeExecutions.filter(ne => {
        if (ignoredNodeIds.includes(ne.id.nodeId)) {
            return false;
        }
        const specId = ne.metadata?.specNodeId;
        if (specId != null && ignoredNodeIds.includes(specId)) {
            return false;
        }
        return true;
    });
}

export function makeNodeExecutionQuery(
    id: NodeExecutionIdentifier
): QueryInput<NodeExecution> {
    return {
        queryKey: [QueryType.NodeExecution, id],
        queryFn: () => getNodeExecution(id)
    };
}

export function fetchNodeExecution(
    queryClient: QueryClient,
    id: NodeExecutionIdentifier
) {
    return queryClient.fetchQuery(makeNodeExecutionQuery(id));
}

export function makeNodeExecutionListQuery(
    id: WorkflowExecutionIdentifier,
    config?: RequestConfig
): QueryInput<NodeExecution[]> {
    return {
        queryKey: [QueryType.NodeExecutionList, id, config],
        queryFn: async () =>
            removeSystemNodes((await listNodeExecutions(id, config)).entities)
    };
}

export function fetchNodeExecutionList(
    queryClient: QueryClient,
    id: WorkflowExecutionIdentifier,
    config?: RequestConfig
) {
    return queryClient.fetchQuery(makeNodeExecutionListQuery(id, config));
}

export function useNodeExecutionListQuery(
    id: WorkflowExecutionIdentifier,
    config: RequestConfig
) {
    return useConditionalQuery<NodeExecution[]>(
        makeNodeExecutionListQuery(id, config),
        // todo: Refresh node executions on interval while parent is non-terminal
        () => true
    );
}

export function makeTaskExecutionChildListQuery(
    id: TaskExecutionIdentifier,
    config?: RequestConfig
): QueryInput<NodeExecution[]> {
    return {
        queryKey: [QueryType.TaskExecutionChildList, id, config],
        queryFn: async () =>
            removeSystemNodes(
                (await listTaskExecutionChildren(id, config)).entities
            )
    };
}

export function fetchTaskExecutionChildList(
    queryClient: QueryClient,
    id: TaskExecutionIdentifier,
    config?: RequestConfig
) {
    return queryClient.fetchQuery(makeTaskExecutionChildListQuery(id, config));
}

/** --- Queries for fetching children of a NodeExecution --- **/

async function fetchGroupForTaskExecution(
    queryClient: QueryClient,
    taskExecutionId: TaskExecutionIdentifier,
    config: RequestConfig
): Promise<NodeExecutionGroup> {
    return {
        // NodeExecutions created by a TaskExecution are grouped
        // by the retry attempt of the task.
        name: formatRetryAttempt(taskExecutionId.retryAttempt),
        nodeExecutions: await fetchTaskExecutionChildList(
            queryClient,
            taskExecutionId,
            config
        )
    };
}

async function fetchGroupForWorkflowExecution(
    queryClient: QueryClient,
    executionId: WorkflowExecutionIdentifier,
    config: RequestConfig
): Promise<NodeExecutionGroup> {
    return {
        // NodeExecutions created by a workflow execution are grouped
        // by the execution id, since workflow executions are not retryable.
        name: executionId.name,
        nodeExecutions: await fetchNodeExecutionList(
            queryClient,
            executionId,
            config
        )
    };
}

async function fetchGroupsForTaskExecutionNode(
    queryClient: QueryClient,
    nodeExecution: NodeExecution,
    config: RequestConfig
): Promise<NodeExecutionGroup[]> {
    const taskExecutions = await fetchTaskExecutionList(
        queryClient,
        nodeExecution.id,
        config
    );

    // For TaskExecutions marked as parents, fetch its children and create a group.
    // Otherwise, return null and we will filter it out later.
    const groups = await Promise.all(
        taskExecutions.map(execution =>
            execution.isParent
                ? fetchGroupForTaskExecution(queryClient, execution.id, config)
                : Promise.resolve(null)
        )
    );

    // Remove any empty groups
    return groups.filter(
        group => group !== null && group.nodeExecutions.length > 0
    ) as NodeExecutionGroup[];
}

async function fetchGroupsForWorkflowExecutionNode(
    queryClient: QueryClient,
    nodeExecution: NodeExecution,
    config: RequestConfig
): Promise<NodeExecutionGroup[]> {
    if (!nodeExecution.closure.workflowNodeMetadata) {
        throw new Error('Unexpected empty `workflowNodeMetadata`');
    }
    const { executionId } = nodeExecution.closure.workflowNodeMetadata;
    // We can only have one WorkflowExecution (no retries), so there is only
    // one group to return. But calling code expects it as an array.
    const group = await fetchGroupForWorkflowExecution(
        queryClient,
        executionId,
        config
    );
    return group.nodeExecutions.length > 0 ? [group] : [];
}

async function fetchGroupsForParentNodeExecution(
    queryClient: QueryClient,
    nodeExecution: NodeExecution,
    config: RequestConfig
): Promise<NodeExecutionGroup[]> {
    const finalConfig = {
        ...config,
        params: {
            ...config.params,
            [nodeExecutionQueryParams.parentNodeId]: nodeExecution.id.nodeId
        }
    };
    const children = await fetchNodeExecutionList(
        queryClient,
        nodeExecution.id.executionId,
        finalConfig
    );
    const groupsByName = children.reduce<Map<string, NodeExecutionGroup>>(
        (out, child) => {
            const retryAttempt = formatRetryAttempt(child.metadata?.retryGroup);
            let group = out.get(retryAttempt);
            if (!group) {
                group = { name: retryAttempt, nodeExecutions: [] };
                out.set(retryAttempt, group);
            }
            group.nodeExecutions.push(child);
            return out;
        },
        new Map()
    );
    return Array.from(groupsByName.values());
}

export function fetchChildNodeExecutionGroups(
    queryClient: QueryClient,
    nodeExecution: NodeExecution,
    config: RequestConfig
) {
    const { workflowNodeMetadata } = nodeExecution.closure;

    // Newer NodeExecution structures can directly indicate their parent
    // status and have their children fetched in bulk.
    if (isParentNode(nodeExecution)) {
        return fetchGroupsForParentNodeExecution(
            queryClient,
            nodeExecution,
            config
        );
    }
    // Otherwise, we need to determine the type of the node and
    // recursively fetch NodeExecutions for the corresponding Workflow
    // or Task executions.
    if (
        workflowNodeMetadata &&
        !isEqual(workflowNodeMetadata.executionId, nodeExecution.id.executionId)
    ) {
        return fetchGroupsForWorkflowExecutionNode(
            queryClient,
            nodeExecution,
            config
        );
    }
    return fetchGroupsForTaskExecutionNode(queryClient, nodeExecution, config);
}

/** Fetches and groups `NodeExecution`s which are direct children of the given
 * `NodeExecution`.
 */
export function useChildNodeExecutionGroupsQuery(
    nodeExecution: NodeExecution,
    config: RequestConfig
): QueryObserverResult<NodeExecutionGroup[], Error> {
    const queryClient = useQueryClient();
    // Use cached data if the parent node execution is terminal and all children
    // in all groups are terminal
    const shouldEnableFn = (groups: NodeExecutionGroup[]) => {
        if (!nodeExecutionIsTerminal(nodeExecution)) {
            return true;
        }
        return some(groups, group =>
            some(group.nodeExecutions, ne => !nodeExecutionIsTerminal(ne))
        );
    };

    return useConditionalQuery<NodeExecutionGroup[]>(
        {
            queryKey: [
                QueryType.NodeExecutionChildList,
                nodeExecution.id,
                config
            ],
            queryFn: () =>
                fetchChildNodeExecutionGroups(
                    queryClient,
                    nodeExecution,
                    config
                )
        },
        shouldEnableFn
    );
}