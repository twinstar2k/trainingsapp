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

/**
 * Ob der Studioname im Verlauf angezeigt werden soll.
 *
 * Der Normalfall ist **ein** Studio — dann ist die Angabe reines Rauschen, weil es nichts zu
 * unterscheiden gibt. Erst ab zwei angelegten Studios erklärt sie, warum der Verlauf genau
 * diese Einheiten zeigt (und im neuen Studio zunächst leer ist).
 *
 * Bewusst an der Zahl der **angelegten Studios** festgemacht, nicht daran, ob diese Übung
 * schon in mehreren Studios vorkommt: Letzteres wüsste man erst nach einer ungefilterten Suche
 * über die gesamte Historie — und das Label fehlte ausgerechnet beim ersten Training im neuen
 * Studio, wo der leere Verlauf am meisten Erklärung braucht.
 */
export function isStudioLabelRelevant(
  contextDependent: boolean,
  studioCount: number,
  studioName: string,
): boolean {
  return contextDependent && studioCount > 1 && studioName !== '';
}
