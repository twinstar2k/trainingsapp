# Feature: Übungsfortschritt (Exercise Progress)

## Kontext & Problemstellung

Der User möchte den Fortschritt in einzelnen Kraftübungen über die Zeit nachvollziehen. Das Problem: Trainingseinheiten haben unterschiedliche Satz- und Wiederholungsstrukturen (3×10 vs. 4×10, 12 Reps@30 kg vs. 6 Reps@50 kg), was einen direkten Vergleich erschwert. Zudem gilt für Maschinen- und Seilzugübungen das `context_dependent`-Flag: Fortschritt ist nur innerhalb desselben Studios vergleichbar.

---

## Kernkonzept: Metriken

Drei Metriken werden kombiniert, um dem User ein vollständiges Bild zu geben:

### 1. Geschätzte 1RM (Estimated One Rep Max) — Hauptmetrik
Normalisiert unterschiedliche Gewicht/Wiederholungs-Kombinationen auf einen einheitlichen Wert.

**Formel (Epley):** `1RM = Gewicht × (1 + Reps / 30)`

Beispiele:
- 12 Reps @ 30 kg → 1RM ≈ 42 kg
- 6 Reps @ 50 kg → 1RM ≈ 60 kg
- 10 Reps @ 40 kg → 1RM ≈ 53 kg

Pro Session wird der **beste Satz** (höchste berechnete 1RM) verwendet. Das ist der primäre Fortschrittsindikator.

> Einschränkung: Epley ist zuverlässig bei 1–12 Reps. Bei >15 Reps wird die Schätzung ungenau — daher Anzeige nur wenn Reps ≤ 15.

### 2. Session-Volumen — Sekundärmetrik
Erfasst den Gesamtaufwand einer Einheit, inkl. Satzanzahl.

**Formel:** `Volumen = Σ (Gewicht × Reps)` über alle Sätze einer Übung pro Session

Unterscheidet 3×10@50 kg (1.500 kg) von 4×10@50 kg (2.000 kg).

### 3. Max-Gewicht — Tertiärmetrik
Einfachster Indikator: Das schwerste verwendete Gewicht in einer Session, unabhängig von Reps.

---

## User Stories

### US-01: Übungsdetail aufrufen
**Als** eingeloggter User
**möchte ich** eine Übung antippen und eine Detailansicht öffnen
**damit** ich den Verlauf dieser Übung über die Zeit sehe

**Priorität:** Must
**Geschätzter Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** ich bin auf der Übungsliste oder im abgeschlossenen Training
   **When** ich eine Übung antippe
   **Then** öffnet sich die Übungsdetailseite (`/exercises/:id`)

2. **Given** die Übung hat `contextDependent = true`
   **When** ich die Detailseite öffne
   **Then** sehe ich einen Studio-Filter (Standard: letztes genutztes Studio dieser Übung)

3. **Given** die Übung hat `contextDependent = false`
   **When** ich die Detailseite öffne
   **Then** sehe ich globale Daten ohne Studio-Filter

---

### US-02: Fortschrittschart (strength_weighted)
**Als** eingeloggter User
**möchte ich** einen Zeitverlauf-Chart meiner geschätzten 1RM sehen
**damit** ich vergleichen kann, ob ich bei unterschiedlichen Gewicht/Rep-Kombinationen stärker geworden bin

**Priorität:** Must
**Geschätzter Aufwand:** M

**Akzeptanzkriterien:**
1. **Given** die Übung hat ≥ 2 Sessions mit `type = weighted` und Reps ≤ 15
   **When** ich die Detailseite öffne
   **Then** zeigt der Chart die geschätzte 1RM (bester Satz je Session) über die Zeit als Linienchart

2. **Given** ein Satz hat Reps > 15
   **When** die 1RM berechnet wird
   **Then** wird dieser Satz für die 1RM-Berechnung ignoriert (zu unzuverlässig) und es wird eine Hinweistext angezeigt

3. **Given** es gibt nur 1 Session
   **When** ich die Detailseite öffne
   **Then** kein Chart, stattdessen: „Noch zu wenig Daten — mach mindestens 2 Einheiten"

4. **Given** ich möchte zwischen Metriken wechseln
   **When** ich auf einen Tab/Chip tippe (1RM / Volumen / Max-Gewicht)
   **Then** wechselt der Chart zur gewählten Metrik

---

### US-03: Session-Volumen-Chart (strength_weighted)
**Als** eingeloggter User
**möchte ich** das Trainingsvolumen pro Session sehen
**damit** ich erkenne, ob ich insgesamt mehr Arbeit leiste (mehr Sätze oder Reps)

**Priorität:** Should
**Geschätzter Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** ich wähle den Tab „Volumen"
   **When** der Chart rendert
   **Then** zeigt die Y-Achse `Σ(Gewicht × Reps)` in kg (gerundet auf ganze Zahlen) je Session

2. **Given** 3×10@50 kg in Session A und 4×10@50 kg in Session B
   **When** ich den Volumen-Chart anschaue
   **Then** sehe ich 1.500 kg für Session A und 2.000 kg für Session B — der Unterschied ist erkennbar

---

### US-04: Beste Leistung & letzte Session
**Als** eingeloggter User
**möchte ich** auf einen Blick die beste je erbrachte Leistung und die letzte Session sehen
**damit** ich ohne Chart-Analyse sofort verstehe wo ich stehe

**Priorität:** Must
**Geschätzter Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** es gibt mindestens 1 Session
   **When** ich die Detailseite öffne
   **Then** zeigt eine Zusammenfassung:
   - Bestes je: höchste 1RM + Datum
   - Letztes Training: Datum + beste 1RM dieser Session + Satzstruktur (z.B. „3 × 10 @ 50 kg")

2. **Given** ich bin in der Zusammenfassung
   **When** mehrere Sätze in einer Session gespielt wurden
   **Then** wird der beste Satz (höchste 1RM) als repräsentativer Wert angezeigt

---

### US-05: Letzte Sätze als Referenz beim Training
**Als** eingeloggter User
**möchte ich** im aktiven Training unter einer Übung sehen, was ich beim letzten Mal gemacht habe
**damit** ich eine Orientierung für mein heutiges Gewicht/Reps habe

**Priorität:** Should
**Geschätzter Aufwand:** M

**Akzeptanzkriterien:**
1. **Given** ich füge eine Übung zum aktiven Training hinzu
   **When** die Übung geladen wird
   **Then** zeigt ein „Letztes Mal"-Label die Satzstruktur der letzten Session dieser Übung (z.B. „Zuletzt: 3 × 10 @ 50 kg")

2. **Given** die Übung hat `contextDependent = true`
   **When** das Label geladen wird
   **Then** wird nur die letzte Session im **aktuellen Studio** als Referenz verwendet

3. **Given** die Übung wurde noch nie trainiert
   **When** sie hinzugefügt wird
   **Then** kein „Letztes Mal"-Label

---

### US-06: Fortschritt für Bodyweight-Übungen (strength_reps_only)
**Als** eingeloggter User
**möchte ich** bei Bodyweight-Übungen die maximalen Wiederholungen je Session sehen
**damit** ich meinen Fortschritt bei Dips, Liegestützen etc. verfolge

**Priorität:** Should
**Geschätzter Aufwand:** S

**Akzeptanzkriterien:**
1. **Given** die Übung hat `type = reps_only`
   **When** ich die Detailseite öffne
   **Then** zeigt der Chart die maximalen Reps eines Satzes je Session (kein Gewicht, kein 1RM)

2. **Given** es gibt Sessions mit mehreren Sätzen
   **When** der Chart rendert
   **Then** wird der Satz mit den meisten Reps je Session dargestellt

---

## Nicht im Scope (bewusst ausgeklammert)

- Cardio-Übungen (`cardio_basic`): Separate Logik (Dauer/Strecke), eigenes Feature
- Vergleich zwischen zwei Usern (kein Social-Feature im MVP)
- Automatische Gewichts-/Reps-Vorschläge für nächste Session
- Persönliche Rekord-Benachrichtigungen (PR-Alerts)
- Exportfunktion (CSV/Excel)
- Unterschied zwischen Trainingszielen (Kraft 1–5 Reps vs. Hypertrophie 8–12 Reps)

---

## Offene Fragen

1. ~~**Metrik-Reihenfolge:** Soll 1RM der Standard-Tab sein, oder lieber Max-Gewicht weil intuitiver?~~
   → **Entschieden: Max-Gewicht ist Standard-Tab**

2. ~~**Zeitraum-Filter:** Sollen alle Sessions angezeigt werden, oder nur die letzten N?~~
   → **Entschieden: letzte 20 Sessions, kein Zeitraum-Filter im MVP**

3. ~~**Navigationsweg zu Übungsdetail:** Nur aus der Übungsliste, oder auch aus dem Training heraus?~~
   → **Entschieden: Übungsname im aktiven Training ist antippbar** → öffnet Detailseite mit Verlauf, damit der User das Gewicht vor Beginn der Übung nach aktuellem Leistungsstand einstellen kann. Navigation zurück ins Training muss einfach sein (Back-Button).

4. ~~**Studio-Wechsel bei context_dependent:** Wechselbar oder nur aktuelles Studio?~~
   → **Entschieden: Nur aktuelles Studio** (das Studio des laufenden/letzten Trainings)

---

## Abhängigkeiten

- **Firestore-Queries:** Alle Sessions einer Übung lesen (`collectionGroup` auf `exercises` oder Query über `trainings/{id}/exercises` mit Filter auf `exerciseId`) → Index erforderlich
- **`context_dependent`-Flag:** Muss bei Studio-Filterung berücksichtigt werden (bereits im Datenmodell vorhanden)
- **Übungskatalog:** Muss initialisiert sein (Seed-Daten) damit `exerciseId`-Referenzen auflösbar sind
- **Trainings müssen abgeschlossen sein** (`status = completed`) damit historische Daten verlässlich sind — oder auch aktive Trainings einschließen?
