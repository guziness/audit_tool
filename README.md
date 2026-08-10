# audit-tool

A screening tool for **one public page at a time**, run by hand. It renders the page,
runs axe-core and Lighthouse against it, measures a set of objective UX facts, and writes
a short plain-language summary you can turn into a one-page opener.

It is a separate utility from the client starter. Its whole job is to get you to a
conversation — not to replace the judgement you sell in the paid audit.

## Intended use — read this first

**Manual, one company at a time, for pages you are about to contact about their own
site.** You paste a URL, you read the summary, you write the email.

There is deliberately **no batch mode**: no list input, no queue, no `--all`, no
concurrency, no crawler. If you want to screen ten companies, you run the command ten
times yourself. The tool also screens only the single page at the URL you pass — it does
not follow links, does not walk a domain, does not fetch sitemaps, and does not fan out.

That limit is a design decision, not a missing feature. A tool that walks a list of sites
unattended is a scraper, and this one is not built to become one.

Nothing leaves your disk. Results are written to a local folder and are never uploaded,
transmitted or reported anywhere.

## Setup

Requires Node 20+.

```bash
npm install
npm run setup          # downloads Chromium for Playwright (once)
```

## Use

```bash
npm run screen -- https://example.com
```

Options:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--out <dir>` | `./runs` | Where the run folder is written. |
| `--timeout <ms>` | `60000` | Page load budget. Minimum 5000. |

Output lands in `runs/<domena>-<RRRR-MM-DD>/`:

- `summary.md` — the short, readable summary (in Polish, ready for outreach prep).
- `raw.json` — full machine output for your records.

Running the same domain twice on one day keeps both runs; the second gets the time
appended, so before/after comparisons don't overwrite each other.

If a site blocks automated access, times out, or has a broken certificate, the tool says
so in one sentence and stops. **It does not retry** — one refused request stays one
request. Retry by hand later if you want.

## What it measures

### Accessibility

- **axe-core** via Playwright, so JavaScript-rendered content is included.
- Only **WCAG-tagged rules** (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`,
  `wcag22aa`). axe's `best-practice` rules are excluded on purpose: every number in the
  summary should trace back to a published standard, because that is what makes it
  defensible when a prospect pushes back.
- Run at 1280×800. The mobile angle is covered by Lighthouse (which emulates a phone)
  and by the UX checks below.
- axe's `incomplete` results are recorded in `raw.json` but never counted as violations.

### Lighthouse

All four category scores, plus lab Core Web Vitals, in Lighthouse's default **mobile**
emulation with throttling. Runs in its own Chromium with nothing else open — sharing a
browser with the axe pass would mean measuring performance on a warm cache.

Bands are Google's published thresholds:

| Metric | good | needs improvement | poor |
| --- | --- | --- | --- |
| LCP | ≤ 2500 ms | ≤ 4000 ms | > 4000 ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TBT | ≤ 200 ms | ≤ 600 ms | > 600 ms |

### UX screen — measurable facts only

This section exists so accessibility isn't the only angle. It reports **only things a
machine can measure the same way twice**: present/absent, pass/fail, or a number.

Second page load at 360×640 with a mobile user agent (a resized desktop render tells you
about a layout the phone visitor never sees):

- **Mobile** — correct `viewport` meta (`width=device-width`, zoom not blocked); no
  horizontal scrolling at 360 px; interactive elements at least 24×24 px; no text below
  12 px.
- **Trust & conversion** *(presence only, never quality)* — a visible contact method; a
  tappable `tel:` link; HTTPS; a non-empty `<title>`; an action visible on the first
  phone screen.
- **Technical SEO** — meta description; exactly one `h1`; Open Graph tags; a declared
  sitemap; indexable (no `noindex` in meta or `X-Robots-Tag`).

Two thresholds are worth knowing precisely, because both are stated in the summary rather
than hidden:

- **Tap targets** apply the WCAG 2.2 inline exception (a link sitting inside a sentence
  is skipped — you can't enlarge one word without wrecking the paragraph). The
  **spacing** exception in SC 2.5.8 is *not* evaluated, so the count is a list of
  elements to look at, not a set of confirmed failures. The summary says this too.
- **"Action on the first screen"** means: a visible link or button within the first 640 px
  whose text or href is `tel:`/`mailto:` or matches an explicit keyword list
  (`kontakt`, `oferta`, `wycena`, `zamów`, `umów`, `book`, `demo`, …, see
  `CTA_KEYWORDS` in [src/collect.mjs](src/collect.mjs)). You can disagree with the list;
  you can't disagree with the measurement.

The only request outside the given page is a single `GET /robots.txt`, purely to read
whether a sitemap is *declared*. The sitemap itself is never fetched and its URLs are
never read — that would be the beginning of a crawl.

### Deliberately out of scope

The tool does **not** assess visual aesthetics, copy quality, whether a layout "makes
sense", information architecture, or the logic of a checkout or booking flow. Those need
human expertise, and they are what the paid audit is for.

The boundary is not squeamishness, it's credibility: accessibility findings survive
pushback because they are facts — contrast either passes 4.5:1 or it doesn't. A tool that
also announced "your navigation is confusing" would be wrong often enough to poison the
hard data sitting next to it. When in doubt whether something is measurable or a matter
of taste, it stays out.

## summary.md

Written for a non-technical reader, in Polish, in two parts you can lead with
independently depending on the prospect:

- **Część 1 — Dostępność** — Lighthouse accessibility score, violation totals by impact,
  and the three most tangible issues translated out of jargon.
- **Część 2 — UX i biznes** — the other three Lighthouse scores, Core Web Vitals with
  bands, the pass/fail checks, and the two or three most tangible UX issues as business
  consequences.
- **Uwaga końcowa** — a one-line note that this is an automated screen, that automated
  tools catch roughly a third of real accessibility issues, and that a manual audit would
  likely find more.

No invented conversion percentages, no scare tactics. Every sentence describes something
that was measured.

## Relationship to the client starter

The starter verifies its own builds with `check-contrast.mjs` and
`check-contrast-pixels.mjs` (token-pair and rendered-pixel contrast, on puppeteer-core).
That pipeline measures things this tool can't, on a site you control. This tool goes the
other way: it screens a stranger's page you have no access to, so it leans on axe-core
and Lighthouse instead. Shared with the starter are the WCAG AA thresholds, the narrow
viewport as the case that matters, and the habit of stating what a check does *not*
prove.

Neither tool says anything about keyboard order, focus visibility or screen-reader
output. Those are still a manual pass.

## Layout

```
src/
  screen.mjs      CLI, orchestration, run folder, graceful failures
  collect.mjs     Playwright: axe pass, document facts, phone pass, robots.txt
  lighthouse.mjs  Lighthouse run, category scores, Core Web Vitals bands
  checks.mjs      raw facts → pass/fail checks
  translate.mjs   axe rules and failed checks → plain-language consequences
  summary.mjs     summary.md rendering
  text.mjs        Polish number agreement
```
