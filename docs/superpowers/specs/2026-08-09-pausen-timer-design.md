# Pausen-Timer für Satzpausen

**Stand:** 2026-08-09 · **Status:** implementiert, Feldtest offen

## Warum

Die Pause zwischen den Sätzen wurde mit der iPhone-Stoppuhr gemessen: nach jedem Satz aus
der App raus, Stoppuhr starten, zurück. Der Timer gehört dorthin, wo der Satz abgehakt
wird — Abhaken und Pause starten sollen **eine** Handlung sein.

Die Pausendauer ist nicht konstant (persönlich 60 s bis 4 min in 30-s-Schritten), muss also
einstellbar sein — aber in einem sinnvollen Rahmen. Andere Nutzer bewegen sich zwischen
30 s und 5 min oder mehr, deshalb **0:30–10:00 in 30-s-Schritten**.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Start | Automatisch beim Abhaken; im Profil auf „nur manuell“ oder „aus“ umstellbar |
| Dauer | Globaler Standardwert im Profil + `±30 s` an der laufenden Pause (gilt nur für diese) |
| Signal | Kurzer steigender Zweiklang über Web Audio, oder „nur visuell“ |
| Lebensdauer | Überlebt In-App-Seitenwechsel und Reload; **nicht** den Wechsel in eine andere App |
| Sichtbarkeit | Leiste nur auf der Trainingsseite; anderswo läuft der Timer unsichtbar weiter |

## Aufbau

```
src/utils/restTimer.ts       reine Rechenlogik (Raster, Restzeit, Wiederherstellung)
src/lib/restSignal.ts        Web-Audio-Mechanik (freischalten + Ton)
src/contexts/RestTimerContext.tsx   Zustand oberhalb des Routers, Intervall, Wake Lock
src/components/training/RestTimerBar.tsx        Leiste über der Navigation
src/components/training/RestTimerSettings.tsx   Profil-Block
eval/rest-timer.test.mjs · eval/rest-signal.test.mjs
```

Der Zustand liegt **oberhalb des Routers** (`src/App.tsx`), nicht in `TrainingDetail`: Wer
während der Pause den Verlauf einer Übung nachschlägt, darf seine Pause nicht verlieren.
Die Leiste wird trotzdem nur im Training gerendert — Sichtbarkeit und Lebensdauer sind zwei
verschiedene Dinge. Ein Reload wird über `localStorage` überlebt.

`toggleSetStatus` (`src/hooks/useTrainingSession.ts`) gibt den neuen Status zurück, damit
nur das Abhaken die Pause startet, nicht das Ent-Haken — dasselbe Muster wie
`toggleTrainingStatus`.

Einstellungen liegen auf `users/{uid}`: `restTimerMode`, `restSeconds`, `restSignal`.
Kein Rules-Deploy nötig, das User-Dokument hat keine `hasOnly`-Validierung.

## Was am Gerät gemessen wurde

Vier Annahmen aus dem Entwurf haben sich am iPhone (iOS 26.5, Safari **und** Chrome) als
falsch erwiesen. Sie stehen hier, damit sie niemand erneut ausprobiert.

**1. Die Musik lässt sich nicht „kurz unterbrechen“.** `audioSession.type = 'transient-solo'`
stoppt die Wiedergabe, setzt sie aber nie von allein fort. Der Modus wäre ein Versprechen
gewesen, das das System nicht einlöst.

**2. Das Setzen der Audio-Session stoppt in Chrome für iOS die Musik.** Isoliert gemessen:
`audioSession.type = 'ambient'` allein ist harmlos, ein `AudioContext` allein auch — beides
zusammen stoppt sie sofort. Eine explizit gesetzte Kategorie verlässt `auto` und wird dort
exklusiv angewandt, sobald der Kontext startet. Safari mischt bei `ambient` korrekt, deshalb
war der Fehler nur in einem Browser sichtbar.

**3. Die Audio Session API gibt es nur in WebKit** (MDN: Safari 16.4+, iOS 16.4+, WebView on
iOS). Auf Android und im Desktop-Chrome hätte eine Einstellung „Musik stoppen“ stumm gar
nichts getan.

→ Konsequenz aus 1–3: Die API wird **nicht** benutzt. Das Signal ist ein Ton über Web Audio,
das es überall gibt. Beim Training stecken Kopfhörer im Ohr — der Ton geht dorthin und nicht
in den Raum, die ursprüngliche Sorge um die Ruhe im Studio trifft den Fall gar nicht. Pegel
`0.6` gegen Musik im Kopfhörer verglichen; 0.15 und 0.35 gingen unter.

**4. Die Seite lässt sich im Hintergrund nicht am Leben halten.** Weder ein stiller
Web-Audio-Loop (`AudioContext` wird `interrupted`) noch ein stilles `<audio>`-Element
verhindern das Einfrieren — gemessen 24 s Stillstand, das Signal danach mit
`NotAllowedError` abgelehnt. Der Timer ist ein **Vordergrund-Timer**; der Wake Lock ist
keine Bequemlichkeit, sondern die tragende Maßnahme.

Dazu kam ein Fehler, der unabhängig davon existiert: iOS unterbricht den `AudioContext`,
während die Musik-App den Audio-Fokus hält. Zwischen Freischalten und Ablauf liegen Minuten,
und ein Start auf einem unterbrochenen Kontext erzeugt keinen Ton — das Signal kam „mal ja,
mal nein“. `fireSignal` fährt den Kontext deshalb erst hoch.

**5. `state === 'running'` ist kein Beleg dafür, dass ein Ton auch rauskommt** (Studio-Test
2026-08-22, Preview-Channel, Chrome/Safari iOS). Das Diagnoseprotokoll zeigte 14 Einträge
„played · running“, tatsächlich blieb der Ton mehrfach aus — immer nach einem Wechsel zur
Musik-App und zurück, nie beim Verbleib in der App. Der Beweis: Beim nächsten Abhaken
(`primeAudio` → `resume()`) wurde der fehlende Ton **nachgeliefert**. iOS hält also den
Render-Thread an, lässt `state` aber auf `running`; die geplanten Oszillatoren warten in
einer stehenden Queue. Ob iOS die Unterbrechung stattdessen ehrlich als `interrupted` meldet,
ist nicht vorhersagbar — daher „nicht reproduzierbar“. Einzige Wahrheit ist, ob
`currentTime` vorankommt. `fireSignal` macht deshalb vor dem Ton eine **Clock-Probe**
(60 ms): steht die Clock, erst `suspend()`+`resume()` („kick“), hilft das nicht, Kontext
schließen und neu anlegen („recreate“). Der Pfad steht im Protokoll (`clockBefore`, `path`).

## Bekannte Grenzen

- **App-Wechsel:** Die Restzeit stimmt bei der Rückkehr (sie wird aus dem Zielzeitstempel
  gerechnet, nicht heruntergezählt), das Signal kommt aber verspätet. Die Leiste zeigt
  deshalb „vor 1:23 abgelaufen“ und blendet sich erst 15 s **nach der Rückkehr** aus.
- **Reload mitten in der Pause:** Der Countdown läuft weiter, der Ton bleibt aus — Audio
  braucht eine Nutzergeste, und beim Neuladen gab es keine.
- **Vibration:** auf iOS nicht vorhanden (`navigator.vibrate` fehlt), auf Android ein
  zusätzlicher Kanal.

## Bewusst nicht enthalten

- **Keine Pause pro Übung.** `TrainingExercise.restSeconds` existiert, wird von der
  KI-Empfehlung geschrieben und bleibt unangetastet. Naheliegender Folgeschritt.
- **Keine Push-Benachrichtigungen.** Der einzige Weg zu einem Signal im Hintergrund wäre
  PWA-Installation plus Web Push von einer Cloud Function — viel Apparat für 90 Sekunden
  Wartezeit, mit unzuverlässiger Zustellzeit. Backlog.
- **Keine Timer-Leiste außerhalb der Trainingsseite.**
- **Kein Speichern der Pausenzeiten in Firestore** — keine Pausen-Statistik.

## Wie es geprüft wird

`cd eval && npm test` — 52 Assertions für die Rechenlogik, 20 für die Audio-Mechanik mit
Browser-Attrappen. Der Signal-Test bewacht ausdrücklich die Regel, an der zwei Fehler
hingen: **`navigator.audioSession` darf nirgends angefasst werden**, und der Kontext wird
vor dem Signal hochgefahren.

Am Gerät bleibt manuell: Ton über der Musik hörbar, Display bleibt an, Reload mitten in der
Pause, Ent-Haken startet nichts, „Training abschließen“ nicht verdeckt.
