import { useEffect, useMemo } from 'react';
import { GraphCanvas } from './components/GraphCanvas';
import { GroupedView } from './components/GroupedView';
import { HierarchyView } from './components/HierarchyView';
import { InspectorPanel } from './components/InspectorPanel';
import { OutlinePanel } from './components/OutlinePanel';
import { TopBar } from './components/TopBar';
import {
  applySearchFilter,
  buildGraphModel,
  buildGroupedColumns,
  countVisibleMatches,
  exportableLayoutState,
  resetGraphPositions,
  summarizeOntology,
} from './lib/layout';
import { useViewerStore } from './state/useViewerStore';

export default function App() {
  const {
    ontology,
    visualState,
    loading,
    error,
    initialize,
    importOntology,
    selectClass,
    setSearchQuery,
    setViewMode,
    updateNodeState,
    updateEdgeState,
    setViewport,
    setLayoutSettings,
    upsertGroup,
    assignGroupToSelected,
    hideClass,
    restoreClass,
    hideBranch,
    restoreAllHiddenClasses,
    importLayout,
    replaceVisualState,
  } = useViewerStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const graph = useMemo(() => {
    if (!ontology || !visualState) {
      return { nodes: [], edges: [], hiddenEdgeCount: 0 };
    }
    return buildGraphModel(ontology, visualState);
  }, [ontology, visualState]);

  const groupedColumns = useMemo(() => {
    if (!ontology || !visualState) {
      return [];
    }
    return buildGroupedColumns(ontology, visualState);
  }, [ontology, visualState]);

  if (loading || !ontology || !visualState) {
    return <main className="loading-screen">Loading ontology workspace…</main>;
  }

  const stats = summarizeOntology(ontology);
  const visibleCount = countVisibleMatches(ontology, visualState.searchQuery);

  return (
    <main className="app-shell">
      <TopBar
        ontology={ontology}
        visualState={visualState}
        onImportOntology={(files) => void importOntology(files)}
        onImportLayout={importLayout}
        onSearch={setSearchQuery}
        onViewModeChange={setViewMode}
        onLayoutChange={(patch) => setLayoutSettings(patch)}
      />

      <section className="status-strip">
        <div>
          <strong>{stats.classCount}</strong>
          <span>classes</span>
        </div>
        <div>
          <strong>{stats.relationCount}</strong>
          <span>relations</span>
        </div>
        <div>
          <strong>{stats.propertyCount}</strong>
          <span>properties</span>
        </div>
        <div>
          <strong>{stats.sourceFileCount}</strong>
          <span>source files</span>
        </div>
        <div>
          <strong>{stats.resolvedImportCount}</strong>
          <span>resolved imports</span>
        </div>
        <div>
          <strong>{stats.unresolvedImportCount}</strong>
          <span>unresolved imports</span>
        </div>
        <div>
          <strong>{stats.disjointRelationCount}</strong>
          <span>disjoint links</span>
        </div>
        <div>
          <strong>{stats.restrictionCount}</strong>
          <span>restrictions</span>
        </div>
        <div>
          <strong>{stats.anonymousExpressionCount}</strong>
          <span>anonymous expressions</span>
        </div>
        <div>
          <strong>{stats.importCount}</strong>
          <span>imports</span>
        </div>
        <div>
          <strong>{visibleCount}</strong>
          <span>visible after filters</span>
        </div>
        <div>
          <button
            className="button button--quiet"
            onClick={() => {
              replaceVisualState((current) => applySearchFilter(ontology, resetGraphPositions(current, ontology, current.layoutSettings)));
            }}
          >
            Reset Graph Positions
          </button>
        </div>
      </section>

      {error ? <section className="error-banner">{error}</section> : null}

      <section className="workspace-grid">
        <OutlinePanel ontology={ontology} visualState={visualState} onSelectClass={selectClass} />

        <section className="workspace-main">
          {visualState.viewMode === 'graph' ? (
            <GraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              hiddenEdgeCount={graph.hiddenEdgeCount}
              visualState={visualState}
              activeViewMode={visualState.viewMode}
              hiddenClasses={visualState.hiddenClassIds.map((classId) => ({ id: classId, label: ontology.classes[classId]?.label || classId }))}
              selectedClassId={visualState.selectedClassId}
              onSelectClass={selectClass}
              onMoveNode={(classId, position) => updateNodeState(classId, { position, pinned: true })}
              onViewModeChange={setViewMode}
              onLayoutChange={setLayoutSettings}
              onUpdateNodeState={updateNodeState}
              onUpdateEdgeState={updateEdgeState}
              onHideClass={hideClass}
              onHideBranch={hideBranch}
              onRestoreClass={restoreClass}
              onRestoreAllHidden={restoreAllHiddenClasses}
              onViewportChange={setViewport}
            />
          ) : null}

          {visualState.viewMode === 'grouped' ? (
            <GroupedView ontology={ontology} groups={groupedColumns} visualState={visualState} onSelectClass={selectClass} />
          ) : null}

          {visualState.viewMode === 'hierarchy' ? (
            <HierarchyView
              ontology={ontology}
              visualState={visualState}
              onSelectClass={selectClass}
              onToggleCollapse={(classId) => {
                const current = visualState.nodeStates[classId];
                updateNodeState(classId, { collapsedInHierarchy: !(current?.collapsedInHierarchy ?? false) });
              }}
            />
          ) : null}

          {ontology.diagnostics.length > 0 ? (
            <section className="diagnostics panel">
              <div className="panel__header">
                <h2>Diagnostics</h2>
                <span>{ontology.diagnostics.length}</span>
              </div>
              <ul className="diagnostic-list">
                {ontology.diagnostics.map((diagnostic) => (
                  <li key={`${diagnostic.level}:${diagnostic.message}`} className={`diagnostic diagnostic--${diagnostic.level}`}>
                    <strong>{diagnostic.level}</strong>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>

        <InspectorPanel
          ontology={ontology}
          visualState={exportableLayoutState(visualState)}
          onUpdateNodeState={(classId, patch) => updateNodeState(classId, patch)}
          onUpsertGroup={upsertGroup}
          onAssignGroup={assignGroupToSelected}
        />
      </section>
    </main>
  );
}