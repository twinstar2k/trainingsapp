# Feature: KI-Trainingsempfehlung (AI Recommendation)

> Status: **Konzept / Entwurf** — Basis für die spätere Umsetzung. Noch nichts implementiert.

## Kontext & Problemstellung

Heute legt der User ein Training rein manuell an: Datum, Studio, Übungen, Sätze, Reps, Gewichte. Er muss selbst entscheiden, ob er heute steigern, halten oder entlasten sollte — und mit welchem konkreten Gewicht. Diese Entscheidung trifft er nach Bauchgefühl, obwohl die App den dafür nötigen Kontext bereits kennt: den **bisherigen Trainingsverlauf**.

Die Idee: Auf Wunsch (per Klick) hält ein LLM **zwei Dimensionen** gegeneinander und schlägt den für diesen Tag logischen Trainingsaufbau vor:

1. **Trainingsziel** (z. B. Progression, Hypertrophie, Kraft, Deload)
2. **Bisheriger Trainingsverlauf** (letzte Sessions, beste Leistung, Trend, je nach `contextDependent` studio-bezogen)

Bei Bestätigung wird der Vorschlag automatisch als Training angelegt.

**Leitprinzip der App bleibt gültig:** Datenqualität vor Feature-Vielfalt. Die Empfehlung respektiert `contextDependent` (Maschinengewichte nicht studioübergreifend vergleichen) und schlägt nichts vor, was die vorhandene Datenbasis nicht hergibt.

---

## Leitentscheidungen (bereits getroffen)

| Entscheidung | Wahl | Begründung |
|---|---|---|
| **LLM-Betrieb** | Hosted-API hinter Backend (Firebase Cloud Function → LLM-API) | Skaliert auf viele Nutzer; API-Key bleibt serverseitig. Provider hinter dünner Schnittstelle, später austauschbar. |
| **Scope** | Phasiert: **Stufe 1 = Progression auf gewählten Übungen** (MVP), **Stufe 2 = volles Session-Design** | Stufe 1 liefert ~80 % des Werts bei deutlich geringerem Risiko und ist Fundament für Stufe 2. |

---

## Kernkonzept

### Die zwei Wege bleiben erhalten

- **Weg A — manuell (unverändert):** Training anlegen wie bisher. Die KI ist rein additiv und niemals verpflichtend.
- **Weg B — KI-Empfehlung:** Per Klick eine Empfehlung holen, prüfen, anpassen, übernehmen.

### Das „Sandwich"-Prinzip (für Sicherheit & Verlässlichkeit)

Die KI „macht nicht alles allein". Der Ablauf ist dreistufig:

1. **Code baut den Kontext** — kuratierte Verlaufs-Zusammenfassung + Ziel (serverseitig, nicht vom Client diktiert).
2. **LLM macht das Reasoning** — schlägt Aufbau vor, in einem strikt strukturierten Format.
3. **Code validiert hart** — gegen Übungskatalog, Progressionsgrenzen und `contextDependent`, *bevor* dem User etwas gezeigt oder angelegt wird.

Das adressiert die drei größten Risiken in einem Zug: Halluzination (erfundene Übungen), Verletzungsrisiko (zu große Gewichtssprünge) und das saubere automatische Anlegen.

### Trainingsziele

| Ziel-Schlüssel | Bedeutung | Typische Rep-Range | Progressions-Charakter |
|---|---|---|---|
| `progression` | Progressive Overload (Standard) | 6–12 | Moderat steigern, wenn letzte Einheit sauber geschafft |
| `hypertrophy` | Muskelaufbau | 8–12 | Volumen-orientiert, moderate Last |
| `strength` | Maximalkraft | 3–6 | Höhere Last, weniger Reps, konservative Sprünge |
| `endurance` | Kraftausdauer | 15+ | Mehr Reps, geringere Last |
| `maintenance` | Halten | wie zuletzt | Gewicht/Reps konstant halten |
| `deload` | Entlastungswoche | reduziert | Last bewusst ~10–20 % senken |

**Ablage:** Ein Standard-Ziel am User-Profil (`trainingGoal`), das pro Empfehlungs-Anfrage übersteuert werden kann.

---

## User Stories — Stufe 1 (MVP)

### US-01: Trainingsziel festlegen
**Als** eingeloggter User
**möchte ich** ein Standard-Trainingsziel setzen (und pro Empfehlung übersteuern können)
**damit** die Empfehlung zu meiner aktuellen Absicht passt

**Priorität:** Must · **Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** ich bin im Profil
   **When** ich ein Standard-Trainingsziel aus der Liste wähle
   **Then** wird es am User-Profil gespeichert und als Default für künftige Empfehlungen verwendet
2. **Given** ich fordere eine Empfehlung an
   **When** der Empfehlungs-Dialog öffnet
   **Then** ist mein Standard-Ziel vorausgewählt, ich kann es aber für *diese* Empfehlung ändern, ohne den Default zu überschreiben
3. **Given** ich habe noch kein Ziel gesetzt
   **When** ich zum ersten Mal eine Empfehlung anfordere
   **Then** ist `progression` als sinnvoller Default vorausgewählt

---

### US-02: Empfehlung anfordern
**Als** eingeloggter User
**möchte ich** beim Anlegen eines Trainings per Klick eine KI-Empfehlung für die gewählten Übungen holen
**damit** ich nicht selbst Gewicht/Reps für heute schätzen muss

**Priorität:** Must · **Aufwand:** L

**Akzeptanzkriterien:**
1. **Given** ich habe Datum, Studio und mindestens eine Übung (manuell oder via Template) gewählt
   **When** ich auf „KI-Empfehlung holen" tippe
   **Then** wird eine Empfehlung serverseitig erzeugt und ein Lade-Zustand angezeigt (Empfehlung kann einige Sekunden dauern)
2. **Given** eine context_dependent-Übung ist dabei
   **When** die Empfehlung erzeugt wird
   **Then** wird ausschließlich die Historie **desselben Studios** als Grundlage genutzt
3. **Given** ich habe (noch) keine Übungen gewählt
   **When** ich den Button sehe
   **Then** ist er deaktiviert mit Hinweis „Wähle zuerst Übungen aus" (Stufe 1 schlägt keine Übungen vor — das ist Stufe 2)

---

### US-03: Empfehlung als editierbare Vorschau prüfen
**Als** eingeloggter User
**möchte ich** den Vorschlag vor dem Übernehmen sehen und anpassen können
**damit** ich die Kontrolle behalte und nichts Unpassendes automatisch angelegt wird

**Priorität:** Must · **Aufwand:** M

**Akzeptanzkriterien:**
1. **Given** eine Empfehlung wurde erzeugt
   **When** sie angezeigt wird
   **Then** sehe ich pro Übung: vorgeschlagene Sätze (Reps × Gewicht), empfohlene Pause und eine kurze Begründung
2. **Given** ich sehe die Vorschau
   **When** ich einen Wert (Reps/Gewicht/Satz) ändere oder einen Satz lösche/ergänze
   **Then** wird die Änderung in die Vorschau übernommen, bevor ich bestätige
3. **Given** eine Übung hat noch keine Historie
   **When** die Empfehlung gezeigt wird
   **Then** ist der Vorschlag als „Startwert — vorsichtig herantasten" markiert
4. **Given** ein vorgeschlagenes Gewicht wurde durch eine Leitplanke begrenzt
   **When** ich die Übung ansehe
   **Then** ist das erkennbar (z. B. „auf +X % zur letzten Einheit gedeckelt")

---

### US-04: Empfehlung übernehmen (auto-anlegen)
**Als** eingeloggter User
**möchte ich** die (ggf. angepasste) Empfehlung mit einem Klick als Training anlegen
**damit** ich sofort mit dem Training starten kann

**Priorität:** Must · **Aufwand:** M

**Akzeptanzkriterien:**
1. **Given** ich habe die Vorschau geprüft
   **When** ich auf „Übernehmen" tippe
   **Then** werden Übungen und Sätze exakt wie in der Vorschau im Training angelegt (gleicher Pfad wie beim manuellen Anlegen) und ich lande im Trainingsdetail
2. **Given** ich verwerfe die Empfehlung
   **When** ich „Abbrechen" tippe
   **Then** bleibt mein bisheriges (manuelles) Setup unverändert erhalten
3. **Given** die Übernahme schlägt teilweise fehl (z. B. Netzfehler beim Schreiben)
   **When** der Fehler auftritt
   **Then** erhalte ich eine klare Fehlermeldung und keine halb angelegten Inkonsistenzen bleiben unkommentiert zurück

---

### US-05: Nachvollziehbarkeit & Vertrauen
**Als** eingeloggter User
**möchte ich** verstehen, warum die KI etwas vorschlägt
**damit** ich der Empfehlung vertrauen (oder begründet abweichen) kann

**Priorität:** Should · **Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** eine Empfehlung wird gezeigt
   **When** ich sie ansehe
   **Then** sehe ich eine kurze Gesamt-Begründung (z. B. „Letzte Einheit sauber geschafft → moderate Steigerung") und pro Übung eine knappe Einzel-Begründung
2. **Given** die Empfehlung basiert auf Ziel X und Verlauf Y
   **When** ich die Begründung lese
   **Then** ist erkennbar, welches Ziel zugrunde lag

---

### US-06: Fehler- & Grenzfälle
**Als** eingeloggter User
**möchte ich** auch dann eine sinnvolle Reaktion bekommen, wenn die KI nicht liefern kann
**damit** das Feature nie das manuelle Anlegen blockiert

**Priorität:** Must · **Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** der LLM-Dienst ist nicht erreichbar oder antwortet ungültig (auch nach Retry)
   **When** ich eine Empfehlung anfordere
   **Then** sehe ich eine freundliche Fehlermeldung und kann ganz normal manuell weitermachen
2. **Given** keine der gewählten Übungen hat Historie
   **When** ich eine Empfehlung anfordere
   **Then** bekomme ich konservative Startwerte mit entsprechendem Hinweis (kein „leerer" Vorschlag)
3. **Given** die LLM-Antwort verletzt eine Leitplanke (erfundene Übung, absurdes Gewicht)
   **When** die Validierung greift
   **Then** wird die Verletzung serverseitig korrigiert (geklammert) oder die Empfehlung abgelehnt — nie wird ein ungültiger Vorschlag angezeigt

---

## User Stories — Stufe 2 (spätere Ausbaustufe, nicht MVP)

> Nur grob skizziert; eigenes Detailkonzept bei Umsetzung.

- **US-2.1 — KI wählt die Übungen selbst:** Auf Basis von Ziel, Verlauf, zuletzt trainierten Muskelgruppen und Erholung schlägt die KI einen kompletten Trainingsaufbau inkl. Übungsauswahl vor (Split-Logik, Muskelgruppen-Balance).
- **US-2.2 — Erholungs-Bewusstsein:** Berücksichtigt, welche Muskelgruppen in den letzten Tagen belastet wurden (keine zwei harten Bein-Tage in Folge).
- **US-2.3 — Automatische Deload-Erkennung:** Schlägt bei Stagnation/Ermüdungssignalen eine Entlastung vor.
- **US-2.4 — Wochenplanung:** Mehrere Trainings über die Woche statt nur „heute".

---

## Nicht im Scope (bewusst ausgeklammert)

- **Stufe 1 schlägt keine Übungen vor** — der User wählt die Übungen, die KI füllt nur Sätze/Reps/Gewichte/Pausen (Übungsauswahl = Stufe 2).
- Lokales LLM / On-Device (bewusst gegen Hosted-API entschieden; Provider-Abstraktion hält die Tür offen).
- Echtzeit-Coaching während des Trainings („nächster Satz jetzt schwerer").
- Ernährungs-/Schlaf-/Wellness-Empfehlungen.
- Soziale/Vergleichs-Features über mehrere User.
- Voll automatisches Anlegen ohne Bestätigung (Mensch bleibt immer in der Schleife).

---

## Offene Fragen (im Architektur-/Umsetzungsschritt zu klären)

1. ~~**LLM-Provider/-Modell:**~~ → **Entschieden:** Modell-Zugang über EU-Gateway **Requesty** (EU-Endpunkt + EU-Modell, Provider-Abstraktion). Start mit kostengünstigem EU-Modell (z. B. `vertex/gemini-3.5-flash@eu` oder `bedrock/claude-3-5-haiku@eu-central-1`), Upgrade zu `bedrock/claude-sonnet-4-5-v2@eu-central-1`. Begründung & EU-Modell-Liste: Architektur-Doc ADR-03 + §6 „DSGVO / EU-Datenresidenz".
2. **Pausen speichern?** Empfehlung enthält Pausen. Werden sie pro Satz/Übung persistiert (neues optionales Feld) oder nur angezeigt? Vorschlag: optionales Feld, MVP zeigt zumindest an.
3. **Konkrete Progressions-Caps:** z. B. „max. +10 % oder +5 kg, je nachdem was kleiner ist". Defaults im Architektur-Doc, später feinjustierbar.
4. **Eval/Qualitätsmessung:** Vorschlag — jede Empfehlung mit Input-Snapshot, Output, Modell und Akzeptanz-Status loggen; Akzeptanzquote + manuelle Stichproben als erste Qualitätsmetrik.
5. **Standing-Goal vs. nur per-Request:** Vorschlag — beides (Default am Profil + Übersteuerung pro Anfrage).

---

## Abhängigkeiten & Voraussetzungen

- **Firebase Blaze-Plan (kostenpflichtig, pay-per-use):** Cloud Functions mit ausgehenden Netzaufrufen zu einer externen LLM-API sind nur im Blaze-Plan möglich (Spark blockiert externe Egress-Calls). **Muss vor der Umsetzung aktiviert werden.**
- **LLM-API-Key:** als Functions-Secret hinterlegen — niemals im Client-Bundle oder Repo.
- **Datenmodell-Erweiterungen:** `trainingGoal` am User-Profil, optionales `restSeconds`, neue `recommendations`-Subcollection (Details im Architektur-Doc).
- **Bestehende Bausteine wiederverwendbar:** Verlaufs-Query-Strategie und Metriken (1RM, Volumen, Max-Gewicht, Last-Session) aus `exercise-progress` / `metrics.ts` bilden die Grundlage der Kontext-Zusammenfassung.
- **Übungskatalog** muss geseedet sein (Referenz-Auflösung + Katalog-Validierung der LLM-Ausgabe).
</content>
</invoke>
