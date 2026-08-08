// Studio-Filterregel für context_dependent-Übungen.
// Single Source für App UND Cloud Functions (ADR-04).
//
// Fachlicher Kern: Bei Maschinen- und Seilzugübungen (`contextDependent`) sind Gewichte nur
// innerhalb desselben Studios vergleichbar — Rollenübersetzungen und Maschineneinstellungen
// unterscheiden sich. Historie darf deshalb nie studioübergreifend gemischt werden.
//
// Warum es das gibt (Bug 2026-08-08): Die Verlaufsseite ermittelte das Studio asynchron und
// prüfte `if (contextDependent && currentStudioId)`. Solange `currentStudioId` noch leer war,
// fiel sie in den else-Zweig und lud ÜBER ALLE STUDIOS — der Verlauf mischte David Lloyd und
// peoples. Zusammen mit fehlendem Effect-Cleanup konnte dieser gemischte Stand dauerhaft
// stehen bleiben. Die Regel macht daraus einen expliziten dritten Zustand: noch nicht laden.

export interface StudioFilter {
  /** Studio, auf das gefiltert wird — `null` bedeutet bewusst „alle Studios". */
  filterStudioId: string | null;
  /** `false` = Studio noch unbekannt → NICHT laden (kein ungefilterter Ersatz). */
  ready: boolean;
}

/**
 * Entscheidet, ob und wie die Historie einer Übung nach Studio gefiltert wird.
 *
 * - globale Übung → ungefiltert, sofort ladbar
 * - studiogebunden mit bekanntem Studio → auf dieses Studio gefiltert
 * - studiogebunden ohne Studio → `ready: false`, es wird gar nicht geladen
 */
export function resolveStudioFilter(
  contextDependent: boolean,
  studioId: string | null | undefined,
): StudioFilter {
  if (!contextDependent) return { filterStudioId: null, ready: true };
  if (!studioId) return { filterStudioId: null, ready: false };
  return { filterStudioId: studioId, ready: true };
}
