# API Телеметрии, Модель Данных и Аналитика

Образовательная платформа School LMS собирает гранулярную телеметрию прохождения интерактивных тренажеров в реальном времени. Архитектура сбора данных и аналитики спроектирована в соответствии с отраслевыми стандартами образовательной аналитики (**xAPI / Tin Can**, **IMS Caliper Analytics**).

---

## 1. Концепция и Нормализованная Модель Данных

Для обеспечения честной аналитики, поддержки межкурсовых срезов и отслеживания повторных прохождений (включая режим «Хардкор») модель данных строго разделяет четыре взаимосвязанные сущности:

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│         СУБЪЕКТ (Actor)        │       │    ОБЪЕКТ (Activity / Task)    │
├────────────────────────────────┤       ├────────────────────────────────┤
│ student_first_name             │       │ course_slug (программа курса)  │
│ student_last_name              │  ───► │ lesson_id (номер урока)        │
│ student_class (когорта ученика)│       │ level_number (уровень 1/2/3)   │
└────────────────────────────────┘       │ mission_name (название миссии) │
                                         └────────────────────────────────┘
                                                         │
                                                         ▼
┌────────────────────────────────┐       ┌────────────────────────────────┐
│      ПОПЫТКА / ЗАБЕГ (Run)     │       │  РЕЗУЛЬТАТ И КОНТЕКСТ (Context)│
├────────────────────────────────┤       ├────────────────────────────────┤
│ attempt_id (UUID / ID забега)  │  ───► │ action_type, status, success   │
│ attempt_number (порядковый №)  │       │ time_spent_sec, attempts_count │
│ attempt_mode (normal/hardcore) │       │ is_hardcore, action_log        │
└────────────────────────────────┘       │ timestamp                      │
                                         └────────────────────────────────┘
```

1. **Субъект (Actor):**
   * `student_first_name`, `student_last_name` — имя и фамилия учащегося.
   * `student_class` — **постоянная когорта / класс ученика** (например: `10-класс_углубленный`). Не изменяется при открытии уроков других параллелей.
2. **Объект (Object / Activity):**
   * `course_slug` — слаг учебной программы, к которой относится задание (`8-класс`, `10-класс_углубленный`, `11-класс_базовый` и др.).
   * `lesson_id` — номер урока в рамках учебного курса (`7`, `20` и т.д.).
   * `level_number` — номер уровня внутри урока (`1`, `2`, `3`).
   * `mission_name` — текстовое наименование миссии (`Урок 7 :: Логические высказывания (Уровень 1)`).
3. **Попытка / Забег (Attempt / Run):**
   * `attempt_id` — уникальный идентификатор сессии прохождения (например, `att_norm_1728892800123`).
   * `attempt_number` — порядковый номер попытки ученика на данном уроке (`1`, `2`, `3`...).
   * `attempt_mode` — режим прохождения попытки (`normal` — обычное прохождение с поуровневым сохранением; `hardcore` — режим «железного человека», где любая ошибка сбрасывает все уровни).
4. **Контекст и результаты (Context & Results):**
   * `action_type` — тип события (`in_progress`, `level_complete`, `level_fail`, `hardcore_reset`, `normal_reset`).
   * `status` — текущий статус (`in_progress`, `completed`, `failed`).
   * `success` — булевый флаг успешного завершения уровня (`1` / `0`).
   * `time_spent_sec` — чистое время работы над заданием в секундах.
   * `attempts_count` — число попыток / микро-ошибок в тренажере.
   * `is_hardcore` — булевый флаг хардкора (`1` / `0`).
   * `action_log` — структурированный лог микро-действий ученика (JSON-строка).
   * `timestamp` — время сохранения события в базе данных.

### Ключевые архитектурные принципы телеметрии:

* **Принцип несгораемого зачёта (Academic Mastery Retention):**
  Успешное завершение урока в стандартном режиме (`isNormalMastered: true`, `lessonStatus: 'completed'`) является необратимым учебным зачётом. Если после сдачи урока ученик нажимает «Пройти заново» или включает «Хардкор» и затем ошибается (вайп в хардкоре), его академический зачёт **никогда не сгорает**. В таблице учителя такой ученик остаётся сдавшим урок, а статус хардкора отражает результат его дополнительного челленджа.
* **Изоляция и дедупликация чистого активного времени (Pure Active Time):**
  Поскольку уровни урока загружаются параллельно в изолированных `iframe`, каждый тренажёр может слать общее время с момента открытия вкладки. Система производит дедупликацию времени внутри каждой попытки (вычитая время предшествующих уровней), а общее время вовлечённости ученика (`totalActiveTimeSec`) корректно суммирует чистое время по всем попыткам без завышений.
* **Разделение рекордов скорости (Best Time):**
  Система отдельно рассчитывает лучшее время сдачи в стандартном режиме (`bestNormalTimeSec`) и лучшее время безупречного забега в режиме хардкора (`bestHardcoreTimeSec`).

---

## 2. Схема Базы Данных (`telemetry.db`) и Индексы

Данные хранятся в файле SQLite `telemetry.db` в корне репозитория (исключен из git через `.gitignore`).

### DDL Таблицы:
```sql
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  class_name TEXT,
  student_class TEXT,
  course_slug TEXT,
  lesson_id TEXT,
  level_number INTEGER,
  mission_name TEXT,
  action_type TEXT,
  start_time TEXT,
  time_spent_sec INTEGER,
  attempts_count INTEGER,
  success BOOLEAN,
  status TEXT,
  action_log TEXT,
  is_hardcore BOOLEAN DEFAULT 0,
  attempt_id TEXT,
  attempt_number INTEGER DEFAULT 1,
  attempt_mode TEXT DEFAULT 'normal',
  stage_current INTEGER,
  stage_total INTEGER,
  wave_number INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS prince_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_class TEXT NOT NULL,
  course_slug TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  stage INTEGER NOT NULL,
  map_level INTEGER NOT NULL,
  time_spent_sec INTEGER DEFAULT 0,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(first_name, last_name, student_class, course_slug, lesson_id),
  UNIQUE(first_name, last_name, student_class, stage)
);
```
Два уникальных ограничения `UNIQUE` в `prince_progress` гарантируют на уровне БД:
* правило **«1 урок = 1 этап»** (`UNIQUE(first_name, last_name, student_class, course_slug, lesson_id)`);
* невозможность повторного зачёта одного и того же этапа кампании (`UNIQUE(first_name, last_name, student_class, stage)`).

### Индексы для высокопроизводительных срезов:
* `idx_telemetry_attempt` ON `telemetry(attempt_id)` — сверхбыстрая агрегация событий конкретного забега.
* `idx_telemetry_student_attempt` ON `telemetry(student_class, lesson_id, attempt_id)` — быстрый доступ к истории попыток ученика на уроке.
* `idx_telemetry_student_cohort` ON `telemetry(student_class, timestamp)` — поиск активности учеников конкретного класса во времени.
* `idx_telemetry_course_lesson` ON `telemetry(course_slug, lesson_id, timestamp)` — выборка результатов прохождения конкретного урока заданной программы.
* `idx_telemetry_sprint` ON `telemetry(course_slug, lesson_id, student_class, action_type)` — мгновенная выборка лучших результатов тренажера «Лого-Шторм».
* `idx_telemetry_student` ON `telemetry(class_name, last_name, first_name)` — легаси-совместимость.
* `idx_telemetry_timestamp` ON `telemetry(timestamp)` — срезы по датам уроков.
* `idx_telemetry_mission` ON `telemetry(mission_name)` — текстовый поиск по названиям.
* `idx_prince_progress_student` ON `prince_progress(first_name, last_name, student_class)` — мгновенная выборка этапов сквозной кампании ученика.
* `idx_prince_progress_lesson` ON `prince_progress(course_slug, lesson_id)` — привязка этапов Prince of Persia к конкретным урокам.

Благодаря композитным индексам API дашборда учителя исключает ресурсоемкие сканирования всей таблицы и эвристики на базе `GROUP BY COUNT(*)`.

---

## 3. Миграция Исторических Данных

Для обновления существующих баз данных создан скрипт [`scripts/migrate_telemetry.js`](../scripts/migrate_telemetry.js):

```bash
node scripts/migrate_telemetry.js
```

### Что делает скрипт миграции:
1. Добавляет колонки `student_class`, `course_slug`, `lesson_id`, `level_number`, `attempt_id`, `attempt_number`, `attempt_mode`, `stage_current`, `stage_total`, `wave_number` в таблицу `telemetry` (если их еще нет).
2. Создает композитные индексы `idx_telemetry_student_cohort`, `idx_telemetry_course_lesson`, `idx_telemetry_attempt`, `idx_telemetry_student_attempt` и `idx_telemetry_sprint`.
3. Анализирует исторические логи и определяет постоянный класс (`student_class`) для каждого ученика на основе его профиля активности (исключая временные переключения классов).
4. Идемпотентно дополняет пропущенные `course_slug`, `lesson_id` и `level_number` из `mission_name` и `courses.json` (сохраняя уже заполненные значения, включая `level_number = 0` для Лого-Шторма и Prince of Persia).
5. Выполняет идемпотентный бэкфилл `stage_current`, `stage_total` и `wave_number` из исторических записей `action_log` (`phase`, `step`, `wave`, `stage`, текстовых меток `Phase N` / `Wave N`).
6. Выполняет пакетное обновление изменённых строк в единой транзакции SQLite и выводит верификационную статистику.

> **Резервная копия:** Перед выполнением миграции рекомендуется создать копию базы `telemetry.db.bak` (шаблон `*.bak` добавлен в `.gitignore`).

---

## 4. Клиентский Контракт Тренажеров и Жизненный Цикл Попыток

Все интерактивные задания изолированы внутри `<iframe>`. Общение тренажера с платформой происходит через `window.parent.postMessage`. Платформа на уровне оболочки урока (`src/pages/lesson/[class]/[id].astro`) управляет сессиями прохождения и конечным автоматом попыток.

### 4.1 События прохождения (`TELEMETRY_EVENT`)
Отправляется тренажёром при старте уровня, периодически в процессе работы и в момент успешного решения:

```javascript
window.parent.postMessage({
    type: 'TELEMETRY_EVENT',
    mission_name: 'Урок 7 :: Логические высказывания (Уровень 1)', // Обязателен префикс "Урок X"
    action_type: 'level_complete', // 'in_progress', 'level_complete', 'level_fail', 'hardcore_reset', 'normal_reset'
    status: 'completed',           // 'in_progress', 'completed' или 'failed'
    start_time: new Date(startTime).toISOString(),
    time_spent_sec: 45,            // Секунд с начала уровня
    attempts_count: 1,             // Количество попыток/ошибок
    success: true,                 // true только при успешном завершении уровня
    stage: 3,                      // Текущая фаза/этап (1..total_stages)
    total_stages: 3,               // Всего фаз/этапов на уровне
    wave: 10,                      // Для Уровня 3: текущая волна
    total_waves: 10,               // Для Уровня 3: всего волн
    action_log: [{ time: '...', action: 'step_done' }] // Опционально
}, '*');
```

> **Обогащение контекстом и активный таймер оболочки:** Платформа в `src/pages/lesson/[class]/[id].astro` перехватывает сообщение, добавляет `student_class`, `course_slug`, `lesson_id`, `attempt_id`, `attempt_number`, `attempt_mode`, а также управляет активным таймером вкладки. Отсчёт `active_tab`-времени уровня начинается **только после первого реального взаимодействия ученика внутри `iframe-N`** (`pointerdown` / `keydown` или первого игрового события), чтобы время чтения теории слева не попадало в Уровень 1.

#### 4.1.1 Единый клиентский хелпер `public/static/lms-telemetry.js`
Для стандартизации тренажёров и исключения дублирования логики времени в `TaskLayout.astro` автоматически подключается легковесный скрипт `/static/lms-telemetry.js`, экспортирующий `window.LMSTelemetry`:

```javascript
const telemetry = window.LMSTelemetry.create({
  missionName: 'Урок 8 :: Логические операции (Уровень 3)',
  level: 3,            // 1, 2 или 3
  totalWaves: 10,      // Для Ур.1 по умолч. 3, для Ур.2 — 5, для Ур.3 — 10
  onAfkStop: () => { /* опционально: пауза игры на экране «Повторить» */ },
  onAfkRetry: () => { /* опционально: перезапуск волны 1 по кнопке «Повторить» */ }
});
```

* **Отложенный `start_time`:** `start_time` фиксируется только при первом реальном действии (`pointerdown`/`keydown`) или явном вызове `telemetry.start()` — время скрытого монтажа `iframe` и чтения теории не учитывается.
* **Методы прогресса и завершения:**
  * `telemetry.advanceStage(nextStage)` / `telemetry.advanceWave(nextWave)` — обновляет этап/волну и отправляет `in_progress`.
  * `telemetry.fail({ wave, isTimeout, actionType })` (алиасы `hardcoreReset`, `levelFail`) — увеличивает `attempts_count` и отправляет сброс/ошибку с текущей волной/этапом.
  * `telemetry.complete()` — отправляет `level_complete` со встроенной защитой от повторной отправки.
* **AFK-защита волны 1 (Уровень 3):** после 2 подряд таймаутов волны 1 (`isTimeout: true` без действий ученика) хелпер блокирует дальнейший спам `level_fail`/`hardcore_reset`, переводит игру в состояние паузы (`isAfkPaused`) и отображает кнопку **«Повторить»** (либо вызывает `onAfkStop`).

### 4.2 Событие «Лого-Шторм» (`action_type: 'sprint_complete'`)
Отправляется клиентом урока по завершении скоростного набора ключевых терминов:
```javascript
{
  student_class: "10-a",
  course_slug: "10-класс_углубленный",
  lesson_id: "27",
  action_type: "sprint_complete",
  level_number: 0,
  status: "completed",
  time_spent_sec: 44,
  attempts_count: 1,
  success: true,
  action_log: JSON.stringify({
    cpm: 265,
    wpm: 53,
    accuracy: 98.5,
    chars_count: 194,
    terms_count: 7,
    errors_count: 2
  })
}
```
* `level_number: 0` указывает, что событие относится к общему мини-тренажеру урока, а не к трем базовым уровням задач.
* Повторные фиксации результатов не затирают предыдущие строки в `telemetry`, а агрегатор дашборда отбирает лучший результат по скорости набора (`cpm`), сохраняя также время и точность.
* **Лидерборд Топ-10:** Клиент «Лого-Шторма» запрашивает рейтинг лучших результатов через `GET /api/teacher/stats?course=all&lesson=all&date=all&exclude_tests=1`, фильтрует учеников со скоростью набора и временем, сортирует по скорости в знаках в минуту (`зн/мин`) по убыванию и отображает топ-10 лучших спринтеров по всей школе за все время с указанием класса, скорости (`зн/мин` и `сл/мин`).
* **Отображение в панели учителя (`/teacher`):** В колонке «⚡ Лого-Шторм» выводятся показатели скорости (`зн/мин` и `сл/мин`), а при сортировке учащиеся упорядочиваются по скорости набора.

### 4.3 Конечный Автомат Попыток (Client-Side Attempt State Machine)
В браузере ученика текущая попытка сохраняется в `sessionStorage` по ключу `lms_attempt_${classSlug}_${lessonId}`:
```json
{
  "attemptId": "att_1728893120155_abc12",
  "attemptNumber": 1,
  "mode": "normal"
}
```

Управление попытками происходит по следующим правилам:
1. **Первый вход на урок:**
   Если в `sessionStorage` нет активной попытки, генерируется `attempt_number: 1` с режимом `attempt_mode: 'normal'` (или `'hardcore'`, если переключатель хардкора был включен до старта).
2. **Кнопка «Пройти заново» (`#reset-lesson-btn`):**
   * Отправляет в телеметрию событие сброса `action_type: 'normal_reset'`.
   * Создает новую попытку с инкрементом порядкового номера (`attempt_number: N + 1`) и режимом `normal`.
   * Перезагружает `<iframe>` уровней для решения с чистого листа.
   * **Важно:** ранее полученный зачёт урока («Несгораемый зачёт») сохраняется в учительской базе.
3. **Переключение тумблера «Режим Хардкора»:**
   * При активации хардкора платформа немедленно стартует новую попытку в режиме `hardcore` (`attempt_mode: 'hardcore'`).
   * Если ученик выключает хардкор обратно, стартует новая попытка в режиме `normal`.
4. **Фатальная ошибка в режиме хардкора (`hardcore_reset`):**
   * При возникновении критической ошибки тренажёр шлет событие `hardcore_reset`.
   * Если режим хардкора включен, текущая попытка ученика помечается как проваленная (`status: 'failed'`).
   * Платформа сбрасывает все `<iframe>` на уровень 1, инициирует новую попытку с инкрементом `attempt_number: N + 1` и режимом `hardcore`.
   * Заработанный ранее зачёт урока в обычном режиме остаётся неизменным.
5. **Локальный сброс уровня / аркадный провал (`level_fail`):**
   * Применяется в динамических или аркадных уровнях (например, в Уровне 3 с таймером и шкалой жизней HP при поражении).
   * Отправляет событие `action_type: 'level_fail'`, фиксируя локальную ошибку и сброс текущего раунда уровня.
   * **Не сбрасывает** ранее пройденные уровни (1 и 2) и **не инкрементирует** глобальный номер попытки (`attempt_number`), оставаясь внутри текущего забега.
   * Таймер раунда тренажера сбрасывается и перезапускается в `startGame()`, что предотвращает паразитное накопление астрономического времени или учет времени до нажатия кнопки старта.
6. **Разделение механик сброса (Hardcore Reset vs Level Reset):**
   * Механика `hardcore_reset` предназначена **исключительно** для режима «Хардкор» (`is_hardcore: true`).
   * Если тренажёр ошибочно отправляет `hardcore_reset` при выключенном режиме хардкора, платформа автоматически понижает событие до локального сброса уровня (`level_fail`), предотвращая ложное обнуление уроков и создание паразитных хардкор-попыток в обычном режиме.

---

## 5. Спецификация HTTP API

### 5.1 Отправка Телеметрии: `POST /api/telemetry`
Принимает JSON-объект события телеметрии.

**Заголовки:** `Content-Type: application/json`

**Тело запроса:**
```json
{
  "student_firstName": "Иван",
  "student_lastName": "Иванов",
  "student_class": "10-класс_углубленный",
  "course_slug": "8-класс",
  "lesson_id": "7",
  "level_number": 1,
  "mission_name": "Урок 7 :: Логические высказывания (Уровень 1)",
  "action_type": "level_complete",
  "status": "completed",
  "time_spent_sec": 65,
  "attempts_count": 1,
  "success": true,
  "is_hardcore": false,
  "attempt_id": "att_1728893120155_abc12",
  "attempt_number": 1,
  "attempt_mode": "normal",
  "stage": 3,
  "total_stages": 3,
  "wave": null,
  "total_waves": null,
  "action_log": []
}
```

**Особенности обработки бэкендом:**
* Если `level_number` не передан явно, он автоматически парсится из `mission_name` (`Уровень 1` -> `1`, `Уровень 2` -> `2`, `Уровень 3` -> `3`).
* Поля `stage_current` / `stage_total` / `wave_number` заполняются из `stage_current ?? stage ?? phase ?? step ?? wave`, `stage_total ?? total_stages ?? total_phases ?? total_waves` и `wave_number ?? wave`.
* Если `lesson_id` не передан, он извлекается из регулярного выражения `Урок (\d+)`.
* Если `course_slug` не передан, используется `student_class`.
* В колонку `class_name` записывается `student_class` для сохранения совместимости.
* Ограничение времени: `time_spent_sec` валидируется в диапазоне от `0` до `86400` секунд.
* **Обработка зачёта кампании Prince of Persia (`action_type: 'prince_complete'`):** сервер в транзакции проверяет, что урок честно пройден в режиме «Хардкор» (`isHardcoreCompleted`, иначе `403`), проверяет правило «1 урок = 1 этап» (повторный запрос того же этапа идемпотентно возвращает `200 { success: true, idempotent: true, stage, mapLevel }`, попытка сдать другой этап или карту на том же уроке отклоняется с `409 Conflict`), проверяет соответствие следующему незавершённому этапу в `src/data/prince-campaign.json` и записывает событие в `telemetry` и `prince_progress`.

**Ответ:** `200 OK` `{"success": true}` (для `prince_complete` — `{"success": true, "idempotent": false, "stage": 1, "mapLevel": 1}`) или `400 / 403 / 409 / 500`.

---

### 5.2 Проверка Прогресса Ученика: `GET /api/progress`
Используется при открытии страницы урока для проверки открытых уровней и статуса прохождения.

**Query-параметры:**
* `firstName` (string, обязательный) — имя ученика.
* `lastName` (string, обязательный) — фамилия ученика.
* `className` (string, обязательный) — класс ученика.
* `lessonPrefix` (string, обязательный) — префикс урока, например `Урок 7`.
* `courseSlug` (string, опциональный) — слаг курса задания, например `8-класс`.
* `lessonId` (string, опциональный) — номер урока задания, например `7`.

**SQL-логика:**
Выборка производится с защитой от изменения класса и изоляцией одноимённых номеров уроков между курсами (fallback по `mission_name` срабатывает только при пустом `course_slug`, а строки бонусного модуля `Prince of Persia` учитываются отдельно в `princeCompleted` и не засчитываются в уровни `1..3` урока):
```sql
SELECT action_type, mission_name, is_hardcore 
FROM telemetry 
WHERE (first_name = ? AND last_name = ?)
  AND (student_class = ? OR class_name = ?)
  AND (
    (course_slug = ? AND lesson_id = ?)
    OR (
      (course_slug IS NULL OR course_slug = '')
      AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)
    )
  )
ORDER BY timestamp ASC
```

**Ответ:**
```json
{
  "unlockedNormal": 2,
  "unlockedHardcore": 1,
  "isNormalCompleted": false,
  "isHardcoreCompleted": false,
  "princeCompleted": false,
  "princeProgress": {
    "eligibleForHardcoreBonus": false,
    "lessonStageCompleted": null,
    "lessonMapLevel": null,
    "completedStages": [1, 2],
    "totalStages": 18,
    "nextStage": {
      "stage": 3,
      "mapLevel": 3,
      "title": "Катакомбы Скелета"
    },
    "campaignFinished": false
  }
}
```
Поле `princeProgress` формируется из таблицы `prince_progress` и конфигурации `src/data/prince-campaign.json`:
* `eligibleForHardcoreBonus` — честный статус хардкор-зачёта на данном уроке (`isHardcoreCompleted`);
* `lessonStageCompleted` / `lessonMapLevel` — номер этапа и карты, уже закрытых в текущем `(courseSlug, lessonId)` (или `null`);
* `completedStages` — отсортированный массив всех пройденных учеником этапов кампании;
* `totalStages` — общее количество этапов кампании;
* `nextStage` — объект следующего невыполненного этапа (`{ stage, mapLevel, title }`) либо `null`, если кампания завершена;
* `campaignFinished` — `true`, если пройдены все этапы кампании.
* `princeCompleted` равен `true`, если бонус завершён по данным телеметрии урока или присутствует `lessonStageCompleted !== null` в `prince_progress`.

---

### 5.2.1 Сводка Прогресса для Матрицы Уроков: `GET /api/matrix-progress`
Используется на странице `/courses` для отображения индивидуального прогресса ученика сразу по всем курсам и урокам матрицы.

**Query-параметры:**
* `firstName` (string, обязательный) — имя ученика.
* `lastName` (string, обязательный) — фамилия ученика.
* `className` (string, обязательный) — постоянный класс ученика (`student_class`).

**Логика агрегации:**
* События группируются по ключу `${course_slug}::${lesson_id}` в хронологическом порядке (`ORDER BY timestamp ASC, id ASC`).
* Сдача всех 3 уровней фиксирует необратимые флаги `completed` (обычный/хардкор) и `hardcoreCompleted`.
* Если урок ещё не пройден до конца (`completed: false`), но зафиксирована активность (`level_complete`, `level_fail`, `hardcore_reset`, `normal_reset` или `in_progress` с `time_spent_sec > 0`), вычисляется `stoppedLevel` (`1`, `2` или `3`) — уровень, на котором остановился ученик.
* Отдельно от уровней `1..3` отслеживаются `princeCompleted` (завершение бонусного уровня `Prince of Persia`), `princeStage` (номер этапа кампании из `prince_progress`, закрытого на данном уроке, либо `null`) и `sprintCompleted` (завершение `sprint_complete` в Лого-Шторме).
* Корневой объект `princeCampaign` содержит сквозной прогресс ученика по всей кампании: `{ completedCount, totalStages, currentStage }` (где `currentStage` — номер следующего доступного этапа или `null` по завершении кампании).

**Ответ:**
```json
{
  "success": true,
  "lessons": {
    "7-класс::7": {
      "completed": true,
      "hardcoreCompleted": true,
      "princeCompleted": true,
      "princeStage": 1,
      "sprintCompleted": true,
      "stoppedLevel": 0
    },
    "11-класс_углубленный::33": {
      "completed": false,
      "hardcoreCompleted": false,
      "princeCompleted": false,
      "princeStage": null,
      "sprintCompleted": false,
      "stoppedLevel": 2
    }
  },
  "princeCampaign": {
    "completedCount": 1,
    "totalStages": 18,
    "currentStage": 2
  }
}
```

---

### 5.3 Аналитика и Мониторинг Учителя: `GET /api/teacher/stats`
Возвращает агрегированные KPI и матрицу результатов учащихся в реальном времени.

**Query-параметры:**
* `class` (string): слаг класса учеников, список через запятую (например, `10-класс_углубленный,11-класс_углубленный`) или `all`.
* `course` (string): программа учебного задания (`8-класс`, `10-класс_углубленный` и др.) или `all`.
* `lesson` (string): номер урока (`7`, `20`) или префикс (`Урок 7`), либо `all`.
* `date` (string): `today`, `all` или конкретная дата `YYYY-MM-DD`.
* `exclude_tests` (string/boolean): `1` / `true` — исключать тестовые аккаунты (`Unknown`, `Тест`, `11-ИТ`).
* `search` (string): поиск по подстроке имени или класса.

**Пример прямого быстрого SQL-запроса:**
```sql
SELECT id, first_name, last_name, class_name, mission_name, action_type,
       time_spent_sec, attempts_count, success, status, action_log,
       is_hardcore, student_class, course_slug, lesson_id, level_number, timestamp
FROM telemetry
WHERE 1=1
  AND DATE(timestamp) = ?
  AND COALESCE(student_class, class_name) IN (?, ?)
  AND course_slug = ?
  AND (lesson_id = ? OR ((lesson_id IS NULL OR lesson_id = '') AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)))
ORDER BY timestamp ASC;
```

**Формат ответа:**
```json
{
  "success": true,
  "students": [
    {
      "key": "10-класс_углубленный_иванов_иван",
      "displayName": "Иванов Иван",
      "firstName": "Иван",
      "lastName": "Иванов",
      "className": "10-класс_углубленный",
      "levels": {
        "1": { "status": "completed", "timeSpentSec": 45, "errors": 0, "completed": true, "hardcore": false },
        "2": { "status": "completed", "timeSpentSec": 120, "errors": 1, "completed": true, "hardcore": false },
        "3": { "status": "completed", "timeSpentSec": 60, "errors": 0, "completed": true, "hardcore": false }
      },
      "attemptsCount": 2,
      "normalAttemptsCount": 1,
      "hardcoreAttemptsCount": 1,
      "isNormalMastered": true,
      "isHardcoreLegend": false,
      "hardcoreStatus": "failed",
      "lessonStatus": "completed",
      "bestNormalTimeSec": 225,
      "bestHardcoreTimeSec": null,
      "totalActiveTimeSec": 310,
      "totalErrors": 2,
      "isActiveNow": true,
      "princeCompleted": false,
      "princeBestTimeSec": null,
      "princeLevels": [],
      "princeCampaignCompleted": 1,
      "princeCampaignTotal": 18,
      "princeStages": [
        {
          "stage": 1,
          "mapLevel": 1,
          "courseSlug": "8-класс",
          "lessonId": "7",
          "timeSpentSec": 94,
          "completedAt": "2026-10-14 08:12:00"
        }
      ],
      "lastCourseSlug": "8-класс",
      "lastLessonId": "7",
      "workedLessons": [
        { "courseSlug": "8-класс", "lessonId": "7" }
      ],
      "currentAttempt": {
        "attemptId": "att_hc_1728893190111",
        "attemptNumber": 2,
        "mode": "hardcore",
        "status": "failed",
        "courseSlug": "8-класс",
        "lessonId": "7",
        "totalTimeSec": 85
      },
      "attempts": [
        {
          "attemptId": "att_norm_1728892800123",
          "attemptNumber": 1,
          "mode": "normal",
          "status": "completed",
          "courseSlug": "8-класс",
          "lessonId": "7",
          "princeCompleted": false,
          "princeBestTimeSec": null,
          "startedAt": "2026-10-14 08:00:00",
          "lastActiveAt": "2026-10-14 08:05:00",
          "totalTimeSec": 225,
          "errorsCount": 1,
          "completedLevelsCount": 3,
          "levels": {
            "1": { "status": "completed", "timeSpentSec": 45, "errors": 0, "completed": true },
            "2": { "status": "completed", "timeSpentSec": 120, "errors": 1, "completed": true },
            "3": { "status": "completed", "timeSpentSec": 60, "errors": 0, "completed": true }
          }
        },
        {
          "attemptId": "att_hc_1728893190111",
          "attemptNumber": 2,
          "mode": "hardcore",
          "status": "failed",
          "startedAt": "2026-10-14 08:06:00",
          "lastActiveAt": "2026-10-14 08:07:25",
          "totalTimeSec": 85,
          "errorsCount": 1,
          "completedLevelsCount": 1,
          "levels": {
            "1": { "status": "completed", "timeSpentSec": 50, "errors": 0, "completed": true },
            "2": { "status": "reset", "timeSpentSec": 35, "errors": 1, "completed": false },
            "3": { "status": "not_started", "timeSpentSec": 0, "errors": 0, "completed": false }
          }
        }
      ]
    }
  ],
  "kpi": {
    "totalStudents": 28,
    "completedCount": 19,
    "hardcoreCount": 8,
    "princeCount": 3,
    "inProgressCount": 7,
    "avgTimeSec": 340,
    "totalErrors": 24
  },
  "availableDates": ["2026-10-14", "2026-10-13"],
  "classes": [...]
}
```
> **Сквозной прогресс кампании Prince of Persia в `students[]`:** поля `princeCampaignCompleted`, `princeCampaignTotal` и массив `princeStages` (`stage`, `mapLevel`, `courseSlug`, `lessonId`, `timeSpentSec`, `completedAt`) формируются из таблицы `prince_progress` по всем урокам ученика (не ограничиваются текущим фильтром `course`/`lesson` и `date`, но учитывают фильтры `class` и `exclude_tests`).

### 5.4 Алгоритм Вычисления Метрик и Статусов
1. **Партиционирование попыток:**
   События группируются по `attempt_id`. Для исторических записей без `attempt_id` сервер производит автоматическое виртуальное секционирование: изменение признака хардкора или получение события `normal_reset` / `hardcore_reset` переводит события в следующую виртуальную попытку.
2. **Дедупликация времени уровней внутри попытки:**
   Если `iframe` уровней запущены одновременно на странице, таймеры в них накапливаются параллельно. Для корректного подсчета чистого времени уровня 2 из его показаний вычитается время завершения уровня 1 (если разница старта `< 60 сек`).
3. **Сохранение академического зачёта:**
   Если хотя бы в одной нормальной попытке все 3 уровня завершены (`completed`), поле `isNormalMastered` устанавливается в `true`, а `lessonStatus` фиксируется как `'completed'` (или `'hardcore_completed'`, если завершён хардкор-забег). Последующие сбросы или провалы в хардкоре не могут понизить этот статус.
4. **Суммарное активное время (`totalActiveTimeSec`):**
   Рассчитывается как сумма чистых времён (`totalTimeSec`) всех зафиксированных попыток ученика.

---

## 6. Пользовательские Интерфейсы

### 6.1 Личный Кабинет Ученика (`/courses`) — Матрица Уроков
* После авторизации на `/` загружается **минималистичная компактная матрица всех курсов и уроков** (`#lessons-matrix`), а не только список уроков класса ученика.
* **Структура и навигация:**
  * Строки отсортированы в естественном порядке классов (`7 кл`, `8 кл`, `9 кл`, `10 баз`, `10 угл`, `11 баз`, `11 угл`) с закреплённым узким заголовком строки слева.
  * Столбцы выстроены по номерам уроков; матрица перематывается вправо (`overflow-x: auto`) и вниз при нехватке высоты экрана (`overflow-y: auto`).
  * В каждой карточке (`144×60 px`) отображаются короткое название класса, порядковый номер (`№N`) и краткое название темы (полная тема — в `title`).
  * При открытии урока любого другого класса (например, ученик `11-класс_углубленный` открывает урок `7-класс` №7) **профиль ученика не сбрасывается**: `student_class` в `localStorage` остаётся неизменным, а в телеметрию передаётся пара `(student_class, course_slug)`.
* **Цветовая индикация и эмоджи-достижения (`GET /api/matrix-progress`):**
  * Если урок **не пройден до конца**, карточка окрашивается в цвет уровня, на котором остановился ученик (в соответствии с `docs/ui-styling.md`):
    * **Уровень 1** — зелёный (`bg-emerald-50`, `border-emerald-500`, бейдж `Ур.1`);
    * **Уровень 2** — жёлтый/оранжевый (`bg-amber-50`, `border-amber-500`, бейдж `Ур.2`);
    * **Уровень 3** — красный (`bg-red-50`, `border-red-500`, бейдж `Ур.3`).
  * Если урок **пройден полностью** (сданы 3 уровня) — карточка подсвечивается голубой рамкой (`bg-sky-50`, `border-sky-600`) и отображает эмоджи **`✅`**.
  * Дополнительные эмоджи-достижения на карточке:
    * **`💀`** — урок пройден в режиме Хардкор;
    * **`⚔️`** / **`⚔️ Эт. N`** — пройден этап сквозной кампании Prince of Persia (при наличии `princeStage` выводится номер закрытого в уроке этапа);
    * **`⚡`** — пройден хотя бы 1 раз Лого-Шторм.
  * В верхней панели страницы `/courses` отображается суммарный счётчик сквозной кампании ученика **`⚔️ Принц: K / M этапов`**.

### 6.2 Панель Мониторинга Учителя (`/teacher`)
* **Фильтры тулбара:**
  1. **«Классы учащихся»:** мультивыбор когорт через чекбоксы (позволяет сформировать единый рейтинг для нескольких параллелей).
  2. **«Курс задания»:** выбор учебной программы задания (`#filter-course`).
  3. **«Урок»:** выпадающий список тем, динамически обновляемый в зависимости от выбранного курса задания. При `course = 'all'` опции курсов кодируются в уникальном формате `${courseSlug}::Урок ${lessonId}`, благодаря чему выбор урока чужого класса точно фильтрует и `course`, и `lesson`.
  4. **«Дата»:** фильтр по датам с поддержкой «Сегодня».
* **Кросс-курсовые бейджи и ачивка Prince of Persia:**
  * В колонке «Статус урока», в раскрывающихся подстроках забегов (`.attempt-subrow`) и в карточках попыток модального окна отображаются бейджи пройденных курсов/уроков (`workedLessons`); прохождения уроков других классов (`courseSlug !== className`) выделяются индиго-бейджем **`🔀 <курс> • Ур. <N>`**.
  * При прохождении бонусного уровня Prince of Persia отображается золотой бейдж **`⚔️ Принц Персии`** в таблице, **`⚔️ Принц`** в подстроке забега, отдельная колонка **`⚔️ Принц`** (`⚔️ K/M`) с сортировкой по числу закрытых этапов кампании, подробный список пройденных этапов с привязкой к урокам в модальном окне деталей ученика, а также колонки `Принц Персии` и `Прогресс Принца` (`K/M`) в экспорте CSV.
* **Интуитивно понятные метрики времени:**
  * **«Время решения»** (`bestNormalTimeSec` / лучшее чистое время сданного урока) — эффективное чистое время выполнения заданий учеником до успешной сдачи.
  * **«Был на уроке»** (`totalActiveTimeSec` / суммарное активное время) — общее астрономическое время активности ученика по всем попыткам (включая повторные прохождения и хардкор).
* **Раскрывающийся список забегов в строке таблицы (Master-Detail Accordion):**
  * В колонке «Попытки» размещена интерактивная кнопка-аккордеон (`▶` / `▼`) с числом попыток ученика.
  * При клике на кнопку строка учащегося плавно раскрывается, отображая встроенную таблицу (`.attempt-subrow`) со всеми забегами ученика:
    * Номер забега (`Забег #1`, `#2`...).
    * Режим забега (обычный зачет `Normal` или челлендж `Hardcore`) и бейдж `⚔️ Принц` при наличии победы в бонусном уровне.
    * Курс и номер урока забега (`courseSlug • Ур. lessonId`).
    * Итоговый статус забега («Сдан», «В процессе», «Ошибка»).
    * Чистое время забега и число допущенных ошибок.
    * Поуровневый срез с индикацией времени и статуса каждого уровня (1, 2, 3).
  * Состояние раскрытых строк сохраняется при автоматическом фоновом обновлении данных каждые 5 секунд (`expandedStudentKeys`).
* **Мульти-сортировка таблицы:**
  * Клик по заголовку сортирует по одной колонке.
  * Клик с удержанием клавиши `Ctrl` или `Shift` включает многоколоночную сортировку с визуальными индикаторами приоритета (`#1`, `#2`).
* **Отображение попыток и двойного статуса:**
  * Бейдж счётчика попыток рядом с именем ученика (`1 забег`, `2 забега`...).
  * Раздельное отражение статуса прохождения обычного режима и статуса хардкора (бейджи «Зачёт», «Хардкор сдан», «Хардкор ошибка»).
* **Модальное окно детальной информации о попытках:**
  * При клике на строку или кнопку «Детали» открывается карточка ученика с интерактивной секцией **«История забегов (Попытки прохождения)»** и карточками уровней/достижений (включая `⚡ Лого-Шторм` и `⚔️ Prince of Persia`).
  * Для каждой попытки отображается карточка с режимом (Normal / Hardcore), итоговым статусом, затраченным чистым временем, количеством ошибок и поуровневыми бейджами прогресса.
* **Живой мониторинг (Live Polling):** автоматический опрос каждые 5 секунд с индикатором сетевой активности и кнопкой паузы.
* **Экспорт в CSV:** выгрузка таблицы результатов в формат CSV со структурированными колонками («Ученик», «Класс», «Курс / Урок», «Статус урока», «Забеги (всего)», «Забеги (хардкор)», «Уровень 1/2/3», «Лого-Шторм», «Время решения (сек)», «Был на уроке», «Хардкор», «Принц Персии», «Прогресс Принца», «Детали забегов»).
