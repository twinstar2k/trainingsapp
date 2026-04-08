# Backlog

Lose Sammlung von Ideen und „Nice to have"-Punkten. Keine Verpflichtung, keine Reihenfolge – wird abgearbeitet, wenn Lust und Zeit da sind.

## Technische Härtung

- **Backup-Monitoring:** Aktuell erfährt man nicht, wenn `run-backup.sh` still scheitert (z. B. abgelaufene Service-Account-Credentials, kein Netz, GitHub-Token rotiert). Mögliche Mini-Lösungen:
  - `mail`-Versand an die eigene Adresse bei Exit-Code != 0
  - Healthcheck-Ping (z. B. healthchecks.io) am Ende des Scripts – dort kommt eine Mail, wenn der erwartete Ping ausbleibt
- **Tests:** Aktuell keine. Bei Single-User-Hobby ok, aber sobald ein größeres Refactor ansteht (z. B. Templates, Mehrfach-Studio, Datenmigration), wären zumindest Smoke-Tests für die kritischen Pfade (Training anlegen, Sätze speichern, Status-Toggle) sinnvoll. Vorschlag: Vitest + React Testing Library, gezielt auf 2-3 Pages.
- **CI/CD:** GitHub-Action-Workflow, der bei Push auf `main` automatisch `npm run build && firebase deploy --only hosting` ausführt. Spart das manuelle Deployen, ~30 Zeilen YAML. Voraussetzung: Firebase-Service-Account als GitHub-Secret hinterlegen.
- **Bundle-Size:** Vite warnt aktuell, dass das Bundle > 500 kB ist. Bei mobilem Erstaufruf merkbar. Lösung: dynamisches Import-Splitting für Recharts (wird nur auf ExerciseDetail-Seite gebraucht).
- **Firestore-Rules serverseitig härten:** Aktuell ist der Edit-Lock für abgeschlossene Trainings nur clientseitig durchgesetzt. Ein motivierter Angreifer könnte mit Devtools weiter schreiben. Rules-seitig wäre eine `get()`-Prüfung auf das Parent-Training nötig (kostet ein extra Read pro Write). Bei Single-User unnötig, bei Multi-User zwingend.

## Features

- **Templates nutzen:** Datenmodell existiert (`Templates` collection), aber kein UI zum Anlegen oder Anwenden beim Training-Start.
- **Notizen pro Training:** `Training.notes` ist im Typ definiert, aber wird nirgends erfasst oder angezeigt.
- **Übungen bearbeiten/löschen:** Aktuell nur `create` möglich – ein Tippfehler im Übungsnamen bleibt für immer im Katalog. Update/Delete wäre sinnvoll, aber muss wg. global geteiltem Katalog vorsichtig (Ownership-Feld?) gemacht werden.
- **Datenimport:** Pendant zum JSON-Export – aus einem Backup wieder in Firestore zurückspielen. Aktuell nur per Hand über Console oder ad-hoc Admin-SDK-Script.
- **PWA-Installation:** Manifest + Service Worker → „Zum Home-Bildschirm hinzufügen" auf dem Handy, Offline-Fallback.

## Verbesserungen

- **Error Tracking im Frontend:** Sentry oder ähnliches – aktuell landet alles nur in `console.error`. Für Single-User Debugging via Devtools ok, für „warum hat es bei mir nicht funktioniert"-Fälle aber wertlos.
- **Migration der Wachstumsanzeige:** Falls die Trainingshistorie irgendwann groß wird, kommt der zweistufige Query (`Trainings → exercises → sets`) an Grenzen. Dann denormalisieren in einen `progressSnapshot`-Subdoc pro Übung.
