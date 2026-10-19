(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.WriterValidator = {}));
})(this, (function (exports) { 'use strict';

    function stripInvisibleChars(str) {
        return (str || '')
            .replace(/[\uFEFF\u200B\u200C\u200D]/g, '')
            .replace(/\u00A0/g, ' ');
    }

    function normalizeSpaces(str) {
        return stripInvisibleChars(str)
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeIndexDigits(str) {
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

    var LATIN_TO_CYRILLIC_HOMOGLYPHS = {
        'A': 'А', 'B': 'В', 'C': 'С', 'E': 'Е', 'H': 'Н', 'K': 'К', 'M': 'М', 'O': 'О', 'P': 'Р', 'T': 'Т', 'X': 'Х',
        'a': 'а', 'c': 'с', 'e': 'е', 'o': 'о', 'p': 'р', 'x': 'х', 'y': 'у'
    };

    function normalizeComparable(str, options) {
        options = options || {};
        var res = normalizeSpaces(normalizeIndexDigits(str));
        if (!options.preserveCase) {
            res = res.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
        }
        if (!options.strictLatin) {
            res = res.replace(/[ABCEHKMOPTXaceopxy]/g, function (ch) {
                return LATIN_TO_CYRILLIC_HOMOGLYPHS[ch] || ch;
            });
        }
        res = res.replace(/\s*°\s*/g, '°');
        return res.replace(/\s+/g, ' ').trim();
    }

    function extractText(source) {
        if (!source) return '';
        if (typeof source === 'string') return source;
        return source.innerText || source.textContent || '';
    }

    function hasText(source, target, options) {
        options = options || {};
        var textNorm = normalizeComparable(extractText(source), options);
        var targetNorm = normalizeComparable(target, options);
        if (textNorm.includes(targetNorm)) return true;
        var textCompact = textNorm.replace(/\s+/g, '');
        var targetCompact = targetNorm.replace(/\s+/g, '');
        return textCompact.includes(targetCompact);
    }

    function hasBoldWord(container, word) {
        if (!container) return false;
        var targetNorm = normalizeComparable(word);
        var boldNodes = container.querySelectorAll('b, strong, [style*="font-weight: bold"], [style*="font-weight: 700"]');
        for (var i = 0; i < boldNodes.length; i++) {
            var text = normalizeComparable(extractText(boldNodes[i]));
            if (text.includes(targetNorm)) return true;
        }
        return false;
    }

    function hasItalicWord(container, word) {
        if (!container) return false;
        var targetNorm = normalizeComparable(word);
        var italicNodes = container.querySelectorAll('i, em, [style*="font-style: italic"]');
        for (var i = 0; i < italicNodes.length; i++) {
            var text = normalizeComparable(extractText(italicNodes[i]));
            if (text.includes(targetNorm)) return true;
        }
        return false;
    }

    function hasUnderlineWord(container, word) {
        if (!container) return false;
        var targetNorm = normalizeComparable(word);
        var uNodes = container.querySelectorAll('u, [style*="text-decoration: underline"], [style*="text-decoration-line: underline"]');
        for (var i = 0; i < uNodes.length; i++) {
            var text = normalizeComparable(extractText(uNodes[i]));
            if (text.includes(targetNorm)) return true;
        }
        return false;
    }

    function hasSuperscript(container, targetDigitOrText) {
        var rawText = container ? extractText(container) : '';
        var normTarget = normalizeIndexDigits(targetDigitOrText);

        if (container) {
            var supNodes = container.querySelectorAll('sup, [style*="vertical-align: super"]');
            for (var i = 0; i < supNodes.length; i++) {
                var nodeText = normalizeIndexDigits(normalizeSpaces(extractText(supNodes[i])));
                if (nodeText.includes(normTarget)) return true;
            }
        }

        if (normTarget === '2' && rawText.includes('²')) return true;
        if (normTarget === '3' && rawText.includes('³')) return true;
        return false;
    }

    function hasSubscript(container, targetDigitOrText, options) {
        options = options || {};
        var rawText = container ? extractText(container) : '';
        var normTarget = normalizeIndexDigits(targetDigitOrText);
        var foundSub = false;

        if (container) {
            var subNodes = container.querySelectorAll('sub, [style*="vertical-align: sub"]');
            for (var i = 0; i < subNodes.length; i++) {
                var nodeText = normalizeIndexDigits(normalizeSpaces(extractText(subNodes[i])));
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

        if (options.requireLatinWords && options.requireLatinWords.length > 0) {
            var cleanedRaw = stripInvisibleChars(rawText);
            for (var j = 0; j < options.requireLatinWords.length; j++) {
                var word = options.requireLatinWords[j];
                if (!cleanedRaw.includes(word)) {
                    return false;
                }
            }
        }

        return true;
    }

    function checkParagraphGeometry(container, options) {
        options = options || {};
        var res = {
            fontOk: !options.font,
            sizeOk: options.sizePt === undefined,
            alignOk: !options.textAlign,
            indentOk: options.indentCm === undefined,
            lineHeightOk: !options.lineHeight,
            allOk: false
        };

        if (!container) return res;

        var p = container.querySelector('p, h1, h2, h3, div') || container;
        var html = container.innerHTML || '';
        var comp = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(p) : null;

        if (options.font) {
            var fontName = options.font.toLowerCase();
            if (
                (p.style && p.style.fontFamily && p.style.fontFamily.toLowerCase().includes(fontName)) ||
                (comp && comp.fontFamily && comp.fontFamily.toLowerCase().includes(fontName)) ||
                html.toLowerCase().includes(fontName)
            ) {
                res.fontOk = true;
            }
        }

        if (options.sizePt !== undefined) {
            var targetPt = options.sizePt;
            var ptStr = targetPt + 'pt';
            var ptFromComputed = 0;
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

        if (options.textAlign) {
            var targetAlign = options.textAlign;
            if (
                (p.style && p.style.textAlign === targetAlign) ||
                (comp && comp.textAlign === targetAlign) ||
                html.includes('text-align: ' + targetAlign)
            ) {
                res.alignOk = true;
            }
        }

        if (options.indentCm !== undefined) {
            var indentPx = comp ? parseFloat(comp.textIndent) || 0 : 0;
            if (
                (p.style && /^1(\.0)?cm$/.test(p.style.textIndent)) ||
                (indentPx >= 32 && indentPx <= 48) ||
                html.includes('text-indent: 1cm') ||
                html.includes('text-indent: 1.0cm')
            ) {
                res.indentOk = true;
            }
        }

        if (options.lineHeight) {
            var lhStr = String(options.lineHeight);
            if (
                (p.style && (p.style.lineHeight === lhStr || p.style.lineHeight === '1.5' || p.style.lineHeight === '1.15')) ||
                html.includes('line-height: ' + lhStr) ||
                html.includes('line-height: 1.15') ||
                html.includes('line-height: 1.5')
            ) {
                res.lineHeightOk = true;
            }
        }

        res.allOk = res.fontOk && res.sizeOk && res.alignOk && res.indentOk && res.lineHeightOk;
        return res;
    }

    function checkTypography(source, options) {
        options = options || {};
        var textNorm = normalizeComparable(extractText(source));
        var res = {
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
            res.symbolsOk = options.symbols.every(function (sym) {
                return textNorm.includes(sym);
            });
        }

        res.allOk = res.quotesOk && res.dashOk && res.symbolsOk;
        return res;
    }

    function checkListStructure(container, options) {
        options = options || {};
        var res = {
            listOk: false,
            countOk: false,
            boldOk: !options.boldTerms || options.boldTerms.length === 0,
            textsOk: !options.texts || options.texts.length === 0,
            allOk: false
        };

        if (!container) return res;

        var tag = options.type || 'ol';
        var listEl = container.querySelector(tag);
        res.listOk = !!listEl;

        var lis = container.querySelectorAll(tag + ' li');
        var minItems = options.minItems || 3;
        res.countOk = lis.length >= minItems;

        if (options.boldTerms && options.boldTerms.length > 0) {
            var boldNodes = container.querySelectorAll('li b, li strong, li [style*="font-weight: bold"], li [style*="font-weight: 700"]');
            var boldText = Array.from(boldNodes)
                .map(function (el) { return normalizeComparable(extractText(el)); })
                .join(' ');
            res.boldOk = options.boldTerms.every(function (term) {
                return boldText.includes(normalizeComparable(term));
            });
        }

        if (options.texts && options.texts.length > 0) {
            var fullListText = normalizeComparable(extractText(container));
            res.textsOk = options.texts.every(function (frag) {
                return fullListText.includes(normalizeComparable(frag));
            });
        }

        res.allOk = res.listOk && res.countOk && res.boldOk && res.textsOk;
        return res;
    }

    function checkTableStructure(container, options) {
        options = options || {};
        var res = {
            tableOk: false,
            centerOk: !options.centered,
            headersOk: !options.headers || options.headers.length === 0,
            cellsOk: !options.cells || options.cells.length === 0,
            allOk: false
        };

        if (!container) return res;

        var tbl = container.querySelector('table');
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

        var trs = tbl.querySelectorAll('tr');
        if (options.headers && options.headers.length > 0 && trs.length >= 1) {
            var ths = trs[0].querySelectorAll('th, td');
            if (ths.length >= options.headers.length) {
                var matched = true;
                for (var i = 0; i < options.headers.length; i++) {
                    var cellText = normalizeComparable(extractText(ths[i])).toLowerCase();
                    var expected = normalizeComparable(options.headers[i]).toLowerCase();
                    if (cellText !== expected) {
                        matched = false;
                        break;
                    }
                }
                if (matched && options.alignHeadersCenter) {
                    var allCentered = Array.from(ths).every(function (cell) {
                        var cStyle = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(cell) : null;
                        return cell.style.textAlign === 'center' || (cStyle && cStyle.textAlign === 'center');
                    });
                    if (!allCentered) matched = false;
                }
                res.headersOk = matched;
            }
        }

        if (options.cells && options.cells.length > 0 && trs.length >= 2) {
            var tds = trs[1].querySelectorAll('td, th');
            if (tds.length >= options.cells.length) {
                var matchedCells = true;
                for (var j = 0; j < options.cells.length; j++) {
                    var dText = normalizeComparable(extractText(tds[j])).toLowerCase();
                    var exp = normalizeComparable(options.cells[j]).toLowerCase();
                    if (dText !== exp) {
                        matchedCells = false;
                        break;
                    }
                }
                res.cellsOk = matchedCells;
            }
        }

        res.allOk = res.tableOk && res.centerOk && res.headersOk && res.cellsOk;
        return res;
    }

    exports.stripInvisibleChars = stripInvisibleChars;
    exports.normalizeSpaces = normalizeSpaces;
    exports.normalizeIndexDigits = normalizeIndexDigits;
    exports.normalizeComparable = normalizeComparable;
    exports.hasText = hasText;
    exports.hasBoldWord = hasBoldWord;
    exports.hasItalicWord = hasItalicWord;
    exports.hasUnderlineWord = hasUnderlineWord;
    exports.hasSuperscript = hasSuperscript;
    exports.hasSubscript = hasSubscript;
    exports.checkParagraphGeometry = checkParagraphGeometry;
    exports.checkTypography = checkTypography;
    exports.checkListStructure = checkListStructure;
    exports.checkTableStructure = checkTableStructure;

    if (typeof window !== 'undefined') {
        window.WriterValidator = exports;
    }
}));
