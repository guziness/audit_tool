/**
 * collect.mjs — everything that needs a real browser.
 *
 * Two page loads, both of the SINGLE url passed in, and nothing else:
 *   1. desktop 1280x800  → axe-core pass + all the head/meta facts
 *   2. mobile   360x640  → the facts that only mean something on a phone
 *      (horizontal scroll, tap target sizes, font sizes, first-screen CTA)
 *
 * The mobile pass is a second load rather than a viewport resize because a lot
 * of sites branch on the user agent, and resizing a desktop render tells you
 * about a layout the phone visitor never sees.
 *
 * Nothing here follows a link, reads a sitemap or touches a second page. The
 * only request outside the given url is /robots.txt, and only to read whether a
 * sitemap is declared — the sitemap itself is never fetched. See README.
 */
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

/* ------------------------------------------------------------------ config */

/** Only WCAG-tagged rules. Every finding stays tied to a published standard,
 *  which is the whole reason these numbers are defensible in an outreach mail.
 *  axe's "best-practice" rules are opinions with a good pedigree — still
 *  opinions, so they stay out. */
export const AXE_TAGS = [
  'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa',
];

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 360, height: 640 };

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

/** Minimum tap target, WCAG 2.2 SC 2.5.8 (AA). */
export const MIN_TAP_TARGET_PX = 24;

/** Below this, body copy forces a phone user to pinch-zoom. */
export const MIN_FONT_SIZE_PX = 12;

/**
 * Words that make a link or button a "działanie" for the first-screen check.
 * Deliberately explicit and boring: the check reports whether one of THESE
 * appears, not whether the page has a "good call to action". A reader can
 * disagree with the list; they cannot disagree with the measurement.
 */
export const CTA_KEYWORDS = [
  'kontakt', 'contact', 'napisz', 'zadzwoń', 'zadzwon', 'zamów', 'zamow',
  'wycen', 'oferta', 'oferty', 'umów', 'umow', 'rezerw', 'zapisz się',
  'konsultacj', 'zapytaj', 'wyślij', 'wyslij', 'kup', 'sklep', 'demo',
  'book', 'buy', 'shop', 'get started', 'sign up', 'free trial', 'quote',
  'get in touch', 'request',
];

/* ------------------------------------------------------------------- entry */

export async function collect(url, { timeoutMs }) {
  const browser = await launchBrowser();
  const errors = [];
  let desktop = null;
  let mobile = null;
  let axe = null;

  try {
    /* ---- pass 1: desktop, axe + document facts -------------------------- */
    const ctx = await browser.newContext({ viewport: DESKTOP_VIEWPORT });
    const page = await ctx.newPage();
    const nav = await navigate(page, url, timeoutMs);

    desktop = {
      finalUrl: page.url(),
      status: nav.status,
      statusText: nav.statusText,
      redirected: nav.finalUrl !== url,
      headers: nav.headers,
      document: await readDocumentFacts(page),
    };

    try {
      const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      axe = summariseAxe(result);
    } catch (err) {
      errors.push({ phase: 'axe', message: err.message });
    }

    await ctx.close();

    /* ---- pass 2: mobile, the phone-only facts --------------------------- */
    try {
      const mctx = await browser.newContext({
        viewport: MOBILE_VIEWPORT,
        userAgent: MOBILE_UA,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const mpage = await mctx.newPage();
      await navigate(mpage, url, timeoutMs);
      mobile = await readMobileFacts(mpage, {
        minTap: MIN_TAP_TARGET_PX,
        minFont: MIN_FONT_SIZE_PX,
        ctaKeywords: CTA_KEYWORDS,
        foldHeight: MOBILE_VIEWPORT.height,
      });
      await mctx.close();
    } catch (err) {
      errors.push({ phase: 'mobile', message: err.message });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return { desktop, mobile, axe, errors };
}

/* --------------------------------------------------------------- browser */

/**
 * Full Chromium rather than Playwright's headless shell: Lighthouse drives the
 * same binary over CDP later, and the shell build is missing pieces it wants.
 * Falls back to the default download if the `chromium` channel isn't installed.
 */
export async function launchBrowser(extraArgs = []) {
  const args = ['--no-sandbox', '--disable-dev-shm-usage', ...extraArgs];
  try {
    return await chromium.launch({ channel: 'chromium', args });
  } catch {
    return await chromium.launch({ args });
  }
}

/**
 * One attempt, no retry loop. A site that blocks automation should cost one
 * request and produce one clear sentence, not a burst of traffic.
 */
async function navigate(page, url, timeoutMs) {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: timeoutMs,
  });

  // Best effort settle. networkidle never fires on pages that poll, so its
  // failure is expected and ignored rather than fatal.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(600);

  if (!response) {
    throw Object.assign(new Error('Brak odpowiedzi HTTP z serwera.'), {
      code: 'NO_RESPONSE',
    });
  }

  const status = response.status();
  if (status >= 400) {
    throw Object.assign(
      new Error(`Serwer odpowiedział kodem ${status} ${response.statusText()}.`),
      { code: 'HTTP_ERROR', status },
    );
  }

  return {
    status,
    statusText: response.statusText(),
    finalUrl: page.url(),
    headers: pickHeaders(response.headers()),
  };
}

function pickHeaders(headers) {
  const keep = ['content-type', 'x-robots-tag', 'server', 'strict-transport-security'];
  const out = {};
  for (const k of keep) if (headers[k]) out[k] = headers[k];
  return out;
}

/* ------------------------------------------------------------------- axe */

function summariseAxe(result) {
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 };

  const violations = result.violations.map((v) => {
    const impact = v.impact ?? 'minor';
    totals[impact] = (totals[impact] ?? 0) + v.nodes.length;
    totals.total += v.nodes.length;
    return {
      id: v.id,
      impact,
      help: v.help,
      description: v.description,
      helpUrl: v.helpUrl,
      tags: v.tags,
      nodeCount: v.nodes.length,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        html: truncate(n.html, 400),
        failureSummary: n.failureSummary ?? null,
      })),
    };
  });

  return {
    testEngine: result.testEngine,
    tags: AXE_TAGS,
    viewport: DESKTOP_VIEWPORT,
    totals,
    ruleCounts: {
      violations: result.violations.length,
      passes: result.passes?.length ?? 0,
      incomplete: result.incomplete?.length ?? 0,
      inapplicable: result.inapplicable?.length ?? 0,
    },
    // axe couldn't decide on its own — worth keeping for the record, never
    // counted as a violation in the summary.
    incomplete: (result.incomplete ?? []).map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      help: v.help,
      nodeCount: v.nodes.length,
    })),
    violations,
  };
}

function truncate(str, max) {
  if (typeof str !== 'string') return str;
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/* -------------------------------------------------- document (desktop pass) */

function readDocumentFacts(page) {
  return page.evaluate(() => {
    const attr = (sel, name) => document.querySelector(sel)?.getAttribute(name) ?? null;
    const text = (v) => (typeof v === 'string' ? v.trim() : null);

    const h1s = [...document.querySelectorAll('h1')].map((h) =>
      (h.textContent ?? '').trim().slice(0, 120),
    );

    const og = {};
    for (const m of document.querySelectorAll('meta[property^="og:"]')) {
      const key = m.getAttribute('property');
      const content = (m.getAttribute('content') ?? '').trim();
      if (key && content) og[key] = content.slice(0, 200);
    }

    const twitter = [...document.querySelectorAll('meta[name^="twitter:"]')].length;

    // Contact signals. Presence only — never a judgement on quality.
    const hrefs = [...document.querySelectorAll('a[href]')].map((a) =>
      a.getAttribute('href') ?? '',
    );
    const mailto = hrefs.filter((h) => h.toLowerCase().startsWith('mailto:'));
    const tel = hrefs.filter((h) => h.toLowerCase().startsWith('tel:'));
    const contactLinks = hrefs.filter((h) => /kontakt|contact/i.test(h));

    const bodyText = (document.body?.innerText ?? '').replace(/\s+/g, ' ');
    const emailInText = /[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(bodyText);

    // A run of 9-15 digits with human separators. Tight enough that prices,
    // years and article numbers don't register as phone numbers.
    const phoneMatches = bodyText.match(/(?:\+?\d[\d\s().-]{7,18}\d)/g) ?? [];
    const phoneInText = phoneMatches.some((m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 9 && digits.length <= 15;
    });

    return {
      title: text(document.title),
      titleLength: (document.title ?? '').trim().length,
      // Volume of what actually rendered. A cookie wall or a bot challenge
      // scores beautifully on every check precisely because there is nothing
      // there — these two numbers are how that gets caught.
      textLength: bodyText.trim().length,
      interactiveCount: document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, textarea',
      ).length,
      lang: attr('html', 'lang'),
      metaDescription: text(attr('meta[name="description"]', 'content')),
      metaRobots: text(attr('meta[name="robots"]', 'content')),
      viewportMeta: text(attr('meta[name="viewport"]', 'content')),
      canonical: attr('link[rel="canonical"]', 'href'),
      sitemapLink: attr('link[rel="sitemap"]', 'href'),
      h1Count: h1s.length,
      h1Texts: h1s.slice(0, 5),
      openGraph: og,
      twitterTagCount: twitter,
      contact: {
        mailtoCount: mailto.length,
        telCount: tel.length,
        contactLinkCount: contactLinks.length,
        emailInText,
        phoneInText,
      },
    };
  });
}

/* ---------------------------------------------------- mobile (phone pass) */

function readMobileFacts(page, cfg) {
  return page.evaluate((c) => {
    const INTERACTIVE = [
      'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
      'summary', '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="radio"]', '[role="tab"]', '[role="menuitem"]',
    ].join(',');

    const isVisible = (el, cs, rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      cs.visibility !== 'hidden' &&
      cs.display !== 'none' &&
      Number(cs.opacity) > 0.05;

    /**
     * WCAG 2.2 exempts a link sitting inside a sentence — you cannot enlarge
     * one word without wrecking the paragraph. Detected as: inline-level <a>
     * whose parent holds text beyond the link's own.
     */
    const isInlineTextLink = (el, cs) => {
      if (el.tagName !== 'A' || !cs.display.startsWith('inline')) return false;
      const own = (el.textContent ?? '').trim().length;
      const parent = (el.parentElement?.textContent ?? '').trim().length;
      return parent > own;
    };

    window.scrollTo(0, 0);

    /* --- horizontal scrolling ----------------------------------------- */
    const docWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );
    const overflowPx = Math.max(0, Math.round(docWidth - window.innerWidth));

    /* --- tap targets --------------------------------------------------- */
    let tapChecked = 0;
    let tapTooSmallCount = 0;
    const tapTooSmall = [];
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, cs, rect)) continue;
      if (isInlineTextLink(el, cs)) continue;
      tapChecked += 1;
      if (rect.width >= c.minTap && rect.height >= c.minTap) continue;
      tapTooSmallCount += 1;
      if (tapTooSmall.length < 10) {
        tapTooSmall.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 40) || null,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }

    /* --- font sizes ---------------------------------------------------- */
    let smallFontCount = 0;
    const smallFontSamples = [];
    for (const el of document.body?.querySelectorAll('*') ?? []) {
      // Only elements holding their own text; otherwise every wrapper counts.
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!ownText) continue;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, cs, rect)) continue;
      const size = parseFloat(cs.fontSize);
      if (Number.isFinite(size) && size < c.minFont) {
        smallFontCount += 1;
        if (smallFontSamples.length < 5) {
          smallFontSamples.push({
            tag: el.tagName.toLowerCase(),
            fontSizePx: Math.round(size * 10) / 10,
            text: ownText.slice(0, 40),
          });
        }
      }
    }

    /* --- first screen -------------------------------------------------- */
    let firstScreenInteractive = 0;
    let firstScreenCta = null;
    for (const el of document.querySelectorAll(INTERACTIVE)) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!isVisible(el, cs, rect)) continue;
      if (rect.top >= c.foldHeight || rect.bottom <= 0) continue;
      firstScreenInteractive += 1;
      if (firstScreenCta) continue;

      const href = (el.getAttribute('href') ?? '').toLowerCase();
      const label = `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      const isContactHref = href.startsWith('tel:') || href.startsWith('mailto:');
      const hit = c.ctaKeywords.find((k) => label.includes(k) || href.includes(k));
      if (isContactHref || hit) {
        firstScreenCta = {
          tag: el.tagName.toLowerCase(),
          text: label.slice(0, 60) || null,
          matched: isContactHref ? href.split(':')[0] : hit,
        };
      }
    }

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentWidth: Math.round(docWidth),
      horizontalOverflowPx: overflowPx,
      tapTargets: {
        checked: tapChecked,
        tooSmall: tapTooSmallCount,
        minPx: c.minTap,
        samples: tapTooSmall,
      },
      fonts: {
        belowMin: smallFontCount,
        minPx: c.minFont,
        samples: smallFontSamples,
      },
      firstScreen: {
        interactiveCount: firstScreenInteractive,
        cta: firstScreenCta,
      },
    };
  }, cfg);
}

/* --------------------------------------------------------------- robots */

/**
 * One request to /robots.txt, purely to see whether a sitemap is declared.
 * The sitemap is never fetched and its urls are never read — that would be the
 * start of a crawl, which this tool does not do.
 */
export async function readRobots(finalUrl, timeoutMs) {
  const robotsUrl = new URL('/robots.txt', finalUrl).href;
  try {
    const res = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(Math.min(timeoutMs, 15_000)),
      headers: { 'user-agent': 'audit-tool (manual single-page screen)' },
      redirect: 'follow',
    });
    if (!res.ok) {
      return { url: robotsUrl, found: false, status: res.status, sitemapCount: 0 };
    }
    const body = (await res.text()).slice(0, 100_000);
    const sitemaps = [...body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]);
    return {
      url: robotsUrl,
      found: true,
      status: res.status,
      sitemapCount: sitemaps.length,
      // Recorded, never requested.
      sitemapUrls: sitemaps.slice(0, 5),
    };
  } catch (err) {
    return { url: robotsUrl, found: false, error: err.message, sitemapCount: 0 };
  }
}
