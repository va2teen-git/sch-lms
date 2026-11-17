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

// Генерация универсальных промптов под ALT Linux, agy-portable и стандарты Issue #566 (без жестких ссылок на docs/*.md — только через AGENTS.md)

const PROD_DIR = '$REAL_HOME/Projects/school-lms';
const DEFAULT_WORKTREE = '$REAL_HOME/Projects/school-lms-dev';
const HARDCORE_PRINCE_COMPAT_NOTE =
  'Совместимость с хардкором и кампанией Prince of Persia (#581): не отправляй вручную `prince_complete` и не подменяй статусы хардкора внутри levelX.astro — этап кампании `src/data/prince-campaign.json` («1 урок хардкора = 1 этап») открывается страницей урока автоматически после честного прохождения всех 3 уровней без сброса.';

function generatePrompt1(className, classSlug, lessonId, topic, branchName, topicSlug) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (сервер ALT Linux).
Начинаем разработку нового урока:
- Параллель и профиль: ${className}
- Номер урока: ${lessonId}
- Тема: «${topic}»
- Ветка Git: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗОЛЯЦИЯ ПРОДАКШНА (ALT Linux + agy-portable):
   В боевом каталоге ${PROD_DIR} (порт 3000, systemd-сервис school-lms.service) НИЧЕГО не меняй и не запускай тесты/сборку.
   ВАЖНО: при запуске agy-portable с USB-флешки (vfat) $HOME указывает на флешку, а реальный каталог на ext4 лежит в $REAL_HOME (/home/SCHOOL223.NET/vatutin_n_a). Запрещено создавать worktree на флешке.
   Проверь занятые worktree командой \`git -C "${PROD_DIR}" worktree list\`. Если ${DEFAULT_WORKTREE} свободен — используй его, иначе возьми следующий свободный суффикс (${DEFAULT_WORKTREE}-2, -3):
   WORKTREE_DIR="${DEFAULT_WORKTREE}"
   git -C "${PROD_DIR}" fetch origin main
   git -C "${PROD_DIR}" worktree add -b ${branchName} "$WORKTREE_DIR" origin/main
   ln -s "${PROD_DIR}/node_modules" "$WORKTREE_DIR/node_modules"
   Вся дальнейшая разработка ведется СТРОГО в "$WORKTREE_DIR".

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции учебного плана, AI Workflow и оформления контента.
   Экономия токенов: перед чтением файлов длиннее 100 строк всегда вызывай get_code_outline.

3. СОЗДАНИЕ ТЕОРИИ И МИКРОРАЗМЕТКА ДЛЯ «ЛОГО-ШТОРМА»:
   Создай файл $WORKTREE_DIR/src/content/lessons/${classSlug}/${lessonId}/theory.md.
   - Материал должен строго соответствовать учебной программе класса и профиля по теме «${topic}».
   - Соблюдай Zero-LaTeX Policy: формулы и обозначения оформляй чистым Unicode и тегами <sub> / <sup> (без синтаксиса $...$).
   - Разбей теорию на понятные дидактические разделы с примерами из реальной практики.
   - ПЕДАГОГИЧЕСКАЯ МИКРОРАЗМЕТКА ТЕРМИНОВ:
     Обязательно выдели от 5 до 12 ключевых понятий темы вместе с краткими определениями для тренажера «Лого-Шторм» через теги:
     <span data-term="Термин" data-definition="Краткое понятное определение термина...">Термин</span>
     или через YAML Frontmatter:
     ---
     sprintTerms:
       - term: "Термин"
         definition: "Краткое понятное определение термина..."
     ---
     Это активирует дидактический HUD-виджет и тренировку терминологической грамотности учащихся.
   - ВАЖНО: Раздел «Дополнительная информация» на данном этапе НЕ СОЗДАВАТЬ (он наполняется на этапе 5 под фактические механики тренажеров).

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл линтером: quick_lint(file_path="$WORKTREE_DIR/src/content/lessons/${classSlug}/${lessonId}/theory.md").
   - Зафиксируй изменения атомарным коммитом и отправь ветку:
     git -C "$WORKTREE_DIR" add "src/content/lessons/${classSlug}/${lessonId}/theory.md"
     git -C "$WORKTREE_DIR" commit -m "content(${classSlug}-${lessonId}): add comprehensive theory on ${topicSlug} with logo-storm markup"
     git -C "$WORKTREE_DIR" push -u origin ${branchName}`;
}

function generatePrompt2(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Убедись, что находишься в своем $WORKTREE_DIR на ветке ${branchName}. В ${PROD_DIR} ничего не меняй.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 1, UI-верстке, кривой сложности и API телеметрии.
   Изучи созданную теорию: $WORKTREE_DIR/src/content/lessons/${classSlug}/${lessonId}/theory.md.

3. РАЗРАБОТКА УРОВНЯ 1:
   Создай файл $WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level1.astro.
   - Ровно 3 фазы. Обертка в TaskLayout level={1}.
   - ZERO MULTIPLE CHOICE: категорически запрещен выбор из готовых вариантов, радиокнопки и селекты.
   - Только физические манипуляции мышью: D&D (Slot & Snap токенами), сортировка по корзинам, прямая правка ячеек сетки/ленты или коммутация связей.
   - Zero-Style и Zero-CDN: запрещены теги <style> и внешние CDN; используй только глобальные утилиты платформы и локальные ассеты /static/, строгий кибер-стиль (rounded-0, темный фон).
   - Хитбоксы кликабельных зон >= 48x48 px.
   - Процедурная генерация параметров на лету. При ошибке прогресс шагов не сбрасывается — выдается уведомление и через 1-1.5 сек генерируется новый вариант текущей фазы.
   - ЕДИНАЯ ТЕЛЕМЕТРИЯ (LMSTelemetry): используй встроенный в TaskLayout SDK \`window.LMSTelemetry.create({ missionName: 'Урок ${lessonId} :: ${topic} (Уровень 1)', level: 1, totalStages: 3 })\`:
     * отложенный \`start_time\` и \`time_spent_sec\` считаются автоматически с первого взаимодействия;
     * при переходе фаз вызывай \`telemetry.advanceStage(nextStage)\`;
     * при ошибке — \`telemetry.fail()\` (передает \`stage\`/\`total_stages\`);
     * при завершении — \`telemetry.complete()\`.
   - ${HARDCORE_PRINCE_COMPAT_NOTE}
   - Запрещено повторно навешивать \`addEventListener\` на постоянные элементы внутри \`init*\`.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Вызови quick_lint(file_path="$WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level1.astro").
   - Зафиксируй изменения атомарным коммитом и сделай push:
     git -C "$WORKTREE_DIR" add "src/pages/tasks/${classSlug}/${lessonId}/level1.astro"
     git -C "$WORKTREE_DIR" commit -m "feat(content): implement level 1 manipulation simulator for ${classSlug} lesson ${lessonId}"
     git -C "$WORKTREE_DIR" push origin ${branchName}`;
}

function generatePrompt3(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Работаем исключительно в $WORKTREE_DIR на ветке ${branchName}. В ${PROD_DIR} ничего не меняй.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 2, калибровке сложности (Sawtooth 2-1-2), UI-верстке и API телеметрии.

3. РАЗРАБОТКА УРОВНЯ 2:
   Создай файл $WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level2.astro.
   - Ровно 5 фаз. Обертка в TaskLayout level={2}.
   - ZERO MULTIPLE CHOICE: только ручной клавиатурный ввод в текстовые поля \`<input type="text" inputmode="decimal">\`.
   - ЗАПРЕТ \`<input type="number">\`: числовые/процентные поля обязаны принимать русскую запятую \`,\`, пробелы по краям и знак \`%\` (нормализация \`.replace('%','').replace(',','.').trim()\`).
   - Anti-Paste: платформа блокирует вставку, ответы рассчитываются учеником самостоятельно.
   - Прогрессия фаз Sawtooth 2-1-2: прямой расчет -> конвертация единиц -> пик инверсии -> долина консолидации -> кульминация без Fake Difficulty.
   - При ошибке: показ сбоя, вызов \`telemetry.fail()\` и процедурная генерация нового варианта текущей фазы.
   - ЕДИНАЯ ТЕЛЕМЕТРИЯ (LMSTelemetry): используй \`window.LMSTelemetry.create({ missionName: 'Урок ${lessonId} :: ${topic} (Уровень 2)', level: 2, totalStages: 5 })\` (\`advanceStage\`, \`fail\`, \`complete\`, отложенный \`start_time\`). Не дублируй \`addEventListener\` внутри \`init*\`.
   - ${HARDCORE_PRINCE_COMPAT_NOTE}
   - Zero-Style и Zero-CDN: никаких тегов <style> и внешних CDN.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл: quick_lint(file_path="$WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level2.astro").
   - Сделай атомарный коммит и push:
     git -C "$WORKTREE_DIR" add "src/pages/tasks/${classSlug}/${lessonId}/level2.astro"
     git -C "$WORKTREE_DIR" commit -m "feat(content): implement level 2 analytical simulator for ${classSlug} lesson ${lessonId}"
     git -C "$WORKTREE_DIR" push origin ${branchName}`;
}

function generatePrompt4(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ПРОВЕРКА ОКРУЖЕНИЯ:
   Работаем исключительно в $WORKTREE_DIR на ветке ${branchName}. В ${PROD_DIR} ничего не меняй.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по геймдизайну Уровня 3 (банк аркадных архетипов), UI-верстке и API телеметрии. Выбери подходящий архетип механики.

3. РАЗРАБОТКА УРОВНЯ 3:
   Создай файл $WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level3.astro.
   - Стек: Vue 3 (локальное подключение /static/vue.global.js, без внешних CDN).
   - Обертка: TaskLayout level={3}.
   - ОБЯЗАТЕЛЬНЫЙ ЭКРАН INTRO: при загрузке страницы показывается стартовый брифинг с кнопкой запуска («Начать» / «Запуск»). Таймер волн и отсчет времени НЕ запускаются до нажатия кнопки старта.
   - 8–12 процедурных волн (стандарт — 10 волн) с динамическим таймером и возрастающей сложностью.
   - Direct Manipulation: интерактивные зоны >= 48x48 px, поддержка горячих клавиш.
   - Звуковой отклик: Web Audio API (генерация звуковых сигналов без внешних файлов).
   - ЕДИНАЯ ТЕЛЕМЕТРИЯ И AFK-ЗАЩИТА (LMSTelemetry):
     * Подключи \`window.LMSTelemetry.create({ missionName: 'Урок ${lessonId} :: ${topic} (Уровень 3)', level: 3, totalWaves: 10, onAfkStop, onAfkRetry })\`.
     * Передавай \`telemetry.advanceWave(nextWave)\` и \`telemetry.complete()\`.
     * При ошибке или таймауте вызывай \`telemetry.fail({ wave, isTimeout })\`: включается сирена (#alarm-box) и ПРОГРЕСС ПОЛНОСТЬЮ СБРАСЫВАЕТСЯ НА ВОЛНУ 1 с перегенерацией волн.
     * AFK-защита волны 1: передавай \`isTimeout: true\` при истечении таймера, чтобы \`LMSTelemetry\` останавливал бесконечный цикл сбросов после 2 таймаутов волны 1 без действий ученика и показывал экран «Повторить».
     * Запрещено повторное навешивание \`addEventListener\` при перезапуске игры.
   - ${HARDCORE_PRINCE_COMPAT_NOTE}
   - Экспорт тестового хука: window.__DEV_LEVEL3_STATE__ = { waves, currentWaveIndex, currentWave, solveCurrentWave(), submitAction() }.
   - Zero-Style: никаких тегов <style>.

4. ВАЛИДАЦИЯ И КОММИТ:
   - Проверь файл: quick_lint(file_path="$WORKTREE_DIR/src/pages/tasks/${classSlug}/${lessonId}/level3.astro").
   - Сделай атомарный коммит и push:
     git -C "$WORKTREE_DIR" add "src/pages/tasks/${classSlug}/${lessonId}/level3.astro"
     git -C "$WORKTREE_DIR" commit -m "feat(content): implement level 3 arcade simulator for ${classSlug} lesson ${lessonId}"
     git -C "$WORKTREE_DIR" push origin ${branchName}`;
}

function generatePrompt5(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Продолжаем пошаговую разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. АНАЛИЗ ФАКТИЧЕСКИХ МЕХАНИК:
   Все 3 уровня задания уже созданы (level1.astro, level2.astro, level3.astro).
   Изучи их фактические алгоритмы, правила и форматы данных.

2. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по оформлению теоретических блоков и Zero-Leakage Policy.

3. ДОПОЛНЕНИЕ ТЕОРИИ:
   Отредактируй файл $WORKTREE_DIR/src/content/lessons/${classSlug}/${lessonId}/theory.md, добавив в конец раздел:
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
   - Вызови quick_lint(file_path="$WORKTREE_DIR/src/content/lessons/${classSlug}/${lessonId}/theory.md").
   - Сделай атомарный коммит и push:
     git -C "$WORKTREE_DIR" add "src/content/lessons/${classSlug}/${lessonId}/theory.md"
     git -C "$WORKTREE_DIR" commit -m "content(${classSlug}-${lessonId}): add comprehensive additional info sections for levels 1-3"
     git -C "$WORKTREE_DIR" push origin ${branchName}`;
}

function generatePrompt6(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Продолжаем разработку урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Активная ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗУЧЕНИЕ СТАНДАРТОВ:
   Ознакомься с AGENTS.md и открой актуальные инструкции по автоматическому тестированию, кривой сложности и симуляции цифровых персон. В качестве образца изучи соседние тесты в tests/.

2. СОЗДАНИЕ ТЕСТОВ:
   Создай тестовые спецификации в $WORKTREE_DIR/tests/:
   1. tests/lesson${classSlug}-${lessonId}-level1.spec.js и tests/lesson${classSlug}-${lessonId}-level1-student-personas.spec.js
   2. tests/lesson${classSlug}-${lessonId}-level2.spec.js и tests/lesson${classSlug}-${lessonId}-level2-student-personas.spec.js
   3. tests/lesson${classSlug}-${lessonId}-level3.spec.js и tests/lesson${classSlug}-${lessonId}-level3-student-personas.spec.js
   Зарегистрируй файлы \`*-student-personas.spec.js\` в скрипте \`"test:personas"\` в \`package.json\`.

   Обязательно протестируй:
   - Архитектурные контракты (Zero Multiple Choice, отсутствие <style> и внешних CDN, TaskLayout, подключение LMSTelemetry).
   - Сквозное прохождение всех фаз и волн с фиксацией событий телеметрии (\`start_time\`, \`time_spent_sec\`, \`stage\`/\`total_stages\`, \`wave\`/\`total_waves\`, \`level_complete\`, \`success: true\`).
   - Ошибочные сценарии: показ сбоя, \`hardcore_reset\` / \`level_fail\`, процедурная перегенерация, защита гейта хардкора (сброс не открывает бонус Prince of Persia), а в Уровне 3 — наличие экрана \`intro\` (таймер не тикает до старта) и AFK-защиту волны 1 (пауза и кнопка «Повторить» после 2 таймаутов).
   - Симуляцию цифровых персон учащихся через \`StudentSimulator\` (NOVICE, CARELESS с русской запятой и пробелами, CHAOS со спам-кликами и Anti-Paste, DILIGENT) и проверку сложности через \`DifficultyBenchmarker\` (CCS и Sawtooth 2-1-2).

3. ЗАПУСК И ОТЛАДКА (ALT Linux + agy-portable):
   - Категорически ЗАПРЕЩЕНО направлять тесты на боевой порт 3000.
   - При необходимости скопируй изолированную БД: \`cp "${PROD_DIR}/telemetry.db" "$WORKTREE_DIR/telemetry.db"\`.
   - Используй переменные для портативного agy:
     \`HOME="$REAL_HOME" PLAYWRIGHT_BROWSERS_PATH="$REAL_HOME/.cache/ms-playwright"\`
   - При параллельном worktree передай свободный порт \`BASE_URL=http://localhost:4322\` (или \`4321\` по умолчанию).
   - Обязательно прогони через run_compact_test:
     * \`STRICT_STANDARDS_AUDIT=1 npx playwright test tests/standards-audit.spec.js\`
     * \`npm run test:contracts\`
     * \`npm run test:integrity\`
     * тесты урока и персон (\`tests/lesson${classSlug}-${lessonId}-*.spec.js\`)
     * \`HOME="$REAL_HOME" npm run build\`
   - Останови все фоновые процессы dev-сервера перед завершением (No Orphan Daemons Policy).

4. КОММИТ И PUSH:
   git -C "$WORKTREE_DIR" add tests/lesson${classSlug}-${lessonId}-*.spec.js package.json "src/pages/tasks/${classSlug}/${lessonId}/"
   git -C "$WORKTREE_DIR" commit -m "test(content): add full e2e and student persona test suites for ${classSlug} lesson ${lessonId}"
   git -C "$WORKTREE_DIR" push origin ${branchName}`;
}

function generatePrompt7(className, classSlug, lessonId, topic, branchName) {
  return `Ты автономный ИИ-разработчик образовательной платформы School LMS (ALT Linux).
Финальный этап сдачи урока:
- Параллель: ${className} | Урок: ${lessonId} | Тема: «${topic}»
- Рабочий каталог: твой изолированный worktree на ext4 ($WORKTREE_DIR, по умолчанию ${DEFAULT_WORKTREE})
- Ветка: ${branchName}

ТВОИ ОБЯЗАТЕЛЬНЫЕ ДЕЙСТВИЯ:
1. ИЗУЧЕНИЕ РЕГЛАМЕНТА:
   Ознакомься с AGENTS.md и открой актуальный регламент сдачи PR, очистки окружения и обновления боевого сервера на ALT Linux.

2. СОЗДАНИЕ PULL REQUEST:
   Убедись, что все коммиты отправлены в origin и \`STRICT_STANDARDS_AUDIT=1 npx playwright test tests/standards-audit.spec.js\` пройден.
   Создай сводный PR через GitHub CLI:
   gh pr create --repo va2teen-git/sch-lms --base main --head ${branchName} --title "feat(content): урок ${classSlug} №${lessonId} «${topic}» — теория, тренажеры 1-3 и тесты" --body "## Описание изменений\\nКомплексная реализация урока ${className} №${lessonId} («${topic}»).\\n- Теория (theory.md) с разметкой Лого-Шторма и разделами дополнительной информации.\\n- Уровень 1: манипуляции мышью (3 фазы, LMSTelemetry).\\n- Уровень 2: аналитический ручной ввод (5 фаз, Sawtooth 2-1-2, LMSTelemetry).\\n- Уровень 3: аркадный тренажер (intro-экран, AFK-защита, LMSTelemetry).\\n- Полный набор E2E-тестов Playwright, цифровых персон и строгий аудит стандартов."

3. СЛИЯНИЕ В MAIN:
   Выполни слияние PR с удалением ветки:
   gh pr merge <PR_NUMBER> --repo va2teen-git/sch-lms --merge --delete-branch

4. ОЧИСТКА DEV-ОКРУЖЕНИЯ (ALT Linux):
   rm -f "$WORKTREE_DIR/node_modules"
   git -C "${PROD_DIR}" worktree remove "$WORKTREE_DIR" --force
   git -C "${PROD_DIR}" remote prune origin

5. ОБНОВЛЕНИЕ БОЕВОГО СЕРВЕРА (${PROD_DIR}):
   В каталоге ${PROD_DIR} выполни строго по регламенту:
   - git checkout main && git pull origin main
   - cp telemetry.db "telemetry.db.bak_$(date +%F_%H%M)"
   - node scripts/migrate_telemetry.js
   - HOME="$REAL_HOME" npm run build
   - Перезапуск systemd-сервиса (политика ALT Linux БЕЗ sudo):
     run-as-root "systemctl restart school-lms.service" "<пароль_root>"

6. ВЕРИФИКАЦИЯ РЕЛИЗА (SMOKE CHECK на порту 3000):
   ВАЖНО: на ALT Linux порт 8080 занят службой ahttpd, боевой school-lms.service работает на порту 3000.
   Через Python (с отключённым прокси \`urllib.request.ProxyHandler({})\`) или \`curl --noproxy '*'\` проверь код ответа HTTP 200:
   - http://127.0.0.1:3000/lesson/${classSlug}/${lessonId}
   - http://127.0.0.1:3000/tasks/${classSlug}/${lessonId}/level1
   - http://127.0.0.1:3000/tasks/${classSlug}/${lessonId}/level2
   - http://127.0.0.1:3000/tasks/${classSlug}/${lessonId}/level3
   - http://127.0.0.1:3000/courses
   - http://127.0.0.1:3000/teacher`;
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
