/**
 * text.mjs — Polish number agreement.
 *
 * Small thing, but "1 elementów" in a document you are about to send to a
 * stranger undoes a lot of the credibility the measurements bought.
 */

/** 1 → one, 2-4 → few, 5+ → many, with the 12-14 exception. */
export function plural(n, one, few, many) {
  if (n === 1) return one;
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

/** "1 element", "3 elementy", "7 elementów" */
export function count(n, one, few, many) {
  return `${n} ${plural(n, one, few, many)}`;
}

export const NOUNS = {
  element: ['element', 'elementy', 'elementów'],
  place: ['miejsce', 'miejsca', 'miejsc'],
  rule: ['regule', 'regułach', 'regułach'],
  violation: ['naruszenie', 'naruszenia', 'naruszeń'],
  link: ['link', 'linki', 'linków'],
  char: ['znak', 'znaki', 'znaków'],
};

/** count(3, ...NOUNS.element) → "3 elementy" */
export function countOf(n, noun) {
  return count(n, ...noun);
}
