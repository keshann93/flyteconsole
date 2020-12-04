import {
    fireEvent,
    getAllByRole,
    getByText,
    getByTitle,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { getCacheKey } from 'components/Cache';
import { mockAPIContextValue } from 'components/data/__mocks__/apiContext';
import { APIContext, APIContextValue } from 'components/data/apiContext';
import { createQueryClient } from 'components/data/queryCache';
import { createMockExecutionEntities } from 'components/Executions/__mocks__/createMockExecutionEntities';
import { cacheStatusMessages } from 'components/Executions/constants';
import {
    ExecutionContext,
    ExecutionContextData,
    NodeExecutionsRequestConfigContext
} from 'components/Executions/contexts';
import { fetchStates } from 'components/hooks';
import { Core } from 'flyteidl';
import { cloneDeep, isEqual } from 'lodash';
import {
    CompiledNode,
    Execution,
    FilterOperationName,
    getTask,
    getWorkflow,
    NodeExecution,
    nodeExecutionQueryParams,
    RequestConfig,
    TaskExecution,
    TaskNodeMetadata,
    Workflow,
    WorkflowExecutionIdentifier
} from 'models';
import { createMockExecution } from 'models/__mocks__/executionsData';
import {
    createMockTaskExecutionForNodeExecution,
    createMockTaskExecutionsListResponse,
    mockExecution as mockTaskExecution
} from 'models/Execution/__mocks__/mockTaskExecutionsData';
import {
    getExecution,
    listNodeExecutions,
    listTaskExecutionChildren,
    listTaskExecutions
} from 'models/Execution/api';
import { NodeExecutionPhase } from 'models/Execution/enums';
import { mockTasks } from 'models/Task/__mocks__/mockTaskData';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { makeIdentifier } from 'test/modelUtils';
import { obj } from 'test/utils';
import { Identifier } from 'typescript';
import { State } from 'xstate';
import { titleStrings } from '../constants';
import {
    NodeExecutionsTable,
    NodeExecutionsTableProps
} from '../NodeExecutionsTable';

// TODO: Update this to use MSW to provide entities and re-enable tests
describe.skip('NodeExecutionsTable', () => {
    let nodeExecutions: NodeExecution[];
    let queryClient: QueryClient;
    let executionContext: ExecutionContextData;
    let requestConfig: RequestConfig;

    beforeEach(async () => {
        nodeExecutions = [];
        requestConfig = {};
        queryClient = createQueryClient();

        executionContext = {
            execution: createMockExecution()
        };
    });

    const Table = (props: NodeExecutionsTableProps) => (
        <QueryClientProvider client={queryClient}>
            <NodeExecutionsRequestConfigContext.Provider value={requestConfig}>
                <ExecutionContext.Provider value={executionContext}>
                    <NodeExecutionsTable {...props} />
                </ExecutionContext.Provider>
            </NodeExecutionsRequestConfigContext.Provider>
        </QueryClientProvider>
    );

    const getProps = async () =>
        ({
            nodeExecutions
        } as NodeExecutionsTableProps);

    const renderTable = async () => {
        return render(<Table {...await getProps()} />);
    };

    // it('renders task name for task nodes', async () => {
    //     const { queryAllByText, getAllByRole } = await renderTable();
    //     await waitFor(() => getAllByRole('listitem').length > 0);

    //     const node = dataCache.getNodeForNodeExecution(mockNodeExecutions[0]);
    //     const taskId = node?.node.taskNode?.referenceId;
    //     expect(taskId).toBeDefined();
    //     const task = dataCache.getTaskTemplate(taskId!);
    //     expect(task).toBeDefined();
    //     expect(queryAllByText(task!.id.name)[0]).toBeInTheDocument();
    // });

    // describe('for nodes with children', () => {
    //     let parentNodeExecution: NodeExecution;
    //     let childNodeExecutions: NodeExecution[];
    //     beforeEach(() => {
    //         parentNodeExecution = mockNodeExecutions[0];
    //     });

    //     const expandParentNode = async (container: HTMLElement) => {
    //         const expander = await waitFor(() =>
    //             getByTitle(container, titleStrings.expandRow)
    //         );
    //         fireEvent.click(expander);
    //         return await waitFor(() => getAllByRole(container, 'list'));
    //     };

    //     describe('with isParentNode flag', () => {
    //         beforeEach(() => {
    //             const id = parentNodeExecution.id;
    //             const { nodeId } = id;
    //             childNodeExecutions = [
    //                 {
    //                     ...parentNodeExecution,
    //                     id: { ...id, nodeId: `${nodeId}-child1` },
    //                     metadata: { retryGroup: '0', specNodeId: nodeId }
    //                 },
    //                 {
    //                     ...parentNodeExecution,
    //                     id: { ...id, nodeId: `${nodeId}-child2` },
    //                     metadata: { retryGroup: '0', specNodeId: nodeId }
    //                 },
    //                 {
    //                     ...parentNodeExecution,
    //                     id: { ...id, nodeId: `${nodeId}-child1` },
    //                     metadata: { retryGroup: '1', specNodeId: nodeId }
    //                 },
    //                 {
    //                     ...parentNodeExecution,
    //                     id: { ...id, nodeId: `${nodeId}-child2` },
    //                     metadata: { retryGroup: '1', specNodeId: nodeId }
    //                 }
    //             ];
    //             mockNodeExecutions[0].metadata = { isParentNode: true };
    //             setExecutionChildren(
    //                 {
    //                     id: mockExecution.id,
    //                     parentNodeId: parentNodeExecution.id.nodeId
    //                 },
    //                 childNodeExecutions
    //             );
    //         });

    //         it('correctly fetches children', async () => {
    //             const { getByText } = await renderTable();
    //             await waitFor(() => getByText(mockNodeExecutions[0].id.nodeId));
    //             expect(mockListNodeExecutions).toHaveBeenCalledWith(
    //                 expect.anything(),
    //                 expect.objectContaining({
    //                     params: {
    //                         [nodeExecutionQueryParams.parentNodeId]:
    //                             parentNodeExecution.id.nodeId
    //                     }
    //                 })
    //             );
    //             expect(mockListTaskExecutionChildren).not.toHaveBeenCalled();
    //         });

    //         it('does not fetch children if flag is false', async () => {
    //             mockNodeExecutions[0].metadata = { isParentNode: false };
    //             const { getByText } = await renderTable();
    //             await waitFor(() => getByText(mockNodeExecutions[0].id.nodeId));
    //             expect(mockListNodeExecutions).not.toHaveBeenCalledWith(
    //                 expect.anything(),
    //                 expect.objectContaining({
    //                     params: {
    //                         [nodeExecutionQueryParams.parentNodeId]:
    //                             parentNodeExecution.id.nodeId
    //                     }
    //                 })
    //             );
    //             expect(mockListTaskExecutionChildren).not.toHaveBeenCalled();
    //         });

    //         it('correctly renders groups', async () => {
    //             const { container } = await renderTable();
    //             const childGroups = await expandParentNode(container);
    //             expect(childGroups).toHaveLength(2);
    //         });
    //     });

    //     describe('without isParentNode flag, using taskNodeMetadata ', () => {
    //         let taskExecutions: TaskExecution[];
    //         beforeEach(() => {
    //             taskExecutions = [0, 1].map(retryAttempt =>
    //                 createMockTaskExecutionForNodeExecution(
    //                     parentNodeExecution.id,
    //                     mockNodes[0],
    //                     retryAttempt,
    //                     { isParent: true }
    //                 )
    //             );
    //             childNodeExecutions = [
    //                 {
    //                     ...parentNodeExecution
    //                 }
    //             ];
    //             mockNodeExecutions = mockNodeExecutions.slice(0, 1);
    //             mockListTaskExecutions.mockImplementation(async id => {
    //                 const entities =
    //                     id.nodeId === parentNodeExecution.id.nodeId
    //                         ? taskExecutions
    //                         : [];
    //                 return { entities };
    //             });
    //             mockListTaskExecutionChildren.mockResolvedValue({
    //                 entities: childNodeExecutions
    //             });
    //         });

    //         it('correctly fetches children', async () => {
    //             const { getByText } = await renderTable();
    //             await waitFor(() => getByText(mockNodeExecutions[0].id.nodeId));
    //             expect(mockListNodeExecutions).not.toHaveBeenCalledWith(
    //                 expect.anything(),
    //                 expect.objectContaining({
    //                     params: {
    //                         [nodeExecutionQueryParams.parentNodeId]:
    //                             parentNodeExecution.id.nodeId
    //                     }
    //                 })
    //             );
    //             expect(mockListTaskExecutionChildren).toHaveBeenCalledWith(
    //                 expect.objectContaining(taskExecutions[0].id),
    //                 expect.anything()
    //             );
    //         });

    //         it('correctly renders groups', async () => {
    //             // We returned two task execution attempts, each with children
    //             const { container } = await renderTable();
    //             const childGroups = await expandParentNode(container);
    //             expect(childGroups).toHaveLength(2);
    //         });
    //     });

    //     describe('without isParentNode flag, using workflowNodeMetadata', () => {
    //         let childExecution: Execution;
    //         let childNodeExecutions: NodeExecution[];
    //         beforeEach(() => {
    //             childExecution = cloneDeep(executionContext.execution);
    //             childExecution.id.name = 'childExecution';
    //             dataCache.insertExecution(childExecution);
    //             dataCache.insertWorkflowExecutionReference(
    //                 childExecution.id,
    //                 mockWorkflow.id
    //             );

    //             childNodeExecutions = cloneDeep(mockNodeExecutions);
    //             childNodeExecutions.forEach(
    //                 ne => (ne.id.executionId = childExecution.id)
    //             );
    //             mockNodeExecutions[0].closure.workflowNodeMetadata = {
    //                 executionId: childExecution.id
    //             };
    //             mockGetExecution.mockImplementation(async id => {
    //                 if (isEqual(id, childExecution.id)) {
    //                     return childExecution;
    //                 }
    //                 if (isEqual(id, mockExecution.id)) {
    //                     return mockExecution;
    //                 }

    //                 throw new Error(
    //                     `Unexpected call to getExecution with execution id: ${obj(
    //                         id
    //                     )}`
    //                 );
    //             });
    //             setExecutionChildren(
    //                 { id: childExecution.id },
    //                 childNodeExecutions
    //             );
    //         });

    //         it('correctly fetches children', async () => {
    //             const { getByText } = await renderTable();
    //             await waitFor(() => getByText(mockNodeExecutions[0].id.nodeId));
    //             expect(mockListNodeExecutions).toHaveBeenCalledWith(
    //                 expect.objectContaining({ name: childExecution.id.name }),
    //                 expect.anything()
    //             );
    //         });

    //         it('correctly renders groups', async () => {
    //             // We returned a single WF execution child, so there should only
    //             // be one child group
    //             const { container } = await renderTable();
    //             const childGroups = await expandParentNode(container);
    //             expect(childGroups).toHaveLength(1);
    //         });
    //     });
    // });

    // it('requests child node executions using configuration from context', async () => {
    //     const { taskExecutions } = createMockTaskExecutionsListResponse(1);
    //     taskExecutions[0].isParent = true;
    //     mockListTaskExecutions.mockResolvedValue({ entities: taskExecutions });
    //     requestConfig.filter = [
    //         { key: 'test', operation: FilterOperationName.EQ, value: 'test' }
    //     ];

    //     await renderTable();
    //     await waitFor(() =>
    //         expect(mockListTaskExecutionChildren).toHaveBeenCalled()
    //     );

    //     expect(mockListTaskExecutionChildren).toHaveBeenCalledWith(
    //         taskExecutions[0].id,
    //         expect.objectContaining(requestConfig)
    //     );
    // });

    // describe('for task nodes with cache status', () => {
    //     let taskNodeMetadata: TaskNodeMetadata;
    //     let cachedNodeExecution: NodeExecution;
    //     beforeEach(() => {
    //         cachedNodeExecution = mockNodeExecutions[0];
    //         taskNodeMetadata = {
    //             cacheStatus: Core.CatalogCacheStatus.CACHE_MISS,
    //             catalogKey: {
    //                 datasetId: makeIdentifier({
    //                     resourceType: Core.ResourceType.DATASET
    //                 }),
    //                 sourceTaskExecution: { ...mockTaskExecution.id }
    //             }
    //         };
    //         cachedNodeExecution.closure.taskNodeMetadata = taskNodeMetadata;
    //     });

    //     [
    //         Core.CatalogCacheStatus.CACHE_HIT,
    //         Core.CatalogCacheStatus.CACHE_LOOKUP_FAILURE,
    //         Core.CatalogCacheStatus.CACHE_POPULATED,
    //         Core.CatalogCacheStatus.CACHE_PUT_FAILURE
    //     ].forEach(cacheStatusValue =>
    //         it(`renders correct icon for ${Core.CatalogCacheStatus[cacheStatusValue]}`, async () => {
    //             taskNodeMetadata.cacheStatus = cacheStatusValue;
    //             const { getByTitle } = await renderTable();
    //             await waitFor(() =>
    //                 getByTitle(cacheStatusMessages[cacheStatusValue])
    //             );
    //         })
    //     );

    //     [
    //         Core.CatalogCacheStatus.CACHE_DISABLED,
    //         Core.CatalogCacheStatus.CACHE_MISS
    //     ].forEach(cacheStatusValue =>
    //         it(`renders no icon for ${Core.CatalogCacheStatus[cacheStatusValue]}`, async () => {
    //             taskNodeMetadata.cacheStatus = cacheStatusValue;
    //             const { getByText, queryByTitle } = await renderTable();
    //             await waitFor(() => getByText(cachedNodeExecution.id.nodeId));
    //             expect(
    //                 queryByTitle(cacheStatusMessages[cacheStatusValue])
    //             ).toBeNull();
    //         })
    //     );
    // });

    // describe('when rendering the DetailsPanel', () => {
    //     beforeEach(() => {
    //         jest.useFakeTimers();
    //     });
    //     afterEach(() => {
    //         jest.clearAllTimers();
    //         jest.useRealTimers();
    //     });

    //     const selectFirstNode = async (container: HTMLElement) => {
    //         const { nodeId } = mockNodeExecutions[0].id;
    //         const nodeNameAnchor = await waitFor(() =>
    //             getByText(container, nodeId)
    //         );
    //         fireEvent.click(nodeNameAnchor);
    //         // Wait for Details Panel to render and then for the nodeId header
    //         const detailsPanel = await waitFor(() =>
    //             screen.getByTestId('details-panel')
    //         );
    //         await waitFor(() => getByText(detailsPanel, nodeId));
    //         return detailsPanel;
    //     };

    //     it('should render updated state if selected nodeExecution object changes', async () => {
    //         mockNodeExecutions[0].closure.phase = NodeExecutionPhase.RUNNING;
    //         // Render table, click first node
    //         const { container, rerender } = await renderTable();
    //         const detailsPanel = await selectFirstNode(container);
    //         await waitFor(() => getByText(detailsPanel, 'Running'));

    //         mockNodeExecutions = cloneDeep(mockNodeExecutions);
    //         mockNodeExecutions[0].closure.phase = NodeExecutionPhase.FAILED;
    //         setExecutionChildren({ id: mockExecution.id }, mockNodeExecutions);

    //         rerender(<Table {...await getProps()} />);
    //         await waitFor(() => getByText(detailsPanel, 'Failed'));
    //     });

    //     describe('with child executions', () => {
    //         let parentNodeExecution: NodeExecution;
    //         let childNodeExecutions: NodeExecution[];
    //         beforeEach(() => {
    //             parentNodeExecution = mockNodeExecutions[0];
    //             const id = parentNodeExecution.id;
    //             const { nodeId } = id;
    //             childNodeExecutions = [
    //                 {
    //                     ...parentNodeExecution,
    //                     id: { ...id, nodeId: `${nodeId}-child1` },
    //                     metadata: { retryGroup: '0', specNodeId: nodeId }
    //                 }
    //             ];
    //             mockNodeExecutions[0].metadata = { isParentNode: true };
    //             setExecutionChildren(
    //                 {
    //                     id: mockExecution.id,
    //                     parentNodeId: parentNodeExecution.id.nodeId
    //                 },
    //                 childNodeExecutions
    //             );
    //         });

    //         it('should correctly render details for nested executions', async () => {
    //             const { container } = await renderTable();
    //             const expander = await waitFor(() =>
    //                 getByTitle(container, titleStrings.expandRow)
    //             );
    //             fireEvent.click(expander);
    //             const { nodeId } = childNodeExecutions[0].id;
    //             const nodeNameAnchor = await waitFor(() =>
    //                 getByText(container, nodeId)
    //             );
    //             fireEvent.click(nodeNameAnchor);
    //             // Wait for Details Panel to render and then for the nodeId header
    //             const detailsPanel = await waitFor(() =>
    //                 screen.getByTestId('details-panel')
    //             );
    //             await waitFor(() => getByText(detailsPanel, nodeId));
    //         });
    //     });
    // });
});
