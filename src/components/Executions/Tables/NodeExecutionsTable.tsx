import * as classnames from 'classnames';
import { getCacheKey } from 'components/Cache';
import { DetailsPanel } from 'components/common';
import { useCommonStyles } from 'components/common/styles';
import { WaitForQuery } from 'components/common/WaitForQuery';
import * as scrollbarSize from 'dom-helpers/util/scrollbarSize';
import { NodeExecution, NodeExecutionIdentifier } from 'models/Execution/types';
import * as React from 'react';
import { useQuery } from 'react-query';
import { NodeExecutionDetailsPanelContent } from '../ExecutionDetails/NodeExecutionDetailsPanelContent';
import { makeNodeExecutionQuery } from '../nodeExecutionQueries';
import { NodeExecutionsTableContext } from './contexts';
import { ExecutionsTableHeader } from './ExecutionsTableHeader';
import { generateColumns } from './nodeExecutionColumns';
import { NodeExecutionRow } from './NodeExecutionRow';
import { NoExecutionsContent } from './NoExecutionsContent';
import { useColumnStyles, useExecutionTableStyles } from './styles';

export interface NodeExecutionsTableProps {
    nodeExecutions: NodeExecution[];
}

const scrollbarPadding = scrollbarSize();

/** Renders a table of NodeExecution records. Executions with errors will
 * have an expanadable container rendered as part of the table row.
 * NodeExecutions are expandable and will potentially render a list of child
 * TaskExecutions
 */
export const NodeExecutionsTable: React.FC<NodeExecutionsTableProps> = ({
    nodeExecutions
}) => {
    const [
        selectedExecution,
        setSelectedExecution
    ] = React.useState<NodeExecutionIdentifier | null>(null);
    const commonStyles = useCommonStyles();
    const tableStyles = useExecutionTableStyles();

    // TODO: Consider adding cacheKey to NodeExecution (and all other items when they are returned from the API)
    const executionsWithKeys = React.useMemo(
        () =>
            nodeExecutions.map(nodeExecution => ({
                nodeExecution,
                cacheKey: getCacheKey(nodeExecution.id)
            })),
        [nodeExecutions]
    );

    const columnStyles = useColumnStyles();
    // Memoizing columns so they won't be re-generated unless the styles change
    const columns = React.useMemo(() => generateColumns(columnStyles), [
        columnStyles
    ]);
    const tableContext = React.useMemo(
        () => ({ columns, state: { selectedExecution, setSelectedExecution } }),
        [columns, selectedExecution, setSelectedExecution]
    );

    const onCloseDetailsPanel = () => setSelectedExecution(null);

    const rowProps = {
        selectedExecution,
        setSelectedExecution,
        onHeightChange: () => {}
    };
    const content =
        executionsWithKeys.length > 0 ? (
            executionsWithKeys.map(({ nodeExecution, cacheKey }, index) => {
                return (
                    <NodeExecutionRow
                        {...rowProps}
                        index={index}
                        key={cacheKey}
                        execution={nodeExecution}
                    />
                );
            })
        ) : (
            <NoExecutionsContent size="large" />
        );

    return (
        <div
            className={classnames(
                tableStyles.tableContainer,
                commonStyles.flexFill
            )}
        >
            <ExecutionsTableHeader
                columns={columns}
                scrollbarPadding={scrollbarPadding}
            />
            <NodeExecutionsTableContext.Provider value={tableContext}>
                <div className={tableStyles.scrollContainer}>{content}</div>
            </NodeExecutionsTableContext.Provider>
            <DetailsPanel
                open={selectedExecution !== null}
                onClose={onCloseDetailsPanel}
            >
                {selectedExecution != null ? (
                    <NodeExecutionDetailsPanelContent
                        onClose={onCloseDetailsPanel}
                        nodeExecutionId={selectedExecution}
                    />
                ) : null}
            </DetailsPanel>
        </div>
    );
};
