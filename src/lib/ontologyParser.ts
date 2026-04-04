import { Parser } from 'n3';
import { hashString } from './hash';
import type {
  OntologyAnnotation,
  OntologyAnonymousExpression,
  OntologyClass,
  OntologyDocument,
  OntologyImportResolution,
  OntologyProperty,
  OntologyRelation,
  OntologyRestriction,
  ParseDiagnostic,
} from '../types/ontology';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const RDFS_COMMENT = 'http://www.w3.org/2000/01/rdf-schema#comment';
const RDFS_SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const OWL_IMPORTS = 'http://www.w3.org/2002/07/owl#imports';
const OWL_EQUIVALENT_CLASS = 'http://www.w3.org/2002/07/owl#equivalentClass';
const OWL_DISJOINT_WITH = 'http://www.w3.org/2002/07/owl#disjointWith';
const OWL_ONTOLOGY = 'http://www.w3.org/2002/07/owl#Ontology';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const OWL_SOME_VALUES_FROM = 'http://www.w3.org/2002/07/owl#someValuesFrom';
const OWL_ALL_VALUES_FROM = 'http://www.w3.org/2002/07/owl#allValuesFrom';
const OWL_HAS_VALUE = 'http://www.w3.org/2002/07/owl#hasValue';
const OWL_MIN_CARDINALITY = 'http://www.w3.org/2002/07/owl#minCardinality';
const OWL_MAX_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxCardinality';
const OWL_CARDINALITY = 'http://www.w3.org/2002/07/owl#cardinality';
const OWL_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#qualifiedCardinality';
const OWL_MIN_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#minQualifiedCardinality';
const OWL_MAX_QUALIFIED_CARDINALITY = 'http://www.w3.org/2002/07/owl#maxQualifiedCardinality';
const OWL_INTERSECTION_OF = 'http://www.w3.org/2002/07/owl#intersectionOf';
const OWL_UNION_OF = 'http://www.w3.org/2002/07/owl#unionOf';
const OWL_COMPLEMENT_OF = 'http://www.w3.org/2002/07/owl#complementOf';
const OWL_ONE_OF = 'http://www.w3.org/2002/07/owl#oneOf';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const RDFS_CLASS = 'http://www.w3.org/2000/01/rdf-schema#Class';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';

interface TripleLike {
  subject: string;
  predicate: string;
  object: string;
  objectType: 'uri' | 'literal' | 'blank';
}

interface ParsedSource {
  sourceName: string;
  sourceText: string;
  triples: TripleLike[];
  diagnostics: ParseDiagnostic[];
  ontologyIri?: string;
  imports: string[];
}

interface RestrictionDescriptor {
  kind: OntologyRestriction['kind'];
  target?: string;
  targetLabel?: string;
}

interface ExpressionParseResult {
  restriction?: OntologyRestriction;
  anonymousExpression?: OntologyAnonymousExpression;
  summary: string;
}

function localNameFromIri(iri: string): string {
  const hashIndex = iri.lastIndexOf('#');
  const slashIndex = iri.lastIndexOf('/');
  return iri.slice(Math.max(hashIndex, slashIndex) + 1) || iri;
}

function labelFromIri(iri: string): string {
  return localNameFromIri(iri)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function stripExtension(value: string): string {
  return value.replace(/\.[a-z0-9]+$/i, '');
}

function basename(value: string): string {
  return value.split(/[\\/]/).pop() || value;
}

function ensureClass(classes: Record<string, OntologyClass>, iri: string): OntologyClass {
  const existing = classes[iri];
  if (existing) {
    return existing;
  }

  const next: OntologyClass = {
    id: iri,
    iri,
    label: labelFromIri(iri),
    localName: localNameFromIri(iri),
    annotations: [],
    dataPropertyIds: [],
    objectPropertyIds: [],
    restrictions: [],
    anonymousExpressions: [],
  };

  classes[iri] = next;
  return next;
}

function ensureProperty(properties: Record<string, OntologyProperty>, iri: string, kind: 'data' | 'object'): OntologyProperty {
  const existing = properties[iri];
  if (existing) {
    return existing;
  }

  const next: OntologyProperty = {
    id: iri,
    iri,
    label: labelFromIri(iri),
    kind,
    domains: [],
    ranges: [],
    annotations: [],
  };

  properties[iri] = next;
  return next;
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function addAnnotation(target: { annotations: OntologyAnnotation[] }, property: string, value: string): void {
  target.annotations.push({ property, value });
}

function createBlankNodeId(counter: { value: number }): string {
  counter.value += 1;
  return `_:xml-${counter.value}`;
}

function classifySubjectIdentifier(element: Element, counter: { value: number }): { id: string; type: 'uri' | 'blank' } | null {
  const about = element.getAttribute('rdf:about') || element.getAttribute('about');
  if (about) {
    return { id: about, type: 'uri' };
  }

  const nodeId = element.getAttribute('rdf:nodeID') || element.getAttribute('nodeID');
  if (nodeId) {
    return { id: `_:${nodeId}`, type: 'blank' };
  }

  if (element.childElementCount > 0 || element.localName === 'Restriction' || element.localName === 'Description') {
    return { id: createBlankNodeId(counter), type: 'blank' };
  }

  return null;
}

function parseXmlTriples(source: string, diagnostics: ParseDiagnostic[]): TripleLike[] {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(source, 'application/xml');
  const parseError = documentNode.querySelector('parsererror');

  if (parseError) {
    throw new Error(parseError.textContent || 'Invalid RDF/XML document');
  }

  const triples: TripleLike[] = [];
  const roots = Array.from(documentNode.documentElement.children);
  const blankCounter = { value: 0 };

  const processResourceElement = (element: Element, linkedFrom?: { subject: string; predicate: string }): void => {
    const subjectInfo = classifySubjectIdentifier(element, blankCounter);
    if (!subjectInfo) {
      return;
    }

    if (linkedFrom) {
      triples.push({
        subject: linkedFrom.subject,
        predicate: linkedFrom.predicate,
        object: subjectInfo.id,
        objectType: subjectInfo.type,
      });
    }

    if (element.localName === 'Class') {
      triples.push({ subject: subjectInfo.id, predicate: RDF_TYPE, object: OWL_CLASS, objectType: 'uri' });
    } else if (element.localName === 'DatatypeProperty') {
      triples.push({ subject: subjectInfo.id, predicate: RDF_TYPE, object: OWL_DATATYPE_PROPERTY, objectType: 'uri' });
    } else if (element.localName === 'ObjectProperty') {
      triples.push({ subject: subjectInfo.id, predicate: RDF_TYPE, object: OWL_OBJECT_PROPERTY, objectType: 'uri' });
    } else if (element.localName === 'Restriction') {
      triples.push({ subject: subjectInfo.id, predicate: RDF_TYPE, object: OWL_RESTRICTION, objectType: 'uri' });
    } else if (element.localName === 'Ontology') {
      triples.push({ subject: subjectInfo.id, predicate: RDF_TYPE, object: OWL_ONTOLOGY, objectType: 'uri' });
    }

    for (const child of Array.from(element.children)) {
      const predicateNamespace = child.namespaceURI || '';
      const predicate = `${predicateNamespace}${child.localName}`;
      const resource = child.getAttribute('rdf:resource') || child.getAttribute('resource');
      const nodeId = child.getAttribute('rdf:nodeID') || child.getAttribute('nodeID');
      const nestedChildren = Array.from(child.children);

      if (resource) {
        triples.push({ subject: subjectInfo.id, predicate, object: resource, objectType: 'uri' });
        continue;
      }

      if (nodeId) {
        triples.push({ subject: subjectInfo.id, predicate, object: `_:${nodeId}`, objectType: 'blank' });
        continue;
      }

      if (nestedChildren.length > 0) {
        for (const nested of nestedChildren) {
          processResourceElement(nested, { subject: subjectInfo.id, predicate });
        }
        continue;
      }

      const text = child.textContent?.trim();
      if (text) {
        triples.push({ subject: subjectInfo.id, predicate, object: text, objectType: 'literal' });
      }
    }
  };

  for (const element of roots) {
    processResourceElement(element);
  }

  if (triples.length === 0) {
    diagnostics.push({ level: 'warning', message: 'No supported RDF/XML entities were discovered.' });
  }

  return triples;
}

async function parseTurtleTriples(source: string): Promise<TripleLike[]> {
  const parser = new Parser();
  const quads = parser.parse(source);

  return quads.map((quad) => ({
    subject: quad.subject.value,
    predicate: quad.predicate.value,
    object: quad.object.value,
    objectType:
      quad.object.termType === 'Literal'
        ? 'literal'
        : quad.object.termType === 'BlankNode'
          ? 'blank'
          : 'uri',
  }));
}

function extractOntologyMetadata(triples: TripleLike[]): { ontologyIri?: string; imports: string[] } {
  let ontologyIri: string | undefined;
  const imports: string[] = [];

  for (const triple of triples) {
    if (triple.predicate === RDF_TYPE && triple.objectType === 'uri' && triple.object === OWL_ONTOLOGY && !triple.subject.startsWith('_:')) {
      ontologyIri = triple.subject;
    }

    if (triple.predicate === OWL_IMPORTS && triple.objectType === 'uri') {
      pushUnique(imports, triple.object);
    }
  }

  return { ontologyIri, imports };
}

async function parseOntologySource(source: string, sourceName: string): Promise<ParsedSource> {
  const diagnostics: ParseDiagnostic[] = [];
  const isXml = source.trim().startsWith('<');
  const triples = isXml ? parseXmlTriples(source, diagnostics) : await parseTurtleTriples(source);
  const metadata = extractOntologyMetadata(triples);

  return {
    sourceName,
    sourceText: source,
    triples,
    diagnostics,
    ontologyIri: metadata.ontologyIri,
    imports: metadata.imports,
  };
}

function restrictionTargetLabel(target?: string): string | undefined {
  if (!target) {
    return undefined;
  }
  if (target.startsWith('_:')) {
    return 'Anonymous expression';
  }
  return labelFromIri(target);
}

function buildRestrictionDescriptor(triples: TripleLike[]): RestrictionDescriptor | null {
  const descriptors: Array<{ predicate: string; kind: OntologyRestriction['kind'] }> = [
    { predicate: OWL_SOME_VALUES_FROM, kind: 'someValuesFrom' },
    { predicate: OWL_ALL_VALUES_FROM, kind: 'allValuesFrom' },
    { predicate: OWL_HAS_VALUE, kind: 'hasValue' },
    { predicate: OWL_MIN_CARDINALITY, kind: 'minCardinality' },
    { predicate: OWL_MAX_CARDINALITY, kind: 'maxCardinality' },
    { predicate: OWL_CARDINALITY, kind: 'exactCardinality' },
    { predicate: OWL_QUALIFIED_CARDINALITY, kind: 'qualifiedCardinality' },
    { predicate: OWL_MIN_QUALIFIED_CARDINALITY, kind: 'minQualifiedCardinality' },
    { predicate: OWL_MAX_QUALIFIED_CARDINALITY, kind: 'maxQualifiedCardinality' },
  ];

  for (const descriptor of descriptors) {
    const triple = triples.find((entry) => entry.predicate === descriptor.predicate);
    if (triple) {
      return {
        kind: descriptor.kind,
        target: triple.object,
        targetLabel: triple.objectType === 'literal' ? triple.object : restrictionTargetLabel(triple.object),
      };
    }
  }

  return null;
}

function summarizeRestriction(restriction: OntologyRestriction): string {
  return `${restriction.onPropertyLabel} ${restriction.kind}${restriction.targetLabel ? ` ${restriction.targetLabel}` : ''}`;
}

function parseList(blankNodeTriples: Map<string, TripleLike[]>, listNodeId: string, visited = new Set<string>()): Array<{ value: string; objectType: TripleLike['objectType'] }> {
  const items: Array<{ value: string; objectType: TripleLike['objectType'] }> = [];
  let current = listNodeId;

  while (current && current !== RDF_NIL && !visited.has(current)) {
    visited.add(current);
    const triples = blankNodeTriples.get(current) || [];
    const first = triples.find((entry) => entry.predicate === RDF_FIRST);
    const rest = triples.find((entry) => entry.predicate === RDF_REST);
    if (first) {
      items.push({ value: first.object, objectType: first.objectType });
    }
    if (!rest || rest.object === RDF_NIL || rest.objectType !== 'blank') {
      break;
    }
    current = rest.object;
  }

  return items;
}

function parseExpressionNode(
  nodeId: string,
  nodeType: TripleLike['objectType'],
  sourceKind: OntologyRestriction['source'],
  blankNodeTriples: Map<string, TripleLike[]>,
  visited = new Set<string>(),
): ExpressionParseResult {
  if (nodeType === 'literal') {
    return { summary: nodeId };
  }

  if (nodeType === 'uri') {
    return { summary: labelFromIri(nodeId) };
  }

  if (visited.has(nodeId)) {
    return {
      summary: 'Recursive anonymous expression',
      anonymousExpression: {
        id: `${sourceKind}:${nodeId}`,
        source: sourceKind,
        kind: 'unknown',
        summary: 'Recursive anonymous expression',
      },
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);
  const triples = blankNodeTriples.get(nodeId) || [];

  const isRestriction = triples.some((entry) => entry.predicate === RDF_TYPE && entry.object === OWL_RESTRICTION);
  if (isRestriction) {
    const onProperty = triples.find((entry) => entry.predicate === OWL_ON_PROPERTY && entry.objectType === 'uri');
    const descriptor = buildRestrictionDescriptor(triples);
    if (onProperty && descriptor) {
      const restriction: OntologyRestriction = {
        id: `${sourceKind}:${nodeId}`,
        source: sourceKind,
        kind: descriptor.kind,
        onPropertyId: onProperty.object,
        onPropertyLabel: labelFromIri(onProperty.object),
        target: descriptor.target,
        targetLabel: descriptor.targetLabel,
      };
      return { restriction, summary: summarizeRestriction(restriction) };
    }
  }

  const collectionPredicates: Array<{ predicate: string; kind: OntologyAnonymousExpression['kind']; prefix: string }> = [
    { predicate: OWL_INTERSECTION_OF, kind: 'intersectionOf', prefix: 'All of' },
    { predicate: OWL_UNION_OF, kind: 'unionOf', prefix: 'Any of' },
    { predicate: OWL_ONE_OF, kind: 'oneOf', prefix: 'One of' },
  ];

  for (const descriptor of collectionPredicates) {
    const collection = triples.find((entry) => entry.predicate === descriptor.predicate && (entry.objectType === 'blank' || entry.objectType === 'uri'));
    if (!collection) {
      continue;
    }

    const members = parseList(blankNodeTriples, collection.object).map((member) => {
      return parseExpressionNode(member.value, member.objectType, sourceKind, blankNodeTriples, nextVisited).summary;
    });

    const summary = `${descriptor.prefix}: ${members.join('; ')}`;
    return {
      summary,
      anonymousExpression: {
        id: `${sourceKind}:${nodeId}`,
        source: sourceKind,
        kind: descriptor.kind,
        summary,
      },
    };
  }

  const complement = triples.find((entry) => entry.predicate === OWL_COMPLEMENT_OF);
  if (complement) {
    const child = parseExpressionNode(complement.object, complement.objectType, sourceKind, blankNodeTriples, nextVisited);
    const summary = `Not: ${child.summary}`;
    return {
      summary,
      anonymousExpression: {
        id: `${sourceKind}:${nodeId}`,
        source: sourceKind,
        kind: 'complementOf',
        summary,
      },
    };
  }

  return {
    summary: 'Unsupported anonymous class expression',
    anonymousExpression: {
      id: `${sourceKind}:${nodeId}`,
      source: sourceKind,
      kind: 'unknown',
      summary: 'Unsupported anonymous class expression',
    },
  };
}

function resolveImportTarget(importIri: string, sources: ParsedSource[]): ParsedSource | undefined {
  const direct = sources.find((entry) => entry.ontologyIri === importIri);
  if (direct) {
    return direct;
  }

  const importBase = basename(importIri);
  const importStem = stripExtension(importBase);
  const keyCandidates = new Set([
    normalizeKey(importIri),
    normalizeKey(importBase),
    normalizeKey(importStem),
    normalizeKey(localNameFromIri(importIri)),
  ]);

  return sources.find((entry) => {
    const candidates = [entry.sourceName, basename(entry.sourceName), stripExtension(basename(entry.sourceName)), entry.ontologyIri || ''];
    return candidates.some((candidate) => candidate && keyCandidates.has(normalizeKey(candidate)));
  });
}

function buildOntologyFromTriples(
  sourceText: string,
  sourceName: string,
  sourceFiles: string[],
  importResolutions: OntologyImportResolution[],
  triples: TripleLike[],
  diagnostics: ParseDiagnostic[],
): OntologyDocument {
  const classes: Record<string, OntologyClass> = {};
  const properties: Record<string, OntologyProperty> = {};
  const relations: OntologyRelation[] = [];
  const imports: string[] = [];
  const classTypes = new Set<string>([OWL_CLASS, RDFS_CLASS]);
  const dataPropertyIds = new Set<string>();
  const objectPropertyIds = new Set<string>();
  const blankNodeTriples = new Map<string, TripleLike[]>();
  let ontologyIri: string | undefined;

  for (const triple of triples) {
    if (triple.subject.startsWith('_:')) {
      const existing = blankNodeTriples.get(triple.subject) || [];
      existing.push(triple);
      blankNodeTriples.set(triple.subject, existing);
    }
  }

  for (const triple of triples) {
    if (triple.predicate === RDF_TYPE && triple.objectType === 'uri') {
      if (triple.object === OWL_ONTOLOGY && !triple.subject.startsWith('_:')) {
        ontologyIri = triple.subject;
      }

      if (classTypes.has(triple.object)) {
        ensureClass(classes, triple.subject);
      }

      if (triple.object === OWL_DATATYPE_PROPERTY) {
        ensureProperty(properties, triple.subject, 'data');
        dataPropertyIds.add(triple.subject);
      }

      if (triple.object === OWL_OBJECT_PROPERTY) {
        ensureProperty(properties, triple.subject, 'object');
        objectPropertyIds.add(triple.subject);
      }
    }

    if (triple.predicate === OWL_IMPORTS && triple.objectType === 'uri') {
      pushUnique(imports, triple.object);
    }
  }

  for (const triple of triples) {
    if (triple.predicate === RDFS_SUBCLASS && triple.objectType === 'uri') {
      ensureClass(classes, triple.subject);
      ensureClass(classes, triple.object);
      relations.push({
        id: `subclass:${triple.subject}:${triple.object}`,
        source: triple.subject,
        target: triple.object,
        type: 'subclass',
      });
      continue;
    }

    if (triple.predicate === OWL_DISJOINT_WITH && triple.objectType === 'uri') {
      ensureClass(classes, triple.subject);
      ensureClass(classes, triple.object);
      relations.push({
        id: `disjoint:${triple.subject}:${triple.object}`,
        source: triple.subject,
        target: triple.object,
        type: 'disjoint',
        label: 'disjoint with',
      });
      continue;
    }

    if (triple.predicate === RDFS_SUBCLASS && triple.objectType === 'blank') {
      const classTarget = ensureClass(classes, triple.subject);
      const parsed = parseExpressionNode(triple.object, 'blank', 'subclass', blankNodeTriples);
      if (parsed.restriction) {
        classTarget.restrictions.push(parsed.restriction);
      } else if (parsed.anonymousExpression) {
        classTarget.anonymousExpressions.push(parsed.anonymousExpression);
      } else {
        diagnostics.push({ level: 'info', message: `Unsupported anonymous subclass expression attached to ${classTarget.label}.` });
      }
      continue;
    }

    if (triple.predicate === OWL_EQUIVALENT_CLASS && triple.objectType === 'blank') {
      const classTarget = ensureClass(classes, triple.subject);
      const parsed = parseExpressionNode(triple.object, 'blank', 'equivalent-class', blankNodeTriples);
      if (parsed.restriction) {
        classTarget.restrictions.push(parsed.restriction);
      } else if (parsed.anonymousExpression) {
        classTarget.anonymousExpressions.push(parsed.anonymousExpression);
      } else {
        diagnostics.push({ level: 'info', message: `Unsupported anonymous equivalent-class expression attached to ${classTarget.label}.` });
      }
      continue;
    }

    if (triple.predicate === OWL_DISJOINT_WITH && triple.objectType === 'blank') {
      const classTarget = ensureClass(classes, triple.subject);
      const parsed = parseExpressionNode(triple.object, 'blank', 'disjoint-class', blankNodeTriples);
      if (parsed.restriction) {
        classTarget.restrictions.push(parsed.restriction);
      } else if (parsed.anonymousExpression) {
        classTarget.anonymousExpressions.push(parsed.anonymousExpression);
      } else {
        diagnostics.push({ level: 'info', message: `Unsupported anonymous disjoint-class expression attached to ${classTarget.label}.` });
      }
      continue;
    }

    const classTarget = classes[triple.subject];
    const propertyTarget = properties[triple.subject];

    if (triple.predicate === RDFS_LABEL && triple.objectType === 'literal') {
      if (classTarget) {
        classTarget.label = triple.object;
      }
      if (propertyTarget) {
        propertyTarget.label = triple.object;
      }
      continue;
    }

    if (triple.predicate === RDFS_COMMENT && triple.objectType === 'literal' && classTarget) {
      classTarget.comment = triple.object;
      continue;
    }

    if (triple.predicate === RDFS_DOMAIN && triple.objectType === 'uri' && propertyTarget) {
      pushUnique(propertyTarget.domains, triple.object);
      ensureClass(classes, triple.object);
      continue;
    }

    if (triple.predicate === RDFS_RANGE && propertyTarget) {
      pushUnique(propertyTarget.ranges, triple.object);
      continue;
    }

    if (classTarget && triple.objectType === 'literal' && ![RDFS_LABEL, RDFS_COMMENT].includes(triple.predicate)) {
      addAnnotation(classTarget, triple.predicate, triple.object);
      continue;
    }

    if (propertyTarget && triple.objectType === 'literal' && triple.predicate !== RDFS_LABEL) {
      addAnnotation(propertyTarget, triple.predicate, triple.object);
    }
  }

  for (const propertyId of dataPropertyIds) {
    const property = properties[propertyId];
    if (!property) {
      continue;
    }

    for (const domain of property.domains) {
      const ontologyClass = ensureClass(classes, domain);
      pushUnique(ontologyClass.dataPropertyIds, propertyId);
    }
  }

  for (const propertyId of objectPropertyIds) {
    const property = properties[propertyId];
    if (!property) {
      continue;
    }

    for (const domain of property.domains) {
      const ontologyClass = ensureClass(classes, domain);
      pushUnique(ontologyClass.objectPropertyIds, propertyId);
    }

    for (const domain of property.domains) {
      for (const range of property.ranges) {
        if (classes[domain] && classes[range]) {
          relations.push({
            id: `object:${propertyId}:${domain}:${range}`,
            source: domain,
            target: range,
            type: 'object-property',
            label: property.label,
          });
        }
      }
    }
  }

  for (const ontologyClass of Object.values(classes)) {
    ontologyClass.restrictions = ontologyClass.restrictions.map((restriction) => {
      const targetLabel = restriction.target
        ? classes[restriction.target]?.label || properties[restriction.target]?.label || restriction.targetLabel || restrictionTargetLabel(restriction.target)
        : restriction.targetLabel;

      return {
        ...restriction,
        onPropertyLabel: restriction.onPropertyId ? properties[restriction.onPropertyId]?.label || restriction.onPropertyLabel : restriction.onPropertyLabel,
        targetLabel,
      };
    });

    ontologyClass.anonymousExpressions = ontologyClass.anonymousExpressions.map((expression) => ({
      ...expression,
      summary: expression.summary.replace(/\s+/g, ' ').trim(),
    }));
  }

  const childIds = new Set(relations.filter((relation) => relation.type === 'subclass').map((relation) => relation.source));
  const roots = Object.keys(classes).filter((id) => !childIds.has(id));

  return {
    ontologyIri: ontologyIri || Object.keys(classes)[0],
    fingerprint: hashString(sourceText),
    sourceFiles,
    imports,
    importResolutions,
    classes,
    properties,
    relations,
    roots,
    diagnostics,
    sourceText,
    sourceName,
  };
}

export async function parseOntology(source: string, sourceName: string): Promise<OntologyDocument> {
  return parseOntologyBundle([{ source, sourceName }]);
}

export async function parseOntologyBundle(sources: Array<{ source: string; sourceName: string }>): Promise<OntologyDocument> {
  if (sources.length === 0) {
    return {
      fingerprint: hashString(''),
      sourceFiles: [],
      imports: [],
      importResolutions: [],
      classes: {},
      properties: {},
      relations: [],
      roots: [],
      diagnostics: [{ level: 'error', message: 'No ontology files were provided.' }],
      sourceText: '',
      sourceName: 'empty-ontology',
    };
  }

  const parsedSources: ParsedSource[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  for (const source of sources) {
    try {
      const parsed = await parseOntologySource(source.source, source.sourceName);
      parsedSources.push(parsed);
      diagnostics.push(...parsed.diagnostics.map((entry) => ({ ...entry, message: `${source.sourceName}: ${entry.message}` })));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to parse ontology source.';
      diagnostics.push({ level: 'error', message: `${source.sourceName}: ${message}` });
    }
  }

  if (parsedSources.length === 0) {
    return {
      fingerprint: hashString(''),
      sourceFiles: [],
      imports: [],
      importResolutions: [],
      classes: {},
      properties: {},
      relations: [],
      roots: [],
      diagnostics,
      sourceText: '',
      sourceName: sources[0]?.sourceName || 'empty-ontology',
    };
  }

  const entry = parsedSources[0];
  if (!entry) {
    return {
      fingerprint: hashString(''),
      sourceFiles: [],
      imports: [],
      importResolutions: [],
      classes: {},
      properties: {},
      relations: [],
      roots: [],
      diagnostics,
      sourceText: '',
      sourceName: sources[0]?.sourceName || 'empty-ontology',
    };
  }

  const resolved = new Map<string, ParsedSource>([[entry.sourceName, entry]]);
  const queue = [entry];
  const importResolutions: OntologyImportResolution[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    for (const importIri of current.imports) {
      if (importResolutions.some((entry) => entry.iri === importIri)) {
        continue;
      }

      const target = resolveImportTarget(importIri, parsedSources);
      if (!target) {
        importResolutions.push({ iri: importIri, resolved: false });
        diagnostics.push({ level: 'warning', message: `${current.sourceName}: Unable to resolve imported ontology ${importIri} from the selected files.` });
        continue;
      }

      importResolutions.push({
        iri: importIri,
        resolved: true,
        sourceFile: target.sourceName,
        ontologyIri: target.ontologyIri,
      });

      if (!resolved.has(target.sourceName)) {
        resolved.set(target.sourceName, target);
        queue.push(target);
      }
    }
  }

  const resolvedSources = [...resolved.values()];
  const tripleKeys = new Set<string>();
  const mergedTriples: TripleLike[] = [];

  for (const source of resolvedSources) {
    for (const triple of source.triples) {
      const key = `${triple.subject}\u0000${triple.predicate}\u0000${triple.object}\u0000${triple.objectType}`;
      if (!tripleKeys.has(key)) {
        tripleKeys.add(key);
        mergedTriples.push(triple);
      }
    }
  }

  const mergedSourceText = resolvedSources.map((source) => source.sourceText).join('\n\n');
  return buildOntologyFromTriples(
    mergedSourceText,
    entry.sourceName,
    resolvedSources.map((source) => source.sourceName),
    importResolutions,
    mergedTriples,
    diagnostics,
  );
}