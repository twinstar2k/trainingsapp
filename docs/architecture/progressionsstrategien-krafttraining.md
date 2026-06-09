# Dokumentation: Progressionsstrategien im Krafttraining fuer eine Trainingsapp mit KI-Coach

Stand: 08.06.2026  
Ziel: belastbare, deterministische Grundlage fuer Trainingsvorgaben, Progression und Coach-Kommunikation auf Basis von Trainingshistorie, Leistung, RIR/RPE und Erholungsindikatoren.

## 1. Grundprinzip

Progression im Krafttraining bedeutet nicht automatisch "jedes Training mehr Gewicht". Ein gutes System erhoeht den Trainingsreiz nur dann, wenn der Sportler den aktuellen Reiz technisch sauber, mit passender Anstrengung und ausreichender Erholung toleriert.

Die App sollte deshalb zwischen drei Ebenen unterscheiden:

1. **Trainingsziel**: Maximalkraft, Hypertrophie, Kraftausdauer, Power oder allgemeine Fitness.
2. **Reizsteuerung**: Last, Wiederholungen, Saetze, RIR, Frequenz, Uebungsauswahl, Pausen, Bewegungsgeschwindigkeit.
3. **Anpassungsentscheidung**: steigern, halten, reduzieren, deloaden oder Uebung/Block wechseln.

Der KI-Coach sollte nicht frei "raten", sondern die deterministische Engine erklaeren, kontextualisieren und motivierend kommunizieren. Die fachliche Entscheidung kommt aus Regeln.

## 2. Evidenzbasierte Leitplanken

Die aktuell wichtigste Leitlinie ist der ACSM Position Stand von 2026 zu Resistance Training Prescription. Er ersetzt das Progressionsmodell von 2009 und basiert auf einer Umbrella-Review mit 137 systematischen Reviews und mehr als 30.000 Teilnehmenden. Die Kernaussage fuer eine App ist: Krafttraining wirkt robust, aber das "optimale" Programm ist ziel- und personenbezogen. Konsistenz, ausreichend hohe Anstrengung und graduelle Steigerung sind wichtiger als komplexe Spezialmethoden.

Praktische Leitplanken:

- Alle grossen Muskelgruppen sollten mindestens 2-mal pro Woche trainiert werden.
- Fuer Maximalkraft sind hoehere Lasten spezifischer und meist wirksamer als sehr leichte Lasten.
- Fuer Hypertrophie kann ein breites Lastspektrum funktionieren, solange Saetze ausreichend nahe ans Muskelversagen kommen und das Wochenvolumen ausreichend ist.
- Fuer Power zaehlt explosive Ausfuehrung mit moderaten Lasten und niedriger bis moderater Ermuedung.
- Training bis zum absoluten Muskelversagen ist fuer die meisten Ziele nicht notwendig und sollte dosiert eingesetzt werden.
- Komplexe Periodisierung ist fuer Einsteiger selten noetig, kann bei Fortgeschrittenen fuer Maximalkraft helfen.

## 3. Zielabhaengige Progressionsparameter

### 3.1 Maximalkraft

Primaerziel: mehr Kraft in spezifischen Bewegungen.

Typische Zielbereiche:

- Hauptuebungen: ca. 75-90% 1RM, haeufig 1-6 Wiederholungen.
- Saetze: 2-6 Arbeitssaetze pro Hauptuebung, abhaengig von Niveau und Frequenz.
- RIR: meistens 1-4; sehr schwere Top-Sets gelegentlich 0-1 RIR, aber nicht dauerhaft.
- Pausen: meist 2-5 Minuten, damit die Leistung im Satz erhalten bleibt.
- Progression: Laststeigerung, e1RM-Steigerung, mehr Wiederholungen bei gleicher Last, bessere Technik bei gleicher relativer Anstrengung.

Algorithmische Konsequenz: Bei Kraftuebungen sollte die App nicht nur Volumenload betrachten. Entscheidender ist, ob e1RM, Top-Set-Leistung oder Zielgewichte bei vergleichbarem RIR steigen.

### 3.2 Hypertrophie

Primaerziel: Muskelquerschnitt und Muskelmasse.

Typische Zielbereiche:

- Last: breit moeglich, grob 30-85% 1RM, praktisch oft 6-20 Wiederholungen.
- Wochenvolumen: als Startpunkt ca. 6-10 harte Saetze pro Muskelgruppe/Woche; fuer viele Fortgeschrittene ca. 10-20 harte Saetze.
- RIR: meist 0-4; niedrige Lasten erfordern tendenziell naeher am Versagen liegende Saetze.
- Progression: zunaechst Wiederholungen innerhalb eines Bereichs, dann Last, dann optional Satzvolumen.

Algorithmische Konsequenz: Fuer Hypertrophie ist die wichtigste Progressionsgroesse nicht das Gewicht allein, sondern "harte Saetze pro Muskelgruppe pro Woche" plus die Leistung innerhalb dieser Saetze.

### 3.3 Kraftausdauer

Primaerziel: hohe Wiederholungsleistung gegen submaximale Lasten.

Typische Zielbereiche:

- Last: leicht bis moderat.
- Wiederholungen: haeufig 12-30+.
- RIR: 0-3 bei Zielsaetzen, aber Ermuedung aktiv managen.
- Progression: mehr Wiederholungen, kuerzere Pausen, mehr Dichte, spaeter Laststeigerung.

### 3.4 Power / Explosivkraft

Primaerziel: Kraft schnell entwickeln.

Typische Zielbereiche:

- Last: je nach Uebung oft 30-70% 1RM.
- Wiederholungen: niedrig bis moderat, haeufig 1-6.
- RIR/Ermuedung: Saetze nicht ausreizen; Abbruch bei deutlichem Geschwindigkeitsverlust.
- Progression: bessere Geschwindigkeit, hoeheres Gewicht bei gleicher Geschwindigkeit, mehr technische Qualitaet.

Algorithmische Konsequenz: Wenn keine Velocity-Daten vorhanden sind, sollte der Coach Power-Training nur ueber konservative Wiederholungszahlen und subjektive Explosivitaet steuern.

## 4. RIR als zentrales Steuerungssignal

RIR ("Repetitions in Reserve") beschreibt, wie viele Wiederholungen bei sauberer Technik noch moeglich gewesen waeren. Fuer eine App ist RIR besser operationalisierbar als allgemeines "hart" oder "leicht".

Mapping:

- 4+ RIR: deutlich submaximal, Technik-/Volumenarbeit, geringe akute Ermuedung.
- 3 RIR: moderat hart, guter Bereich fuer Aufbauphasen und viele Arbeitsvolumina.
- 2 RIR: hart, aber kontrollierbar.
- 1 RIR: sehr hart, nahe am Limit.
- 0 RIR: technisches oder konzentrisches Muskelversagen, sparsam einsetzen.

Wichtige Einschraenkung: RIR ist genauer, wenn Saetze naeher am Versagen liegen und die Last hoeher ist. Bei sehr hohen Wiederholungszahlen und niedrigen Lasten unterschaetzen viele Sportler die tatsaechlichen Reserven. Die App sollte RIR deshalb kalibrieren.

### RIR-Kalibrierung

Die App sollte alle 4-8 Wochen einfache Kalibrierungssaetze einbauen:

- Ausgewaehlte sichere Uebung, z.B. Maschine, Kabelzug, Kurzhantel, nicht zwingend schwere Kniebeuge oder Kreuzheben.
- Vorgabe: "Stoppe bei geschaetzten 2 RIR."
- Danach optional: "Wenn sicher: fuehre noch maximal saubere Wiederholungen aus."
- Differenz zwischen geschaetztem und tatsaechlichem RIR als Bias speichern.

Beispiel:

- Sportler meldet 2 RIR.
- Danach schafft er noch 5 saubere Wiederholungen.
- RIR-Bias = +3; die App behandelt kuenftige RIR-Angaben dieses Sportlers auf aehnlichen Uebungen vorsichtiger.

## 5. Progressionsmodelle

### 5.1 Lineare Lastprogression

Geeignet fuer: Anfaenger, stabile Technik, einfache Grunduebungen oder Maschinen.

Regel:

- Wenn alle Zielsaetze mit Ziel-RIR erreicht werden: Last naechste Einheit erhoehen.
- Wenn Ziel knapp verfehlt wird: Last halten.
- Wenn Ziel deutlich verfehlt wird oder RIR zu niedrig ist: Last reduzieren oder Satzanzahl reduzieren.

Beispiel:

- Kniebeuge: 3 x 5, Ziel-RIR 2.
- Ergebnis: 5/5/5 bei RIR 3/2/2.
- Entscheidung: +2,5-5 kg naechste Einheit.

Vorteil: sehr einfach, motivierend.  
Nachteil: endet schnell, wenn Fortschritt nicht mehr von Einheit zu Einheit moeglich ist.

### 5.2 Double Progression

Geeignet fuer: Hypertrophie, Maschinen, Kurzhanteln, Zubehoeruebungen, Fortgeschrittene.

Regel:

- Definiere Wiederholungsbereich, z.B. 8-12.
- Last bleibt gleich, bis alle Saetze am oberen Ende des Bereichs mit Ziel-RIR erreicht sind.
- Dann Last erhoehen und wieder am unteren/mittleren Bereich starten.

Beispiel:

- Bankdruecken: 3 x 8-12, Ziel 1-3 RIR.
- Woche 1: 10/9/8
- Woche 2: 11/10/9
- Woche 3: 12/11/10
- Woche 4: 12/12/12 bei RIR 2/2/1
- Entscheidung: Last +2,5 kg.

Diese Methode ist fuer eine App besonders robust, weil sie kleine Leistungsschwankungen abfedert.

### 5.3 Top-Set plus Back-Off

Geeignet fuer: Hauptuebungen bei Intermediates und Fortgeschrittenen.

Struktur:

- Top-Set: ein schwerer Satz in Zielbereich, z.B. 1 x 3-6 @ 1-2 RIR.
- Back-Off-Saetze: 2-5 Saetze mit 5-15% weniger Last.

Regel:

- Top-Set steuert Tagesleistung.
- Back-Off-Last wird prozentual aus Top-Set oder e1RM berechnet.
- Wenn Top-Set deutlich unter Ziel liegt, werden Back-Offs automatisch reduziert.

Beispiel:

- Top-Set Bankdruecken: 1 x 5 @ 2 RIR.
- Back-Off: 3 x 6-8 mit -8% Last.

Vorteil: kombiniert Autoregulation mit planbarer Volumenarbeit.

### 5.4 APRE / Reps-basierte Autoregulation

APRE passt Lasten anhand der tatsaechlich erreichten Wiederholungen an. Das ist fuer Apps attraktiv, weil es ohne Velocity-Sensor und ohne perfektes RIR-Verstaendnis funktioniert.

Beispiel APRE-Logik fuer 6RM-orientierte Arbeit:

- Satz 1: 50% Arbeitslast x 10
- Satz 2: 75% Arbeitslast x 6
- Satz 3: Arbeitslast x max saubere Wiederholungen
- Satz 4: Lastanpassung nach Satz 3

Anpassung fuer Satz 4 und naechste Einheit:

- 0-2 Wiederholungen: -5 bis -10%
- 3-4 Wiederholungen: -2,5 bis -5%
- 5-7 Wiederholungen: halten
- 8-10 Wiederholungen: +2,5 bis +5%
- 11+ Wiederholungen: +5 bis +10%

Die genauen Schwellen sollten pro Uebungstyp und Zielbereich konfigurierbar sein.

### 5.5 RIR-basierte Autoregulation

Geeignet fuer: Sportler mit halbwegs verlaesslicher Selbsteinschaetzung.

Regelidee:

- Ziel: 3 x 8 @ 2 RIR.
- Ist-RIR zu hoch: Training war leichter als geplant -> Last oder Wiederholungen erhoehen.
- Ist-RIR passend: Progression nach Plan.
- Ist-RIR zu niedrig: Last halten oder senken.

Beispiel-Entscheidung:

- Alle Saetze geschafft, mittleres RIR >= Ziel-RIR + 1: naechste Einheit +2,5-5%.
- Alle Saetze geschafft, mittleres RIR im Zielbereich: kleine Progression oder halten.
- Wiederholungen verfehlt oder RIR <= 0 frueh im Training: Last -2,5-5% oder Satzvolumen senken.

### 5.6 Volumenprogression

Geeignet fuer: Hypertrophie, wenn Last/Reps stagnieren, aber Erholung gut ist.

Regel:

- Erhoehe Wochenvolumen um 1-2 harte Saetze pro Muskelgruppe, wenn Leistung stagniert, RIR-Ziele eingehalten werden und Erholungsmarker unauffaellig sind.
- Reduziere Volumen, wenn Leistung faellt, Muskelkater/Schmerz hoch ist oder mehrere Einheiten hintereinander Zielwerte verfehlt werden.

Beispiel:

- Brust: 8 harte Saetze/Woche, 3 Wochen keine Rep- oder Lastprogression, RIR passt, keine Erholungsprobleme.
- Entscheidung: auf 10 Saetze/Woche erhoehen.

### 5.7 Periodisierte Progression

Geeignet fuer: Fortgeschrittene, Maximalkraft, Plateau-Phasen.

Einfache Blockstruktur:

- Woche 1: moderat, 3-4 RIR
- Woche 2: etwas schwerer/mehr Volumen, 2-3 RIR
- Woche 3: hart, 1-2 RIR
- Woche 4: sehr hart oder Peak, 0-1 RIR bei ausgewaehlten Top-Sets
- Woche 5: Deload oder Pivot, 4-6 RIR und weniger Volumen

Fuer Hypertrophie ist Periodisierung weniger entscheidend als ausreichendes Volumen und Naehe zum Versagen. Fuer Maximalkraft zeigen Reviews eher Vorteile periodisierter Modelle, besonders bei trainierten Personen.

## 6. Entscheidungsengine fuer die App

### 6.1 Notwendige Datenfelder

Pro Satz:

- Uebung
- Last
- Wiederholungen
- RIR
- Satztyp: warmup, work, top, backoff, calibration
- Technikstatus: sauber, unsicher, abgebrochen
- Schmerz: 0-10
- optional: Tempo/Velocity, ROM, Notizen

Pro Einheit:

- Schlafqualitaet oder Schlafdauer
- subjektive Bereitschaft / Readiness
- Muskelkater pro Muskelgruppe
- Motivation / Stress
- Koerpergewicht optional
- Session-RPE

Pro Uebung:

- Ziel: Kraft, Hypertrophie, Kraftausdauer, Power
- Progressionsmodell
- Rep-Range
- Ziel-RIR
- minimale und maximale Lastspruenge
- technische Schwierigkeit
- Sicherheitsrisiko

### 6.2 Abgeleitete Kennzahlen

**e1RM mit RIR-Korrektur**

Eine praktikable Formel:

```text
e1RM = Gewicht * (1 + (Wiederholungen + RIR) / 30)
```

Diese Schaetzung ist bei niedrigen bis moderaten Wiederholungszahlen nuetzlicher als bei sehr hohen Wiederholungen. Sie sollte nicht als exakte Wahrheit behandelt werden, sondern als Trend.

**Hard Sets**

Ein Arbeitssatz zaehlt als harter Satz, wenn:

```text
RIR <= 4
Technikstatus == sauber
Schmerz <= 3
```

Bei sehr leichten Lasten oder sehr hohen Wiederholungen kann die Schwelle strenger sein, z.B. RIR <= 2.

**Performance Trend**

Vergleiche die letzten 3-5 Exposures derselben Uebung:

- e1RM-Trend
- Wiederholungen bei gleicher Last
- Last bei gleicher Wiederholungszahl und RIR
- Zielerfuellungsquote
- Schmerz-/Technikflags

### 6.3 Basisalgorithmus pro Uebung

```text
Input:
  planned_sets, rep_range, target_RIR, load, exercise_type, goal
  actual_sets = [{load, reps, RIR, technique_ok, pain}]

Filter:
  valid_sets = sets where technique_ok and pain <= 3

Evaluate:
  all_sets_completed = valid_sets count >= planned_work_sets
  reps_in_range = all valid work sets reps >= rep_range.min
  top_range_hit = all valid work sets reps >= rep_range.max
  rir_too_easy = median_RIR >= target_RIR + 2
  rir_on_target = median_RIR between target_RIR - 1 and target_RIR + 1
  rir_too_hard = median_RIR <= target_RIR - 2 or any early_set_RIR <= 0

Decision:
  if pain >= 5 or technique broken:
      reduce load 5-10% or substitute exercise
  else if top_range_hit and rir_on_target_or_easy:
      increase load by exercise_increment
  else if reps_in_range and rir_too_easy:
      increase reps next time or small load increase
  else if reps_in_range and rir_on_target:
      hold load, progress reps within range
  else if not reps_in_range and rir_too_hard:
      reduce load 2.5-7.5% next time
  else:
      hold load and repeat
```

### 6.4 Wochenentscheidung pro Muskelgruppe

```text
Input:
  weekly_hard_sets_muscle
  performance_trend
  soreness
  joint_pain
  target_goal
  adherence

Decision:
  if joint_pain >= 5:
      reduce volume and/or swap exercise
  else if performance_down for 2-3 exposures and soreness high:
      reduce weekly sets by 20-40% for 1 week
  else if performance_stable_or_up and soreness manageable:
      keep volume
  else if performance_plateau >= 3 weeks and recovery good:
      add 1-2 weekly hard sets
  else if adherence poor:
      reduce plan complexity before increasing stimulus
```

## 7. Deload- und Fatigue-Regeln

Ein Deload ist keine Strafe, sondern geplante Ermuedungsreduktion. Die App sollte Deloads nicht nur kalendarisch, sondern datenbasiert ausloesen.

### Harte Deload-Trigger

- Schmerz >= 5/10 in einer Uebung oder Muskelgruppe.
- Technik bricht bei Lasten ein, die zuvor stabil waren.
- Leistung faellt in 2-3 aufeinanderfolgenden Einheiten trotz hoher Anstrengung.
- Schlaf/Stress/Readiness ueber mehrere Tage auffaellig schlecht.
- Sportler meldet Krankheit, Verletzung oder aussergewoehnliche Belastung.

### Weiche Deload-Trigger

- Mehrere Uebungen verfehlen Zielwiederholungen.
- RIR ist deutlich niedriger als geplant.
- Muskelkater bleibt laenger als 72 Stunden leistungsrelevant.
- Motivation sinkt und Session-RPE steigt.

### Deload-Varianten

1. **Volumen-Deload**: Saetze um 30-50% reduzieren, Last moderat halten.
2. **Intensitaets-Deload**: Last um 10-20% reduzieren, Saetze aehnlich halten.
3. **Kompletter Deload**: Last und Volumen reduzieren, RIR 4-6.
4. **Pivot-Woche**: andere Uebungsvarianten, geringere Gelenkbelastung.

Fuer die meisten Sportler ist ein Volumen-Deload mit moderater Last die beste Standardoption.

## 8. Plateauerkennung

Ein Plateau liegt nicht vor, wenn eine einzelne Einheit schlecht war. Die App sollte mindestens 3 vergleichbare Exposures bewerten.

Plateau-Kriterien pro Uebung:

- e1RM steigt ueber 3-5 Exposures nicht.
- Wiederholungen bei gleicher Last und vergleichbarem RIR steigen nicht.
- Ziel-RIR wird nicht erreicht oder faellt trotz gleicher Last.
- Technik und ROM sind unveraendert.

Entscheidungsmatrix:

| Befund | Wahrscheinliche Ursache | App-Entscheidung |
|---|---|---|
| Leistung stagniert, RIR hoch | Reiz zu niedrig | Last/Reps erhoehen |
| Leistung stagniert, RIR passend, Erholung gut | Volumen evtl. zu niedrig | +1-2 Saetze/Woche |
| Leistung faellt, RIR niedrig, Erholung schlecht | Ermuedung zu hoch | Deload oder Volumen -20-40% |
| Nur eine Uebung stagniert | Uebungsspezifisches Plateau | Variante wechseln oder Rep-Range aendern |
| Viele Uebungen stagnieren | Systemische Ermuedung | Deload, Plan vereinfachen |
| Schmerz steigt | Belastbarkeit ueberschritten | Last/ROM/Uebung anpassen |

## 9. Uebungswechsel als Progressionswerkzeug

Uebungswechsel sollten nicht zufaellig erfolgen. Zu haeufige Wechsel zerstoeren Vergleichbarkeit, zu seltene Wechsel kann Plateaus oder Ueberlastung verstaerken.

Regeln:

- Hauptuebungen: 6-12 Wochen stabil halten, ausser Schmerz/Technikproblem.
- Assistenzuebungen: 4-8 Wochen stabil halten.
- Isolationsuebungen: koennen flexibler gewechselt werden.
- Wechselgrund speichern: Plateau, Schmerz, Motivation, Equipment, Zielwechsel.

Bei Wechseln sollte die App eine "Ankerlogik" nutzen:

- gleiche Muskelgruppe
- aehnliches Bewegungsmuster
- aehnliche Ziel-Rep-Range
- Start konservativ mit 2-4 RIR

## 10. Coach-Kommunikation

Der LLM-Coach sollte die Entscheidung der Engine uebersetzen, nicht ersetzen.

Gute Coach-Antwort:

> "Wir erhoehen heute beim Bankdruecken um 2,5 kg, weil du letzte Woche alle drei Saetze am oberen Ende der Rep-Range geschafft hast und noch etwa 2 Wiederholungen im Tank hattest. Ziel heute: gleiche Technik, 8-10 Wiederholungen, nicht bis ans Limit."

Schlechte Coach-Antwort:

> "Push dich heute maximal, dein Koerper schafft das."

### Tonalitaet nach Entscheidungsart

**Progression**

- Betonung: verdient, datenbasiert, kontrolliert.
- "Mehr Gewicht, aber gleiche Technik bleibt die Bedingung."

**Halten**

- Betonung: Stabilisieren ist Teil der Progression.
- "Wir sammeln heute eine bessere Wiederholung, nicht zwingend mehr Gewicht."

**Reduktion**

- Betonung: langfristige Entwicklung.
- "Die Reduktion schuetzt die naechsten Fortschritte."

**Deload**

- Betonung: Ermuedung abbauen, Anpassung realisieren.
- "Diese Woche macht dich nicht schwaecher; sie macht den naechsten Block moeglich."

## 11. Sicherheitslogik

Die App sollte klare Grenzen haben:

- Kein Pushen durch akuten Schmerz.
- Kein 1RM-Test fuer Anfaenger ohne Freigabe.
- Keine Failure-Vorgaben bei technisch riskanten Uebungen, wenn der Sportler allein trainiert.
- Bei Krankheit, Schwindel, Brustschmerz, neurologischen Symptomen oder Verletzungsverdacht: Training abbrechen und medizinisch abklaeren lassen.
- Bei Jugendlichen, Schwangeren, Aelteren, Reha- oder chronisch kranken Personen: eigene Profile und konservativere Progression.

## 12. Empfohlene Standardprofile

### Beginner

- Frequenz: 2-3 Einheiten/Woche.
- Struktur: Ganzkoerper oder einfacher Ober-/Unterkoerper-Split.
- Saetze: 1-3 pro Uebung.
- RIR: 2-4.
- Progression: lineare oder Double Progression.
- Deload: selten geplant, eher bei Flags.

### Intermediate

- Frequenz: 3-5 Einheiten/Woche.
- Struktur: Ober-/Unterkoerper, Push/Pull/Beine oder zielbasierter Split.
- Saetze: ca. 8-16 harte Saetze pro Muskelgruppe/Woche.
- RIR: Blockweise 3 -> 1, gelegentlich 0 bei sicheren Uebungen.
- Progression: Double Progression, Top-Set + Back-Off, Volumenprogression.
- Deload: alle 4-8 Wochen oder datenbasiert.

### Advanced

- Frequenz: 4-6 Einheiten/Woche.
- Struktur: stark individualisiert.
- Saetze: haeufig 10-20 harte Saetze pro Muskelgruppe/Woche, je nach Muskel und Erholung.
- RIR: differenziert nach Uebung, Muskelgruppe und Block.
- Progression: autoreguliert, periodisiert, mit Plateau- und Fatigue-Management.
- Deload/Pivot: geplant und datengetrieben.

## 13. Priorisierte MVP-Regeln fuer deine App

Wenn du zuerst nur ein robustes System bauen willst, wuerde ich diese Regeln implementieren:

1. **Double Progression als Standard** fuer die meisten Uebungen.
2. **Top-Set + Back-Off** fuer Hauptuebungen.
3. **RIR-Zielkorridor** pro Uebung und Block.
4. **Hard-Set-Zaehler pro Muskelgruppe/Woche**.
5. **Plateauerkennung ueber 3-5 vergleichbare Exposures**.
6. **Deload-Trigger bei Leistungsabfall + hoher Anstrengung + schlechter Erholung**.
7. **Schmerz-/Technikflags als harte Overrides**.
8. **LLM nur als Kommunikationsschicht**, nicht als unkontrollierte Entscheidungsinstanz.

## 14. Regelprioritaet fuer die Engine

Wenn Regeln kollidieren, braucht die App eine feste Prioritaet. Vorschlag:

1. **Sicherheit vor Progression**: Schmerz, Technikabbruch, Krankheit oder Verletzungsverdacht ueberschreiben jede geplante Steigerung.
2. **Ziel vor Metrik**: Bei Maximalkraft zaehlt spezifische Kraftleistung mehr als Volumenload; bei Hypertrophie zaehlen harte Saetze und Naehe zum Versagen mehr als 1RM-Schaetzungen.
3. **Trend vor Einzeldatum**: Eine schlechte Einheit loest selten eine Plananpassung aus; 2-3 schlechte Exposures sind ein Signal.
4. **Erholung vor Volumenerhoehung**: Mehr Saetze nur, wenn Leistung stagniert und Erholung gut ist.
5. **Adhaerenz vor Optimierung**: Wenn der Sportler Einheiten auslaesst, ist ein einfacherer Plan besser als ein theoretisch perfekter.
6. **Coach erklaert, Engine entscheidet**: Das LLM formuliert Begruendung, Alternativen und Motivation, darf aber keine Regel-Overrides erfinden.

## 15. Beispiel: Progressionsentscheidung als Engine-Output

Der LLM-Coach sollte strukturierte Entscheidungen erhalten. Beispiel:

```json
{
  "exercise": "Bankdruecken",
  "decision": "increase_load",
  "next_load_kg": 82.5,
  "reason_codes": [
    "all_sets_at_top_of_rep_range",
    "rir_within_target",
    "no_pain_or_technique_flags"
  ],
  "athlete_message_constraints": {
    "tone": "calm_confident",
    "must_include": [
      "Steigerung ist klein und kontrolliert",
      "Technik bleibt wichtiger als Gewicht",
      "Ziel-RIR 1-3"
    ],
    "must_not_include": [
      "bis ans absolute Limit gehen",
      "Schmerz ignorieren"
    ]
  }
}
```

So bleibt die Kommunikation menschlich, aber die Trainingssteuerung nachvollziehbar, testbar und auditierbar.

## 16. Quellen

- American College of Sports Medicine. "Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews." Medicine & Science in Sports & Exercise, 2026. DOI: 10.1249/MSS.0000000000003897. PubMed: https://pubmed.ncbi.nlm.nih.gov/41843416/
- ACSM Science Spotlight zur 2026 Position Stand: https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/
- ACSM Infographic "5 Things to Know About Creating an Effective Resistance Training Plan", 2026: https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf
- American College of Sports Medicine. "Progression Models in Resistance Training for Healthy Adults." Medicine & Science in Sports & Exercise, 2009;41(3):687-708.
- Moesgaard L. et al. "Effects of Periodization on Strength and Muscle Hypertrophy in Volume-Equated Resistance Training Programs: A Systematic Review and Meta-analysis." Sports Medicine, 2022. https://pubmed.ncbi.nlm.nih.gov/35044672/
- Refalo M.C. et al. "Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis." Sports Medicine, 2023. https://link.springer.com/article/10.1007/s40279-022-01784-y
- Lopez P. et al. "Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis." Medicine & Science in Sports & Exercise, 2021. https://pubmed.ncbi.nlm.nih.gov/33433148/
- Schoenfeld B.J. et al. "Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis." Journal of Sports Sciences, 2017. https://www.tandfonline.com/doi/abs/10.1080/02640414.2016.1210197
- Zhang X. et al. "Auto-Regulation Method vs. Fixed-Loading Method in Maximum Strength Training for Athletes: A Systematic Review and Meta-Analysis." Frontiers in Physiology, 2021. https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.651112/full
- Hickmott L.M. et al. "The Effect of Load and Volume Autoregulation on Muscular Strength and Hypertrophy: A Systematic Review and Meta-Analysis." Sports Medicine - Open, 2022. https://pubmed.ncbi.nlm.nih.gov/35038063/
- Russo F. et al. "Factors influencing the accuracy of the repetition in reserve scale in resistance training: a systematic review." Physical Therapy Reviews, 2026. https://doi.org/10.1080/10833196.2025.2564026
