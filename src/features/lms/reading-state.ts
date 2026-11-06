/**
 * Preserves document reader viewport states across view switches and sessions.
 * Caches zoom, page number, and scroll offsets per document identifier.
 */

export interface ReadingState {
  page: number;
  zoom: number;
  scrollTop: number;
  updatedAt: number;
}

const MEMORY_CACHE = new Map<string, ReadingState>();

export function getReadingState(fileKey: string): ReadingState {
  if (MEMORY_CACHE.has(fileKey)) {
    return MEMORY_CACHE.get(fileKey)!;
  }

  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(`lifeos:reading:${fileKey}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ReadingState;
        MEMORY_CACHE.set(fileKey, parsed);
        return parsed;
      }
    } catch {
      // Fallback to default
    }
  }

  return {
    page: 1,
    zoom: 1.0,
    scrollTop: 0,
    updatedAt: Date.now(),
  };
}

export function saveReadingState(fileKey: string, update: Partial<ReadingState>): void {
  const current = getReadingState(fileKey);
  const next: ReadingState = {
    ...current,
    ...update,
    updatedAt: Date.now(),
  };

  MEMORY_CACHE.set(fileKey, next);

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(`lifeos:reading:${fileKey}`, JSON.stringify(next));
    } catch {
      // Session storage quota or private mode fallback
    }
  }
}
