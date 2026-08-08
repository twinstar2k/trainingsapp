# Einrichtung: automatisches Hosting-Deployment

Was in den GitHub-Repository-Einstellungen hinterlegt sein muss, damit
`deploy-hosting.yml` läuft. Einmalige Einrichtung.

> **Das Repo ist öffentlich.** Deshalb unten die Trennung zwischen „echtes Geheimnis" und
> „ohnehin öffentlich". In öffentlichen Repos sind auch die Workflow-Logs öffentlich.

## 1. Secret — das einzige echte Geheimnis

`Settings → Secrets and variables → Actions → Secrets → New repository secret`

| Name | Inhalt |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Kompletter JSON-Inhalt eines Service-Account-Keys mit Deploy-Rechten |

Damit kann jeder, der ihn hat, auf das Firebase-Projekt deployen — dieser Wert gehört nirgendwo
ins Repo und nicht in Log-Ausgaben.

So wurde er am 2026-08-08 eingerichtet (manueller Weg, siehe Warnung darunter):

1. **Dienstkonto anlegen** —
   <https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=mvp-app-claude>
   - Name: `github-deploy-hosting`
   - Rollen: **Firebase Hosting-Administrator** (`roles/firebasehosting.admin`) und
     **Firebase-Betrachter** (`roles/firebase.viewer`)
2. **Schlüssel erzeugen** — Dienstkonto öffnen → Reiter *Schlüssel* → *Schlüssel hinzufügen* →
   *Neuen Schlüssel erstellen* → **JSON**
3. **Als Secret setzen**, ohne dass der Schlüssel in einer Kommandozeile oder Log-Ausgabe landet:
   ```bash
   gh secret set FIREBASE_SERVICE_ACCOUNT -R twinstar2k/trainingsapp < ~/Downloads/<datei>.json
   ```
4. **Heruntergeladene Datei löschen** — ein Service-Account-Key gehört nicht in den
   Download-Ordner.

> **`firebase init hosting:github` funktioniert hier nicht.** Der Befehl soll Service Account,
> Rechte und Secret automatisch anlegen, scheiterte in diesem Projekt aber reproduzierbar mit
> `HTTP Error: 404, Service account … does not exist` — er versucht einen Schlüssel für ein
> Konto zu erzeugen, dessen Anlegen zuvor still fehlschlug (vermutlich fehlende IAM-Rechte des
> angemeldeten Kontos). Zusätzlich hätte er eigene Workflow-Dateien angelegt, darunter eine
> PR-Variante, die bei fremden Pull Requests liefe — bei einem öffentlichen Repo unerwünscht.
> Der manuelle Weg oben ist auch sparsamer: Firebase braucht dabei gar keinen GitHub-Zugriff.

**Zum Secret-Namen:** GitHub-Secrets lassen sich nach dem Anlegen nicht mehr auslesen und
deshalb auch nicht umbenennen. Wer ein Secret unter anderem Namen hat, passt entweder
`deploy-hosting.yml` an oder legt das Secret aus der Original-Schlüsseldatei neu an.

## 2. Variables — nicht geheim

`Settings → Secrets and variables → Actions → Variables → New repository variable`

| Name | Wert (aus deiner lokalen `.env`) |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIza…` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `mvp-app-claude.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `mvp-app-claude` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `mvp-app-claude.…` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Zahlenfolge |
| `VITE_FIREBASE_APP_ID` | `1:…:web:…` |
| `VITE_AI_RECOMMENDATIONS` | `true` (aus deiner `.env.local`) — leer lassen oder `false` schaltet die KI-Empfehlung ab |

**Warum Variables statt Secrets?** Diese Werte sind bereits öffentlich: Die Firebase-Web-Config
wird in jedes Client-Bundle eingebacken und ist auf <https://mvp-app-claude.web.app> im
Browser abrufbar; `mvp-app-claude` steht zudem in `.firebaserc` und `CLAUDE.md`. Bei Firebase ist
das so vorgesehen — der Schutz kommt aus den Security Rules und der Allowlist, nicht aus der
Geheimhaltung dieser Werte.

Sie als Secrets abzulegen brächte keinen Schutz, würde aber die Logs verstümmeln: GitHub ersetzt
jedes Vorkommen eines Secret-Werts durch `***`, also auch `mvp-app-claude` in jeder
Firebase-CLI-Ausgabe.

Wer sie trotzdem als Secrets führen will: anlegen und in `deploy-hosting.yml` alle
`${{ vars.VITE_… }}` durch `${{ secrets.VITE_… }}` ersetzen. Der `VITE_AI_RECOMMENDATIONS`-Wert
im Schritt „Bundle gegenprüfen" muss dann entfallen, weil Secrets nicht in `if`-Ausdrücken
verglichen werden sollten.

## 3. Erster Lauf

Nach dem Merge nach `main` startet der Workflow automatisch. Manuell auslösen geht über
`Actions → Deploy Hosting → Run workflow`.

```bash
gh run watch          # Lauf live verfolgen
gh run view --log     # Log ansehen
```

## Was der Workflow NICHT tut

- **Keine Cloud Functions.** `firebase deploy --only functions` bleibt manuell. Grund: Es braucht
  deutlich weitere IAM-Rechte und Zugriff auf den Secret Manager (`REQUESTY_API_KEY`), und die
  Function ändert sich selten. Nach einer Änderung in `functions/` also weiterhin selbst
  deployen.
- **Keine Firestore Rules oder Indizes.** Ebenfalls bewusst manuell — ein fehlerhafter
  Rules-Deploy sperrt im Zweifel die ganze App aus.
- **Kein Deploy aus Pull Requests.** Siehe Kommentar oben in `deploy-hosting.yml`.

### Aber: Der Workflow warnt, wenn ein manueller Deploy fällig ist

Der letzte Schritt vergleicht den Push gegen den Vorgängerstand und meldet sichtbar (Annotation
oben am Lauf **und** Job-Summary), wenn etwas geändert wurde, das Hosting allein nicht abdeckt:

| Geändert | Fälliger Befehl |
|---|---|
| `shared/` oder `functions/` | `firebase deploy --only functions` |
| `firestore.rules` | `firebase deploy --only firestore:rules` |
| `firestore.indexes.json` | `firebase deploy --only firestore:indexes` |

**Warum das wichtig ist:** `shared/` (Metriken, Policy-Kern, `session-scan.ts`,
`studio-filter.ts`) wird von der App **und** der Cloud Function genutzt. Ohne den Hinweis geht
die App neu live, während der Coach weiter mit altem Code rechnet — stille Drift, dieselbe
Fehlerklasse, vor der `CLAUDE.md` bei den Security Rules warnt.

Bewusst nur eine **Warnung, kein Fehler**: Die App-Änderung soll ja live gehen, sie ist nicht
falsch — es fehlt nur noch ein zweiter Schritt.
