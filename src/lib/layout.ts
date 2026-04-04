import type {
  GraphModel,
  GraphEdge,
  GraphNode,
  LayoutSettings,
  OntologyDocument,
  PersistedViewerState,
} from '../types/ontology';

const MAX_VISIBLE_GRAPH_EDGES = 320;

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function orderByLabel<T extends { label: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.label.localeCompare(right.label));
}

export function buildGraphModel(
  ontology: OntologyDocument,
  visualState: PersistedViewerState,
): GraphModel {
  const subclassParents = new Map<string, string[]>();
  const subclassChildren = new Map<string, string[]>();

  for (const relation of ontology.relations) {
    if (relation.type !== 'subclass') {
      continue;
    }

    const existingParents = subclassParents.get(relation.source) || [];
    existingParents.push(relation.target);
    subclassParents.set(relation.source, existingParents);

    const existingChildren = subclassChildren.get(relation.target) || [];
    existingChildren.push(relation.source);
    subclassChildren.set(relation.target, existingChildren);
  }

  const depthById = new Map<string, number>();
  const queue = orderByLabel(ontology.roots.map((rootId) => ontology.classes[rootId]).filter(isPresent));

  for (const root of queue) {
    depthById.set(root.id, 0);
  }

  const pending = [...queue];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) {
      continue;
    }
    const currentDepth = depthById.get(current.id) || 0;
    const children = orderByLabel((subclassChildren.get(current.id) || []).map((id) => ontology.classes[id]).filter(isPresent));
    for (const child of children) {
      if (!depthById.has(child.id)) {
        depthById.set(child.id, currentDepth + 1);
        pending.push(child);
      }
    }
  }

  const levels = new Map<number, string[]>();
  for (const classId of Object.keys(ontology.classes)) {
    const depth = depthById.get(classId) || 0;
    const list = levels.get(depth) || [];
    list.push(classId);
    levels.set(depth, list);
  }

  const hiddenSet = new Set(visualState.hiddenClassIds);
  const nodes = [...Object.values(ontology.classes)]
    .filter((ontologyClass) => !hiddenSet.has(ontologyClass.id))
    .map((ontologyClass) => {
      const nodeState = visualState.nodeStates[ontologyClass.id];
      const depth = depthById.get(ontologyClass.id) || 0;
      const level = orderByLabel((levels.get(depth) || []).map((id) => ontology.classes[id]).filter(isPresent));
      const index = Math.max(0, level.findIndex((entry) => entry.id === ontologyClass.id));
      const autoX = 240 + depth * visualState.layoutSettings.layerGap;
      const autoY = 120 + index * visualState.layoutSettings.nodeGap;

      return {
        id: ontologyClass.id,
        label: ontologyClass.label,
        groupId: nodeState?.groupId || null,
        color: nodeState?.color || '#1c7c72',
        detailMode: nodeState?.detailMode || 'compact',
        expanded: nodeState?.expanded ?? false,
        x: nodeState?.position?.x ?? autoX,
        y: nodeState?.position?.y ?? autoY,
        parentIds: subclassParents.get(ontologyClass.id) || [],
        childIds: subclassChildren.get(ontologyClass.id) || [],
        dataPropertyCount: ontologyClass.dataPropertyIds.length,
        objectPropertyCount: ontologyClass.objectPropertyIds.length,
        restrictionCount: ontologyClass.restrictions.length + ontologyClass.anonymousExpressions.length,
      } satisfies GraphNode;
    });

  const visibleIds = new Set(nodes.map((node) => node.id));
  const allEdges = ontology.relations
    .filter((relation) => visibleIds.has(relation.source) && visibleIds.has(relation.target))
    .map((relation) => ({
      id: relation.id,
      source: relation.source,
      target: relation.target,
      type: relation.type,
      label: relation.label,
    } satisfies GraphEdge));

  if (allEdges.length <= MAX_VISIBLE_GRAPH_EDGES) {
    return { nodes, edges: allEdges, hiddenEdgeCount: 0 };
  }

  const selectedId = visualState.selectedClassId;
  const prioritized = allEdges.filter((edge) => edge.type === 'subclass' || (selectedId ? edge.source === selectedId || edge.target === selectedId : false));
  const prioritizedIds = new Set(prioritized.map((edge) => edge.id));
  const remainingBudget = Math.max(0, MAX_VISIBLE_GRAPH_EDGES - prioritized.length);
  const secondary = allEdges.filter((edge) => !prioritizedIds.has(edge.id)).slice(0, remainingBudget);
  const edges = [...prioritized.slice(0, MAX_VISIBLE_GRAPH_EDGES), ...secondary].slice(0, MAX_VISIBLE_GRAPH_EDGES);

  return { nodes, edges, hiddenEdgeCount: Math.max(0, allEdges.length - edges.length) };
}

export interface HierarchyRow {
  id: string;
  depth: number;
  hasChildren: boolean;
  descendantCount: number;
}

export function buildHierarchyRows(
  ontology: OntologyDocument,
  visualState: PersistedViewerState,
): HierarchyRow[] {
  const childMap = new Map<string, string[]>();
  const roots = ontology.roots.length > 0 ? ontology.roots : Object.keys(ontology.classes);
  const hiddenSet = new Set(visualState.hiddenClassIds);

  for (const relation of ontology.relations) {
    if (relation.type !== 'subclass') {
      continue;
    }

    const children = childMap.get(relation.target) || [];
    children.push(relation.source);
    childMap.set(relation.target, children);
  }

  const rows: HierarchyRow[] = [];
  const visit = (classId: string, depth: number): number => {
    if (hiddenSet.has(classId)) {
      return 0;
    }
    const children = orderByLabel((childMap.get(classId) || []).map((id) => ontology.classes[id]).filter(isPresent));
    let visibleDescendants = 0;
    for (const child of children) {
      visibleDescendants += 1 + visit(child.id, depth + 1);
    }
    rows.push({ id: classId, depth, hasChildren: children.length > 0, descendantCount: visibleDescendants });
    return visibleDescendants;
  };

  for (const root of orderByLabel(roots.map((id) => ontology.classes[id]).filter(isPresent))) {
    visit(root.id, 0);
  }

  return rows.reverse().filter((row) => {
    const parentRelation = ontology.relations.find((relation) => relation.type === 'subclass' && relation.source === row.id);
    if (!parentRelation) {
      return true;
    }
    return !visualState.nodeStates[parentRelation.target]?.collapsedInHierarchy;
  });
}

export function buildGroupedColumns(
  ontology: OntologyDocument,
  visualState: PersistedViewerState,
): Array<{ groupId: string; label: string; color: string; classIds: string[] }> {
  const groups = new Map<string, { groupId: string; label: string; color: string; classIds: string[] }>();
  const hiddenSet = new Set(visualState.hiddenClassIds);

  for (const ontologyClass of Object.values(ontology.classes)) {
    if (hiddenSet.has(ontologyClass.id)) {
      continue;
    }

    const nodeState = visualState.nodeStates[ontologyClass.id];
    const groupId = nodeState?.groupId || 'ungrouped';
    const visualGroup = visualState.groups.find((group) => group.id === groupId);
    const group = groups.get(groupId) || {
      groupId,
      label: visualGroup?.label || 'Ungrouped',
      color: visualGroup?.color || '#52606d',
      classIds: [],
    };

    group.classIds.push(ontologyClass.id);
    groups.set(groupId, group);
  }

  return [...groups.values()]
    .map((group) => ({ ...group, classIds: orderByLabel(group.classIds.map((id) => ontology.classes[id]).filter(isPresent)).map((entry) => entry.id) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function createDefaultVisualState(fingerprint: string): PersistedViewerState {
  return {
    fingerprint,
    viewMode: 'graph',
    selectedClassId: null,
    hiddenClassIds: [],
    searchQuery: '',
    viewport: { x: 0, y: 0, zoom: 1 },
    layoutSettings: {
      nodeGap: 140,
      layerGap: 220,
      indentation: 24,
    },
    groups: [],
    nodeStates: {},
  };
}

export function ensureNodeState(
  visualState: PersistedViewerState,
  classId: string,
): PersistedViewerState['nodeStates'][string] {
  return (
    visualState.nodeStates[classId] || {
      color: '#1c7c72',
      groupId: null,
      expanded: false,
      detailMode: 'compact',
      position: null,
      pinned: false,
      collapsedInHierarchy: false,
    }
  );
}

export function countVisibleMatches(ontology: OntologyDocument, searchQuery: string): number {
  if (!searchQuery.trim()) {
    return Object.keys(ontology.classes).length;
  }

  const query = searchQuery.trim().toLowerCase();
  return Object.values(ontology.classes).filter((entry) => {
    return (
      entry.label.toLowerCase().includes(query)
      || entry.localName.toLowerCase().includes(query)
      || entry.comment?.toLowerCase().includes(query)
      || entry.anonymousExpressions.some((expression) => expression.summary.toLowerCase().includes(query))
      || entry.restrictions.some((restriction) => {
        return (
          restriction.onPropertyLabel.toLowerCase().includes(query)
          || restriction.targetLabel?.toLowerCase().includes(query)
          || restriction.kind.toLowerCase().includes(query)
        );
      })
    );
  }).length;
}

export function applySearchFilter(
  ontology: OntologyDocument,
  visualState: PersistedViewerState,
): PersistedViewerState {
  const query = visualState.searchQuery.trim().toLowerCase();
  if (!query) {
    return { ...visualState, hiddenClassIds: [] };
  }

  const hiddenClassIds = Object.values(ontology.classes)
    .filter((entry) => {
      return !(
        entry.label.toLowerCase().includes(query)
        || entry.localName.toLowerCase().includes(query)
        || entry.comment?.toLowerCase().includes(query)
        || entry.anonymousExpressions.some((expression) => expression.summary.toLowerCase().includes(query))
        || entry.restrictions.some((restriction) => {
          return (
            restriction.onPropertyLabel.toLowerCase().includes(query)
            || restriction.targetLabel?.toLowerCase().includes(query)
            || restriction.kind.toLowerCase().includes(query)
          );
        })
      );
    })
    .map((entry) => entry.id);

  return { ...visualState, hiddenClassIds };
}

export function clampViewportZoom(value: number): number {
  return Math.min(2.5, Math.max(0.4, value));
}

export function summarizeOntology(ontology: OntologyDocument): {
  classCount: number;
  relationCount: number;
  propertyCount: number;
  sourceFileCount: number;
  importCount: number;
  resolvedImportCount: number;
  unresolvedImportCount: number;
  disjointRelationCount: number;
  restrictionCount: number;
  anonymousExpressionCount: number;
} {
  return {
    classCount: Object.keys(ontology.classes).length,
    relationCount: ontology.relations.length,
    propertyCount: Object.keys(ontology.properties).length,
    sourceFileCount: ontology.sourceFiles.length,
    importCount: ontology.imports.length,
    resolvedImportCount: ontology.importResolutions.filter((entry) => entry.resolved).length,
    unresolvedImportCount: ontology.importResolutions.filter((entry) => !entry.resolved).length,
    disjointRelationCount: ontology.relations.filter((entry) => entry.type === 'disjoint').length,
    restrictionCount: Object.values(ontology.classes).reduce((count, entry) => count + entry.restrictions.length, 0),
    anonymousExpressionCount: Object.values(ontology.classes).reduce((count, entry) => count + entry.anonymousExpressions.length, 0),
  };
}

export function exportableLayoutState(visualState: PersistedViewerState): PersistedViewerState {
  return JSON.parse(JSON.stringify(visualState)) as PersistedViewerState;
}

export function resetGraphPositions(
  visualState: PersistedViewerState,
  ontology: OntologyDocument,
  layoutSettings: LayoutSettings,
): PersistedViewerState {
  const nextNodeStates = { ...visualState.nodeStates };
  for (const classId of Object.keys(ontology.classes)) {
    const current = ensureNodeState(visualState, classId);
    nextNodeStates[classId] = {
      ...current,
      position: null,
      pinned: false,
    };
  }

  return {
    ...visualState,
    layoutSettings,
    nodeStates: nextNodeStates,
  };
}