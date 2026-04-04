import { useMemo, useState } from 'react';
import { ensureNodeState } from '../lib/layout';
import type { OntologyDocument, PersistedViewerState, VisualGroup } from '../types/ontology';

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

interface InspectorPanelProps {
  ontology: OntologyDocument;
  visualState: PersistedViewerState;
  onUpdateNodeState: (classId: string, patch: Partial<PersistedViewerState['nodeStates'][string]>) => void;
  onUpsertGroup: (group: VisualGroup) => void;
  onAssignGroup: (groupId: string | null) => void;
}

export function InspectorPanel({ ontology, visualState, onUpdateNodeState, onUpsertGroup, onAssignGroup }: InspectorPanelProps) {
  const selectedClass = visualState.selectedClassId ? ontology.classes[visualState.selectedClassId] : null;
  const disjointClasses = useMemo(() => {
    if (!selectedClass) {
      return [];
    }

    return ontology.relations
      .filter((relation) => relation.type === 'disjoint' && (relation.source === selectedClass.id || relation.target === selectedClass.id))
      .map((relation) => {
        const otherId = relation.source === selectedClass.id ? relation.target : relation.source;
        return ontology.classes[otherId];
      })
      .filter(isDefined);
  }, [ontology, selectedClass]);
  const nodeState = useMemo(() => {
    if (!selectedClass) {
      return null;
    }
    return ensureNodeState(visualState, selectedClass.id);
  }, [selectedClass, visualState]);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  return (
    <aside className="inspector panel">
      <div className="panel__header">
        <h2>Inspector</h2>
        <span>{selectedClass ? 'Class selected' : 'No selection'}</span>
      </div>

      {!selectedClass || !nodeState ? (
        <div className="empty-state">
          <p>Select a class to tune color, group, detail visibility, and hierarchy behavior.</p>
        </div>
      ) : (
        <div className="inspector__content">
          <section className="inspector-card">
            <h3>{selectedClass.label}</h3>
            <p>{selectedClass.comment || 'No comment available for this class.'}</p>
            <dl>
              <div>
                <dt>IRI</dt>
                <dd>{selectedClass.iri}</dd>
              </div>
              <div>
                <dt>Data properties</dt>
                <dd>{selectedClass.dataPropertyIds.length}</dd>
              </div>
              <div>
                <dt>Object properties</dt>
                <dd>{selectedClass.objectPropertyIds.length}</dd>
              </div>
              <div>
                <dt>Restrictions</dt>
                <dd>{selectedClass.restrictions.length}</dd>
              </div>
              <div>
                <dt>Anonymous expressions</dt>
                <dd>{selectedClass.anonymousExpressions.length}</dd>
              </div>
              <div>
                <dt>Disjoint classes</dt>
                <dd>{disjointClasses.length}</dd>
              </div>
            </dl>
          </section>

          {ontology.importResolutions.length > 0 ? (
            <section className="inspector-card">
              <h3>Imports</h3>
              <ul className="annotation-list">
                {ontology.importResolutions.map((entry) => (
                  <li key={entry.iri}>
                    <strong>{entry.resolved ? 'Resolved' : 'Unresolved'}</strong>
                    <span>
                      {entry.iri}
                      {entry.sourceFile ? ` -> ${entry.sourceFile}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="inspector-card">
            <h3>Visual behavior</h3>
            <label>
              <span>Node color</span>
              <input
                type="color"
                value={nodeState.color}
                onChange={(event) => onUpdateNodeState(selectedClass.id, { color: event.target.value })}
              />
            </label>
            <label>
              <span>Detail mode</span>
              <select
                value={nodeState.detailMode}
                onChange={(event) => onUpdateNodeState(selectedClass.id, { detailMode: event.target.value as 'compact' | 'detail' })}
              >
                <option value="compact">Compact</option>
                <option value="detail">Detailed</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={nodeState.expanded}
                onChange={(event) => onUpdateNodeState(selectedClass.id, { expanded: event.target.checked })}
              />
              <span>Show properties in detailed views</span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={nodeState.collapsedInHierarchy}
                onChange={(event) => onUpdateNodeState(selectedClass.id, { collapsedInHierarchy: event.target.checked })}
              />
              <span>Collapse this branch in hierarchy mode</span>
            </label>
          </section>

          <section className="inspector-card">
            <h3>Grouping</h3>
            <label>
              <span>Assigned group</span>
              <select value={nodeState.groupId || ''} onChange={(event) => onAssignGroup(event.target.value || null)}>
                <option value="">Ungrouped</option>
                {visualState.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="create-group-row">
              <input value={newGroupLabel} onChange={(event) => setNewGroupLabel(event.target.value)} placeholder="Create visual group" />
              <button
                className="button"
                onClick={() => {
                  const trimmed = newGroupLabel.trim();
                  if (!trimmed) {
                    return;
                  }
                  const groupId = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                  onUpsertGroup({ id: groupId, label: trimmed, color: nodeState.color });
                  onAssignGroup(groupId);
                  setNewGroupLabel('');
                }}
              >
                Save Group
              </button>
            </div>
          </section>

          <section className="inspector-card">
            <h3>Properties</h3>
            <ul className="chip-list">
              {selectedClass.dataPropertyIds.length === 0 && selectedClass.objectPropertyIds.length === 0 ? (
                <li>No attached properties</li>
              ) : null}
              {selectedClass.dataPropertyIds.map((propertyId) => (
                <li key={propertyId}>Data: {ontology.properties[propertyId]?.label || propertyId}</li>
              ))}
              {selectedClass.objectPropertyIds.map((propertyId) => (
                <li key={propertyId}>Object: {ontology.properties[propertyId]?.label || propertyId}</li>
              ))}
            </ul>
          </section>

          <section className="inspector-card">
            <h3>Restrictions</h3>
            <ul className="annotation-list">
              {selectedClass.restrictions.length === 0 ? <li>No class restrictions discovered.</li> : null}
              {selectedClass.restrictions.map((restriction) => (
                <li key={restriction.id}>
                  <strong>{restriction.onPropertyLabel}</strong>
                  <span>
                    {restriction.kind}
                    {restriction.targetLabel ? ` ${restriction.targetLabel}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="inspector-card">
            <h3>Anonymous class expressions</h3>
            <ul className="annotation-list">
              {selectedClass.anonymousExpressions.length === 0 ? <li>No broader anonymous expressions discovered.</li> : null}
              {selectedClass.anonymousExpressions.map((expression) => (
                <li key={expression.id}>
                  <strong>{expression.kind}</strong>
                  <span>{expression.summary}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="inspector-card">
            <h3>Disjoint classes</h3>
            <ul className="annotation-list">
              {disjointClasses.length === 0 ? <li>No disjoint-class relations discovered.</li> : null}
              {disjointClasses.map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.label}</strong>
                  <span>{entry.iri}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="inspector-card">
            <h3>Annotations</h3>
            <ul className="annotation-list">
              {selectedClass.annotations.length === 0 ? <li>No extra annotations.</li> : null}
              {selectedClass.annotations.map((annotation) => (
                <li key={`${annotation.property}:${annotation.value}`}>
                  <strong>{annotation.property}</strong>
                  <span>{annotation.value}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </aside>
  );
}