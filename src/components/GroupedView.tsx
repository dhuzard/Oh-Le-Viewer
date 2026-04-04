import type { OntologyDocument, PersistedViewerState } from '../types/ontology';

interface GroupedViewProps {
  ontology: OntologyDocument;
  groups: Array<{ groupId: string; label: string; color: string; classIds: string[] }>;
  visualState: PersistedViewerState;
  onSelectClass: (classId: string) => void;
}

export function GroupedView({ ontology, groups, visualState, onSelectClass }: GroupedViewProps) {
  return (
    <section className="grouped-panel panel">
      <div className="panel__header">
        <h2>Grouped View</h2>
        <span>{groups.length} groups</span>
      </div>

      <div className="group-columns">
        {groups.map((group) => (
          <div key={group.groupId} className="group-column" style={{ borderColor: group.color }}>
            <header className="group-column__header" style={{ background: `${group.color}1f` }}>
              <strong>{group.label}</strong>
              <span>{group.classIds.length}</span>
            </header>
            <div className="group-column__body">
              {group.classIds.map((classId) => {
                const ontologyClass = ontology.classes[classId];
                if (!ontologyClass) {
                  return null;
                }

                const selected = visualState.selectedClassId === classId;

                return (
                  <button
                    key={classId}
                    className={selected ? 'group-class is-selected' : 'group-class'}
                    onClick={() => onSelectClass(classId)}
                  >
                    <strong>{ontologyClass.label}</strong>
                    <small>
                      {ontologyClass.dataPropertyIds.length} data · {ontologyClass.objectPropertyIds.length} object
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}