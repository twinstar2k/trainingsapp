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

**Bequemster Weg, ihn zu erzeugen** (legt Service Account, Rechte und GitHub-Secret in einem
Rutsch an):

```bash
firebase init hosting:github
```

Der Befehl fragt nach dem GitHub-Repository (`twinstar2k/trainingsapp`), erzeugt den Service
Account und legt das Secret automatisch an — allerdings unter dem Namen
`FIREBASE_SERVICE_ACCOUNT_MVP_APP_CLAUDE`. Zwei Möglichkeiten:

- das Secret in den Repo-Einstellungen auf `FIREBASE_SERVICE_ACCOUNT` umbenennen (neu anlegen,
  altes löschen), **oder**
- in `deploy-hosting.yml` den Namen anpassen.

Außerdem legt der Befehl eigene Workflow-Dateien an (`firebase-hosting-merge.yml`,
`firebase-hosting-pull-request.yml`). **Beide löschen** — sie überschneiden sich mit
`deploy-hosting.yml`, und die PR-Variante würde bei fremden Pull Requests laufen, was wir
bewusst nicht wollen.

**Manuell** geht es auch: In der Google Cloud Console unter *IAM & Verwaltung →
Dienstkonten* ein Konto anlegen, ihm die Rolle **Firebase Hosting Admin**
(`roles/firebasehosting.admin`) sowie **Firebase-Leser** (`roles/firebase.viewer`) geben, einen
JSON-Schlüssel erzeugen und dessen kompletten Inhalt als Secret einfügen.

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
