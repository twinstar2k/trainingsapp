// Re-Export der reinen Metrik-Funktionen aus dem geteilten Modul (ADR-04, Single Source).
// App und Cloud Function nutzen dieselbe Quelle: shared/metrics.ts
// Bestehende Imports (`../utils/metrics` bzw. `@/utils/metrics`) bleiben dadurch unverändert.
export * from '../../shared/metrics';
