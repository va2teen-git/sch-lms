const xlsx = require('xlsx');
const workbook = xlsx.readFile('wp/2026-2027_10 класс_базовый_информатика_Ватутин.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
console.log(data.slice(0, 10));
