# Design: Übungskarten-Kopf aufräumen (nach Live-Progressionsanzeige)

**Datum:** 2026-07-18
**Status:** Vom Nutzer freigegeben (Mockup-Iteration im Visual Companion, „Final B2")

## Kontext

Mit der Live-Progressionsanzeige waren im Kopf der Übungskarte viele Informationen
zusammengekommen: Name, Zuletzt-Label, zwei laute Badges (Muskelgruppe, Studio-gebunden),
Löschen-Button und der neue Balken-Block. Ziel: Informationshierarchie ordnen, ohne
Funktion zu verlieren.

## Entscheidungen

1. **Lese-Reihenfolge = chronologische Erzählung:**
   Name → „Zuletzt: 3 × 10 @ 50 kg" → Volumen-Balken (live) → „noch 300 kg bis Best (1.500 kg)".
   Erst was zuletzt war, dann wo man steht, dann was zum Bestwert fehlt.
2. **Muskelgruppe als kleines Badge am Namen** (Variante B2): das bekannte grüne Badge
   wandert in die Namenszeile statt einer eigenen Badge-Zeile — Wiedererkennung aus
   Katalog/Detailseite bleibt, hilft Anfängern bei der Muskel-Zuordnung.
3. **„Studio-gebunden"-Badge entfällt in der Übungskarte:** Die Information ist bei der
   Übungs*auswahl* relevant (Katalog/Detailseite zeigen sie weiterhin), nicht mitten im
   Training. Die Studio-Logik selbst (context_dependent-Vergleich) bleibt unverändert.

## Umsetzung

Nur `src/components/training/ExerciseCard.tsx`:
- Muskelgruppen-Badge inline neben den Namens-Button (gleiche Badge-Klassen, `ml-1.5 align-middle`)
- Badge-Zeile (Muskelgruppe + Studio-gebunden) entfernen
- Reihenfolge Zuletzt-Label → LiveProgressBar bleibt wie implementiert

`LiveProgressBar` und `useExerciseReference` bleiben unverändert.
