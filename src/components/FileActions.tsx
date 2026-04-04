import { useRef } from 'react';
import { exportLayoutJson, importLayoutJson } from '../lib/export';
import type { PersistedViewerState } from '../types/ontology';

interface FileActionsProps {
  visualState: PersistedViewerState;
  onImportLayout: (state: PersistedViewerState) => void;
  onImportOntology: (files: File[]) => void;
}

export function FileActions({ visualState, onImportLayout, onImportOntology }: FileActionsProps) {
  const ontologyInputRef = useRef<HTMLInputElement | null>(null);
  const layoutInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="file-actions">
      <button className="button button--primary" onClick={() => ontologyInputRef.current?.click()}>
        Load OWL Files
      </button>
      <button className="button" onClick={() => exportLayoutJson(visualState)}>
        Export Layout JSON
      </button>
      <button className="button" onClick={() => layoutInputRef.current?.click()}>
        Import Layout JSON
      </button>
      <input
        ref={ontologyInputRef}
        hidden
        type="file"
        multiple
        accept=".owl,.rdf,.xml,.ttl,.txt"
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          if (files.length > 0) {
            onImportOntology(files);
          }
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={layoutInputRef}
        hidden
        type="file"
        accept=".json,.ohle-layout.json"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            try {
              const nextState = await importLayoutJson(file);
              onImportLayout(nextState);
            } catch {
              window.alert('Unable to import that layout file. Ensure it is valid JSON exported by this app.');
            }
          }
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}