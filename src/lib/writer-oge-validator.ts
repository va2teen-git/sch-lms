/**
 * Модуль автоматической экспертной проверки документов на соответствие стандарту ОГЭ 13.2
 * Проверяет параметры страницы, абзацев, шрифта, таблиц и выявляет типичные ошибки («костыли»).
 */

export interface OgeCheckItem {
    id: string;
    category: 'page' | 'paragraph' | 'font' | 'table' | 'crutches' | 'lesson';
    label: string;
    passed: boolean;
    message: string;
    isCrutch?: boolean;
}

export interface OgeInspectionResult {
    valid: boolean;
    score: number; // 0, 1 или 2 балла
    items: OgeCheckItem[];
    crutchesFound: boolean;
    summary: string;
}

export interface PageMargins {
    leftCm: number;
    rightCm: number;
    topCm: number;
    bottomCm: number;
}

/**
 * Парсер размера в сантиметрах из строки CSS или атрибута
 */
export function parseCm(val: string | null | undefined): number | null {
    if (!val) return null;
    val = val.trim().toLowerCase();
    if (val.endsWith('cm')) {
        return parseFloat(val);
    }
    if (val.endsWith('px')) {
        // 1 см ~ 37.795 px (при 96 DPI)
        return parseFloat(val) / 37.79527559;
    }
    if (val.endsWith('pt')) {
        // 1 pt = 1/72 inch = 2.54/72 cm = 0.0352778 cm
        return parseFloat(val) * 0.0352778;
    }
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

/**
 * Проверка соответствия документа критериям ОГЭ 13.2
 * @param rootEl - DOM-элемент листа редактора (.jodit-wysiwyg)
 * @param margins - Текущие поля страницы
 */
export function inspectOgeDocument(rootEl: HTMLElement | null, margins: PageMargins): OgeInspectionResult {
    const items: OgeCheckItem[] = [];

    if (!rootEl) {
        return {
            valid: false,
            score: 0,
            items: [{
                id: 'no_doc',
                category: 'paragraph',
                label: 'Документ',
                passed: false,
                message: 'Документ пуст или редактор не инициализирован.'
            }],
            crutchesFound: false,
            summary: 'Документ не содержит текста.'
        };
    }

    const rawHtml = rootEl.innerHTML || '';
    const textContent = rootEl.textContent || '';
    const trimmedText = textContent.trim();

    if (trimmedText.length === 0) {
        return {
            valid: false,
            score: 0,
            items: [{
                id: 'empty_text',
                category: 'paragraph',
                label: 'Текст документа',
                passed: false,
                message: 'В документе отсутствует текст. Наберите текст задания.'
            }],
            crutchesFound: false,
            summary: 'Документ пуст. Наберите текст для проверки.'
        };
    }

    // ================= 1. ДЕТЕКТОР «КОСТЫЛЕЙ» (ТИПИЧНЫЕ ОШИБКИ ШКОЛЬНИКОВ) =================
    
    // Костыль 1: Красная строка сделана пробелами (два и более пробела или &nbsp; в начале абзаца)
    const paras = Array.from(rootEl.querySelectorAll('p, h1, h2, h3'));
    let spaceIndentFound = false;
    for (const p of paras) {
        const html = p.innerHTML || '';
        if (/^(&nbsp;|\s){2,}/i.test(html) || /^\t+/.test(p.textContent || '')) {
            spaceIndentFound = true;
            break;
        }
    }
    if (spaceIndentFound) {
        items.push({
            id: 'crutch_spaces_indent',
            category: 'crutches',
            label: 'Красная строка пробелами',
            passed: false,
            isCrutch: true,
            message: 'Красная строка сделана клавишей Пробел или Tab! По критериям ОГЭ отступ первой строки настраивается в свойствах абзаца (Формат → Абзац → Первая строка: 1.0 см) или на линейке.'
        });
    }

    // Костыль 2: Пустые строки (двойной Enter) для разделения абзацев
    let emptyParasCount = 0;
    for (let idx = 0; idx < paras.length; idx++) {
        const p = paras[idx];
        const pText = (p.textContent || '').replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim();
        const inner = (p.innerHTML || '').replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim();
        const isEmptyP = pText === '' && (inner === '' || inner === '<br>' || inner === '&nbsp;');
        if (isEmptyP) {
            const prevP = idx > 0 ? paras[idx - 1] : null;
            const prevEmpty = prevP && (prevP.textContent || '').replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim() === '';
            const isTrailingSingle = idx === paras.length - 1 && !prevEmpty;
            const isLeadingBeforeBlock = idx === 0 && paras.length === 1;
            if (!isTrailingSingle && !isLeadingBeforeBlock) {
                emptyParasCount++;
            }
        }
    }
    if (emptyParasCount > 0) {
        items.push({
            id: 'crutch_double_enter',
            category: 'crutches',
            label: 'Лишние пустые строки (Enter)',
            passed: false,
            isCrutch: true,
            message: `Обнаружено ${emptyParasCount} пустых строк (двойной Enter)! По критериям ОГЭ запрещено разделять абзацы пустыми строками. Используйте межабзацный интервал (Формат → Абзац → Отступ после абзаца).`
        });
    }

    // Костыль 3: Дефис вместо длинного тире между словами ("слово - слово" вместо "слово — слово")
    if (/\s+-\s+/g.test(textContent)) {
        items.push({
            id: 'crutch_hyphen',
            category: 'crutches',
            label: 'Дефис вместо тире',
            passed: false,
            isCrutch: true,
            message: 'Использован дефис (-) вместо длинного тире (—). Вставляйте тире через меню «Вставка → Специальные символы» или Alt+0151.'
        });
    }

    // Костыль 4: Программистские кавычки вместо кавычек-ёлочек ("..." вместо «...»)
    if (/"[^"]+"/.test(textContent)) {
        items.push({
            id: 'crutch_quotes',
            category: 'crutches',
            label: 'Прямые кавычки вместо кавычек-ёлочек',
            passed: false,
            isCrutch: true,
            message: 'Использованы прямые кавычки (") вместо кавычек-ёлочек (« »). Вставляйте кавычки через меню «Вставка → Специальные символы».'
        });
    }

    // ================= 2. ПАРАМЕТРЫ СТРАНИЦЫ (ПОЛЯ) =================
    // По ОГЭ стандарт: левое 2.0 см (допуск 2-3 см), правое/верхнее/нижнее ~ 1.5 - 2.0 см
    const isLeftMarginOk = margins.leftCm >= 1.8 && margins.leftCm <= 3.2;
    const isRightMarginOk = margins.rightCm >= 1.3 && margins.rightCm <= 2.5;
    const isTopMarginOk = margins.topCm >= 1.3 && margins.topCm <= 2.5;
    const isBottomMarginOk = margins.bottomCm >= 1.3 && margins.bottomCm <= 2.5;

    if (isLeftMarginOk && isRightMarginOk && isTopMarginOk && isBottomMarginOk) {
        items.push({
            id: 'page_margins',
            category: 'page',
            label: 'Поля страницы',
            passed: true,
            message: `Поля страницы настроены верно (Левое: ${margins.leftCm} см, Правое: ${margins.rightCm} см, Верх/Низ: ${margins.topCm} см).`
        });
    } else {
        items.push({
            id: 'page_margins',
            category: 'page',
            label: 'Поля страницы',
            passed: false,
            message: `Поля страницы не настроены под стандарт ОГЭ (сейчас: Л ${margins.leftCm}см, П ${margins.rightCm}см). Настройте поля (Левое 2.0 см, остальные 1.5–2.0 см) через меню «Формат → Страница...».`
        });
    }

    // ================= 3. ПАРАМЕТРЫ АБЗАЦЕВ И ОСНОВНОГО ТЕКСТА =================
    const contentParas = paras.filter(p => (p.textContent || '').replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim().length > 0);

    if (contentParas.length === 0 && trimmedText.length > 0) {
        // Текст вне параграфов
        items.push({
            id: 'para_structure',
            category: 'paragraph',
            label: 'Структура абзацев',
            passed: false,
            message: 'Текст должен быть оформлен в виде абзацев (<p>).'
        });
    } else {
        // Проверка красной строки (отступ первой строки 1.0 см)
        let indentPassCount = 0;
        let nonJustifyCount = 0;
        let wrongFontCount = 0;
        let wrongSizeCount = 0;

        contentParas.forEach((p, idx) => {
            const style = window.getComputedStyle(p);
            
            // 1. textIndent
            const indentCm = parseCm(p.style.textIndent || style.textIndent) || 0;
            if (indentCm >= 0.85 && indentCm <= 1.25) {
                indentPassCount++;
            }

            // 2. textAlign (должно быть justify / по ширине)
            const align = p.style.textAlign || style.textAlign;
            if (align !== 'justify') {
                nonJustifyCount++;
            }

            // 3. Гарнитура шрифта (Serif: Liberation Serif, Times New Roman, serif)
            const childWithFont = p.querySelector('[style*="font-family"], font[face]') as HTMLElement | null;
            const childFont = childWithFont ? (childWithFont.style.fontFamily || childWithFont.getAttribute('face') || '') : '';
            const fontFam = (childFont || p.style.fontFamily || style.fontFamily || '').toLowerCase();
            const isSans = fontFam.includes('sans-serif') || fontFam.includes('arial') || fontFam.includes('liberation sans');
            const isSerif = !isSans && (fontFam.includes('liberation serif') || fontFam.includes('times') || fontFam.includes('serif'));
            if (!isSerif) {
                wrongFontCount++;
            }

            // 4. Размер шрифта (14 пт ~ 18.66px, допуск 13-15 пт ~ 17.3-20px)
            const childWithSize = p.querySelector('[style*="font-size"]') as HTMLElement | null;
            const targetEl = childWithSize || p;
            const pxSize = parseFloat(window.getComputedStyle(targetEl).fontSize);
            // 14pt = 18.666px; 12pt = 16px; 11pt = 14.66px
            const ptSize = pxSize * 0.75;
            if (ptSize < 13 || ptSize > 15.5) {
                wrongSizeCount++;
            }
        });

        // Результат по красной строке
        if (indentPassCount === contentParas.length) {
            items.push({
                id: 'para_first_line',
                category: 'paragraph',
                label: 'Красная строка (1.0 см)',
                passed: true,
                message: 'Отступ первой строки равен 1.0 см во всех абзацах текста.'
            });
        } else {
            items.push({
                id: 'para_first_line',
                category: 'paragraph',
                label: 'Красная строка (1.0 см)',
                passed: false,
                message: `Красная строка 1.0 см отсутствует в ${contentParas.length - indentPassCount} абзац(ах). Настройте отступ через Меню «Формат → Абзац» (Первая строка: 1.0 см) или передвиньте верхний маркер на линейке.`
            });
        }

        // Результат по выравниванию
        if (nonJustifyCount === 0) {
            items.push({
                id: 'para_justify',
                category: 'paragraph',
                label: 'Выравнивание по ширине',
                passed: true,
                message: 'Основной текст выровнен по ширине (Justify).'
            });
        } else {
            items.push({
                id: 'para_justify',
                category: 'paragraph',
                label: 'Выравнивание по ширине',
                passed: false,
                message: `Основной текст выровнен не по ширине (найдено выравнивание по левому краю). По критериям ОГЭ основной текст должен быть выровнен по ширине (Ctrl+J).`
            });
        }

        // Результат по гарнитуре
        if (wrongFontCount === 0) {
            items.push({
                id: 'font_family',
                category: 'font',
                label: 'Гарнитура шрифта (Serif)',
                passed: true,
                message: 'Использован шрифт с засечками (Liberation Serif / Times New Roman).'
            });
        } else {
            items.push({
                id: 'font_family',
                category: 'font',
                label: 'Гарнитура шрифта (Serif)',
                passed: false,
                message: 'Текст набран шрифтом без засечек (Arial / Sans-Serif). Выберите гарнитуру «Liberation Serif» или «Times New Roman» в выпадающем списке шрифтов.'
            });
        }

        // Результат по размеру шрифта
        if (wrongSizeCount === 0) {
            items.push({
                id: 'font_size',
                category: 'font',
                label: 'Размер шрифта (14 пт)',
                passed: true,
                message: 'Основной текст набран кеглем 14 пт.'
            });
        } else {
            items.push({
                id: 'font_size',
                category: 'font',
                label: 'Размер шрифта (14 пт)',
                passed: false,
                message: 'Размер основного текста отличается от требуемых 14 пт. Выделите текст и установите размер «14 пт» на панели инструментов.'
            });
        }

        // Межстрочный интервал (от 1.0 до 1.5)
        const pStyle = window.getComputedStyle(contentParas[0]);
        const lh = contentParas[0].style.lineHeight || pStyle.lineHeight;
        let isLhOk = true;
        if (lh) {
            const lhNum = parseFloat(lh);
            // Если в пикселях, сопоставляем с font-size
            const fsNum = parseFloat(pStyle.fontSize);
            const ratio = lh.endsWith('px') ? (lhNum / fsNum) : lhNum;
            if (!isNaN(ratio) && (ratio < 0.95 || ratio > 1.6)) {
                isLhOk = false;
            }
        }
        if (isLhOk) {
            items.push({
                id: 'line_spacing',
                category: 'paragraph',
                label: 'Межстрочный интервал (1.0–1.5)',
                passed: true,
                message: 'Межстрочный интервал соответствует норме (от 1.0 до 1.5).'
            });
        } else {
            items.push({
                id: 'line_spacing',
                category: 'paragraph',
                label: 'Межстрочный интервал (1.0–1.5)',
                passed: false,
                message: 'Межстрочный интервал выходит за рамки допустимого (должен быть не менее одинарного и не более полуторного, рекомендуется 1.15).'
            });
        }
    }

    // ================= 4. ПАРАМЕТРЫ ТАБЛИЦЫ (ЕСЛИ ЕСТЬ В ДОКУМЕНТЕ) =================
    const tables = Array.from(rootEl.querySelectorAll('table'));
    if (tables.length > 0) {
        tables.forEach((tbl, tIdx) => {
            const tStyle = window.getComputedStyle(tbl);
            
            // Центрирование таблицы на листе
            const isCentered = tbl.style.marginLeft === 'auto' && tbl.style.marginRight === 'auto'
                || tbl.getAttribute('align') === 'center'
                || tStyle.marginLeft === tStyle.marginRight;

            if (isCentered) {
                items.push({
                    id: `table_align_${tIdx}`,
                    category: 'table',
                    label: 'Центрирование таблицы',
                    passed: true,
                    message: 'Таблица отцентрирована по горизонтали.'
                });
            } else {
                items.push({
                    id: `table_align_${tIdx}`,
                    category: 'table',
                    label: 'Центрирование таблицы',
                    passed: false,
                    message: 'Таблица не отцентрирована на листе. Настройте выравнивание таблицы по центру (Меню: Таблица → Свойства таблицы).'
                });
            }

            // Шапка таблицы: заголовки по центру
            const headerCells = Array.from(tbl.querySelectorAll('th, thead td, tr:first-child th, tr:first-child td'));
            let headersCentered = true;
            for (const hCell of headerCells) {
                const cStyle = window.getComputedStyle(hCell);
                const align = (hCell as HTMLElement).style.textAlign || cStyle.textAlign;
                if (align !== 'center') {
                    headersCentered = false;
                    break;
                }
            }
            if (headersCentered && headerCells.length > 0) {
                items.push({
                    id: `table_headers_${tIdx}`,
                    category: 'table',
                    label: 'Выравнивание шапки таблицы',
                    passed: true,
                    message: 'Заголовки столбцов выровнены по центру.'
                });
            } else if (headerCells.length > 0) {
                items.push({
                    id: `table_headers_${tIdx}`,
                    category: 'table',
                    label: 'Выравнивание шапки таблицы',
                    passed: false,
                    message: 'В заголовках столбцов таблицы текст должен быть выровнен строго по центру.'
                });
            }

            // Размер шрифта в таблице (не больше основного, допускается 12-14 пт)
            const firstCell = tbl.querySelector('td, th');
            if (firstCell) {
                const cStyle = window.getComputedStyle(firstCell);
                const px = parseFloat(cStyle.fontSize);
                const pt = px * 0.75;
                if (pt <= 15) {
                    items.push({
                        id: `table_font_size_${tIdx}`,
                        category: 'table',
                        label: 'Размер шрифта в таблице',
                        passed: true,
                        message: `Размер шрифта в таблице (${Math.round(pt)} пт) не превышает размер основного текста.`
                    });
                } else {
                    items.push({
                        id: `table_font_size_${tIdx}`,
                        category: 'table',
                        label: 'Размер шрифта в таблице',
                        passed: false,
                        message: `Размер шрифта в таблице (${Math.round(pt)} пт) больше допустимого. Допускается 12–14 пт.`
                    });
                }
            }
        });
    }

    // ================= 5. ИТОГОВЫЙ БАЛЛ ПО КРИТЕРИЯМ ОГЭ 13.2 =================
    // В ОГЭ максимум 2 балла:
    // Критерий 1 (Текст): 1 балл если соблюдены размер, красная строка, интервалы, выравнивание, нет костылей
    // Критерий 2 (Таблица): 1 балл если таблица правильно оформлена (или 1 балл если таблицы в задании нет, но текст идеален)
    const failedItems = items.filter(it => !it.passed);
    const crutchesFound = items.some(it => it.isCrutch && !it.passed);

    let score = 2;
    if (failedItems.length > 0) {
        if (failedItems.length <= 2 && !crutchesFound) {
            score = 1;
        } else {
            score = 0;
        }
    }

    const valid = failedItems.length === 0;

    let summary = '';
    if (valid) {
        summary = 'Документ полностью соответствует требованиям ОГЭ по информатике (Задание 13.2)! Набрано 2 из 2 баллов.';
    } else {
        const errorDescriptions = failedItems.map(f => `• ${f.message}`).join('\n');
        summary = `Обнаружены отклонения от стандартов ОГЭ (Оценка: ${score}/2):\n${errorDescriptions}`;
    }

    return {
        valid,
        score,
        items,
        crutchesFound,
        summary
    };
}
