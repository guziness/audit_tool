/**
 * translate.mjs — jargon out, consequence in.
 *
 * Every sentence here describes what a visitor experiences, in the present
 * tense, with no number that was not measured. No "you are losing 30% of
 * customers", no "this could cost you a lawsuit". The findings next to these
 * sentences are facts, and inflated language is exactly what would make a
 * reader start doubting the facts too.
 */

/* ------------------------------------------------------ accessibility --- */

/** axe rule id → what a person actually runs into. */
const AXE_RULES = {
  'color-contrast':
    'Część tekstu ma zbyt mały kontrast względem tła — jest trudna do odczytania, szczególnie na telefonie, w słońcu i przy słabszym wzroku.',
  'color-contrast-enhanced':
    'Część tekstu nie spełnia podwyższonego progu kontrastu — czyta się ją z wysiłkiem przy słabszym wzroku.',
  'link-in-text-block':
    'Linki w tekście różnią się od reszty tylko kolorem — osoby nierozróżniające barw ich nie zauważą.',

  label:
    'Pola formularza nie mają poprawnych etykiet — formularz kontaktowy jest trudny lub niemożliwy do wypełnienia czytnikiem ekranu i z klawiatury.',
  'label-title-only':
    'Etykiety pól formularza istnieją tylko jako dymki — czytnik ekranu i klawiatura ich nie odczytają.',
  'form-field-multiple-labels':
    'Pola formularza mają sprzeczne etykiety — czytnik ekranu odczytuje mylące instrukcje.',
  'select-name':
    'Listy wyboru w formularzu nie mają nazwy — nie wiadomo, co się w nich wybiera.',
  'input-button-name':
    'Przyciski formularza nie mają nazwy — nie wiadomo, co się stanie po kliknięciu.',
  'autocomplete-valid':
    'Pola formularza nie pozwalają przeglądarce podpowiedzieć danych — trzeba wpisywać wszystko ręcznie.',

  'image-alt':
    'Zdjęcia nie mają opisu alternatywnego — są niewidoczne dla osób niewidomych i dla Google.',
  'input-image-alt':
    'Przyciski graficzne nie mają opisu — nie wiadomo, do czego służą.',
  'role-img-alt': 'Grafiki nie mają opisu alternatywnego — dla części odbiorców nie istnieją.',
  'svg-img-alt': 'Grafiki SVG nie mają opisu — dla części odbiorców nie istnieją.',
  'area-alt': 'Klikalne obszary na obrazku nie mają opisu — nie wiadomo, dokąd prowadzą.',
  'object-alt': 'Osadzone obiekty nie mają opisu tekstowego.',

  'link-name':
    'Część linków nie ma czytelnej nazwy — czytnik ekranu odczytuje je jako „link”, bez informacji, dokąd prowadzą.',
  'button-name':
    'Część przycisków nie ma nazwy — bez myszki nie wiadomo, co robią.',
  'frame-title': 'Osadzone ramki nie mają tytułu — czytnik ekranu nie potrafi ich opisać.',

  'heading-order':
    'Nagłówki są w złej kolejności — po stronie trudno się poruszać czytnikiem ekranu, a Google gorzej rozumie jej strukturę.',
  'empty-heading': 'Część nagłówków jest pusta — struktura strony rozjeżdża się dla czytnika ekranu.',
  'page-has-heading-one':
    'Strona nie ma głównego nagłówka — nie wiadomo, czego dotyczy, ani dla czytnika ekranu, ani dla Google.',

  bypass:
    'Nie da się przeskoczyć menu do treści głównej — osoba na klawiaturze musi przy każdym wejściu przejść przez całą nawigację.',
  region:
    'Treść nie jest przypisana do oznaczonych sekcji strony — nie da się po niej skakać technologią asystującą.',
  'landmark-one-main':
    'Strona nie ma oznaczonej treści głównej — nie da się do niej przeskoczyć.',
  'landmark-unique': 'Sekcje strony mają powtarzające się oznaczenia — nawigacja po nich myli.',
  'skip-link': 'Link „przejdź do treści” nie działa.',

  'html-has-lang':
    'Strona nie deklaruje języka — czytnik ekranu może czytać polski tekst z angielską wymową.',
  'html-lang-valid': 'Strona deklaruje nieprawidłowy kod języka — czytnik ekranu czyta ją złym głosem.',
  'valid-lang': 'Fragmenty w innym języku mają nieprawidłowy kod — czytnik ekranu przełącza się na zły akcent.',
  'document-title': 'Strona nie ma tytułu — nie widać jej tematu w zakładce przeglądarki ani w wynikach Google.',

  list: 'Listy są zbudowane niepoprawnie — czytnik ekranu nie zapowiada, ile jest pozycji.',
  listitem: 'Pozycje list są poza listą — czytnik ekranu gubi ich kolejność.',
  'definition-list': 'Lista definicji jest zbudowana niepoprawnie.',

  'meta-viewport':
    'Strona blokuje powiększanie na telefonie — osoby słabowidzące nie mogą powiększyć tekstu.',
  'meta-refresh': 'Strona przeładowuje się sama — może przerwać czytanie w połowie.',

  'aria-required-attr': 'Znaczniki dostępności (ARIA) są niekompletne — technologie asystujące dostają mylące informacje.',
  'aria-required-children': 'Struktura komponentu ARIA jest niepoprawna — czytnik ekranu opisuje go błędnie.',
  'aria-required-parent': 'Struktura komponentu ARIA jest niepoprawna — czytnik ekranu opisuje go błędnie.',
  'aria-valid-attr-value': 'Atrybuty ARIA mają nieprawidłowe wartości — czytnik ekranu podaje błędny stan.',
  'aria-allowed-attr': 'Atrybuty ARIA są użyte tam, gdzie nie powinny — czytnik ekranu dostaje sprzeczne informacje.',
  'aria-hidden-body': 'Cała treść strony jest ukryta przed technologiami asystującymi.',
  'aria-hidden-focus':
    'Elementy ukryte przed czytnikiem ekranu wciąż da się złapać klawiszem Tab — kursor znika w niewidzialnym miejscu.',
  'aria-command-name': 'Elementy sterujące ARIA nie mają nazwy — nie wiadomo, co robią.',
  'aria-input-field-name': 'Pola formularza ARIA nie mają nazwy — nie wiadomo, co wpisać.',
  'aria-toggle-field-name': 'Przełączniki nie mają nazwy — nie wiadomo, co włączają.',

  tabindex:
    'Kolejność poruszania się klawiszem Tab jest wymuszona ręcznie — kursor skacze po stronie w nieoczywistej kolejności.',
  'nested-interactive':
    'Elementy klikalne są zagnieżdżone w sobie — klawiatura i czytnik ekranu gubią się, który jest który.',
  'scrollable-region-focusable':
    'Przewijanych obszarów nie da się przewinąć klawiaturą — część treści jest poza zasięgiem.',
  'focus-order-semantics': 'Kolejność fokusu nie odpowiada układowi strony.',
  'target-size':
    'Część elementów do kliknięcia jest za mała — na telefonie łatwo trafić w sąsiedni.',

  'duplicate-id-aria': 'Powtórzone identyfikatory rozspójniają powiązania etykiet z polami.',
  'td-headers-attr': 'Tabela ma niepoprawnie powiązane nagłówki — czytnik ekranu odczytuje komórki bez kontekstu.',
  'th-has-data-cells': 'Nagłówki tabeli nie są powiązane z danymi — czytnik ekranu odczytuje same liczby.',
  'table-fake-caption': 'Tabela nie ma poprawnego podpisu.',
  'video-caption': 'Materiały wideo nie mają napisów — są bezużyteczne dla osób niesłyszących i przy wyciszonym dźwięku.',
  'audio-caption': 'Nagrania dźwiękowe nie mają transkrypcji.',
  blink: 'Na stronie jest migająca treść.',
  marquee: 'Na stronie jest przewijająca się treść, której nie da się zatrzymać.',
};

/** Fallback by axe category tag, so an unmapped rule still says something true. */
const AXE_CATEGORIES = [
  ['cat.color', 'Część treści nie spełnia wymogów kontrastu i czytelności kolorów.'],
  ['cat.forms', 'Formularz na stronie nie jest w pełni obsługiwalny czytnikiem ekranu i klawiaturą.'],
  ['cat.text-alternatives', 'Część treści graficznej nie ma odpowiednika tekstowego — dla części odbiorców nie istnieje.'],
  ['cat.keyboard', 'Części strony nie da się obsłużyć samą klawiaturą.'],
  ['cat.name-role-value', 'Część elementów sterujących nie ma nazwy zrozumiałej dla technologii asystujących.'],
  ['cat.structure', 'Struktura strony jest niepoprawna — utrudnia nawigację technologią asystującą.'],
  ['cat.semantics', 'Struktura strony jest niepoprawna — utrudnia nawigację technologią asystującą.'],
  ['cat.aria', 'Znaczniki dostępności (ARIA) są użyte niepoprawnie — technologie asystujące dostają mylące informacje.'],
  ['cat.tables', 'Tabele są zbudowane niepoprawnie — czytnik ekranu odczytuje dane bez kontekstu.'],
  ['cat.language', 'Strona nie deklaruje poprawnie języka — czytnik ekranu czyta ją złym głosem.'],
  ['cat.time-and-media', 'Materiały audio/wideo nie mają alternatywy tekstowej.'],
  ['cat.sensory-and-visual-cues', 'Część informacji przekazana jest wyłącznie wizualnie.'],
];

/**
 * Every sentence above is written as "what is wrong — what it means", so it
 * splits cleanly into a headline and a consequence. Splitting rather than
 * printing the whole sentence twice is the difference between a summary that
 * reads like it was written and one that reads like it was generated.
 */
export function explainAxeRule(violation) {
  const direct = AXE_RULES[violation.id];
  if (direct) return { ...split(direct), mapped: true };

  for (const [tag, text] of AXE_CATEGORIES) {
    if (violation.tags?.includes(tag)) return { ...split(text), mapped: false };
  }
  return {
    head: `Reguła „${violation.id}”`,
    consequence: violation.help,
    text: `Reguła „${violation.id}”: ${violation.help}`,
    mapped: false,
  };
}

function split(text) {
  const cut = text.indexOf(' — ');
  if (cut < 0) return { head: text.replace(/\.$/, ''), consequence: null, text };
  const consequence = text.slice(cut + 3);
  return {
    head: text.slice(0, cut).trim(),
    consequence: consequence.charAt(0).toUpperCase() + consequence.slice(1),
    text,
  };
}

const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 };

export const IMPACT_PL = {
  critical: 'krytyczne',
  serious: 'poważne',
  moderate: 'średnie',
  minor: 'drobne',
};

/**
 * The three most tangible issues: worst impact first, then most occurrences.
 * A rule with a hand-written sentence wins ties against one that would fall
 * back to a generic line — "tangible" means the reader can picture it.
 */
export function topAccessibilityIssues(violations, limit = 3) {
  return [...violations]
    .map((v) => ({ ...v, explanation: explainAxeRule(v) }))
    .sort((a, b) => {
      const impact = (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9);
      if (impact !== 0) return impact;
      if (a.explanation.mapped !== b.explanation.mapped) {
        return a.explanation.mapped ? -1 : 1;
      }
      return b.nodeCount - a.nodeCount;
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------- UX ------- */

const CWV_CONSEQUENCE = {
  lcp: 'Strona długo staje się użyteczna — wolniejsze strony tracą odwiedzających i wypadają niżej w wynikach Google.',
  cls: 'Treść przeskakuje w trakcie ładowania — strona sprawia wrażenie niestabilnej i łatwo kliknąć nie to, co się chciało.',
  tbt: 'Po wczytaniu strona przez chwilę nie reaguje na kliknięcia — użytkownik klika, nic się nie dzieje, część osób klika drugi raz albo wychodzi.',
};

/**
 * Failed check → how to name the problem, and what it means for the visitor.
 * The title states the finding, not the criterion: a reader skimming the list
 * should see what is wrong, not what was tested.
 */
const CHECK_CONSEQUENCE = {
  indexable: {
    title: 'Strona jest zablokowana przed indeksowaniem',
    text: 'Strona jest oznaczona jako niewidoczna dla wyszukiwarek — nie pojawi się w wynikach Google.',
  },
  https: {
    title: 'Brak szyfrowanego połączenia (HTTPS)',
    text: 'Strona nie działa po HTTPS — przeglądarki pokazują przy niej ostrzeżenie „niezabezpieczona”, a Google traktuje to jako minus.',
  },
  'no-horizontal-scroll': {
    title: 'Na telefonie stronę da się przesuwać w bok',
    text: 'Część treści ucieka poza ekran i trzeba ją szukać palcem — układ nie mieści się w szerokości telefonu.',
  },
  'viewport-meta': {
    title: 'Strona nie jest poprawnie przygotowana pod ekran telefonu',
    text: 'Układ nie dopasowuje się do szerokości telefonu albo nie da się na nim powiększyć tekstu gestem — osoby, które potrzebują większych liter, nie mają jak sobie pomóc.',
  },
  'tel-link': {
    title: 'Numer telefonu nie jest klikalny',
    text: 'Na telefonie klient musi przepisać numer ręcznie, zamiast dotknąć go i zadzwonić — a wielu tego nie zrobi.',
  },
  'contact-present': {
    title: 'Brak widocznej metody kontaktu',
    text: 'Na stronie nie ma ani adresu e-mail, ani telefonu, ani linku do kontaktu — osoba gotowa się odezwać nie ma jak.',
  },
  title: {
    title: 'Strona nie ma tytułu',
    text: 'W wynikach Google i w zakładce przeglądarki nie widać, czego strona dotyczy.',
  },
  'tap-targets': {
    title: 'Część elementów do kliknięcia jest za mała',
    text: 'Elementy poniżej 24 px są na telefonie trudne do trafienia — łatwo kliknąć sąsiedni i wylądować nie tam, gdzie się chciało.',
  },
  'font-size': {
    title: 'Część tekstu jest ustawiona bardzo drobno',
    text: 'Poniżej 12 px na telefonie trzeba powiększać, żeby przeczytać — część osób zamiast tego zamknie stronę.',
  },
  'cta-above-fold': {
    title: 'Na pierwszym ekranie telefonu nie ma widocznego działania',
    text: 'Odwiedzający nie widzi od razu, gdzie się skontaktować ani co kliknąć dalej — musi tego szukać.',
  },
  'meta-description': {
    title: 'Brak opisu meta',
    text: 'W wynikach Google zamiast przygotowanego zdania pokazuje się przypadkowy fragment strony.',
  },
  'open-graph': {
    title: 'Brak tagów Open Graph',
    text: 'Po wklejeniu linku na Facebooku, LinkedInie czy WhatsAppie nie pojawi się podgląd — tylko goły adres.',
  },
  'single-h1': {
    title: 'Strona nie ma dokładnie jednego głównego nagłówka',
    text: 'Google trudniej ustalić, czego strona dotyczy, a czytnikom ekranu — od czego zacząć.',
  },
  'sitemap-declared': {
    title: 'Brak zadeklarowanej mapy strony',
    text: 'Wyszukiwarki wolniej odkrywają podstrony, bo nie dostają ich spisu.',
  },
};

/** How much each failure is worth surfacing. Higher = more consequential. */
const CHECK_WEIGHT = {
  indexable: 100,
  https: 90,
  'contact-present': 80,
  'no-horizontal-scroll': 70,
  'viewport-meta': 68,
  'tel-link': 65,
  title: 60,
  'cta-above-fold': 45,
  'tap-targets': 42,
  'font-size': 40,
  'meta-description': 35,
  'open-graph': 25,
  'single-h1': 22,
  'sitemap-declared': 15,
};

const CWV_WEIGHT = { poor: 85, 'needs-improvement': 50 };
const CWV_LABEL = {
  lcp: 'Największy element ładuje się wolno (LCP)',
  cls: 'Układ strony przeskakuje przy ładowaniu (CLS)',
  tbt: 'Strona długo nie reaguje po wczytaniu (TBT)',
};

/**
 * The two or three most tangible UX issues, drawn from both the Core Web
 * Vitals and the pass/fail checks and ranked on one shared scale so the
 * genuinely worse thing wins regardless of which screen found it.
 */
export function topUxIssues({ checks, lighthouse }, limit = 3) {
  const candidates = [];

  for (const [metric, data] of Object.entries(lighthouse?.metrics ?? {})) {
    if (!CWV_CONSEQUENCE[metric]) continue;
    const weight = CWV_WEIGHT[data.band];
    if (!weight) continue;
    candidates.push({
      id: metric,
      title: CWV_LABEL[metric],
      consequence: CWV_CONSEQUENCE[metric],
      weight,
    });
  }

  for (const check of checks) {
    if (check.status !== 'fail') continue;
    const entry = CHECK_CONSEQUENCE[check.id];
    if (!entry) continue;
    candidates.push({
      id: check.id,
      title: entry.title,
      detail: check.detail,
      consequence: entry.text,
      weight: CHECK_WEIGHT[check.id] ?? 10,
    });
  }

  return candidates.sort((a, b) => b.weight - a.weight).slice(0, limit);
}
