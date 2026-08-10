#!/usr/bin/env node
/**
 * screen.mjs — one public url in, one folder of findings out.
 *
 *   npm run screen -- https://example.com
 *   npm run screen -- https://example.com --out ./runs --timeout 90000
 *
 * ONE URL, ONE RUN, TRIGGERED BY HAND. There is deliberately no list input, no
 * queue, no --all, no concurrency and no link following. Ten companies means
 * running this ten times. That limit is not a missing feature — it is what
 * keeps this a screening tool for pages you are about to contact about their
 * own site, rather than a scraper. See README.
 *
 * Everything stays on this disk. Nothing is uploaded anywhere.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { collect, readRobots } from './collect.mjs';
import { runLighthouse } from './lighthouse.mjs';
import { assessRender, buildChecks } from './checks.mjs';
import { renderSummary } from './summary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TIMEOUT_MS = 60_000;
const VERSION = '1.0.0';

/* ------------------------------------------------------------------ cli --- */

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out' || arg === '--timeout') {
      flags[arg.slice(2)] = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg.startsWith('-')) {
      throw new UserError(`Nieznana opcja: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (flags.help) return { help: true };

  // The batch guard, stated out loud rather than silently ignoring extras.
  if (positional.length === 0) throw new UserError('Podaj jeden adres URL.', USAGE);
  if (positional.length > 1) {
    throw new UserError(
      'To narzędzie sprawdza dokładnie jeden adres na uruchomienie.',
      'Aby sprawdzić kilka firm, uruchom polecenie kilka razy — osobno dla każdej.',
    );
  }

  const url = normaliseUrl(positional[0]);
  const timeoutMs = flags.timeout ? Number(flags.timeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 5000) {
    throw new UserError('--timeout musi być liczbą milisekund, minimum 5000.');
  }

  return {
    url,
    timeoutMs,
    outDir: path.resolve(flags.out ? String(flags.out) : path.join(ROOT, 'runs')),
  };
}

const USAGE = `
Użycie:
  npm run screen -- <adres-url> [--out <katalog>] [--timeout <ms>]

Przykład:
  npm run screen -- https://example.com

Jeden adres na uruchomienie. Narzędzie nie chodzi po linkach i nie sprawdza
innych podstron — bada wyłącznie podaną stronę.
`.trim();

function normaliseUrl(raw) {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new UserError(`To nie wygląda na poprawny adres URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UserError('Obsługiwane są tylko adresy http:// i https://.');
  }
  if (!parsed.hostname) throw new UserError(`Brak nazwy domeny w adresie: ${raw}`);
  return parsed.href;
}

class UserError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

/* ------------------------------------------------------------------ run --- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const { url, timeoutMs, outDir } = opts;
  const domain = new URL(url).hostname.replace(/^www\./, '');
  const startedAt = new Date();

  console.log(`\nSprawdzam: ${url}`);
  console.log(`Limit czasu: ${Math.round(timeoutMs / 1000)} s na wczytanie strony.\n`);

  /* --- browser passes: axe + document + phone -------------------------- */
  console.log('  1/4  Renderuję stronę i uruchamiam axe-core…');
  let collected;
  try {
    collected = await collect(url, { timeoutMs });
  } catch (err) {
    throw explainLoadFailure(err, url);
  }
  const errors = [...collected.errors];
  if (collected.axe) {
    console.log(`       axe-core: ${collected.axe.totals.total} naruszeń.`);
  } else {
    console.log('       axe-core: nie udało się uruchomić (szczegóły w raw.json).');
  }

  /* --- robots.txt: one request, sitemap declaration only ---------------- */
  console.log('  2/4  Sprawdzam deklarację mapy strony w robots.txt…');
  const robots = await readRobots(collected.desktop.finalUrl, timeoutMs);

  /* --- lighthouse ------------------------------------------------------- */
  console.log('  3/4  Uruchamiam Lighthouse (to trwa najdłużej)…');
  let lighthouse = null;
  try {
    lighthouse = await runLighthouse(collected.desktop.finalUrl, { timeoutMs });
    console.log(
      `       Wydajność ${lighthouse.scores.performance} · ` +
        `Dostępność ${lighthouse.scores.accessibility} · ` +
        `Dobre praktyki ${lighthouse.scores.bestPractices} · ` +
        `SEO ${lighthouse.scores.seo}`,
    );
  } catch (err) {
    errors.push({ phase: 'lighthouse', message: err.message });
    console.log(`       Lighthouse nie ukończył testu: ${err.message}`);
    console.log('       Reszta wyników zostanie zapisana mimo to.');
  }

  /* --- assemble --------------------------------------------------------- */
  const checks = buildChecks({
    desktop: collected.desktop,
    mobile: collected.mobile,
    robots,
  });

  const render = assessRender(collected.desktop.document);
  if (render.thin) {
    console.log('\n  ⚠ Uwaga: strona wyrenderowała się niemal pusta');
    console.log(`       (${render.reason}).`);
    console.log('       Prawdopodobnie zatrzymała nas zgoda na cookies lub ochrona przed botami.');
    console.log('       Wyniki poniżej opisują to, co się wczytało — nie całą stronę.');
  }

  const report = {
    tool: 'audit-tool',
    version: VERSION,
    screenedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    input: { url, domain, timeoutMs },
    page: {
      finalUrl: collected.desktop.finalUrl,
      status: collected.desktop.status,
      redirected: collected.desktop.redirected,
      headers: collected.desktop.headers,
      document: collected.desktop.document,
    },
    mobile: collected.mobile,
    axe: collected.axe,
    lighthouse,
    robots,
    render,
    checks,
    errors,
  };

  /* --- write ------------------------------------------------------------ */
  console.log('  4/4  Zapisuję wyniki…');
  const runDir = await makeRunDir(outDir, domain, startedAt);
  await fs.writeFile(
    path.join(runDir, 'raw.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  await fs.writeFile(path.join(runDir, 'summary.md'), `${renderSummary(report)}\n`, 'utf8');

  console.log(`\nGotowe. Wyniki: ${runDir}`);
  console.log(`  summary.md  — podsumowanie do przeczytania`);
  console.log(`  raw.json    — pełne dane techniczne\n`);
}

/**
 * Folder per run, named from domain and date. A second run of the same domain
 * on the same day gets the time appended rather than overwriting the first —
 * comparing before/after is the normal reason to run twice.
 */
async function makeRunDir(outDir, domain, when) {
  const safeDomain = domain.replace(/[^a-z0-9.-]/gi, '_');
  const date = [
    when.getFullYear(),
    String(when.getMonth() + 1).padStart(2, '0'),
    String(when.getDate()).padStart(2, '0'),
  ].join('-');

  let dir = path.join(outDir, `${safeDomain}-${date}`);
  try {
    await fs.mkdir(dir, { recursive: false });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      await fs.mkdir(path.dirname(dir), { recursive: true });
      await fs.mkdir(dir, { recursive: true });
      return dir;
    }
    const time = `${String(when.getHours()).padStart(2, '0')}${String(when.getMinutes()).padStart(2, '0')}`;
    dir = path.join(outDir, `${safeDomain}-${date}-${time}`);
    await fs.mkdir(dir, { recursive: true });
  }
  return dir;
}

/**
 * One failure, one sentence a human can act on. No retry: a site that turned us
 * away should be visited by hand, not hammered.
 */
function explainLoadFailure(err, url) {
  const msg = err.message ?? String(err);
  const host = safeHost(url);

  if (err.code === 'HTTP_ERROR' && (err.status === 403 || err.status === 429)) {
    return new UserError(
      `Strona odrzuciła połączenie (HTTP ${err.status}).`,
      'Serwis najprawdopodobniej blokuje ruch automatyczny. Otwórz go ręcznie w przeglądarce — nie ponawiam próby.',
    );
  }
  if (err.code === 'HTTP_ERROR') {
    return new UserError(msg, 'Sprawdź, czy adres jest aktualny.');
  }
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|getaddrinfo/i.test(msg)) {
    return new UserError(`Nie znaleziono domeny ${host}.`, 'Sprawdź pisownię adresu.');
  }
  if (/ERR_CERT|SSL|certificate/i.test(msg)) {
    return new UserError(
      `Certyfikat HTTPS dla ${host} jest nieprawidłowy lub wygasł.`,
      'Sam w sobie jest to wynik wart odnotowania — przeglądarki pokazują tu ostrzeżenie.',
    );
  }
  if (/Timeout|timeout exceeded/i.test(msg)) {
    return new UserError(
      `Strona ${host} nie wczytała się w wyznaczonym czasie.`,
      'Możesz wydłużyć limit: --timeout 120000. Nie ponawiam próby automatycznie.',
    );
  }
  if (/ERR_CONNECTION|ECONNREFUSED|ECONNRESET|net::/i.test(msg)) {
    return new UserError(`Nie udało się połączyć z ${host}.`, msg);
  }
  return new UserError(`Nie udało się wczytać strony: ${msg}`);
}

function safeHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

main().catch((err) => {
  if (err instanceof UserError) {
    console.error(`\n✖ ${err.message}`);
    if (err.hint) {
      for (const line of String(err.hint).split('\n')) console.error(`  ${line}`);
    }
    console.error('');
    process.exit(1);
  }
  console.error('\n✖ Nieoczekiwany błąd:');
  console.error(err);
  process.exit(1);
});
