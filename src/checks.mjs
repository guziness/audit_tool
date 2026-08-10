/**
 * checks.mjs — raw facts in, pass/fail facts out.
 *
 * The rule for everything in this file: a check may only report something a
 * machine can measure the same way twice. Present or absent, pass or fail, or a
 * number. No check is allowed to have an opinion about whether a page is good.
 *
 * Where a check needs a threshold to become binary (24 px, 12 px, "one h1"),
 * the threshold is a published one or is stated in the label, so a reader can
 * see exactly what was measured rather than trusting a verdict.
 */
import { MIN_FONT_SIZE_PX, MIN_TAP_TARGET_PX } from './collect.mjs';
import { NOUNS, countOf } from './text.mjs';

const PASS = 'pass';
const FAIL = 'fail';
const UNKNOWN = 'unknown';

/**
 * Did we actually screen the site, or a wall in front of it?
 *
 * A cookie gate, a "checking your browser" interstitial or a JS bundle that
 * never ran all produce the same thing: a nearly empty document that passes
 * every check because there is nothing in it to fail. Reporting that as a
 * clean bill of health is the one way this tool could genuinely embarrass you
 * in an outreach mail, so it gets called out at the top of the summary.
 */
export function assessRender(doc) {
  if (!doc) return { thin: true, reason: 'nie udało się odczytać treści strony' };

  const textLength = doc.textLength ?? 0;
  const interactive = doc.interactiveCount ?? 0;

  if (textLength < 500 && interactive < 5) {
    return {
      thin: true,
      textLength,
      interactiveCount: interactive,
      reason:
        `wyrenderowana strona zawiera tylko ${countOf(textLength, NOUNS.char)} tekstu ` +
        `i ${countOf(interactive, NOUNS.element)} klikalnych`,
    };
  }
  return { thin: false, textLength, interactiveCount: interactive };
}

export function buildChecks({ desktop, mobile, robots }) {
  const doc = desktop?.document ?? null;
  const checks = [];
  const add = (c) => checks.push(c);

  /* ------------------------------------------------ telefon (mobile) ---- */

  const vp = doc?.viewportMeta ?? null;
  const hasDeviceWidth = !!vp && /width\s*=\s*device-width/i.test(vp);
  const blocksZoom =
    !!vp &&
    (/user-scalable\s*=\s*(no|0)/i.test(vp) ||
      /maximum-scale\s*=\s*(1(\.0+)?|0?\.\d+)\b/i.test(vp));

  add({
    id: 'viewport-meta',
    group: 'mobile',
    label: 'Poprawny tag viewport',
    status: !vp ? FAIL : hasDeviceWidth && !blocksZoom ? PASS : FAIL,
    value: vp,
    detail: !vp
      ? 'brak tagu <meta name="viewport">'
      : !hasDeviceWidth
        ? 'brak width=device-width'
        : blocksZoom
          ? 'strona blokuje powiększanie'
          : vp,
  });

  add({
    id: 'no-horizontal-scroll',
    group: 'mobile',
    label: 'Brak przewijania w bok przy szerokości 360 px',
    status: mobile == null ? UNKNOWN : mobile.horizontalOverflowPx <= 1 ? PASS : FAIL,
    value: mobile?.horizontalOverflowPx ?? null,
    detail:
      mobile == null
        ? 'nie zmierzono'
        : mobile.horizontalOverflowPx <= 1
          ? 'treść mieści się w ekranie'
          : `treść wystaje o ${mobile.horizontalOverflowPx} px poza ekran`,
  });

  const tap = mobile?.tapTargets ?? null;
  add({
    id: 'tap-targets',
    group: 'mobile',
    label: `Elementy klikalne co najmniej ${MIN_TAP_TARGET_PX}×${MIN_TAP_TARGET_PX} px`,
    status: tap == null ? UNKNOWN : tap.tooSmall === 0 ? PASS : FAIL,
    value: tap?.tooSmall ?? null,
    detail:
      tap == null
        ? 'nie zmierzono'
        : tap.tooSmall === 0
          ? `sprawdzono ${countOf(tap.checked, NOUNS.element)}, wszystkie wystarczająco duże`
          : `${tap.tooSmall} z ${countOf(tap.checked, NOUNS.element)} poniżej ${MIN_TAP_TARGET_PX} px`,
  });

  const fonts = mobile?.fonts ?? null;
  add({
    id: 'font-size',
    group: 'mobile',
    label: `Tekst nie mniejszy niż ${MIN_FONT_SIZE_PX} px`,
    status: fonts == null ? UNKNOWN : fonts.belowMin === 0 ? PASS : FAIL,
    value: fonts?.belowMin ?? null,
    detail:
      fonts == null
        ? 'nie zmierzono'
        : fonts.belowMin === 0
          ? 'brak tekstu poniżej progu'
          : `${countOf(fonts.belowMin, NOUNS.element)} z tekstem poniżej ${MIN_FONT_SIZE_PX} px`,
  });

  /* --------------------------------------- kontakt i zaufanie (trust) --- */

  const contact = doc?.contact ?? null;
  const hasContact =
    !!contact &&
    (contact.mailtoCount > 0 ||
      contact.telCount > 0 ||
      contact.contactLinkCount > 0 ||
      contact.emailInText ||
      contact.phoneInText);

  add({
    id: 'contact-present',
    group: 'trust',
    label: 'Widoczna metoda kontaktu',
    status: contact == null ? UNKNOWN : hasContact ? PASS : FAIL,
    value: hasContact,
    detail: contact == null ? 'nie zmierzono' : describeContact(contact),
  });

  add({
    id: 'tel-link',
    group: 'trust',
    label: 'Numer telefonu klikalny (link tel:)',
    status:
      contact == null
        ? UNKNOWN
        : contact.telCount > 0
          ? PASS
          : contact.phoneInText
            ? FAIL
            : UNKNOWN,
    value: contact?.telCount ?? null,
    detail:
      contact == null
        ? 'nie zmierzono'
        : contact.telCount > 0
          ? `${countOf(contact.telCount, NOUNS.link)} tel:`
          : contact.phoneInText
            ? 'numer jest w treści, ale nie jest linkiem tel:'
            : 'nie znaleziono numeru telefonu na stronie',
  });

  const https = (() => {
    try {
      return new URL(desktop?.finalUrl ?? '').protocol === 'https:';
    } catch {
      return null;
    }
  })();
  add({
    id: 'https',
    group: 'trust',
    label: 'Połączenie szyfrowane (HTTPS)',
    status: https == null ? UNKNOWN : https ? PASS : FAIL,
    value: https,
    detail: https == null ? 'nie zmierzono' : https ? 'tak' : 'strona działa po HTTP',
  });

  add({
    id: 'title',
    group: 'trust',
    label: 'Niepusty tytuł strony',
    status: doc == null ? UNKNOWN : doc.titleLength > 0 ? PASS : FAIL,
    value: doc?.titleLength ?? null,
    detail:
      doc == null
        ? 'nie zmierzono'
        : doc.titleLength > 0
          ? `„${doc.title}” (${countOf(doc.titleLength, NOUNS.char)})`
          : 'brak tytułu',
  });

  const fold = mobile?.firstScreen ?? null;
  add({
    id: 'cta-above-fold',
    group: 'trust',
    label: 'Działanie (kontakt / oferta) widoczne na pierwszym ekranie telefonu',
    status: fold == null ? UNKNOWN : fold.cta ? PASS : FAIL,
    value: fold?.cta?.matched ?? null,
    detail:
      fold == null
        ? 'nie zmierzono'
        : fold.cta
          ? `„${fold.cta.text ?? fold.cta.matched}”`
          : `${countOf(fold.interactiveCount, NOUNS.element)} klikalnych na pierwszym ekranie, żaden nie pasuje do listy słów kluczowych`,
  });

  /* ------------------------------------------------------ SEO (facts) --- */

  add({
    id: 'meta-description',
    group: 'seo',
    label: 'Opis meta (meta description)',
    status: doc == null ? UNKNOWN : doc.metaDescription ? PASS : FAIL,
    value: doc?.metaDescription?.length ?? 0,
    detail:
      doc == null
        ? 'nie zmierzono'
        : doc.metaDescription
          ? countOf(doc.metaDescription.length, NOUNS.char)
          : 'brak',
  });

  add({
    id: 'single-h1',
    group: 'seo',
    label: 'Dokładnie jeden nagłówek h1',
    status: doc == null ? UNKNOWN : doc.h1Count === 1 ? PASS : FAIL,
    value: doc?.h1Count ?? null,
    detail: doc == null ? 'nie zmierzono' : `znaleziono ${doc.h1Count}`,
  });

  const ogKeys = Object.keys(doc?.openGraph ?? {});
  add({
    id: 'open-graph',
    group: 'seo',
    label: 'Tagi Open Graph (podgląd linku w social media)',
    status: doc == null ? UNKNOWN : ogKeys.length > 0 ? PASS : FAIL,
    value: ogKeys.length,
    detail:
      doc == null
        ? 'nie zmierzono'
        : ogKeys.length > 0
          ? ogKeys.join(', ')
          : 'brak',
  });

  const sitemapDeclared =
    !!doc?.sitemapLink || (robots?.sitemapCount ?? 0) > 0;
  add({
    id: 'sitemap-declared',
    group: 'seo',
    label: 'Zadeklarowana mapa strony (sitemap)',
    status: sitemapDeclared ? PASS : FAIL,
    value: sitemapDeclared,
    detail: doc?.sitemapLink
      ? 'zadeklarowana w <link rel="sitemap">'
      : (robots?.sitemapCount ?? 0) > 0
        ? `zadeklarowana w robots.txt (${robots.sitemapCount})`
        : robots?.found === false
          ? 'brak deklaracji; robots.txt niedostępny'
          : 'brak deklaracji w robots.txt i w kodzie strony',
  });

  const robotsMeta = (doc?.metaRobots ?? '').toLowerCase();
  const headerRobots = (desktop?.headers?.['x-robots-tag'] ?? '').toLowerCase();
  const noindex = robotsMeta.includes('noindex') || headerRobots.includes('noindex');
  add({
    id: 'indexable',
    group: 'seo',
    label: 'Strona widoczna dla Google (brak noindex)',
    status: doc == null ? UNKNOWN : noindex ? FAIL : PASS,
    value: !noindex,
    detail: noindex
      ? `zablokowana przez ${robotsMeta.includes('noindex') ? 'meta robots' : 'nagłówek X-Robots-Tag'}`
      : 'brak blokady indeksowania',
  });

  return checks;
}

function describeContact(contact) {
  const bits = [];
  if (contact.telCount) bits.push(`${contact.telCount} × tel:`);
  if (contact.mailtoCount) bits.push(`${contact.mailtoCount} × mailto:`);
  if (contact.contactLinkCount) bits.push('link do strony kontaktowej');
  if (!contact.telCount && contact.phoneInText) bits.push('numer w treści');
  if (!contact.mailtoCount && contact.emailInText) bits.push('e-mail w treści');
  return bits.length ? bits.join(', ') : 'nie znaleziono';
}
