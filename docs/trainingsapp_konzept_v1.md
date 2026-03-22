# Trainingsapp — Fach- und Produktkonzept

**Version 1.0 — Finales MVP-Konzept**

Persönliche Web-App zur Erfassung und Analyse von Krafttraining.
Schnelle Trainingserfassung · Belastbare Fortschrittsanalyse · Studio- und Gerätekontext

Stand: März 2026

---

## 1. Produktziel und Leitprinzipien

Die App ist ein persönlicher Trainingslogger mit analytischem Schwerpunkt für Krafttraining. Sie beantwortet vier zentrale Fragen:

- Hat sich eine Übung verbessert?
- Wie entwickelt sich das Trainingsvolumen?
- Wie verändert sich das Körpergewicht?
- Ist ein Vergleich fachlich zulässig, wenn unterschiedliche Geräte oder Studios genutzt wurden?

> **Leitprinzip:** Die analytische Qualität der Daten hat Vorrang vor Feature-Vielfalt. Vergleiche nur im passenden Kontext.

| Merkmal | Ausprägung |
|---------|-----------|
| **Plattform** | Responsive Web-App (mobile-first) |
| **Zielgruppe** | Mehrere Nutzer: primär Eigennutzung, zusätzlich Partnerin und Freunde zum Testen |
| **Trainingsfokus** | Krafttraining mit Bodyweight und einfacher Cardio-Erfassung |
| **Besonderheit** | Fortschritt bei Maschinen/Seilzügen nur im passenden Studio-Kontext vergleichen |
| **Auth** | Google Login (Firebase Auth) |

---

## 2. Fachlicher Scope

| Bereich | In Version 1 | Nicht im Fokus |
|---------|-------------|---------------|
| **Training** | Anlegen, Übungen/Sätze erfassen, abschließen, editieren, nachträglich eintragen | Soziale Funktionen, Coach-Modus |
| **Analyse** | Dashboard, Übungsverlauf, Gewichtsentwicklung, Filter nach Studio | Komplexe Periodisierung, RPE-Steuerung |
| **Templates** | Vorlagen anlegen und beim Trainingsstart laden; flexibel abweichen | Automatisierte Planlogik |
| **Cardio** | Zeit und Strecke dokumentieren | Herzfrequenz, Zonen, Kalorien |
| **Bodyweight** | Nur Wiederholungen, kein Gewicht | Zusatzgewicht (Dips, Liegestütze) |

---

## 3. Kernobjekte des Datenmodells

Das Datenmodell trennt konsequent zwischen der fachlichen Übung und dem Ausführungskontext (Studio). Eine separate Gerätevarianten-Ebene entfällt in V1 — der Vergleichsschlüssel ist **Übung + Studio**.

### User

Accountdaten über Firebase Auth (Google Login). Profildaten wie Name und Geburtstag werden in Firestore gespeichert. Jeder User hat seinen eigenen Datenraum für Studios, Trainings und Gewichtshistorie.

### Gewichtshistorie

Historische Gewichtseinträge mit Datum. Neue Einträge überschreiben nicht, sondern ergänzen die Historie, damit Trends sichtbar bleiben.

### Übungskatalog

Globaler Katalog für alle User (nur Admin kann Übungen hinzufügen). Jede Übung hat: Name, Typ (weighted / reps only / cardio basic), primäre Muskelgruppe und das Flag `context_dependent`.

### Studio

Jeder User pflegt seine eigenen Studios (z.B. David Lloyd Bad Homburg, peoples Karben, Home Gym). Studios sind nicht geteilt zwischen Usern.

### Trainingseinheit

Eine Session an einem Datum, zugeordnet zu einem Studio. Optionaler Templatebezug (rein informativ, keine Einschränkung). Status: aktiv oder abgeschlossen.

### Trainingsübung

Konkret eingefügte Übung innerhalb eines Trainings mit Referenz auf den globalen Übungskatalog und Reihenfolge.

### Satz

Kleinste Erfassungseinheit: Wiederholungen, optional Gewicht (bei weighted), optional Zeit und Strecke (bei cardio). Status: erledigt oder offen. Sätze können dupliziert und anschließend in Gewicht und Reps editiert werden.

### Template

Wiederverwendbare Vorlage mit Übungsreihenfolge und optionalen Standardsätzen. Templates sind Startpunkte — Übungen können im Training hinzugefügt oder weggelassen werden, ohne den Templatebezug zu verlieren.

---

## 4. Übungstypen und Erfassungslogik

| Typ | Beispiele | Zu erfassen | Gewicht |
|-----|-----------|-------------|---------|
| **Strength weighted** | Bankdrücken, Brustpresse, Rudern, Schulterdrücken | Satz, Wiederholungen, Gewicht | Ja (Pflicht) |
| **Strength reps only** | Beinheben, Dips, Liegestütze, Theraband | Satz, Wiederholungen | Nein |
| **Cardio basic** | Laufband, Indoor Cycle, Rudern Ergometer | Zeit, Strecke | Nein |

---

## 5. Studio-Kontext als Schlüssellogik

Diese Anforderung ist fachlich zentral: Bei Maschinen und Seilzügen sind Gewichtsangaben nicht studioübergreifend vergleichbar. Die Übersetzung der Maschinen unterscheidet sich zwischen Studios — z.B. Butterfly mit 80 kg im David Lloyd vs. 50 kg im peoples bei vergleichbarer Leistung. Bei freien Gewichten (Kurzhanteln, Langhanteln, Kettlebells) und Bodyweight-Übungen besteht dieses Problem nicht.

Die Lösung: Jede Übung im Katalog erhält ein **`context_dependent`-Flag:**

- **`context_dependent = true`:** Maschinen- und Seilzugübungen. Fortschritt wird pro Studio angezeigt und verglichen.
- **`context_dependent = false`:** Freie Gewichte, Bodyweight, Cardio. Fortschritt wird global über alle Studios verglichen.

> **Leitregel für die Analyse:** Ein Fortschrittsvergleich ist nur dann belastbar, wenn die Übung im selben Kontext (Studio) ausgeführt wurde. Globale Verläufe für kontextabhängige Übungen werden nur ergänzend und mit Vorbehalt dargestellt.

Das Namensprefix der Übung bestimmt das Flag:

- `Maschine *` und `Seilzug *` → `context_dependent: true`
- `Kurzhantel *`, `Langhantel *`, `Kettlebell *` → `context_dependent: false`
- Bodyweight (Dips, Liegestütze, Beinheben) → `context_dependent: false`
- Cardio (Laufband, Indoor Cycle, Rudern Ergometer) → `context_dependent: false`
- Sonderfälle wie `GTS Butterfly einarmig` → `context_dependent: true` (Maschinengerät)

---

## 6. Trainings- und Template-Flow

Empfohlener Ablauf für die Nutzung der Web-App:

1. Neues Training starten oder aus Template erzeugen
2. Datum wählen (auch rückwirkend möglich)
3. Studio wählen
4. Übungen hinzufügen (aus Katalog wählen)
5. Sätze erfassen: Gewicht und Wiederholungen eingeben (Tastatur), als erledigt markieren
6. Optional: Satz duplizieren und Gewicht/Reps anpassen
7. Training abschließen und speichern

> **Template-Prinzip:** Templates sind flexible Startpunkte. Übungen können im Training hinzugefügt oder weggelassen werden. Keine starre Planlogik.

---

## 7. Dashboard und Analyse

Das Dashboard soll modern, aber nicht verspielt sein. Fokus ist Lesbarkeit und direkte Nutzbarkeit. Mobile Erfassung auf dem Smartphone, komfortable Auswertung am Desktop.

| Bereich | Kennzahlen | Hinweis |
|---------|-----------|---------|
| **Überblick** | Trainingstage pro Woche/Monat, Satzanzahl, Gesamtvolumen | Startseite des Dashboards |
| **Körpergewicht** | Aktueller Wert, Trend, Veränderung 30/90 Tage | Historisch speichern, nicht überschreiben |
| **Weighted Exercises** | Max Gewicht, bestes Set, Volumen, Frequenz | Bei `context_dependent` standardmäßig nach Studio filtern |
| **Bodyweight** | Max Wiederholungen, Gesamtwiederholungen, Frequenz | Kein Gewicht speichern |
| **Cardio** | Gesamtdauer, Gesamtstrecke, Sessions | Nur grobe Dokumentation |
| **Aktivitätsmuster** | Muskelgruppen-Verteilung, Trainingsfrequenz | Ergänzende Übersicht |

---

## 8. Zentrale Screens

| Screen | Beschreibung |
|--------|-------------|
| **Dashboard** | Kompakter Überblick über Trainingsaktivität, Fortschritt und Körpergewicht |
| **Trainingsliste** | Historie mit Filtern nach Datum, Studio, Status und Übung |
| **Neues Training** | Schnellstart: Datum, Studio, Template, Übungen |
| **Trainingsdetail** | Sätze erfassen und duplizieren, abhaken, Training speichern |
| **Übungsdetail** | Verlauf global oder nach Studio (je nach `context_dependent`-Flag) |
| **Gewichtsverlauf** | Historie und Trendlinie der Körpergewichtsentwicklung |
| **Templates** | Push, Pull, Oberkörper, Unterkörper, Ganzkörper und eigene Vorlagen |
| **Stammdaten** | Studios verwalten; Übungskatalog (nur Ansicht für normale User) |

---

## 9. Übungskatalog (Initialer Seed)

Der folgende Katalog wird als globaler Seed für alle User bereitgestellt. Er umfasst 50 Übungen. Neue Übungen können nur durch den Admin ergänzt werden.

### Strength weighted, context_dependent: true (30 Übungen)

| Übung | Muskelgruppe |
|-------|-------------|
| GTS Butterfly einarmig | Brust |
| Maschine Abduktor | Beine |
| Maschine Adduktor | Beine |
| Maschine Bauchcrunch | Core |
| Maschine Beinbeuger | Beine |
| Maschine Beinbeuger liegend | Beine |
| Maschine Beinstrecker | Beine |
| Maschine Brustpresse | Brust |
| Maschine Butterfly gestreckte Arme | Brust |
| Maschine Butterfly Reverse gestreckte Arme | Schultern / Rücken |
| Maschine Butterfly Reverse gestreckte Arme proniert | Schultern / Rücken |
| Maschine Klimmzüge mit Unterstützung | Rücken |
| Maschine Latzug | Rücken |
| Maschine Rudern | Rücken |
| Maschine Rückenstrecker | Rücken |
| Maschine Schrägbankdrücken | Brust |
| Maschine Schulterdrücken | Schultern |
| Seilzug Bizeps Curls | Bizeps |
| Seilzug Butterfly einarmig nach unten | Brust |
| Seilzug Butterfly nach oben stehend | Brust |
| Seilzug Butterfly nach unten | Brust |
| Seilzug Butterfly Reverse einarmig | Schultern / Rücken |
| Seilzug Latziehen zur Brust | Rücken |
| Seilzug Rudern eng | Rücken |
| Seilzug Rudern im Untergriff | Rücken |
| Seilzug Rudern weit sitzend | Rücken |
| Seilzug Rumpfrotation | Core |
| Seilzug Seitheben einarmig | Schultern |
| Seilzug Trizepsdrücken einarmig im Obergriff | Trizeps |
| Seilzug Trizepsdrücken im Obergriff | Trizeps |

### Strength weighted, context_dependent: false (12 Übungen)

| Übung | Muskelgruppe |
|-------|-------------|
| Core Bag Kniebeugen | Beine |
| Kettlebell Schulterdrücken einarmig | Schultern |
| Kurzhantel Arnold Press | Schultern |
| Kurzhantel Bizeps Curls einarmig | Bizeps |
| Kurzhantel Butterfly Reverse einarmig vorgebeugt | Schultern / Rücken |
| Kurzhantel Butterfly Reverse stehend | Schultern / Rücken |
| Kurzhantel Seitheben | Schultern |
| Kurzhantel Schulterdrücken einarmig | Schultern |
| Kurzhantel Schulterheben | Trapez |
| Kurzhantel Schulterheben stehend | Trapez |
| Langhantel Bankdrücken | Brust |
| Langhantel Rudern vorgebeugt | Rücken |

### Strength reps only (5 Übungen)

| Übung | Muskelgruppe |
|-------|-------------|
| Beinheben im Hang mit Kontakt | Core |
| Dips | Brust / Trizeps |
| Equalizer Liegestütze | Brust |
| Liegestütze | Brust |
| Theraband Butterfly Reverse | Schultern / Rücken |

### Cardio basic (3 Übungen)

| Übung | Muskelgruppe |
|-------|-------------|
| Indoor Cycle | Cardio |
| Laufband | Cardio |
| Rudern Ergometer | Cardio |

**Zusammenfassung:** 30 Übungen sind kontextabhängig (Studio-Filter bei Analyse), 20 Übungen werden global verglichen.

---

## 10. Technische Architektur

### Tech-Stack

| Komponente | Technologie |
|------------|------------|
| **Frontend** | React 18+ (responsive Web-App, mobile-first) |
| **UI-Bibliothek** | MUI (Material UI) oder vergleichbar |
| **Auth** | Firebase Authentication (Google Login) |
| **Datenbank** | Cloud Firestore (NoSQL, dokumentbasiert) |
| **Hosting** | Firebase Hosting |
| **Backend** | Kein eigenes Backend — Firestore Security Rules steuern Zugriff |
| **GCP-Projekt** | mvp-app-claude (bestehendes Projekt, europe-west3) |

### Warum Firestore statt PostgreSQL?

- Kein Backend-Code nötig: Direkter Zugriff aus dem React-Frontend auf die Datenbank
- Firebase Auth liefert Multi-User-Unterstützung ohne eigene Implementierung
- Security Rules regeln Datentrennung pro User deklarativ
- Firebase Hosting ermöglicht Deployment mit einem Befehl
- Das Datenvolumen (wenige aktive User, ca. 200 Trainings/Jahr) erlaubt client-seitige Analytik
- Passt in das bestehende GCP-Ökosystem

### Firestore-Dokumentstruktur (Grob)

| Collection | Wichtigste Felder | Hinweise |
|------------|------------------|----------|
| `exercises` (global) | name, type, muscleGroup, contextDependent | Globaler Katalog, nur Admin-beschreibbar |
| `users/{uid}` | name, birthday, email, createdAt | Dokument-ID = Firebase Auth UID |
| `users/{uid}/studios` | name, createdAt | Subcollection: Studios pro User |
| `users/{uid}/weightHistory` | date, weight | Subcollection: Gewichtseinträge pro User |
| `users/{uid}/trainings` | date, studioId, templateId, status, notes | Subcollection: Trainings pro User |
| `users/{uid}/trainings/{id}/exercises` | exerciseId, order, status | Sub-subcollection: Übungen im Training |
| `users/{uid}/trainings/{id}/exercises/{id}/sets` | reps, weight, duration, distance, status, order | Sub-subcollection: Sätze pro Übung |
| `users/{uid}/templates` | name, exercises[] | Subcollection: Templates pro User |

Hinweis: Die tiefe Verschachtelung (trainings → exercises → sets) ist in Firestore performant abfragbar. Für Analyse-Queries (z.B. alle Sätze einer Übung über mehrere Trainings) wird eine Collection Group Query auf `sets` oder `exercises` verwendet.

---

## 11. MVP-Features (Version 1)

- Google Login und Profil (Name, Geburtstag)
- Gewichtshistorie mit Verlauf
- Globaler Übungskatalog mit Typen und `context_dependent`-Flag
- Studio-Verwaltung (pro User)
- Training anlegen, editieren, abschließen (auch rückwirkend)
- Übungen und Sätze erfassen, Sätze duplizieren
- Bodyweight ohne Gewicht
- Cardio mit Zeit und Strecke
- Templates anlegen und als Startpunkt verwenden (flexibel abweichen)
- Dashboard mit Fortschritt je Übung und automatischem Studio-Filter

---

## 12. Offene Erweiterungen für spätere Phasen

- Favoriten und Schnellzugriff auf häufig genutzte Übungen
- Letztes Gewicht und letztes Gerät automatisch vorschlagen
- Übungen aus der letzten Session übernehmen
- Persönliche Rekorde automatisch markieren
- Export nach CSV/Excel
- Gerätevarianten-Ebene nachrüsten (falls innerhalb eines Studios differenziert werden muss)
- Offline-Fähigkeit mit Sync
- Komfortfunktionen für Planungs- und Deload-Logik

---

## 13. Fazit

Das Konzept ist fachlich geschärft und technisch umsetzbar. Die zentrale Innovation ist die automatische Trennung von kontextabhängigen und kontextunabhängigen Übungen durch das `context_dependent`-Flag. Damit werden Maschinengewichte nicht studioübergreifend verglichen und die Analyseergebnisse bleiben belastbar.

Durch den Einsatz von Firebase (Auth, Firestore, Hosting) entfällt ein eigenes Backend. Multi-User-Unterstützung für Partnerin und Freunde ist über Firebase Auth und Security Rules elegant gelöst. Der Tech-Stack passt in das bestehende GCP-Ökosystem und ist für das erwartete Datenvolumen skalierend.

Der definierte MVP liefert eine im Alltag nutzbare App mit schneller Trainingserfassung, flexiblen Templates und einem analytisch sauberen Dashboard — mit einer klaren Basis für spätere Erweiterungen.
