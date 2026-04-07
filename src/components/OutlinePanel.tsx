import { getHiddenClassIdSet } from '../lib/layout';
import type { OntologyDocument, PersistedViewerState } from '../types/ontology';

interface OutlinePanelProps {
  ontology: OntologyDocument;
  visualState: PersistedViewerState;
  onSelectClass: (classId: string) => void;
}

export function OutlinePanel({ ontology, visualState, onSelectClass }: OutlinePanelProps) {
  const hiddenSet = getHiddenClassIdSet(visualState);
  const visibleClasses = Object.values(ontology.classes)
    .filter((entry) => !hiddenSet.has(entry.id))
    .sort((left, right) => left.label.localeCompare(right.label));

  return (
    <aside className="outline-panel panel">
      <div className="panel__header">
        <h2>Classes</h2>
        <span>{visibleClasses.length}</span>
      </div>
      <div className="outline-list">
        {visibleClasses.map((entry) => {
          const selected = entry.id === visualState.selectedClassId;
          const nodeState = visualState.nodeStates[entry.id];

          return (
            <button
              key={entry.id}
              className={selected ? 'outline-item is-selected' : 'outline-item'}
              onClick={() => onSelectClass(entry.id)}
            >
              <span className="outline-item__swatch" style={{ background: nodeState?.color || '#1c7c72' }} />
              <span className="outline-item__text">
                <strong>{entry.label}</strong>
                <small>
                  {entry.restrictions.length > 0 || entry.anonymousExpressions.length > 0
                    ? `${entry.localName} · ${entry.restrictions.length} rules · ${entry.anonymousExpressions.length} expr`
                    : entry.localName}
                </small>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}