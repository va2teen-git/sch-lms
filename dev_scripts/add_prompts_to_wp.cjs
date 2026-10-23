const fs = require('fs');
const path = require('path');
const xlsx = require('../node_modules/xlsx');

const WP_DIR = path.join(__dirname, '..', 'wp');
const BACKUP_DIR = path.join(WP_DIR, '_backup_original');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Таблица соответствия файлов классам
const FILE_MAPPING = {
  '2026-2027_7 класс_информатика_Ватутин.xlsx': {
    classSlug: '7-класс',
    className: '7 класс (базовый уровень)'
  },
  '2026-2027_8 класс_информатика_Ватутин.xlsx': {
    classSlug: '8-класс',
    className: '8 класс (базовый уровень)'
  },
  '2026-2027_9 класс_информатика_Ватутин.xlsx': {
    classSlug: '9-класс',
    className: '9 класс (базовый уровень, подготовка к ОГЭ)'
  },
  '2026-2027_10 класс_базовый_информатика_Ватутин.xlsx': {
    classSlug: '10-класс_базовый',
    className: '10 класс (базовый уровень, гуманитарный профиль)'
  },
  '2026-2027_10 класс_углубленный_информатика_Ватутин.xlsx': {
    classSlug: '10-класс_углубленный',
    className: '10 класс (углубленный уровень, технологический профиль)'
  },
  '2026-2027_11 класс_базовый_информатика_Ватутин.xlsx': {
    classSlug: '11-класс_базовый',
    className: '11 класс (базовый уровень, гуманитарный профиль)'
  },
  '2026-2027_11 класс_углубленный_информатика_Ватутин.xlsx': {
    classSlug: '11-класс_углубленный',
    className: '11 класс (углубленный уровень, технологический профиль)'
  }
};

// Функция транслитерации для формирования компактного git slug
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

// Генерация универсальных промптов БЕЗ жестких ссылок на docs/*.md (только через AGENTS.md)

function generatePrompt1(className, classSlug, lessonId, topic, branchName, topicSlug) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Начинаем разработку нового урока:
- Параллель и профиль: ${className}
- Номер урока: ${lessonId}
- Тема: «${topic}»
- Ветка Git: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗОЛЯЦИЯ ПРОДАКШНА:
   В боевом каталоге D:\\school-lms ничего не меняй. Создай изолированное дерево git worktree:
   git -C "D:\\school-lms" worktree add -b ${branchName} "D:\\school-lms-dev"
   cmd /c mklink /J "D:\\school-lms-dev\\node_modules" "D:\\school-lms\\node_modules"
   Вся дальнейшая разработка ведется СТРОГО в каталоге D:\\school-lms-dev.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции учебного плана и оформления контента.
   Экономия токенов: перед чтением файлов длиннее 100 строк всегда вызывай get_code_outline.

3. СОЗДАНИЕ ТЕОРИИ:
   Создай файл D:\\school-lms-dev\\src\\content\\lessons\\${classSlug}\\${lessonId}\\theory.md.
   - Материал должен строго соответствовать учебной программе класса и профиля по теме «${topic}».
   - Соблюдай Zero-LaTeX Policy: формулы и обозначения оформляй чистым Unicode и тегами <sub> / <sup> (без синтаксиса $...$).
   - Разбей теорию на понятные дидактические разделы с примерами из реальной практики.
   - ВАЖНО: Раздел «Дополнительная информация» на данном этапе НЕ СОЗДАВАТЬ (он наполняется на этапе 5 под фактические механики тренажеров).

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл линтером: quick_lint(file_path="D:/school-lms-dev/src/content/lessons/${classSlug}/${lessonId}/theory.md").
   - Зафиксируй изменения атомарным коммитом и отправь ветку:
     git -C "D:\\school-lms-dev" add "src/content/lessons/${classSlug}/${lessonId}/theory.md"
     git -C "D:\\school-lms-dev" commit -m "content(${classSlug}-${lessonId}): add comprehensive theory on ${topicSlug}"
     git -C "D:\\school-lms-dev" push -u origin ${branchName}`;
}

function generatePrompt2(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: D:\\school-lms-dev (изолированный worktree)
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Убедись, что находишься в D:\\school-lms-dev на ветке ${branchName}. В D:\\school-lms ничего не меняй.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 1, UI-верстке и кривой сложности.
   Изучи созданную теорию: D:\\school-lms-dev\\src\\content\\lessons\\${classSlug}\\${lessonId}\\theory.md.

3. РАЗРАБОТКА УРОВНЯ 1:
   Создай файл D:\\school-lms-dev\\src\\pages\\tasks\\${classSlug}\\${lessonId}\\level1.astro.
   - Ровно 3 фазы. Обертка в TaskLayout level={1}.
   - ZERO MULTIPLE CHOICE: категорически запрещен выбор из готовых вариантов, радиокнопки и селекты.
   - Только физические манипуляции мышью: D&D (Slot & Snap токенами), сортировка по корзинам, прямая правка ячеек сетки/ленты или коммутация связей.
   - Zero-Style: запрещены теги <style>, используй только глобальные утилиты платформы, строгий кибер-стиль (rounded-0, темный фон).
   - Хитбоксы кликабельных зон >= 48x48 px.
   - Процедурная генерация параметров на лету. При ошибке прогресс шагов не сбрасывается — выдается уведомление, отправляется hardcore_reset и через 1-1.5 сек генерируется новый вариант текущей фазы.
   - Контракт телеметрии: отправка TELEMETRY_EVENT в окно родителя с именем миссии, action_type: 'level_complete' / 'in_progress'.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Вызови quick_lint(file_path="D:/school-lms-dev/src/pages/tasks/${classSlug}/${lessonId}/level1.astro").
   - Зафиксируй изменения атомарным коммитом и сделай push:
     git -C "D:\\school-lms-dev" add "src/pages/tasks/${classSlug}/${lessonId}/level1.astro"
     git -C "D:\\school-lms-dev" commit -m "feat(content): implement level 1 manipulation simulator for ${classSlug} lesson ${lessonId}"
     git -C "D:\\school-lms-dev" push origin ${branchName}`;
}

function generatePrompt3(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: D:\\school-lms-dev (изолированный worktree)
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Работаем исключительно в D:\\school-lms-dev на ветке ${branchName}.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 2, калибровке сложности (Sawtooth 2-1-2) и UI-верстке.

3. РАЗРАБОТКА УРОВНЯ 2:
   Создай файл D:\\school-lms-dev\\src\\pages\\tasks\\${classSlug}\\${lessonId}\\level2.astro.
   - Ровно 5 фаз. Обертка в TaskLayout level={2}.
   - ZERO MULTIPLE CHOICE: только ручной клавиатурный ввод в текстовые или числовые поля <input>.
   - Anti-Paste: платформа блокирует вставку, ответы рассчитываются учеником самостоятельно.
   - Прогрессия фаз Sawtooth 2-1-2: прямой расчет -> конвертация единиц -> пик инверсии -> долина консолидации -> кульминация без Fake Difficulty.
   - При ошибке: показ сбоя, телеметрия hardcore_reset и процедурная генерация нового варианта текущей фазы.
   - Zero-Style: никаких тегов <style>.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл: quick_lint(file_path="D:/school-lms-dev/src/pages/tasks/${classSlug}/${lessonId}/level2.astro").
   - Сделай атомарный коммит и push:
     git -C "D:\\school-lms-dev" add "src/pages/tasks/${classSlug}/${lessonId}/level2.astro"
     git -C "D:\\school-lms-dev" commit -m "feat(content): implement level 2 analytical simulator for ${classSlug} lesson ${lessonId}"
     git -C "D:\\school-lms-dev" push origin ${branchName}`;
}

function generatePrompt4(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: D:\\school-lms-dev (изолированный worktree)
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Работаем исключительно в D:\\school-lms-dev на ветке ${branchName}.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 3 (банк аркадных архетипов) и верстке. Выбери подходящий архетип механики.

3. РАЗРАБОТКА УРОВНЯ 3:
   Создай файл D:\\school-lms-dev\\src\\pages\\tasks\\${classSlug}\\${lessonId}\\level3.astro.
   - Стек: Vue 3 (подключение /static/vue.global.js).
   - Обертка: TaskLayout level={3}.
   - 8–12 процедурных волн (стандарт — 10 волн) с динамическим таймером и возрастающей сложностью.
   - Direct Manipulation: интерактивные зоны >= 48x48 px, поддержка горячих клавиш.
   - Звуковой отклик: Web Audio API (генерация звуковых сигналов без внешних файлов).
   - ТОТАЛЬНЫЙ ХАРДКОР-СБРОС: любая ошибка, неверный выбор или тайм-аут вызывают системную сирену (#alarm-box), шлют hardcore_reset в телеметрию и ПОЛНОСТЬЮ СБРАСЫВАЮТ ПРОГРЕСС НА ВОЛНУ 1 с перегенерацией волн.
   - Экспорт тестового хука: window.__DEV_LEVEL3_STATE__ = { waves, currentWaveIndex, currentWave, solveCurrentWave(), submitAction() }.
   - Zero-Style: никаких тегов <style>.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл: quick_lint(file_path="D:/school-lms-dev/src/pages/tasks/${classSlug}/${lessonId}/level3.astro").
   - Сделай атомарный коммит и push:
     git -C "D:\\school-lms-dev" add "src/pages/tasks/${classSlug}/${lessonId}/level3.astro"
     git -C "D:\\school-lms-dev" commit -m "feat(content): implement level 3 arcade simulator for ${classSlug} lesson ${lessonId}"
     git -C "D:\\school-lms-dev" push origin ${branchName}`;
}

function generatePrompt5(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: D:\\school-lms-dev (изолированный worktree)
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. АНАЛИЗ ФАКТИЧЕСКИХ МЕХАНИК:
   Все 3 уровня задания уже созданы (level1.astro, level2.astro, level3.astro).
   Изучи их фактические алгоритмы, правила и форматы данных.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по оформлению теоретических блоков и Zero-Leakage Policy.

3. ДОПОЛНЕНИЕ ТЕОРИИ:
   Отредактируй файл D:\\school-lms-dev\\src\\content\\lessons\\${classSlug}\\${lessonId}\\theory.md, добавив в конец раздел:
   ## Дополнительная информация
   ### Для уровня 1 (Базовый)
   ### Для уровня 2 (Продвинутый)
   ### Для уровня 3 (Аркада)

   КРИТИЧЕСКИЕ ПРАВИЛА ZERO-LEAKAGE:
   - Исчерпывающе объясни метод решения, формулы и правила синтаксиса для каждого уровня.
   - КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО приводить прямые готовые ответы, загаданные числовые константы или цитировать точные строковые токены из levelX.astro.
   - Примеры в теории должны быть абстрактными и дидактическими.
   - Zero-LaTeX: формулы только через Unicode и теги <sub> / <sup>.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Вызови quick_lint(file_path="D:/school-lms-dev/src/content/lessons/${classSlug}/${lessonId}/theory.md").
   - Сделай атомарный коммит и push:
     git -C "D:\\school-lms-dev" add "src/content/lessons/${classSlug}/${lessonId}/theory.md"
     git -C "D:\\school-lms-dev" commit -m "content(${classSlug}-${lessonId}): add comprehensive additional info sections for levels 1-3"
     git -C "D:\\school-lms-dev" push origin ${branchName}`;
}

function generatePrompt6(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Продолжаем разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: D:\\school-lms-dev (изолированный worktree)
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по автоматическому тестированию и симуляции цифровых персон. В качестве образца изучи соседние тесты в tests/.

2. СОЗДАНИЕ ТЕСТОВ:
   Создай тестовые спецификации в D:\\school-lms-dev\\tests\\:
   1. tests/lesson${classSlug}-${lessonId}-level1.spec.js и tests/lesson${classSlug}-${lessonId}-level1-student-personas.spec.js
   2. tests/lesson${classSlug}-${lessonId}-level2.spec.js и tests/lesson${classSlug}-${lessonId}-level2-student-personas.spec.js
   3. tests/lesson${classSlug}-${lessonId}-level3.spec.js и tests/lesson${classSlug}-${lessonId}-level3-student-personas.spec.js
   
   Обязательно протестируй:
   - Архитектурные контракты (Zero Multiple Choice, отсутствие <style>, TaskLayout).
   - Сквозное успешное прохождение всех фаз и волн с фиксацией событий телеметрии (level_complete, success: true).
   - Ошибочные сценарии: показ сбоя, событие hardcore_reset, корректность процедурной перегенерации.
   - Симуляцию цифровых персон учащихся через StudentSimulator (NOVICE с ошибкой и исправлением, CHAOS со спам-кликами, DILIGENT с безошибочным прохождением).

3. ЗАПУСК И ОТЛАДКА:
   - Запусти dev-сервер в фоне в D:\\school-lms-dev на свободном порту (или используй BASE_URL=http://localhost:4321).
   - Прогони тесты через run_compact_test.
   - Убедись, что все тесты зеленые (100% pass). При падениях исправь код в task-файлах.
   - Обязательно останови фоновый dev-сервер перед завершением (No Orphan Daemons Policy).

4. КОММИТ И PUSH:
   git -C "D:\\school-lms-dev" add tests/lesson${classSlug}-${lessonId}-*.spec.js "src/pages/tasks/${classSlug}/${lessonId}/"
   git -C "D:\\school-lms-dev" commit -m "test(content): add full e2e and student persona test suites for ${classSlug} lesson ${lessonId}"
   git -C "D:\\school-lms-dev" push origin ${branchName}`;
}

function generatePrompt7(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS.
Финальный этап сдачи урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗУЧЕНИЕ РЕГЛАМЕНТА:
   Ознакомься с AGENTS.md и открой актуальный регламент сдачи PR, очистки окружения и обновления боевого сервера.

2. СОЗДАНИЕ PULL REQUEST:
   Убедись, что все коммиты отправлены в origin.
   Создай сводный PR через GitHub CLI:
   gh pr create --repo va2teen-git/sch-lms --base main --head ${branchName} --title "feat(content): урок ${classSlug} №${lessonId} «${topic}» — теория, тренажеры 1-3 и тесты" --body "## Описание изменений\\nКомплексная реализация урока ${className} №${lessonId} («${topic}»).\\n- Теория (theory.md) с разделами дополнительной информации.\\n- Уровень 1: манипуляции мышью (3 фазы).\\n- Уровень 2: аналитический ручной ввод (5 фаз, Sawtooth 2-1-2).\\n- Уровень 3: аркадный тренажер с динамическим таймером и хардкор-сбросом.\\n- Полный набор E2E-тестов Playwright и симуляций цифровых персон."

3. СЛИЯНИЕ В MAIN:
   Выполни слияние PR с удалением ветки:
   gh pr merge <PR_NUMBER> --repo va2teen-git/sch-lms --merge --delete-branch

4. ОЧИСТКА DEV-ОКРУЖЕНИЯ:
   if (Test-Path "D:\\school-lms-dev\\node_modules") { cmd /c rmdir "D:\\school-lms-dev\\node_modules" }
   git -C "D:\\school-lms" worktree remove "D:\\school-lms-dev" --force
   git -C "D:\\school-lms" remote prune origin

5. ОБНОВЛЕНИЕ БОЕВОГО СЕРВЕРА (D:\\school-lms):
   В каталоге D:\\school-lms выполни:
   - git checkout main && git pull origin main
   - node scripts/migrate_telemetry.js
   - npm run build
   - Мягкий перезапуск сервиса:
     Get-Process -Name node | Where-Object { $_.Path -like '*node.exe*' } | Stop-Process
     (сторож start_server.ps1 автоматически поднимет новый билд за 2 секунды).

6. ВЕРИФИКАЦИЯ РЕЛИЗА (SMOKE CHECK):
   Через Python-скрипт (без системного прокси) проверь код ответа 200 на порту 8080:
   - http://localhost:8080/lesson/${classSlug}/${lessonId}
   - http://localhost:8080/tasks/${classSlug}/${lessonId}/level1
   - http://localhost:8080/tasks/${classSlug}/${lessonId}/level2
   - http://localhost:8080/tasks/${classSlug}/${lessonId}/level3`;
}

// Новые заголовки колонок
const NEW_HEADERS = [
  'Промпт 1: Теория (без доп. блоков)',
  'Промпт 2: Уровень 1 (Манипуляции)',
  'Промпт 3: Уровень 2 (Аналитика/Ввод)',
  'Промпт 4: Уровень 3 (Аркадный босс)',
  'Промпт 5: Дополнительная информация',
  'Промпт 6: Тестирование (E2E и персоны)',
  'Промпт 7: PR, Merge и Деплой'
];

let totalProcessed = 0;

for (const [filename, config] of Object.entries(FILE_MAPPING)) {
  const filePath = path.join(WP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    continue;
  }

  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length === 0) continue;

  const headerRow = rows[0];
  while (headerRow.length > 8) {
    headerRow.pop();
  }
  headerRow.push(...NEW_HEADERS);

  let lessonsInFile = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const lessonId = row[0];
    if (lessonId === undefined || lessonId === null || lessonId === '') {
      continue;
    }
    const topic = row[2] || `Урок ${lessonId}`;
    const topicSlug = transliterate(topic);
    const branchName = `content/${config.classSlug}-lesson-${lessonId}-${topicSlug}`;

    while (row.length > 8) {
      row.pop();
    }
    while (row.length < 8) {
      row.push('');
    }

    const p1 = generatePrompt1(config.className, config.classSlug, lessonId, topic, branchName, topicSlug);
    const p2 = generatePrompt2(config.className, config.classSlug, lessonId, topic, branchName);
    const p3 = generatePrompt3(config.className, config.classSlug, lessonId, topic, branchName);
    const p4 = generatePrompt4(config.className, config.classSlug, lessonId, topic, branchName);
    const p5 = generatePrompt5(config.className, config.classSlug, lessonId, topic, branchName);
    const p6 = generatePrompt6(config.className, config.classSlug, lessonId, topic, branchName);
    const p7 = generatePrompt7(config.className, config.classSlug, lessonId, topic, branchName);

    row.push(p1, p2, p3, p4, p5, p6, p7);
    lessonsInFile++;
  }

  const newSheet = xlsx.utils.aoa_to_sheet(rows);

  newSheet['!cols'] = [
    { wch: 6 },   // №
    { wch: 18 },  // Тип
    { wch: 45 },  // Тема
    { wch: 30 },  // ДЗ
    { wch: 15 },  // Материалы
    { wch: 10 },  // Связи
    { wch: 8 },   // Часы
    { wch: 18 },  // Контроль
    { wch: 40 },  // Промпт 1
    { wch: 40 },  // Промпт 2
    { wch: 40 },  // Промпт 3
    { wch: 40 },  // Промпт 4
    { wch: 40 },  // Промпт 5
    { wch: 40 },  // Промпт 6
    { wch: 40 }   // Промпт 7
  ];

  wb.Sheets[sheetName] = newSheet;
  xlsx.writeFile(wb, filePath);
  console.log(`✅ ${filename}: обновлено ${lessonsInFile} уроков`);
  totalProcessed += lessonsInFile;
}

console.log(`\n🎉 ВСЕГО ОБРАБОТАНО УРОКОВ: ${totalProcessed}`);
