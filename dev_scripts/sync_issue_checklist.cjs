const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const coursesFile = path.join(__dirname, '..', 'src', 'data', 'courses.json');
const coursesData = JSON.parse(fs.readFileSync(coursesFile, 'utf-8'));

// Функция транслитерации для формирования git branch
function transliterate(str) {
  const ruMap = {
    'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'е':'e', 'ё':'yo', 'ж':'zh',
    'з':'z', 'и':'i', 'й':'j', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o',
    'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'h', 'ц':'ts',
    'ч':'ch', 'ш':'sh', 'щ':'sch', 'ъ':'', 'ы':'y', 'ь':'', 'э':'e', 'ю':'yu',
    'я':'ya'
  };
  const clean = str.toLowerCase().replace(/«|»|"|'|:|\.|\(|\)|,/g, ' ');
  let res = '';
  for (const ch of clean) {
    if (ruMap[ch] !== undefined) {
      res += ruMap[ch];
    } else if (/[a-z0-9]/.test(ch)) {
      res += ch;
    } else if (/\s+/.test(ch)) {
      if (res.length > 0 && res[res.length - 1] !== '-') {
        res += '-';
      }
    }
  }
  res = res.replace(/^-+|-+$/g, '');
  if (res.length > 30) {
    res = res.substring(0, 30).replace(/-[^-]*$/, '');
  }
  return res || 'topic';
}

function generateIssueBody(className, classSlug, lessonId, topic, branchName) {
  return `### 🎯 Разработка урока: ${className}. Урок №${lessonId} («${topic}»)

**Параметры:**
- **Курс:** \`${classSlug}\`
- **Урок:** \`${lessonId}\`
- **Ветка Git:** \`${branchName}\`
- **Рабочий каталог:** \`D:\\school-lms-dev\`

---

### 📋 Чек-лист этапов разработки:
- [ ] **Этап 1: Базовая теория** (\`theory.md\`, Zero-LaTeX, без спойлеров к тренажерам)
- [ ] **Этап 2: Тренажер Уровня 1** (\`level1.astro\`, 3 фазы, манипуляции мышью, Zero Multiple Choice)
- [ ] **Этап 3: Тренажер Уровня 2** (\`level2.astro\`, 5 фаз, аналитический ручной ввод, пилообразная кривая сложности)
- [ ] **Этап 4: Тренажер Уровня 3** (\`level3.astro\`, аркадный босс, Vue 3, динамический таймер, хардкор-сброс)
- [ ] **Этап 5: Дополнительная информация** (разделы в \`theory.md\` под механики уровней 1–3, Zero-Leakage Policy)
- [ ] **Этап 6: Автоматизированное тестирование** (E2E-тесты Playwright + симуляции цифровых персон)
- [ ] **Этап 7: Релиз и деплой** (Pull Request, слияние в \`main\`, очистка окружения, сборка и деплой на боевой сервер)

---
*Перед выполнением каждого этапа обратитесь к \`AGENTS.md\` для получения актуальных инструкций проекта.*`;
}

// Аргументы: node sync_issue_checklist.cjs <issue_number> <class_slug> <lesson_id>
const [,, issueNum, classSlug, lessonId] = process.argv;

if (!issueNum || !classSlug || !lessonId) {
  console.log('Использование: node sync_issue_checklist.cjs <issue_number> <class_slug> <lesson_id>');
  console.log('Пример: node sync_issue_checklist.cjs 352 7-класс 9');
  process.exit(0);
}

const course = coursesData.find(c => c.slug === classSlug);
if (!course) {
  console.error(`Курс со слагом "${classSlug}" не найден в courses.json`);
  process.exit(1);
}

const lesson = course.lessons.find(l => String(l.id) === String(lessonId));
if (!lesson) {
  console.error(`Урок "${lessonId}" не найден в курсе "${classSlug}"`);
  process.exit(1);
}

const topicSlug = transliterate(lesson.topic);
const branchName = `content/${classSlug}-lesson-${lessonId}-${topicSlug}`;
const body = generateIssueBody(course.name, classSlug, lessonId, lesson.topic, branchName);

// Записываем тело во временный файл для надежной передачи в gh cli
const tmpFile = path.join(__dirname, 'tmp_issue_body.md');
fs.writeFileSync(tmpFile, body, 'utf-8');

try {
  execSync(`gh issue edit ${issueNum} --repo va2teen-git/sch-lms --body-file "${tmpFile}"`, { stdio: 'inherit' });
  console.log(`✅ Issue #${issueNum} успешно обновлен чек-листом для урока ${classSlug} №${lessonId}`);
} finally {
  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }
}
