const https = require('https');
const fs = require('fs');
const path = require('path');

const baseUrl = 'https://raw.githubusercontent.com/LibreOffice/core/master/icon-themes/colibre_svg/cmd/';
const outDir = path.join(__dirname, '..', 'public', 'static', 'colibre');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const icons = {
    'undo': 'lc_undo.svg',
    'redo': 'lc_redo.svg',
    'cut': 'lc_cut.svg',
    'copy': 'lc_copy.svg',
    'paste': 'lc_paste.svg',
    'find': 'lc_searchdialog.svg',
    'source': 'lc_newhtmldoc.svg',
    'paragraph': 'lc_paragraphdialog.svg',
    'font': 'lc_charfontname.svg',
    'fontsize': 'lc_grow.svg',
    'bold': 'lc_bold.svg',
    'italic': 'lc_italic.svg',
    'underline': 'lc_underline.svg',
    'strikethrough': 'lc_strikeout.svg',
    'superscript': 'lc_superscript.svg',
    'subscript': 'lc_subscript.svg',
    'brush': 'lc_color.svg',
    'eraser': 'lc_resetattributes.svg',
    'align': 'lc_alignleft.svg',
    'ul': 'lc_defaultbullet.svg',
    'ol': 'lc_defaultnumbering.svg',
    'outdent': 'lc_decrementindent.svg',
    'indent': 'lc_incrementindent.svg',
    'table': 'lc_inserttable.svg',
    'link': 'lc_inserthyperlink.svg',
    'image': 'lc_insertgraphic.svg',
    'hr': 'lc_hfixedline.svg'
};

Object.keys(icons).forEach(joditName => {
    const loName = icons[joditName];
    const fileUrl = baseUrl + loName;
    const dest = path.join(outDir, `${joditName}.svg`);

    https.get(fileUrl, (res) => {
        if (res.statusCode === 200) {
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${joditName}.svg`);
            });
        } else {
            console.error(`Failed to download ${loName}: HTTP ${res.statusCode}`);
        }
    }).on('error', (err) => {
        console.error(`Error downloading ${loName}: ${err.message}`);
    });
});
