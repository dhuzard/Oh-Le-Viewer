import { create } from 'zustand';
import { applySearchFilter, collectSubclassDescendants, createDefaultVisualState, ensureEdgeState, ensureNodeState, normalizeVisualState } from '../lib/layout';
import { parseOntology, parseOntologyBundle } from '../lib/ontologyParser';
import { loadPersistedState, savePersistedState } from '../lib/persistence';
import { sampleImportedOntology, sampleOntology } from '../data/sampleOntology';
import type { OntologyDocument, PersistedViewerState, ViewMode, VisualGroup, VisualNodeState, ViewportState } from '../types/ontology';

interface ViewerState {
  ontology: OntologyDocument | null;
  visualState: PersistedViewerState | null;
  loading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  importOntology: (files: File[]) => Promise<void>;
  loadOntologyFromText: (source: string, sourceName: string) => Promise<void>;
  selectClass: (classId: string | null) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSearchQuery: (searchQuery: string) => void;
  updateNodeState: (classId: string, patch: Partial<VisualNodeState>) => void;
  updateEdgeState: (edgeId: string, patch: Partial<PersistedViewerState['edgeStates'][string]>) => void;
  setViewport: (viewport: ViewportState) => void;
  setLayoutSettings: (patch: Partial<PersistedViewerState['layoutSettings']>) => void;
  upsertGroup: (group: VisualGroup) => void;
  assignGroupToSelected: (groupId: string | null) => void;
  hideClass: (classId: string) => void;
  restoreClass: (classId: string) => void;
  hideBranch: (classId: string) => void;
  restoreAllHiddenClasses: () => void;
  importLayout: (state: PersistedViewerState) => void;
  replaceVisualState: (updater: (current: PersistedViewerState) => PersistedViewerState) => void;
}

async function hydrateOntology(source: string, sourceName: string): Promise<{ ontology: OntologyDocument; visualState: PersistedViewerState }> {
  const ontology = await parseOntology(source, sourceName);
  const persisted = loadPersistedState(ontology.fingerprint);
  const visualState = normalizeVisualState(persisted || createDefaultVisualState(ontology.fingerprint), ontology.fingerprint);
  return { ontology, visualState: applySearchFilter(ontology, visualState) };
}

async function hydrateOntologyFiles(files: File[]): Promise<{ ontology: OntologyDocument; visualState: PersistedViewerState }> {
  const sources = await Promise.all(files.map(async (file) => ({ source: await file.text(), sourceName: file.name })));
  const ontology = await parseOntologyBundle(sources);
  const persisted = loadPersistedState(ontology.fingerprint);
  const visualState = normalizeVisualState(persisted || createDefaultVisualState(ontology.fingerprint), ontology.fingerprint);
  return { ontology, visualState: applySearchFilter(ontology, visualState) };
}

function persistIfReady(state: ViewerState): void {
  if (state.visualState) {
    savePersistedState(state.visualState);
  }
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  ontology: null,
  visualState: null,
  loading: false,
  error: null,
  initialize: async () => {
    set({ loading: true, error: null });
    const ontology = await parseOntologyBundle([
      { source: sampleOntology, sourceName: 'sample-ontology.ttl' },
      { source: sampleImportedOntology, sourceName: 'shared-core.ttl' },
    ]);
    const persisted = loadPersistedState(ontology.fingerprint);
    const visualState = normalizeVisualState(persisted || createDefaultVisualState(ontology.fingerprint), ontology.fingerprint);
    const next = { ontology, visualState: applySearchFilter(ontology, visualState) };
    set({ ontology: next.ontology, visualState: next.visualState, loading: false });
    persistIfReady(get());
  },
  importOntology: async (files) => {
    set({ loading: true, error: null });
    const next = await hydrateOntologyFiles(files);
    set({ ontology: next.ontology, visualState: next.visualState, loading: false });
    persistIfReady(get());
  },
  loadOntologyFromText: async (source, sourceName) => {
    set({ loading: true, error: null });
    const next = await hydrateOntology(source, sourceName);
    set({ ontology: next.ontology, visualState: next.visualState, loading: false });
    persistIfReady(get());
  },
  selectClass: (classId) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return { visualState: { ...state.visualState, selectedClassId: classId } };
    });
    persistIfReady(get());
  },
  setViewMode: (viewMode) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return { visualState: { ...state.visualState, viewMode } };
    });
    persistIfReady(get());
  },
  setSearchQuery: (searchQuery) => {
    set((state) => {
      if (!state.visualState || !state.ontology) {
        return state;
      }
      return { visualState: applySearchFilter(state.ontology, { ...state.visualState, searchQuery }) };
    });
    persistIfReady(get());
  },
  updateNodeState: (classId, patch) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      const current = ensureNodeState(state.visualState, classId);
      return {
        visualState: {
          ...state.visualState,
          nodeStates: {
            ...state.visualState.nodeStates,
            [classId]: { ...current, ...patch },
          },
        },
      };
    });
    persistIfReady(get());
  },
  updateEdgeState: (edgeId, patch) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      const current = ensureEdgeState(state.visualState, edgeId);
      return {
        visualState: {
          ...state.visualState,
          edgeStates: {
            ...state.visualState.edgeStates,
            [edgeId]: {
              ...current,
              ...patch,
            },
          },
        },
      };
    });
    persistIfReady(get());
  },
  setViewport: (viewport) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return {
        visualState: {
          ...state.visualState,
          viewport,
        },
      };
    });
    persistIfReady(get());
  },
  setLayoutSettings: (patch) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return {
        visualState: {
          ...state.visualState,
          layoutSettings: { ...state.visualState.layoutSettings, ...patch },
        },
      };
    });
    persistIfReady(get());
  },
  upsertGroup: (group) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      const existing = state.visualState.groups.filter((entry) => entry.id !== group.id);
      return {
        visualState: {
          ...state.visualState,
          groups: [...existing, group].sort((left, right) => left.label.localeCompare(right.label)),
        },
      };
    });
    persistIfReady(get());
  },
  assignGroupToSelected: (groupId) => {
    const selectedClassId = get().visualState?.selectedClassId;
    if (!selectedClassId) {
      return;
    }
    get().updateNodeState(selectedClassId, { groupId });
  },
  hideClass: (classId) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      const hiddenClassIds = state.visualState.hiddenClassIds.includes(classId)
        ? state.visualState.hiddenClassIds
        : [...state.visualState.hiddenClassIds, classId];
      return {
        visualState: {
          ...state.visualState,
          hiddenClassIds,
          selectedClassId: state.visualState.selectedClassId === classId ? null : state.visualState.selectedClassId,
        },
      };
    });
    persistIfReady(get());
  },
  restoreClass: (classId) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return {
        visualState: {
          ...state.visualState,
          hiddenClassIds: state.visualState.hiddenClassIds.filter((entry) => entry !== classId),
        },
      };
    });
    persistIfReady(get());
  },
  hideBranch: (classId) => {
    set((state) => {
      if (!state.visualState || !state.ontology) {
        return state;
      }
      const descendantIds = collectSubclassDescendants(state.ontology, classId);
      const hiddenClassIds = new Set(state.visualState.hiddenClassIds);
      for (const descendantId of descendantIds) {
        hiddenClassIds.add(descendantId);
      }
      return {
        visualState: {
          ...state.visualState,
          hiddenClassIds: [...hiddenClassIds],
          selectedClassId: descendantIds.includes(state.visualState.selectedClassId || '') ? classId : state.visualState.selectedClassId,
        },
      };
    });
    persistIfReady(get());
  },
  restoreAllHiddenClasses: () => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return {
        visualState: {
          ...state.visualState,
          hiddenClassIds: [],
        },
      };
    });
    persistIfReady(get());
  },
  importLayout: (nextState) => {
    set((state) => {
      if (!state.ontology || nextState.fingerprint !== state.ontology.fingerprint) {
        return { error: 'The imported layout belongs to a different ontology fingerprint.' };
      }
      return { visualState: applySearchFilter(state.ontology, normalizeVisualState(nextState, state.ontology.fingerprint)), error: null };
    });
    persistIfReady(get());
  },
  replaceVisualState: (updater) => {
    set((state) => {
      if (!state.visualState) {
        return state;
      }
      return { visualState: updater(state.visualState) };
    });
    persistIfReady(get());
  },
}));