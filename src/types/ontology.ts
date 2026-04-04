export type ViewMode = 'graph' | 'grouped' | 'hierarchy';

export interface OntologyAnnotation {
  property: string;
  value: string;
}

export interface OntologyRestriction {
  id: string;
  source: 'subclass' | 'equivalent-class' | 'disjoint-class';
  kind:
    | 'someValuesFrom'
    | 'allValuesFrom'
    | 'hasValue'
    | 'minCardinality'
    | 'maxCardinality'
    | 'exactCardinality'
    | 'qualifiedCardinality'
    | 'minQualifiedCardinality'
    | 'maxQualifiedCardinality';
  onPropertyId?: string;
  onPropertyLabel: string;
  target?: string;
  targetLabel?: string;
}

export interface OntologyAnonymousExpression {
  id: string;
  source: 'subclass' | 'equivalent-class' | 'disjoint-class';
  kind: 'intersectionOf' | 'unionOf' | 'complementOf' | 'oneOf' | 'unknown';
  summary: string;
}

export interface OntologyImportResolution {
  iri: string;
  resolved: boolean;
  sourceFile?: string;
  ontologyIri?: string;
}

export interface OntologyProperty {
  id: string;
  label: string;
  iri: string;
  kind: 'data' | 'object';
  domains: string[];
  ranges: string[];
  annotations: OntologyAnnotation[];
}

export interface OntologyClass {
  id: string;
  iri: string;
  label: string;
  localName: string;
  comment?: string;
  annotations: OntologyAnnotation[];
  dataPropertyIds: string[];
  objectPropertyIds: string[];
  restrictions: OntologyRestriction[];
  anonymousExpressions: OntologyAnonymousExpression[];
}

export interface OntologyRelation {
  id: string;
  source: string;
  target: string;
  type: 'subclass' | 'object-property' | 'disjoint';
  label?: string;
}

export interface ParseDiagnostic {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface OntologyDocument {
  ontologyIri?: string;
  fingerprint: string;
  sourceFiles: string[];
  imports: string[];
  importResolutions: OntologyImportResolution[];
  classes: Record<string, OntologyClass>;
  properties: Record<string, OntologyProperty>;
  relations: OntologyRelation[];
  roots: string[];
  diagnostics: ParseDiagnostic[];
  sourceText: string;
  sourceName: string;
}

export interface VisualNodeState {
  color: string;
  groupId: string | null;
  expanded: boolean;
  detailMode: 'compact' | 'detail';
  position: { x: number; y: number } | null;
  pinned: boolean;
  collapsedInHierarchy: boolean;
}

export interface VisualGroup {
  id: string;
  label: string;
  color: string;
}

export interface LayoutSettings {
  nodeGap: number;
  layerGap: number;
  indentation: number;
}

export interface PersistedViewerState {
  fingerprint: string;
  viewMode: ViewMode;
  selectedClassId: string | null;
  hiddenClassIds: string[];
  searchQuery: string;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  layoutSettings: LayoutSettings;
  groups: VisualGroup[];
  nodeStates: Record<string, VisualNodeState>;
}

export interface GraphNode {
  id: string;
  label: string;
  groupId: string | null;
  color: string;
  detailMode: 'compact' | 'detail';
  expanded: boolean;
  x: number;
  y: number;
  parentIds: string[];
  childIds: string[];
  dataPropertyCount: number;
  objectPropertyCount: number;
  restrictionCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'subclass' | 'object-property' | 'disjoint';
  label?: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hiddenEdgeCount: number;
}