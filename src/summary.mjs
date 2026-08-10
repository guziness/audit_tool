/**
 * summary.mjs — the page a human actually reads.
 *
 * Two parts that can be led with independently, because which angle lands
 * depends on the prospect: some care that the site excludes people, some care
 * that it loses them. Both are backed by the same measured facts.
 */
import { CWV_BANDS } from './lighthouse.mjs';
import { MIN_TAP_TARGET_PX } from './collect.mjs';
import { NOUNS, countOf } from './text.mjs';
import { IMPACT_PL, topAccessibilityIssues, topUxIssues } from './translate.mjs';

const BAND_PL = {
  good: 'dobrze',
  'needs-improvement': 'do poprawy',
  poor: 'słabo',
  unknown: 'nie zmierzono',
};

const STATUS_MARK = { pass: '✅', fail: '❌', unknown: '➖' };

const GROUP_TITLES = {
  mobile: 'Telefon',
  trust: 'Kontakt i zaufanie',
  seo: 'SEO — podstawy techniczne',
};

export function renderSummary(report) {
  const { input, screenedAt, page, axe, lighthouse, checks, render } = report;
  const domain = input.domain;
  const date = screenedAt.slice(0, 10);
  const out = [];

  out.push(`# Przegląd strony ${domain}`);
  out.push('');
  out.push(`**Adres:** ${page?.finalUrl ?? input.url}  `);
  out.push(`**Data przeglądu:** ${date}`);
  if (page?.redirected) out.push(`  \n**Uwaga:** podany adres przekierował na powyższy.`);
  out.push('');

  if (render?.thin) {
    out.push('> **⚠ Ten przegląd jest niemiarodajny.**  ');
    out.push(
      `> Strona wyrenderowała się niemal pusta — ${render.reason}. ` +
        'Najprawdopodobniej zatrzymała nas zgoda na cookies albo ochrona przed ruchem ' +
        'automatycznym. Wyniki poniżej opisują to, co udało się wczytać, a nie ' +
        'rzeczywistą stronę — dobre oceny nic tu nie oznaczają. Otwórz stronę ręcznie ' +
        'przed użyciem tych danych w rozmowie.',
    );
    out.push('');
  }

  out.push('---');
  out.push('');

  /* ------------------------------------------------ Część 1 ------------- */

  out.push('## Część 1 — Dostępność');
  out.push('');
  out.push(
    `**Ocena dostępności (Lighthouse): ${fmtScore(lighthouse?.scores?.accessibility)}**`,
  );
  out.push('');

  if (!axe) {
    out.push('_Nie udało się przeprowadzić testu axe-core na tej stronie._');
    out.push('');
  } else {
    const t = axe.totals;
    if (t.total === 0) {
      out.push('**Automatyczny test axe-core nie wykrył naruszeń WCAG.**');
      out.push('');
    } else {
      out.push(
        `**Znalezione naruszenia: ${t.total}**, w ${countOf(axe.violations.length, NOUNS.rule)} WCAG.`,
      );
      out.push('');
      out.push('| Waga | Liczba |');
      out.push('| --- | ---: |');
      out.push(`| Krytyczne | ${t.critical} |`);
      out.push(`| Poważne | ${t.serious} |`);
      out.push(`| Średnie | ${t.moderate} |`);
      out.push(`| Drobne | ${t.minor} |`);
      out.push('');
    }

    const top = topAccessibilityIssues(axe.violations, 3);
    if (top.length) {
      out.push('### Trzy najbardziej odczuwalne problemy');
      out.push('');
      top.forEach((v, i) => {
        out.push(
          `${i + 1}. **${v.explanation.head}** — ${IMPACT_PL[v.impact]}, ` +
            `${countOf(v.nodeCount, NOUNS.place)} na stronie.`,
        );
        if (v.explanation.consequence) out.push(`   ${v.explanation.consequence}`);
        out.push('');
      });
    } else {
      out.push('_Test automatyczny nie wykrył naruszeń WCAG na tej stronie._');
      out.push('');
    }
  }

  out.push('---');
  out.push('');

  /* ------------------------------------------------ Część 2 ------------- */

  out.push('## Część 2 — UX i biznes');
  out.push('');
  out.push('### Pozostałe oceny Lighthouse');
  out.push('');
  out.push(`- Wydajność: ${fmtScore(lighthouse?.scores?.performance)}`);
  out.push(`- Dobre praktyki: ${fmtScore(lighthouse?.scores?.bestPractices)}`);
  out.push(`- SEO: ${fmtScore(lighthouse?.scores?.seo)}`);
  out.push('');

  out.push('### Szybkość i stabilność (Core Web Vitals)');
  out.push('');
  if (!lighthouse) {
    out.push('_Nie udało się zmierzyć — Lighthouse nie ukończył testu._');
  } else {
    out.push('| Wskaźnik | Wartość | Ocena | Próg „dobrze” |');
    out.push('| --- | ---: | --- | ---: |');
    out.push(row('LCP — czas do wyświetlenia głównej treści', lighthouse.metrics.lcp, 'lcp'));
    out.push(row('CLS — przeskakiwanie układu', lighthouse.metrics.cls, 'cls'));
    out.push(row('TBT — czas bez reakcji na kliknięcia', lighthouse.metrics.tbt, 'tbt'));
    out.push('');
    out.push(`_Pomiar w emulacji telefonu (${lighthouse.formFactor}), tak jak liczy to Google._`);
  }
  out.push('');

  for (const group of ['mobile', 'trust', 'seo']) {
    const rows = checks.filter((c) => c.group === group);
    if (!rows.length) continue;
    out.push(`### ${GROUP_TITLES[group]}`);
    out.push('');
    for (const c of rows) {
      out.push(`- ${STATUS_MARK[c.status] ?? '➖'} ${c.label} — ${c.detail}`);
    }
    // Said out loud rather than buried in the README: the count is a
    // measurement of box size, not a confirmed WCAG failure, because the
    // spacing exception in SC 2.5.8 is not evaluated here.
    if (group === 'mobile' && rows.some((c) => c.id === 'tap-targets' && c.status === 'fail')) {
      out.push('');
      out.push(
        `_Zmierzono sam rozmiar elementu. WCAG 2.2 dopuszcza mniejsze elementy, ` +
          `jeśli mają wokół siebie ${MIN_TAP_TARGET_PX} px odstępu — tego narzędzie nie sprawdza, ` +
          `więc powyższą liczbę traktuj jako listę do obejrzenia, nie jako potwierdzone błędy._`,
      );
    }
    out.push('');
  }

  const uxTop = topUxIssues({ checks, lighthouse }, 3);
  if (uxTop.length) {
    out.push('### Najbardziej odczuwalne problemy UX');
    out.push('');
    uxTop.forEach((issue, i) => {
      out.push(`${i + 1}. **${issue.title}**${issue.detail ? ` — ${issue.detail}.` : ''}`);
      out.push(`   ${issue.consequence}`);
      out.push('');
    });
  } else {
    out.push('### Najbardziej odczuwalne problemy UX');
    out.push('');
    out.push('_Mierzone wskaźniki UX nie wykazały problemów na tej stronie._');
    out.push('');
  }

  /* ---------------------------------------------- Uwaga końcowa --------- */

  out.push('---');
  out.push('');
  out.push('## Uwaga końcowa');
  out.push('');
  out.push(
    'To jest przegląd automatyczny jednej podstrony. Narzędzia automatyczne wykrywają ' +
      'około jednej trzeciej rzeczywistych problemów z dostępnością — reszty, razem z oceną ' +
      'układu, czytelności i logiki ścieżki użytkownika, nie da się zmierzyć programem. ' +
      'Pełny audyt ręczny znalazłby najprawdopodobniej więcej.',
  );
  out.push('');

  const notes = report.errors ?? [];
  if (notes.length) {
    out.push('_Etapy, które się nie powiodły: ' +
      notes.map((e) => `${e.phase} (${e.message})`).join('; ') + '._');
    out.push('');
  }

  return out.join('\n');
}

/* ------------------------------------------------------------ helpers --- */

function row(label, metric, key) {
  const band = BAND_PL[metric.band] ?? BAND_PL.unknown;
  return `| ${label} | ${fmtMetric(key, metric.value)} | ${band} | ${fmtMetric(key, CWV_BANDS[key].good)} |`;
}

function fmtMetric(key, value) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (key === 'cls') return value.toFixed(3).replace('.', ',');
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')} s`;
  return `${Math.round(value)} ms`;
}

function fmtScore(score) {
  return score == null ? 'nie zmierzono' : `${score} / 100`;
}

