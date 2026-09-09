# Profil-Struktur: Einstellungs-Hub mit Unterseiten

**Datum:** 2026-08-22
**Status:** umgesetzt

## Ausgangslage

Das Profil war über die Zeit zur Sammelstelle geworden: sechs gleichrangige Blöcke
untereinander auf einer 318-Zeilen-Seite — Profilkopf mit Transparenz-Block, Studios (kompletter
Inline-CRUD samt Firestore-Aufrufen), Vorlagen-Link, Pausen-Timer, Coach-Ziel und ein
System-Block mit Export, Katalog-Seed und Abmelden.

Drei Probleme:

1. **Zu lang.** Alles gleichzeitig sichtbar, der gesuchte Punkt geht im Scrollen unter.
2. **Alles gleich gewichtet.** Selten genutzte Verwaltung (Studios anlegen, Seed, Export) stand
   optisch gleichrangig neben täglich genutzten Einstellungen (Pausen-Timer, Coach-Ziel).
3. **Kein Platz für Neues.** Jede kommende Einstellung wäre wieder ein handgebauter Block am
   Ende gewesen. Laut `docs/BACKLOG.md` stehen an: Split-Einstellungen, weitere Coach-Ziele,
   PWA/Benachrichtigungen, Datenimport und Zyklus-Awareness — letztere DSGVO Art. 9 und damit
   ein Thema, das einen klar abgegrenzten Ort braucht statt einer weiteren Zeile im Fließtext.

## Entscheidung

**Hub mit Unterseiten**, ein Thema pro Seite. `/profile` ist nur noch Einstieg: Profilkarte,
darunter drei kurze Gruppen aus Listenzeilen. Jede Zeile führt auf eine eigene Route und zeigt
im Hub bereits ihren **aktuellen Wert**.

```
/profile
  Profilkarte (Foto/Initiale, Name bzw. Spitzname, E-Mail, Stift für den Spitznamen)
  TRAINING     Pausen-Timer  „1:30, automatisch"  → /profile/rest-timer
               Dein Coach    „Progression"        → /profile/coach   (nur bei aktivem AI-Flag)
               Vorlagen      „3 Vorlagen"         → /templates
  STAMMDATEN   Studios       „2 Studios"          → /profile/studios
  KONTO        Daten & Datenschutz                → /profile/data
  [ Abmelden ]
```

Verworfene Alternativen:

- **Akkordeon auf einer Seite.** Billiger zu bauen (die vorhandene `CollapsibleSection` hätte
  gereicht), aber bei acht Gruppen wieder eine lange Liste, kein Deep-Link möglich, und ein
  Eingabeformular im Akkordeon springt beim Öffnen.
- **Drei grobe Sammelseiten** („Training & Coach", „Stammdaten", „Daten & Konto"). Weniger
  Routen, aber der Hub könnte pro Zeile keinen konkreten Wert mehr zeigen, und die Sammelseiten
  wachsen später selbst wieder zu.

## Warum der Wert im Hub steht

Die häufigste Frage an eine Einstellungsseite ist nicht „ich will etwas ändern", sondern „wie
steht es gerade?". Steht der Wert schon in der Übersicht, ist die Frage ohne Navigation
beantwortet. Solange ein Wert lädt, bleibt die Zeile **ohne** Wert — ein kurz angezeigter
Standardwert wäre eine Falschaussage, und ein Spinner würde den Hub blockieren.

## Bausteine

Der eigentliche Hebel gegen „kein Platz für Neues" sind drei propgesteuerte Komponenten in
`src/components/ui/`:

| Komponente | Aufgabe |
|---|---|
| `SettingsPage` | Rahmen jeder Unterseite: Zurück-Header (fest auf `/profile`, nicht `navigate(-1)`) + Titel/Untertitel. Zeichnet bewusst **keine** Karte, sonst gäbe es doppelte Kartenoptik. |
| `SettingsGroup` | Abschnittslabel + Karte mit `divide-y`-Liste — dasselbe Muster wie Übungskatalog und Trainingsliste. |
| `SettingsRow` | Eine Zeile: Icon, Titel, optionaler Hinweis, aktueller Wert, Chevron. Link (`to`) oder Aktion (`onClick`). |

Damit kostet eine neue Einstellung **eine Zeile** statt eines neuen Blocks.

Der Zurück-Knopf navigiert bewusst hart auf `/profile` statt `navigate(-1)`: Einstellungen sind
eine Hierarchie, kein Verlauf. Nach einem Deep-Link (`NewTraining` → `/profile/studios`) oder
einem Reload führt `-1` sonst aus der App heraus.

## Datenzugriff

Vorher machte die Seite ihre Firestore-Aufrufe selbst. Jetzt:

- `src/hooks/useStudios.ts` — Laden + Anlegen/Löschen von `users/{uid}/studios`, analog
  `useTemplates.ts`. Zwei Nutzer: die Studio-Seite und der Hub (nur `studios.length`).
- `src/hooks/useUserSettings.ts` — die Felder auf `users/{uid}`, die keinem Context gehören;
  heute nur `trainingGoal`. Ersetzt das doppelte Lesen in `Profile.tsx` **und**
  `RecommendationDialog.tsx`.

**Drei Schreiber auf einem Dokument.** `nickname` gehört dem `AuthContext`,
`restTimerMode/restSeconds/restSignal` dem `RestTimerContext`, alles Übrige dem neuen Hook. Das
ist nur deshalb unkritisch, weil alle drei disjunkte Felder anfassen und ausschließlich mit
`{ merge: true }` schreiben — ein volles `setDoc` würde die Felder der anderen löschen. Wer hier
ein Feld ergänzt, muss wissen, welcher der drei es besitzt.

`RecommendationDialog` wartet jetzt auf `settingsLoaded`, bevor es die Empfehlung anfordert.
Vorher las es das Ziel selbst und startete danach; jetzt käme die Anfrage sonst mit der
Voreinstellung los und würde ein abweichend eingestelltes Ziel überfahren. Damit der Hook nie
hängt, setzt er `loaded` auch dann, wenn es gar keinen Nutzer gibt.

## Mitgenommene Aufräumarbeiten

- Studio löschen nutzt den vorhandenen `ConfirmDialog` statt des nativen `confirm()`.
- Fehlerpfade (Spitzname, Export, Seed, Studio-CRUD) melden inline in `text-error` statt per
  `alert()` — Konvention „jede Komponente hat Loading- und Error-State".
- `Templates.tsx` hat einen Zurück-Knopf bekommen. Die Seite ist nur über das Profil erreichbar
  und hatte bisher keinen Rückweg außer der Bottom-Nav.
- Verweise nachgezogen: `NewTraining` verlinkt bei fehlendem Studio direkt auf
  `/profile/studios`; der Empty-State in `Exercises` nennt den neuen Ort des Seed-Buttons.

## Bewusst nicht enthalten

- Keine Änderung an der Bottom-Nav. Sie hebt `/profile/*` korrekt hervor, weil `AppLayout`
  bereits mit `startsWith` prüft.
- Kein Redesign von `GoalPicker` oder `RestTimerSettings` — beide wurden nur umgehängt.
- Keine Änderung an `firestore.rules`: keine neuen Felder, keine neuen Collections, nur eine
  andere Anordnung derselben Aufrufe.
