// rest-timer.test.mjs — Offline-Test für die Rechenlogik des Pausen-Timers.
//
// Testet den KOMPILIERTEN Code (kein hand-portierter Spiegel → kein Drift):
//   1) npm run build:utils     (erzeugt eval/lib/restTimer.js aus src/utils/restTimer.ts)
//   2) node rest-timer.test.mjs        (oder: npm test — macht beides)
//
// Warum offline testbar: Der Timer entscheidet (Raster, Grenzen, „ist der gespeicherte
// Stand noch gültig?"). Solche Logik im Hook wäre nur mit laufender App und echter Uhr
// prüfbar — siehe CLAUDE.md, „Entscheidungslogik als reine Funktion".
//
// Kernregel: Restzeit kommt IMMER aus dem Zielzeitstempel. iOS friert JS im Hintergrund
// ein; ein heruntergezählter Wert wäre nach jedem App-Wechsel falsch.

import { existsSync } from 'node:fs';

const URL_ = new URL('./lib/restTimer.js', import.meta.url);
if (!existsSync(URL_)) {
  console.error('✗ Kompilierter Rest-Timer fehlt. Bitte zuerst bauen (siehe Kopf dieser Datei).');
  process.exit(2);
}
const {
  REST_MIN, REST_MAX, REST_DEFAULT,
  clampRestSeconds, adjustRestSeconds, remainingSeconds, restProgress,
  formatRestTime, restoreTimer, parseRestSettings,
} = await import(URL_);

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { pass++; } else { fail++; console.log(`  ✗ ${label} -> ${JSON.stringify(got)}`); }
}

// ── A: Dauer auf Raster und Grenzen ─────────────────────────────────────────────
{
  check('A exakt im Raster bleibt', clampRestSeconds(90) === 90, clampRestSeconds(90));
  check('A rundet auf 30er-Raster', clampRestSeconds(100) === 90, clampRestSeconds(100));
  check('A rundet auf', clampRestSeconds(110) === 120, clampRestSeconds(110));
  check('A untere Grenze', clampRestSeconds(5) === REST_MIN, clampRestSeconds(5));
  check('A obere Grenze', clampRestSeconds(3600) === REST_MAX, clampRestSeconds(3600));
  check('A negativ → Minimum', clampRestSeconds(-60) === REST_MIN, clampRestSeconds(-60));

  // Kaputte Firestore-Werte dürfen nie einen endlosen Timer erzeugen.
  check('A NaN → Default', clampRestSeconds(NaN) === REST_DEFAULT, clampRestSeconds(NaN));
  check('A Infinity → Default', clampRestSeconds(Infinity) === REST_DEFAULT, clampRestSeconds(Infinity));
  check('A String → Default', clampRestSeconds('120') === REST_DEFAULT, clampRestSeconds('120'));
  check('A undefined → Default', clampRestSeconds(undefined) === REST_DEFAULT, clampRestSeconds(undefined));
}

// ── B: ±30 s an der laufenden Pause ─────────────────────────────────────────────
{
  check('B plus', adjustRestSeconds(90, 30) === 120, adjustRestSeconds(90, 30));
  check('B minus', adjustRestSeconds(90, -30) === 60, adjustRestSeconds(90, -30));
  check('B minus unter Minimum bleibt Minimum', adjustRestSeconds(30, -30) === REST_MIN, adjustRestSeconds(30, -30));
  check('B plus über Maximum bleibt Maximum', adjustRestSeconds(600, 30) === REST_MAX, adjustRestSeconds(600, 30));
  // Josefs Bereich (60 s–4 min) muss vollständig erreichbar sein.
  check('B 60 s erreichbar', adjustRestSeconds(90, -30) === 60, adjustRestSeconds(90, -30));
  check('B 240 s erreichbar', adjustRestSeconds(210, 30) === 240, adjustRestSeconds(210, 30));
}

// ── C: Restzeit aus Zeitstempeln ────────────────────────────────────────────────
{
  const t0 = 1_700_000_000_000;
  check('C voller Rest', remainingSeconds(t0 + 90_000, t0) === 90, remainingSeconds(t0 + 90_000, t0));
  check('C halber Rest', remainingSeconds(t0 + 45_000, t0) === 45, remainingSeconds(t0 + 45_000, t0));
  // Aufrunden: 0,3 s Rest zeigt noch „1" statt zu früh auf 0 zu springen.
  check('C rundet auf', remainingSeconds(t0 + 300, t0) === 1, remainingSeconds(t0 + 300, t0));
  check('C exakt 0', remainingSeconds(t0, t0) === 0, remainingSeconds(t0, t0));
  // Der eigentliche Punkt: nach 5 min im Hintergrund ist die Zeit einfach weg, nicht eingefroren.
  check('C lange weggewesen → 0', remainingSeconds(t0 + 90_000, t0 + 300_000) === 0,
    remainingSeconds(t0 + 90_000, t0 + 300_000));
  check('C nie negativ', remainingSeconds(t0, t0 + 60_000) === 0, remainingSeconds(t0, t0 + 60_000));
}

// ── D: Fortschrittsbalken ───────────────────────────────────────────────────────
{
  const t0 = 1_700_000_000_000;
  check('D Start = 0', restProgress(t0 + 90_000, 90, t0) === 0, restProgress(t0 + 90_000, 90, t0));
  check('D Hälfte = 0.5', restProgress(t0 + 45_000, 90, t0) === 0.5, restProgress(t0 + 45_000, 90, t0));
  check('D Ende = 1', restProgress(t0, 90, t0) === 1, restProgress(t0, 90, t0));
  check('D überzogen bleibt 1', restProgress(t0, 90, t0 + 30_000) === 1, restProgress(t0, 90, t0 + 30_000));
  check('D Dauer 0 → 1 (kein NaN im style)', restProgress(t0, 0, t0) === 1, restProgress(t0, 0, t0));
}

// ── E: Anzeigeformat ────────────────────────────────────────────────────────────
{
  check('E 107 → 1:47', formatRestTime(107) === '1:47', formatRestTime(107));
  check('E 7 → 0:07', formatRestTime(7) === '0:07', formatRestTime(7));
  check('E 60 → 1:00', formatRestTime(60) === '1:00', formatRestTime(60));
  check('E 600 → 10:00', formatRestTime(600) === '10:00', formatRestTime(600));
  check('E 0 → 0:00', formatRestTime(0) === '0:00', formatRestTime(0));
  check('E negativ → 0:00', formatRestTime(-5) === '0:00', formatRestTime(-5));
  check('E NaN → 0:00', formatRestTime(NaN) === '0:00', formatRestTime(NaN));
}

// ── F: Wiederherstellung nach Reload — lieber kein Timer als ein Geistertimer ────
{
  const now = 1_700_000_000_000;
  const ok = restoreTimer(JSON.stringify({ endsAt: now + 45_000, durationSeconds: 90 }), now);
  check('F gültiger Stand kommt zurück', ok?.endsAt === now + 45_000 && ok?.durationSeconds === 90, ok);

  check('F nichts gespeichert', restoreTimer(null, now) === null, restoreTimer(null, now));
  check('F leerer String', restoreTimer('', now) === null, restoreTimer('', now));
  check('F kaputtes JSON', restoreTimer('{nope', now) === null, restoreTimer('{nope', now));
  check('F kein Objekt', restoreTimer('42', now) === null, restoreTimer('42', now));
  check('F abgelaufen', restoreTimer(JSON.stringify({ endsAt: now - 1000, durationSeconds: 90 }), now) === null,
    restoreTimer(JSON.stringify({ endsAt: now - 1000, durationSeconds: 90 }), now));
  check('F genau jetzt zu Ende → verworfen',
    restoreTimer(JSON.stringify({ endsAt: now, durationSeconds: 90 }), now) === null,
    restoreTimer(JSON.stringify({ endsAt: now, durationSeconds: 90 }), now));
  // Uhr verstellt / uralter Eintrag: Restzeit größer als die Höchstdauer ist unmöglich.
  check('F unplausibel weit in der Zukunft',
    restoreTimer(JSON.stringify({ endsAt: now + 86_400_000, durationSeconds: 90 }), now) === null,
    restoreTimer(JSON.stringify({ endsAt: now + 86_400_000, durationSeconds: 90 }), now));
  check('F Dauer außerhalb des Bereichs',
    restoreTimer(JSON.stringify({ endsAt: now + 5000, durationSeconds: 9999 }), now) === null,
    restoreTimer(JSON.stringify({ endsAt: now + 5000, durationSeconds: 9999 }), now));
  check('F endsAt kein Zahl',
    restoreTimer(JSON.stringify({ endsAt: 'bald', durationSeconds: 90 }), now) === null,
    restoreTimer(JSON.stringify({ endsAt: 'bald', durationSeconds: 90 }), now));
  check('F Felder fehlen', restoreTimer('{}', now) === null, restoreTimer('{}', now));
}

// ── G: Einstellungen aus dem User-Dokument ──────────────────────────────────────
{
  const d = parseRestSettings(null);
  check('G leeres Dokument → Voreinstellung',
    d.mode === 'auto' && d.seconds === REST_DEFAULT && d.signal === 'interrupt', d);

  const full = parseRestSettings({ restTimerMode: 'manual', restSeconds: 180, restSignal: 'stop' });
  check('G gesetzte Werte werden übernommen',
    full.mode === 'manual' && full.seconds === 180 && full.signal === 'stop', full);

  // Ein kaputtes Feld darf die beiden anderen nicht mitreißen.
  const mixed = parseRestSettings({ restTimerMode: 'quatsch', restSeconds: 180, restSignal: 'silent' });
  check('G unbekannter Modus fällt einzeln zurück',
    mixed.mode === 'auto' && mixed.seconds === 180 && mixed.signal === 'silent', mixed);

  const rounded = parseRestSettings({ restSeconds: 100 });
  check('G Sekunden werden gerastert', rounded.seconds === 90, rounded);

  check('G aus-Modus wird respektiert', parseRestSettings({ restTimerMode: 'off' }).mode === 'off',
    parseRestSettings({ restTimerMode: 'off' }));
}

console.log(`rest-timer: ${pass} ok, ${fail} fehlgeschlagen`);
process.exit(fail === 0 ? 0 : 1);
