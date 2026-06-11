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

- **Templates nutzen / Sessions speichern:** Datenmodell existiert (`Templates` collection, `Template`-Typ in `src/types/index.ts`), aber kein UI zum Anlegen oder Anwenden beim Training-Start. Test-Feedback (Angela, 2026-06): Sessions ähneln sich oft → fertige Vorlagen „auf Knopfdruck" sparen das Neu-Aufsetzen und verbessern die UX für standardisiert Trainierende. **Aufwand geringer als es klingt — Infrastruktur ist halb da, es fehlt im Wesentlichen die UI.**
- **Notizen pro Training:** `Training.notes` ist im Typ definiert, aber wird nirgends erfasst oder angezeigt.
- **Übungen löschen:** _Bearbeiten ist erledigt_ (Update seit 2026-06: Name/Muskelgruppe/context_dependent/repsProgression über Stift-Button; Typ bleibt fix). Offen bleibt **Löschen** — und damit das schon notierte Ownership-Thema: Der Katalog ist global und jeder freigeschaltete User darf ihn schreiben (keine Admin-Rolle in den Rules). Sobald mehrere Tester denselben Katalog teilen, wäre ein Ownership-/Admin-Konzept nötig, bevor Löschen sinnvoll ist.
- **Zyklus-Awareness (Frauen):** Test-Feedback (Angela, 2026-06): Trainingsstrategie + KI-Coach sind implizit „männlich gedacht"; der Menstruationszyklus beeinflusst Leistung/Erholung. **Gute Nachricht:** die Engine ist bereits autoregulatorisch (RIR + tatsächlich geloggte Leistung) — ein schwacher Tag hält die Last automatisch; diese Basis ist schon frauenfreundlich, nur nicht benannt. Smarter MVP = Phase/Symptome optional loggen + Autoregulation absorbiert es + neutraler Coach-Ton; NICHT phasenbasierte Pläne verordnen (Evidenzlage dünn/umstritten). **Achtung Datenschutz:** Zyklus-/Symptomdaten sind DSGVO Art. 9 (sensible Gesundheitsdaten) — minimal/optional halten, nicht unbedacht an die LLM-Function. Verdient ein eigenes Konzept-Doc vor jedem Bau.
- **KI wählt Übungen aus (Stufe 2) + Trainingskonzepte:** Über die heutige „Sätze/Reps/Gewicht für gewählte Übungen"-Empfehlung hinaus auch die Übungsauswahl. Braucht ein Modell für Split-Konzepte (Push/Pull/Beine, 2er/3er-Split, Oberkörper/Unterkörper, Ganzkörper). Hängt eng mit „Templates/Sessions speichern" zusammen — eine gespeicherte „Push-Session" IST ein Split-Baustein; das Split-Vokabular wäre das gemeinsame Datenmodell für manuell (Templates) und automatisch (KI). → zusammen designen.
- **Datenimport:** Pendant zum JSON-Export – aus einem Backup wieder in Firestore zurückspielen. Aktuell nur per Hand über Console oder ad-hoc Admin-SDK-Script.
- **PWA-Installation:** Manifest + Service Worker → „Zum Home-Bildschirm hinzufügen" auf dem Handy, Offline-Fallback.
- **`completedAt`-Timestamp:** Aktuell kennt das Datenmodell nur `status`, kein Abschluss-Datum. Folge: Re-Open + erneutes Abschließen erhöht die Celebration-Zählung doppelt und es gibt keine harte Info, *wann* ein Training abgeschlossen wurde. Vorschlag: `completedAt` beim ersten Übergang auf `completed` setzen (nur wenn leer). Ermöglicht korrekte Zählung und Auswertungen wie „Abschlüsse pro Woche".

## Verbesserungen

- **Error Tracking im Frontend:** Sentry oder ähnliches – aktuell landet alles nur in `console.error`. Für Single-User Debugging via Devtools ok, für „warum hat es bei mir nicht funktioniert"-Fälle aber wertlos.
- **Migration der Wachstumsanzeige:** Falls die Trainingshistorie irgendwann groß wird, kommt der zweistufige Query (`Trainings → exercises → sets`) an Grenzen. Dann denormalisieren in einen `progressSnapshot`-Subdoc pro Übung.
