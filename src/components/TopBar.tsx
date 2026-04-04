import type { LayoutSettings, OntologyDocument, PersistedViewerState, ViewMode } from '../types/ontology';
import { FileActions } from './FileActions';

interface TopBarProps {
  ontology: OntologyDocument;
  visualState: PersistedViewerState;
  onImportOntology: (files: File[]) => void;
  onImportLayout: (state: PersistedViewerState) => void;
  onSearch: (value: string) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onLayoutChange: (patch: Partial<LayoutSettings>) => void;
}

const modes: ViewMode[] = ['graph', 'grouped', 'hierarchy'];

export function TopBar({
  ontology,
  visualState,
  onImportOntology,
  onImportLayout,
  onSearch,
  onViewModeChange,
  onLayoutChange,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__intro">
        <div>
          <p className="eyebrow">Ontology Layout Explorer</p>
          <h1>{ontology.sourceName}</h1>
        </div>
        <p className="topbar__note">
          Visual edits stay separate from ontology semantics. Switch between graph, grouped, and hierarchy views while preserving the same class identity.
        </p>
      </div>

      <div className="topbar__controls">
        <FileActions visualState={visualState} onImportLayout={onImportLayout} onImportOntology={onImportOntology} />
        <label className="search-box">
          <span>Search classes</span>
          <input
            value={visualState.searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Filter by label or local name"
          />
        </label>

        <div className="segmented-control" role="tablist" aria-label="View modes">
          {modes.map((mode) => (
            <button
              key={mode}
              className={mode === visualState.viewMode ? 'is-active' : ''}
              onClick={() => onViewModeChange(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="slider-row">
          <label>
            <span>Node spacing</span>
            <input
              type="range"
              min="90"
              max="220"
              value={visualState.layoutSettings.nodeGap}
              onChange={(event) => onLayoutChange({ nodeGap: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Layer spacing</span>
            <input
              type="range"
              min="150"
              max="300"
              value={visualState.layoutSettings.layerGap}
              onChange={(event) => onLayoutChange({ layerGap: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Indentation</span>
            <input
              type="range"
              min="14"
              max="44"
              value={visualState.layoutSettings.indentation}
              onChange={(event) => onLayoutChange({ indentation: Number(event.target.value) })}
            />
          </label>
        </div>
      </div>
    </header>
  );
}