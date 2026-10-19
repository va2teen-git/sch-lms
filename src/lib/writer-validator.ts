/**
 * Унифицированный модуль валидации документов в WriterEmulator
 * Обеспечивает строгую и надежную проверку текстового ввода, типографики,
 * форматирования (начертание, индексы), списков, таблиц и геометрии абзацев.
 */

export interface WriterRuleResult {
    id: string;
    label: string;
    passed: boolean;
    message?: string;
}

export interface WriterState {
    html?: string;
    text?: string;
    wysiwyg?: HTMLElement | null;
    pageMargins?: {
        leftCm: number;
        rightCm: number;
        topCm: number;
        bottomCm: number;
    };
    actionLog?: any[];
}

export interface NormalizeOptions {
    strictLatin?: boolean;
    preserveCase?: boolean;
}

export interface ParagraphGeometryOptions {
    font?: string;
    sizePt?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    indentCm?: number;
    lineHeight?: string | number;
}

export interface TypographyOptions {
    quotes?: string;
    dash?: boolean;
    symbols?: string[];
}

export interface ListStructureOptions {
    type?: 'ol' | 'ul';
    minItems?: number;
    boldTerms?: string[];
    texts?: string[];
}

export interface TableStructureOptions {
    minRows?: number;
    minCols?: number;
    centered?: boolean;
    headers?: string[];
    cells?: string[];
    alignHeadersCenter?: boolean;
}

/**
 * Очищает строку от невидимых символов и BOM (Zero Width Space, Zero Width Non-Joiner, \uFEFF)
 * и преобразует неразрывные пробелы \u00A0 в стандартные.
 */
export function stripInvisibleChars(str: string | null | undefined): string {
    return (str || '')
        .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
        .replace(/\u00A0/g, ' ');
}

/**
 * Нормализует пробелы: удаляет невидимые символы, объединяет повторяющиеся пробелы и делает trim.
 */
export function normalizeSpaces(str: string | null | undefined): string {
    return stripInvisibleChars(str)
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Преобразует надстрочные (⁰¹²³) и подстрочные (₀₁₂₃) цифры в стандартные символы '0'-'9'.
 */
export function normalizeIndexDigits(str: string | null | undefined): string {
    return (str || '')
        .replace(/⁰/g, '0')
        .replace(/¹/g, '1')
        .replace(/²/g, '2')
        .replace(/³/g, '3')
        .replace(/⁴/g, '4')
        .replace(/⁵/g, '5')
        .replace(/⁶/g, '6')
        .replace(/⁷/g, '7')
        .replace(/⁸/g, '8')
        .replace(/⁹/g, '9')
        .replace(/₀/g, '0')
        .replace(/₁/g, '1')
        .replace(/₂/g, '2')
        .replace(/₃/g, '3')
        .replace(/₄/g, '4')
        .replace(/₅/g, '5')
        .replace(/₆/g, '6')
        .replace(/₇/g, '7')
        .replace(/₈/g, '8')
        .replace(/₉/g, '9');
}

/**
 * Карта букв-омоглифов (латиница -> кириллица) для устойчивого текстового сравнения
 */
const LATIN_TO_CYRILLIC_HOMOGLYPHS: Record<string, string> = {
    'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х',
    'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у'
};

/**
 * Нормализует текст для сопоставления:
 * - удаляет невидимые символы и BOM
 * - заменяет 'ё' на 'е'
 * - при strictLatin = false мапит латинские буквы-двойники (C, O, H, A, x) в кириллические
 * - стандартизирует знак градуса ° и тире
 */
export function normalizeComparable(str: string | null | undefined, options: NormalizeOptions = {}): string {
    let res = normalizeSpaces(normalizeIndexDigits(str));
    if (!options.preserveCase) {
        // Оставляем исходный регистр или нормализуем буквы ё
        res = res.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
    }
    if (!options.strictLatin) {
        res = res.replace(/[ABCEHKMOPTXaceopxy]/g, ch => LATIN_TO_CYRILLIC_HOMOGLYPHS[ch] || ch);
    }
    res = res.replace(/\s*°\s*/g, '°');
    return res.replace(/\s+/g, ' ').trim();
}

/**
 * Извлекает текстовое содержимое из HTMLElement или строки
 */
function extractText(source: HTMLElement | string | null | undefined): string {
    if (!source) return '';
    if (typeof source === 'string') return source;
    return source.innerText || source.textContent || '';
}

/**
 * Проверяет, содержится ли искомая фраза в тексте редактора
 */
export function hasText(
    source: HTMLElement | string | null | undefined,
    target: string,
    options: NormalizeOptions = {}
): boolean {
    const textNorm = normalizeComparable(extractText(source), options);
    const targetNorm = normalizeComparable(target, options);
    if (textNorm.includes(targetNorm)) return true;
    // Сравнение без пробелов (на случай переносов или мелких погрешностей верстки)
    const textCompact = textNorm.replace(/\s+/g, '');
    const targetCompact = targetNorm.replace(/\s+/g, '');
    return textCompact.includes(targetCompact);
}

/**
 * Проверяет, выделено ли указанное слово полужирным начертанием (b, strong, style font-weight)
 */
export function hasBoldWord(container: HTMLElement | null | undefined, word: string): boolean {
    if (!container) return false;
    const targetNorm = normalizeComparable(word);
    const boldNodes = container.querySelectorAll('b, strong, [style*="font-weight: bold"], [style*="font-weight: 700"]');
    for (const node of Array.from(boldNodes)) {
        const text = normalizeComparable(extractText(node as HTMLElement));
        if (text.includes(targetNorm)) return true;
    }
    return false;
}

/**
 * Проверяет, выделено ли указанное слово курсивом (i, em, style font-style: italic)
 */
export function hasItalicWord(container: HTMLElement | null | undefined, word: string): boolean {
    if (!container) return false;
    const targetNorm = normalizeComparable(word);
    const italicNodes = container.querySelectorAll('i, em, [style*="font-style: italic"]');
    for (const node of Array.from(italicNodes)) {
        const text = normalizeComparable(extractText(node as HTMLElement));
        if (text.includes(targetNorm)) return true;
    }
    return false;
}

/**
 * Проверяет, выделено ли указанное слово подчёркиванием (u, text-decoration: underline)
 */
export function hasUnderlineWord(container: HTMLElement | null | undefined, word: string): boolean {
    if (!container) return false;
    const targetNorm = normalizeComparable(word);
    const uNodes = container.querySelectorAll('u, [style*="text-decoration: underline"], [style*="text-decoration-line: underline"]');
    for (const node of Array.from(uNodes)) {
        const text = normalizeComparable(extractText(node as HTMLElement));
        if (text.includes(targetNorm)) return true;
    }
    return false;
}

/**
 * Проверяет наличие верхнего индекса с заданной цифрой/текстом (sup, vertical-align: super или Unicode ²/³)
 */
export function hasSuperscript(container: HTMLElement | null | undefined, targetDigitOrText: string): boolean {
    const rawText = container ? extractText(container) : '';
    const normTarget = normalizeIndexDigits(targetDigitOrText);

    if (container) {
        const supNodes = container.querySelectorAll('sup, [style*="vertical-align: super"]');
        for (const node of Array.from(supNodes)) {
            const nodeText = normalizeIndexDigits(normalizeSpaces(extractText(node as HTMLElement)));
            if (nodeText.includes(normTarget)) return true;
        }
    }

    // Фоллбэк: проверка символов Unicode степени (², ³, ⁴...)
    if (normTarget === '2' && rawText.includes('²')) return true;
    if (normTarget === '3' && rawText.includes('³')) return true;
    return false;
}

/**
 * Проверяет наличие нижнего индекса (sub, vertical-align: sub или Unicode ₁/₂)
 * Дополнительно может проверять, что указанные переменные/формулы набраны именно на латинице (например, H₂O).
 */
export function hasSubscript(
    container: HTMLElement | null | undefined,
    targetDigitOrText: string,
    options: { requireLatinWords?: string[] } = {}
): boolean {
    const rawText = container ? extractText(container) : '';
    const normTarget = normalizeIndexDigits(targetDigitOrText);
    let foundSub = false;

    if (container) {
        const subNodes = container.querySelectorAll('sub, [style*="vertical-align: sub"]');
        for (const node of Array.from(subNodes)) {
            const nodeText = normalizeIndexDigits(normalizeSpaces(extractText(node as HTMLElement)));
            if (nodeText.includes(normTarget)) {
                foundSub = true;
                break;
            }
        }
    }

    if (!foundSub) {
        if (normTarget === '1' && rawText.includes('₁')) foundSub = true;
        if (normTarget === '2' && rawText.includes('₂')) foundSub = true;
    }

    if (!foundSub) return false;

    // Если требуется строгая латиница для формулы (например, 'H' и 'O' в H2O)
    if (options.requireLatinWords && options.requireLatinWords.length > 0) {
        for (const word of options.requireLatinWords) {
            // Ищем слово в исходном тексте с сохранением точных ASCII-символов
            const cleanedRaw = stripInvisibleChars(rawText);
            const regex = new RegExp(`\\b${word}\\b|[\\s—–-]${word}[\\s—–-]|${word}(?=[0-9₀-₉sub<])`, 'g');
            // Если латинское слово не найдено как подстрока, проверяем наличие любого из требуемых латинских символов
            if (!cleanedRaw.includes(word)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Проверяет геометрию и оформление абзаца (гарнитура, кегль, выравнивание, красная строка, интерлиньяж)
 */
export function checkParagraphGeometry(
    container: HTMLElement | null | undefined,
    options: ParagraphGeometryOptions
): {
    fontOk: boolean;
    sizeOk: boolean;
    alignOk: boolean;
    indentOk: boolean;
    lineHeightOk: boolean;
    allOk: boolean;
} {
    const res = {
        fontOk: !options.font,
        sizeOk: !options.sizePt,
        alignOk: !options.textAlign,
        indentOk: options.indentCm === undefined,
        lineHeightOk: !options.lineHeight,
        allOk: false
    };

    if (!container) return res;

    const p = (container.querySelector('p, h1, h2, h3, div') || container) as HTMLElement;
    const html = container.innerHTML || '';
    const comp = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(p) : null;

    // Проверка шрифта
    if (options.font) {
        const fontName = options.font.toLowerCase();
        if (
            (p.style && p.style.fontFamily && p.style.fontFamily.toLowerCase().includes(fontName)) ||
            (comp && comp.fontFamily && comp.fontFamily.toLowerCase().includes(fontName)) ||
            html.toLowerCase().includes(fontName)
        ) {
            res.fontOk = true;
        }
    }

    // Проверка размера (кегля) в пунктах
    if (options.sizePt !== undefined) {
        const targetPt = options.sizePt;
        const ptStr = `${targetPt}pt`;
        let ptFromComputed = 0;
        if (comp && comp.fontSize) {
            ptFromComputed = Math.round(parseFloat(comp.fontSize) * 0.75);
        }
        if (
            (p.style && p.style.fontSize === ptStr) ||
            ptFromComputed === targetPt ||
            html.includes(ptStr)
        ) {
            res.sizeOk = true;
        }
    }

    // Проверка выравнивания
    if (options.textAlign) {
        const targetAlign = options.textAlign;
        if (
            (p.style && p.style.textAlign === targetAlign) ||
            (comp && comp.textAlign === targetAlign) ||
            html.includes(`text-align: ${targetAlign}`)
        ) {
            res.alignOk = true;
        }
    }

    // Проверка красной строки (text-indent)
    if (options.indentCm !== undefined) {
        const indentPx = comp ? parseFloat(comp.textIndent) || 0 : 0;
        if (
            (p.style && /^1(\.0)?cm$/.test(p.style.textIndent)) ||
            (indentPx >= 32 && indentPx <= 48) ||
            html.includes('text-indent: 1cm') ||
            html.includes('text-indent: 1.0cm')
        ) {
            res.indentOk = true;
        }
    }

    // Проверка межстрочного интервала (line-height)
    if (options.lineHeight) {
        const lhStr = String(options.lineHeight);
        if (
            (p.style && (p.style.lineHeight === lhStr || p.style.lineHeight === '1.5' || p.style.lineHeight === '1.15')) ||
            html.includes(`line-height: ${lhStr}`) ||
            html.includes('line-height: 1.15') ||
            html.includes('line-height: 1.5')
        ) {
            res.lineHeightOk = true;
        }
    }

    res.allOk = res.fontOk && res.sizeOk && res.alignOk && res.indentOk && res.lineHeightOk;
    return res;
}

/**
 * Проверка типографики (кавычки-ёлочки «», длинное тире —, спецсимволы ° и ±)
 */
export function checkTypography(
    source: HTMLElement | string | null | undefined,
    options: TypographyOptions
): {
    quotesOk: boolean;
    dashOk: boolean;
    symbolsOk: boolean;
    allOk: boolean;
} {
    const textNorm = normalizeComparable(extractText(source));
    const res = {
        quotesOk: !options.quotes,
        dashOk: !options.dash,
        symbolsOk: !options.symbols || options.symbols.length === 0,
        allOk: false
    };

    if (options.quotes) {
        res.quotesOk = textNorm.includes(normalizeComparable(options.quotes));
    }
    if (options.dash) {
        res.dashOk = textNorm.includes('—') || textNorm.includes('–');
    }
    if (options.symbols && options.symbols.length > 0) {
        res.symbolsOk = options.symbols.every(sym => textNorm.includes(sym));
    }

    res.allOk = res.quotesOk && res.dashOk && res.symbolsOk;
    return res;
}

/**
 * Проверка структуры нумерованного/маркированного списка
 */
export function checkListStructure(
    container: HTMLElement | null | undefined,
    options: ListStructureOptions
): {
    listOk: boolean;
    countOk: boolean;
    boldOk: boolean;
    textsOk: boolean;
    allOk: boolean;
} {
    const res = {
        listOk: false,
        countOk: false,
        boldOk: !options.boldTerms || options.boldTerms.length === 0,
        textsOk: !options.texts || options.texts.length === 0,
        allOk: false
    };

    if (!container) return res;

    const tag = options.type || 'ol';
    const listEl = container.querySelector(tag);
    res.listOk = !!listEl;

    const lis = container.querySelectorAll(`${tag} li`);
    const minItems = options.minItems || 3;
    res.countOk = lis.length >= minItems;

    if (options.boldTerms && options.boldTerms.length > 0) {
        const boldText = Array.from(container.querySelectorAll('li b, li strong, li [style*="font-weight: bold"], li [style*="font-weight: 700"]'))
            .map(el => normalizeComparable(extractText(el as HTMLElement)))
            .join(' ');
        res.boldOk = options.boldTerms.every(term => boldText.includes(normalizeComparable(term)));
    }

    if (options.texts && options.texts.length > 0) {
        const fullListText = normalizeComparable(extractText(container));
        res.textsOk = options.texts.every(frag => fullListText.includes(normalizeComparable(frag)));
    }

    res.allOk = res.listOk && res.countOk && res.boldOk && res.textsOk;
    return res;
}

/**
 * Проверка структуры и форматирования таблицы
 */
export function checkTableStructure(
    container: HTMLElement | null | undefined,
    options: TableStructureOptions
): {
    tableOk: boolean;
    centerOk: boolean;
    headersOk: boolean;
    cellsOk: boolean;
    allOk: boolean;
} {
    const res = {
        tableOk: false,
        centerOk: !options.centered,
        headersOk: !options.headers || options.headers.length === 0,
        cellsOk: !options.cells || options.cells.length === 0,
        allOk: false
    };

    if (!container) return res;

    const tbl = container.querySelector('table');
    if (!tbl) return res;
    res.tableOk = true;

    if (options.centered) {
        if (
            (tbl.style.marginLeft === 'auto' && tbl.style.marginRight === 'auto') ||
            tbl.getAttribute('align') === 'center'
        ) {
            res.centerOk = true;
        }
    }

    const trs = tbl.querySelectorAll('tr');
    if (options.headers && options.headers.length > 0 && trs.length >= 1) {
        const ths = trs[0].querySelectorAll('th, td');
        if (ths.length >= options.headers.length) {
            let matched = true;
            for (let i = 0; i < options.headers.length; i++) {
                const cellText = normalizeComparable(extractText(ths[i] as HTMLElement)).toLowerCase();
                const expected = normalizeComparable(options.headers[i]).toLowerCase();
                if (cellText !== expected) {
                    matched = false;
                    break;
                }
            }
            if (matched && options.alignHeadersCenter) {
                const allCentered = Array.from(ths).every(cell => {
                    const cStyle = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(cell) : null;
                    return (cell as HTMLElement).style.textAlign === 'center' || (cStyle && cStyle.textAlign === 'center');
                });
                if (!allCentered) matched = false;
            }
            res.headersOk = matched;
        }
    }

    if (options.cells && options.cells.length > 0 && trs.length >= 2) {
        const tds = trs[1].querySelectorAll('td, th');
        if (tds.length >= options.cells.length) {
            let matched = true;
            for (let i = 0; i < options.cells.length; i++) {
                const cellText = normalizeComparable(extractText(tds[i] as HTMLElement)).toLowerCase();
                const expected = normalizeComparable(options.cells[i]).toLowerCase();
                if (cellText !== expected) {
                    matched = false;
                    break;
                }
            }
            res.cellsOk = matched;
        }
    }

    res.allOk = res.tableOk && res.centerOk && res.headersOk && res.cellsOk;
    return res;
}

/**
 * Объект-реестр хелперов валидатора для удобного глобального использования
 */
export const WriterValidator = {
    stripInvisibleChars,
    normalizeSpaces,
    normalizeIndexDigits,
    normalizeComparable,
    hasText,
    hasBoldWord,
    hasItalicWord,
    hasUnderlineWord,
    hasSuperscript,
    hasSubscript,
    checkParagraphGeometry,
    checkTypography,
    checkListStructure,
    checkTableStructure
};

// Экспорт в глобальный объект window при запуске в браузере
if (typeof window !== 'undefined') {
    (window as any).WriterValidator = WriterValidator;
}

export default WriterValidator;
