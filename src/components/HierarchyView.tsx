import { buildHierarchyRows } from '../lib/layout';
import type { OntologyDocument, PersistedViewerState } from '../types/ontology';

interface HierarchyViewProps {
  ontology: OntologyDocument;
  visualState: PersistedViewerState;
  onSelectClass: (classId: string) => void;
  onToggleCollapse: (classId: string) => void;
}

export function HierarchyView({ ontology, visualState, onSelectClass, onToggleCollapse }: HierarchyViewProps) {
  const rows = buildHierarchyRows(ontology, visualState);

  return (
    <section className="hierarchy-panel panel">
      <div className="panel__header">
        <h2>Hierarchy View</h2>
        <span>{rows.length} visible rows</span>
      </div>

      <div className="hierarchy-list">
        {rows.map((row) => {
          const ontologyClass = ontology.classes[row.id];
          if (!ontologyClass) {
            return null;
          }

          const nodeState = visualState.nodeStates[row.id];
          const selected = visualState.selectedClassId === row.id;

          return (
            <div
              key={row.id}
              className={selected ? 'hierarchy-row is-selected' : 'hierarchy-row'}
              style={{ paddingLeft: 18 + row.depth * visualState.layoutSettings.indentation }}
            >
              <button className="hierarchy-row__toggle" onClick={() => onToggleCollapse(row.id)} disabled={!row.hasChildren}>
                {row.hasChildren ? (nodeState?.collapsedInHierarchy ? '+' : '−') : '·'}
              </button>
              <button className="hierarchy-row__label" onClick={() => onSelectClass(row.id)}>
                <span>{ontologyClass.label}</span>
                <small>{row.descendantCount} descendants</small>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}