# „Zurück zum aktiven Training"-Banner

**Datum:** 2026-07-24
**Status:** Umgesetzt

## Problem

Wechselt der Nutzer während eines laufenden Trainings zu Übungen, Gewicht oder Profil (z. B. in der Satzpause, um Informationen nachzuschlagen), braucht er zwei Klicks zurück: Footer-Tab (Dashboard oder Training) → Trainingskarte. Nur aus dem Übungs-Verlauf geht es per „<" mit einem Klick zurück. Ziel: Von **jeder** Seite mit **einem** Klick zurück ins aktive Training.

## Entscheidung (UX)

Betrachtete Varianten:

1. **Banner-Leiste über der Bottom-Nav** (gewählt) — Spotify-Mini-Player-Stil, beschriftet, selbsterklärend, verdeckt keinen Inhalt dauerhaft.
2. Smarter Training-Tab (führt bei aktivem Training direkt hinein) — verworfen: Tab-Verhalten würde zustandsabhängig wechseln, Trainingsliste nur noch über Umweg erreichbar.
3. Floating Action Button — verworfen: verdeckt Inhalt, ohne Beschriftung weniger selbsterklärend.

Antippbare Pille direkt über der Bottom-Navigation: „**Aktives Training** · Datum" mit Hantel-Icon und Chevron. Ein Tap → `/trainings/{id}`. Sichtbar auf allen Seiten außer der Detailseite des aktiven Trainings selbst; ohne aktives Training kein Banner. Auf `/trainings/new` bewusst sichtbar (erinnert an ein vergessenes aktives Training, beugt Doppel-Trainings vor).

## Technisches Design

- **Hook `src/hooks/useActiveTraining.ts`:** `onSnapshot`-Listener auf `users/{uid}/trainings` mit `where('status','==','active') + orderBy('date','desc') + limit(1)`. Echtzeit statt Einmal-Fetch, weil `AppLayout` über Navigationen hinweg gemountet bleibt (gleicher Komponententyp in allen Routen) — ein `getDocs` würde nach Anlegen/Abschließen veralten. Der Composite-Index `status ASC, date DESC` existierte bereits in `firestore.indexes.json`; kein Index-/Rules-Deploy nötig. Erster onSnapshot-Listener im Frontend; kompatibel mit dem erzwungenen Long-Polling.
- **Kein Context:** Nur ein Konsument (AppLayout) — Hook genügt (Muster `useTemplates`). Bei künftigen weiteren Konsumenten (z. B. Dashboard-Kachel „Weiter trainieren") auf Context heben.
- **Komponente `src/components/layout/ActiveTrainingBanner.tsx`:** Pille (`bg-primary text-on-primary rounded-2xl`), Datum via `date-fns`/`de`. Kein Studio-Name (bräuchte zweiten Fetch), kein Timer, keine Animation (YAGNI).
- **`AppLayout.tsx`:** Positionierungsklassen (`fixed bottom-0 …`) auf einen Wrapper gehoben; Banner darüber, Nav-Optik unverändert. `main`-Padding wächst konditional `pb-28` → `pb-44`, damit die Pille keinen Inhalt verdeckt.

## Edge-Cases

- Mehrere aktive Trainings (Schema erzwingt keine Eindeutigkeit): `limit(1)` → das neueste gewinnt.
- Snapshot ausstehend oder Listener-Fehler: Banner aus (`console.error` im Fehler-Callback), App bleibt nutzbar.
- Training abgeschlossen/gelöscht: Snapshot feuert, Banner verschwindet ohne Reload.
