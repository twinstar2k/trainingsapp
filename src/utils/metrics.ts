/**
 * Epley formula: estimated one-rep max.
 * Only reliable for reps <= 15. Returns null for higher rep counts.
 */
export function calculate1RM(weight: number, reps: number): number | null {
  if (reps > 15 || reps <= 0 || weight <= 0) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface SetData {
  reps?: number;
  weight?: number;
  duration?: number; // minutes
  distance?: number; // km
}

/**
 * Best estimated 1RM across all sets in a session.
 * Returns null if no valid set exists (all reps > 15 or no weighted sets).
 */
export function bestSessionOneRM(sets: SetData[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.reps == null || s.weight == null) continue;
    const rm = calculate1RM(s.weight, s.reps);
    if (rm != null && (best === null || rm > best)) {
      best = rm;
    }
  }
  return best;
}

/** Total volume: Σ(weight × reps) across all sets. */
export function sessionVolume(sets: SetData[]): number {
  return sets.reduce((sum, s) => {
    if (s.reps == null || s.weight == null) return sum;
    return sum + s.weight * s.reps;
  }, 0);
}

/** Highest weight used in any set. */
export function sessionMaxWeight(sets: SetData[]): number {
  return sets.reduce((max, s) => {
    if (s.weight == null) return max;
    return s.weight > max ? s.weight : max;
  }, 0);
}

/** Max reps in any single set (for reps_only exercises). */
export function sessionMaxReps(sets: SetData[]): number {
  return sets.reduce((max, s) => {
    if (s.reps == null) return max;
    return s.reps > max ? s.reps : max;
  }, 0);
}

/** Total reps summed across all sets in a session. */
export function sessionTotalReps(sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

/** Total duration in minutes summed across all sets. */
export function sessionTotalDuration(sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + (s.duration ?? 0), 0);
}

/** Total distance in km summed across all sets. */
export function sessionTotalDistance(sets: SetData[]): number {
  return sets.reduce((sum, s) => sum + (s.distance ?? 0), 0);
}

/**
 * Pace as decimal minutes per km (totalMin / totalKm).
 * Returns null when distance is 0 or duration is 0.
 */
export function sessionPace(sets: SetData[]): number | null {
  const totalMin = sessionTotalDuration(sets);
  const totalKm = sessionTotalDistance(sets);
  if (totalKm <= 0 || totalMin <= 0) return null;
  return totalMin / totalKm;
}

/** Format decimal-minute pace as "M:SS min/km" (e.g. 5.4545 → "5:27"). */
export function formatPace(paceMin: number): string {
  const min = Math.floor(paceMin);
  const sec = Math.round((paceMin - min) * 60);
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Formats the set structure of a session as a human-readable label.
 *
 * Weighted: "3 × 10 @ 50 kg" (wenn alle Sätze gleich)
 *           "bester Satz: 10 Wdh @ 50 kg" (wenn Sätze gemischt)
 * Reps only: "3 × 12 Wdh" or "max. 15 Wdh"
 */
export function formatLastSessionLabel(sets: SetData[], type: 'weighted' | 'reps_only'): string {
  const doneSets = sets.filter(s => s.reps != null && s.reps > 0);
  if (doneSets.length === 0) return '';

  if (type === 'reps_only') {
    const maxReps = sessionMaxReps(doneSets);
    const allSame = doneSets.every(s => s.reps === doneSets[0].reps);
    if (allSame && doneSets.length > 1) {
      return `${doneSets.length} × ${maxReps} Wdh`;
    }
    return `max. ${maxReps} Wdh`;
  }

  // weighted
  const weightedSets = doneSets.filter(s => s.weight != null && s.weight > 0);
  if (weightedSets.length === 0) return '';

  const allSameWeight = weightedSets.every(s => s.weight === weightedSets[0].weight);
  const allSameReps = weightedSets.every(s => s.reps === weightedSets[0].reps);

  if (allSameWeight && allSameReps) {
    return `${weightedSets.length} × ${weightedSets[0].reps} @ ${weightedSets[0].weight} kg`;
  }

  // Mixed sets: show the best set (highest 1RM, fallback to highest weight)
  let bestSet = weightedSets[0];
  for (const s of weightedSets) {
    const curr1RM = calculate1RM(s.weight!, s.reps!) ?? 0;
    const best1RM = calculate1RM(bestSet.weight!, bestSet.reps!) ?? 0;
    if (curr1RM > best1RM) bestSet = s;
  }
  return `bester Satz: ${bestSet.reps} Wdh @ ${bestSet.weight} kg`;
}
