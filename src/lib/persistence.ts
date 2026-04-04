import type { PersistedViewerState } from '../types/ontology';

const STORAGE_PREFIX = 'oh-le-viewer:';

export function loadPersistedState(fingerprint: string): PersistedViewerState | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${fingerprint}`);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as PersistedViewerState;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedViewerState): void {
  window.localStorage.setItem(`${STORAGE_PREFIX}${state.fingerprint}`, JSON.stringify(state));
}