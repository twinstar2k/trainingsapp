# Prozess-Blueprint: Entwicklung, CI/CD und Absicherung

Übertragbare Fassung der Prozessverbesserungen vom **2026-08-08**, bewusst **ohne
Firebase-Bezug** — anwendbar auf jedes Frontend-Projekt mit gehosteter Datenbank
(Supabase, PocketBase, eigenes Backend). Provider-spezifische Befehle sind als
`<Platzhalter>` markiert.

Die Firebase-Umsetzung dieses Blueprints liegt in `.github/workflows/deploy-hosting.yml`
und `.github/workflows/README-secrets.md`.

---

## 1. Der Arbeitsablauf

```
Feature-Branch  →  Commit(s)  →  lokale Sichtprüfung  →  Merge  →  Push
                                                                    └→ CI baut, prüft, deployt
```

| Schritt | Regel | Warum |
|---|---|---|
| **Feature-Branch** | `feat/…`, `fix/…`, `chore/…`, `docs/…` | Arbeit bleibt isoliert; `main` ist immer auslieferbar |
| **Commits** | Code und Doku **getrennt**; Nachricht nennt das *Warum*, nicht nur das *Was* | Die Historie beantwortet später „warum steht das so da" |
| **Sichtprüfung** | Vor dem Merge lokal ansehen | Die einzige Kontrolle, die Rendering und Bedienung prüft |
| **Merge** | `--no-ff` | Das Feature bleibt als Einheit erkennbar |
| **Push** | **ist der Deploy** | siehe Abschnitt 2 |

**Freigabepflichtig ist der Push**, nicht mehr ein Deploy-Befehl. Sobald die Pipeline steht,
verschiebt sich der Punkt, an dem etwas unwiderruflich nach außen geht.

**Kleinigkeiten sammeln.** Mehrere kleine Änderungen auf einem Branch bündeln, statt pro
Kleinigkeit einen Zyklus zu fahren.

---

## 2. Warum die CI deployt und nicht der Laptop

Zwei getrennte Gründe — der zweite wird meist übersehen:

**Reihenfolge.** Wird lokal deployt und *danach* gepusht, läuft nach einem Abbruch dazwischen
Code auf dem Server, der **nirgends versioniert** ist. Um herauszufinden, was live ist, müsste
man das minifizierte Bundle rückwärts lesen. Bei Push-zuerst ist der schlimmste Fall „Code
gesichert, live noch der alte Stand" — mit einem Befehl nachholbar. Man tauscht einen teuren
Fehlerfall gegen einen billigen.

**Herkunft des Artefakts.** Ein lokaler Deploy lädt den Build **deines Arbeitsverzeichnisses**
hoch. Der enthält womöglich uncommittete Änderungen und liest lokale `.env`-Dateien, die nicht
im Repo liegen. Der Live-Stand ist dann grundsätzlich nicht aus dem Repository reproduzierbar —
auch bei korrekter Reihenfolge. Erst wenn die CI aus dem gepushten Commit in einer frischen
Umgebung baut, gilt: **was live ist, steht auf dem Server-Repo.**

> Solange noch lokal deployt wird, hilft als Minimalschutz: vor dem Deploy prüfen, dass
> `git status` sauber ist und `HEAD == origin/main`.

---

## 3. Aufbau der Pipeline

Reihenfolge ist Absicht — je später ein Schritt, desto teurer sein Fehlschlag:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:        # manuelles Nachdeployen ohne Leer-Commit

concurrency:
  group: deploy
  cancel-in-progress: false # zwei Deploys nacheinander, keinen abbrechen

jobs:
  deploy:
    permissions:
      contents: read        # so wenig wie möglich
    steps:
      # 1. Checkout, Node-Version wie in der Produktionsumgebung, Dependency-Cache
      # 2. Deterministisch installieren  (npm ci — nicht npm install)
      # 3. Lint
      # 4. Tests
      # 5. Pflicht-Env-Variablen prüfen      ← siehe unten
      # 6. Bauen
      # 7. Bundle gegenprüfen                ← siehe unten
      # 8. Zugangsdaten bereitstellen
      # 9. Deploy
      # 10. Zugangsdatei entfernen  (if: always())
      # 11. Auf ausstehende manuelle Deploys hinweisen   ← Abschnitt 5
```

### Die beiden Schritte, die den stummen Fehlschlag verhindern

Der gefährlichste Fehler ist nicht der rote Lauf — es ist der **grüne Lauf, der etwas Kaputtes
ausliefert**. Typischer Hergang: Die Client-Konfiguration fehlt, der Client wird nicht
initialisiert, die App startet ohne Login und ohne Daten. Der Build wirft dabei keinen Fehler.

**Schritt 5 — Pflichtvariablen prüfen:** Vor dem Build hart abbrechen, wenn eine benötigte
Variable leer ist. Nennt beim Abbruch den Namen und verweist auf die Einrichtungsanleitung.

```bash
fehlend=0
for name in <VAR_1> <VAR_2> …; do
  if [ -z "${!name}" ]; then
    echo "::error::Variable $name fehlt"
    fehlend=1
  fi
done
[ "$fehlend" -eq 0 ] || exit 1
```

**Schritt 7 — Bundle gegenprüfen:** Nach dem Build belegen, dass die Werte wirklich im Artefakt
gelandet sind. Schritt 5 prüft nur, ob sie im Runner ankamen — nicht, ob der Bundler sie
übernommen hat.

```bash
grep -qr "<erwarteter Wert>" dist/assets/*.js \
  || { echo "::error::Konfiguration nicht im Bundle"; exit 1; }
```

> **Vor dem ersten Einsatz verifizieren, nicht annehmen:** Ob der Bundler Variablen aus der
> Prozessumgebung übernimmt (in der CI gibt es keine `.env`), lässt sich lokal in einer Minute
> beweisen — mit einem Probe-Wert bauen und im Bundle nachsehen:
> `<VAR>=probe-xyz npm run build && grep -r probe-xyz dist/`

---

## 4. Secrets und Variables trennen

Nicht alles, was nach Zugangsdaten aussieht, ist geheim. Die Leitfrage:

> **Steht der Wert ohnehin im ausgelieferten Client-Bundle?** Dann ist er öffentlich, egal wie
> er heißt.

| Art | Ablage | Beispiele |
|---|---|---|
| Im Client-Bundle sichtbar | **Repository Variable** | Projekt-URL, öffentlicher API-Key (Supabase: `anon key`), Feature-Flags |
| Kann deployen, schreiben oder Regeln umgehen | **Repository Secret** | Deploy-Token, Service-Rollen-Schlüssel (Supabase: `service_role key`), CI-Zugangsschlüssel |

**Warum nicht einfach alles als Secret?** Es schützt nichts und schadet der Lesbarkeit: Der
Runner ersetzt jedes Vorkommen eines Secret-Werts durch `***` — auch die Projekt-ID in jeder
CLI-Ausgabe. Logs werden unlesbar, ohne Sicherheitsgewinn.

**Ein öffentlicher Schlüssel ist kein Sicherheitsproblem — solange der Schutz woanders sitzt:**
in Row-Level-Security-Policies bzw. Datenbankregeln und einer Zugangs-Allowlist. Wenn ein
öffentlicher Key im Bundle dich beunruhigt, ist das ein Hinweis, die Regeln zu prüfen — nicht
den Key zu verstecken.

**Ein geheimer Schlüssel gehört nie in eine Kommandozeile.** Per Standardeingabe setzen und die
heruntergeladene Datei danach löschen:

```bash
gh secret set <NAME> -R <user/repo> < <datei>.json
rm <datei>.json
```

---

## 5. Wenn die Pipeline nur einen Teil deployt

Meist deployt die CI nur das Frontend, während Datenbankregeln, Migrationen und
Server-Funktionen manuell bleiben — bewusst, denn sie brauchen weitere Rechte und können im
Fehlerfall die App aussperren.

**Das erzeugt eine stille Gefahr:** Wird geteilter Code geändert, den Frontend *und*
Server-Funktion nutzen, geht das Frontend neu live, während die Funktion mit altem Code
weiterrechnet. Niemand bemerkt es.

**Gegenmittel:** ein letzter Schritt, der den Push gegen den Vorgängerstand vergleicht und
sichtbar meldet, was noch fehlt — als Annotation **und** in der Job-Summary, mit
Copy-Paste-fertigem Befehl.

```bash
if [ -n "$(git diff --name-only "$VORHER" "$GITHUB_SHA" -- <pfade>)" ]; then
  echo "::warning::<Bereich> geändert — bitte manuell deployen: <befehl>"
fi
```

Erfordert `fetch-depth: 0` beim Checkout. Bei `workflow_dispatch` gibt es keinen
Vorgängerstand — diesen Fall abfangen und überspringen.

**Bewusst eine Warnung, kein Fehler.** Die Frontend-Änderung soll ja live gehen; es fehlt nur
ein zweiter Schritt. Ein harter Abbruch würde eine korrekte Auslieferung blockieren.

Zu überwachende Pfade typischerweise: geteilter Code, Server-/Edge-Functions,
Datenbank-Policies, Migrationen, Index-Definitionen.

---

## 6. Reproduzierbarkeit und Sicherheit

| Regel | Warum |
|---|---|
| **Deploy-CLI auf exakte Version pinnen** (`tool@1.2.3`, nicht `tool@1`) | Sonst können zwei Läufe desselben Commits verschiedene Versionen nutzen. Updates werden so zu einem eigenen, nachvollziehbaren Commit |
| **`npm ci`, nie `npm install`** | Installiert exakt den Lockfile-Stand |
| **Node-Version festlegen**, passend zur Produktionsumgebung | Lokal läuft oft eine andere |
| **Actions aktuell halten** | Deprecation-Warnungen im Lauf ernst nehmen; veraltete Runtimes werden irgendwann abgeschaltet |
| **Kein `pull_request`-Trigger bei öffentlichen Repos** | Sonst stünde das Deploy-Secret fremden Pull Requests zur Verfügung. Nur `push` auf den Hauptbranch und `workflow_dispatch` |
| **`permissions:` minimal setzen** | Standardrechte sind großzügiger als nötig |

**Nach jedem Deploy prüfen, dass live und Repo übereinstimmen** — Artefakt-Hash der
ausgelieferten Seite gegen den lokalen Build, plus `HEAD == origin/main`.

> Fallstrick: Große Artefakte nicht durch eine Shell-Variable pipen
> (`JS=$(curl …); echo "$JS" | grep …`) — das scheitert ab wenigen hundert KB stumm. In eine
> Datei laden und darin suchen.

---

## 7. Testkonvention: Logik raus aus den Effekten

**Regel:** Sobald ein Daten-Hook mehr tut als laden und setzen — filtern, sortieren, rechnen,
entscheiden ob überhaupt geladen wird — gehört dieser Teil in eine **reine Funktion** in einem
eigenen Modul, mit Unit-Test. Die Datenbankaufrufe bleiben im Hook.

**Warum das der wirksamste Testansatz mit dem geringsten Aufwand ist:** Fehler in
Entscheidungslogik sind die tückischsten — die Oberfläche zeigt etwas an, nur das Falsche. Beim
Draufschauen fällt das nicht auf. Als reine Funktion sind sie in Minuten prüfbar, ohne Mocking,
ohne Emulator, ohne laufende App.

**Vorwärts anwenden, nicht nachrüsten.** Beim Bauen kostet die Trennung fast nichts.
Nachträglich aus einem gewachsenen Hook zu extrahieren ist deutlich teurer — und lohnt sich oft
nicht: Ein Hook, der überwiegend CRUD-Operationen enthält, hat kaum extrahierbare Logik, und
sein eigentliches Risiko (schreibt er das richtige Dokument? bleibt lokaler State konsistent?)
ließe sich ohnehin nur mit Mocking oder Emulator prüfen.

**Ein dependency-freies Testverzeichnis reicht** für reine Funktionen: Node-eigener Runner,
Assertions von Hand, in der Pipeline mitlaufen lassen. Kein Test-Framework nötig, solange keine
Komponenten gerendert werden.

---

## 8. Verifikationsgewohnheiten

Die Gewohnheit, die in dieser Session die meisten Fehler verhindert hat: **belegen statt
annehmen** — auch wenn es offensichtlich scheint.

| Annahme | Wie sie billig zu belegen ist |
|---|---|
| „Der Bundler übernimmt Env-Variablen" | Mit Probe-Wert bauen, im Bundle suchen |
| „Das Shell-Skript im Workflow ist korrekt" | `bash -n` über jeden `run`-Block, Ausdrücke durch Platzhalter ersetzt |
| „Die Änderungs-Erkennung schlägt richtig an" | Gegen **echte Commits der Historie** durchspielen, positiv und negativ |
| „Der Fix wirkt" | Gegen einen **echten Datenbestand** rechnen (Backup-Dump), alt gegen neu vergleichen |
| „Das Deploy ist durch" | Artefakt-Hash live gegen lokal, Commit-SHA gegen `origin` |
| „Diese Bibliotheksversion existiert" | Registry fragen, statt eine Versionsnummer zu raten |

Ebenso wichtig: **Ein grüner Lauf ist kein Beweis, dass das Deployte funktioniert.** Er belegt
nur, dass die Schritte durchliefen, die wir definiert haben.

---

## 9. Was bewusst nicht automatisiert wird

Nicht alles gehört in die Pipeline. Manuell bleiben sollte, was weitreichende Rechte braucht
oder im Fehlerfall den Zugang zur App zerstört:

- **Datenbankregeln / RLS-Policies** — ein fehlerhafter Deploy sperrt alle Nutzer aus
- **Migrationen** — nicht ohne Weiteres rückgängig zu machen
- **Server-/Edge-Functions** — brauchen meist weitergehende Rechte und Zugriff auf Secrets

Diese Entscheidung ist nur haltbar **zusammen mit der Drift-Warnung aus Abschnitt 5** — sonst
verlässt man sich darauf, dass niemand den zweiten Schritt vergisst.

---

## 10. Übertragung auf ein Supabase-Projekt

Direkt übertragbar sind die Abschnitte 1, 2, 3, 5, 6, 7, 8 und 9 — sie enthalten keine
Provider-Annahmen.

**Abschnitt 4 (Secrets/Variables) sinngemäß:**

| Wert | Einstufung |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | **Variable** — stehen im Client-Bundle, sind öffentlich |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — umgeht Row Level Security vollständig |
| `SUPABASE_ACCESS_TOKEN` / Deploy-Token der Hosting-Plattform | **Secret** |

Der `anon key` ist öffentlich by design — der Schutz liegt in den **RLS-Policies**. Wer ihn als
Secret behandelt, gewinnt nichts; wer keine RLS-Policies hat, verliert alles.

**Vor dem Übertragen zu klären:**

1. **Wer deployt das Frontend?** Vercel, Netlify und Cloudflare deployen oft selbst bei Push.
   Dann ist Abschnitt 2 bereits erfüllt — aber prüfen, ob dort auch Lint, Tests und der
   Env-Check laufen. Meist nicht. Dann bleibt die eigene Pipeline sinnvoll, oder die
   Plattform-Integration wird um diese Prüfungen ergänzt.
2. **Was ist die manuell zu deployende Teilmenge?** Bei Supabase typischerweise Migrationen
   (`supabase db push`) und Edge Functions (`supabase functions deploy`). Deren Pfade in die
   Drift-Warnung aus Abschnitt 5 eintragen.
3. **Gibt es geteilten Code** zwischen Frontend und Edge Functions? Falls ja, ist er der
   wichtigste zu überwachende Pfad — genau dort entsteht stille Drift.
4. **Sind die Migrationen versioniert im Repo?** Falls ja, sind sie ein natürlicher Kandidat
   für die Drift-Warnung; falls nein, ist das der erste Schritt vor allem anderen.

**Was du nicht übernehmen solltest, ohne es zu prüfen:** die konkrete Rollenwahl für das
Deploy-Konto. Vergib die minimalen Rechte deiner Plattform und lass den ersten Lauf zeigen, was
fehlt — die Fehlermeldung nennt die konkrete Berechtigung.

---

## Offene Verbesserung

**Doku-Änderungen lösen einen vollen Deploy aus.** Ein Push, der nur Markdown ändert, baut und
deployt ein identisches Bundle. Mit `paths-ignore` (`**.md`, `docs/**`) ließe sich das
vermeiden. Gegenargument: Dann gilt „live == `main`" nicht mehr ausnahmslos, was die einfache
Regel aufweicht. Bei seltenen Doku-Commits ist der Leerlauf womöglich billiger als die Ausnahme.
