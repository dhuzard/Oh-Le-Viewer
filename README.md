# Oh-Le-Viewer

Oh-Le-Viewer is a React + TypeScript ontology visualization tool for loading OWL ontologies and organizing their presentation in a readable, graph-based workspace.

## What it does

- Loads OWL, RDF/XML, Turtle, and plain text ontology files, including multi-file ontology bundles for local import resolution.
- Extracts classes, subclass relations, object-property links, disjoint-class links, data properties, imports, common OWL restrictions, broader anonymous class expressions, and annotations.
- Presents the ontology in three modes: graph, grouped, and hierarchy.
- Lets users inspect classes, assign colors, create visual groups, collapse hierarchy branches, review resolved versus unresolved imports, inspect disjoint-class links, inspect restrictions and anonymous class expressions, and choose compact or detailed node display.
- Persists visual layout state separately from ontology source semantics.
- Imports and exports saved layout JSON.
- Exports the graph view as SVG or PNG.

## Architecture

- `src/lib/ontologyParser.ts`: OWL ingestion and normalization.
- `src/lib/layout.ts`: graph, grouped, and hierarchy projections.
- `src/state/useViewerStore.ts`: application state, view state, and persistence wiring.
- `src/components/`: top bar, graph canvas, grouped view, hierarchy view, outline, inspector, and file actions.
- `src/lib/persistence.ts`: local browser persistence keyed by ontology fingerprint.
- `src/lib/export.ts`: layout JSON and graph image export.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- Visual edits never mutate the ontology source.
- Layouts are restored per ontology fingerprint.
- When loading multiple ontology files, the first selected file is treated as the entry ontology and local owl:imports are resolved against the rest of the selected files.
- Import feedback is explicit in the UI: resolved imports show the matched source file, unresolved imports remain visible instead of failing silently.
- The app ships with a small sample ontology so the interface is usable before importing a file.
