---
name: verify
description: Wie Änderungen an der Trainingsapp verifiziert werden — Build/Dev-Server-Handles und warum E2E hier manuell beim Nutzer liegt
---

# Verifikation Trainingsapp

## Handles

- Build/Typecheck: `npm run build` (Vite + tsc strict; Bundle-Size-Warnung > 500 kB ist bekannt/Backlog)
- Dev-Server: `npm run dev` — Ports 5173/5174 sind oft von anderen Projekten belegt (z. B. „TheraMind"), Vite weicht aus; tatsächlichen Port aus dem Log lesen
- Smoke ohne Login: `curl http://localhost:<port>/` (Titel „Trainingsapp") und `curl http://localhost:<port>/src/<pfad>.tsx` — prüft, dass neue Module transformieren und serviert werden

## Grenze: kein automatisiertes E2E

Die App ist hinter Google `signInWithPopup` + Private-Beta-Allowlist. Es gibt **keine
Firebase-Emulator-Konfiguration** — der Dev-Server liest/schreibt das **echte** Firestore
(`mvp-app-claude`). Automatisiertes Durchklicken ist daher doppelt blockiert:
Login-Popup nicht automatisierbar UND jede Interaktion mutiert Produktivdaten.

Konsequenz (entspricht Josefs Ship-Workflow): eingeloggte Flows verifiziert **Josef selbst**
via `npm run dev`, bevor gemergt/deployt wird. Im Verify-Report als BLOCKED (Auth-Wall)
ausweisen und ihm den lokalen Prüfpfad + Port nennen.
