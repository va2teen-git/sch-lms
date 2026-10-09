import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';

const wpDir = path.join(process.cwd(), 'wp');
const dataDir = path.join(process.cwd(), 'src', 'data');
const outputFile = path.join(dataDir, 'courses.json');

const files = fs.readdirSync(wpDir).filter(f => f.endsWith('.xlsx'));
const courses = [];

for (const file of files) {
  // Example name: 2026-2027_10 класс_базовый_информатика_Ватутин.xlsx
  const match = file.match(/2026-2027_(.*?)_информатика/);
  if (!match) continue;
  
  const className = match[1]; // e.g., "10 класс_базовый"
  const slug = className.replace(/\s+/g, '-').toLowerCase();
  
  const filePath = path.join(wpDir, file);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const lessons = [];
  
  // Skip header (row 0), and extract lessons
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row.length === 0) continue;
    const num = row[0]; // №
    const topic = row[2]; // Тема
    
    if (num && topic) {
      lessons.push({
        id: num.toString(),
        topic: topic.toString().trim()
      });
    }
  }
  
  courses.push({
    name: className,
    slug: slug,
    lessons: lessons
  });
}

fs.writeFileSync(outputFile, JSON.stringify(courses, null, 2), 'utf-8');
console.log(`Parsed ${files.length} courses into ${outputFile}`);
