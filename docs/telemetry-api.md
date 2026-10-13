# API Телеметрии, Модель Данных и Аналитика

Образовательная платформа School LMS собирает гранулярную телеметрию прохождения интерактивных тренажеров в реальном времени. Архитектура сбора данных и аналитики спроектирована в соответствии с отраслевыми стандартами образовательной аналитики (**xAPI / Tin Can**, **IMS Caliper Analytics**).

---

## 1. Концепция и Нормализованная Модель Данных

Для обеспечения честной аналитики и поддержки межкурсовых срезов (например, когда 10-й инженерный класс решает олимпиадные или повторительные задания из курса 8-го класса) модель данных строго разделяет три независимые сущности:

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
                                         ┌────────────────────────────────┐
                                         │  РЕЗУЛЬТАТ И КОНТЕКСТ (Context)│
                                         ├────────────────────────────────┤
                                         │ action_type, status, success   │
                                         │ time_spent_sec, attempts_count │
                                         │ is_hardcore, action_log        │
                                         │ timestamp                      │
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
3. **Контекст и результаты (Context & Results):**
   * `action_type` — тип события (`in_progress`, `level_complete`, `hardcore_reset`, `normal_reset`).
   * `status` — текущий статус (`in_progress`, `completed`).
   * `success` — булевый флаг успешного завершения уровня (`1` / `0`).
   * `time_spent_sec` — чистое время работы над заданием в секундах.
   * `attempts_count` — число попыток / ошибок.
   * `is_hardcore` — признак включенного хардкор-режима (`1` / `0`).
   * `action_log` — структурированный лог микро-действий ученика (JSON-строка).
   * `timestamp` — время сохранения события в базе данных.
4. **Обратная совместимость:**
   * Колонка `class_name` сохранена в таблице SQLite и при записи автоматически дублирует значение `student_class`.

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
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Индексы для высокопроизводительных срезов:
* `idx_telemetry_student_cohort` ON `telemetry(student_class, timestamp)` — быстрый поиск активности учеников конкретного класса во времени.
* `idx_telemetry_course_lesson` ON `telemetry(course_slug, lesson_id, timestamp)` — выборка результатов прохождения конкретного урока заданной программы.
* `idx_telemetry_student` ON `telemetry(class_name, last_name, first_name)` — легаси-совместимость.
* `idx_telemetry_timestamp` ON `telemetry(timestamp)` — срезы по датам уроков.
* `idx_telemetry_mission` ON `telemetry(mission_name)` — текстовый поиск по названиям.

Благодаря композитным индексам API дашборда учителя исключает ресурсоемкие сканирования всей таблицы и эвристики на базе `GROUP BY COUNT(*)`.

---

## 3. Миграция Исторических Данных

Для обновления существующих баз данных создан скрипт [scripts/migrate_telemetry.js](file:///D:/school-lms/scripts/migrate_telemetry.js):

```bash
node scripts/migrate_telemetry.js
```

### Что делает скрипт миграции:
1. Добавляет колонки `student_class`, `course_slug`, `lesson_id`, `level_number` в таблицу `telemetry` (если их еще нет).
2. Создает композитные индексы `idx_telemetry_student_cohort` и `idx_telemetry_course_lesson`.
3. Анализирует исторические логи и определяет постоянный класс (`student_class`) для каждого ученика на основе его профиля активности (исключая временные переключения классов).
4. Разбирает существующие строки `mission_name` и сопоставляет темы с курсами (`courses.json`), извлекая номер урока и номер уровня.
5. Выполняет пакетное обновление строк в единой транзакции SQLite.
6. Выводит верификационную статистику обновленных записей.

> **Резервная копия:** Перед выполнением миграции рекомендуется создать копию базы `telemetry.db.bak` (шаблон `*.bak` добавлен в `.gitignore`).

---

## 4. Клиентский Контракт Тренажеров (`postMessage`)

Все интерактивные задания изолированы внутри `<iframe>`. Общение тренажера с платформой происходит исключительно через `window.parent.postMessage`.

### 4.1 События прохождения (`TELEMETRY_EVENT`)
Отправляется при старте уровня, периодически в процессе работы и в момент успешного решения:

```javascript
window.parent.postMessage({
    type: 'TELEMETRY_EVENT',
    mission_name: 'Урок 7 :: Логические высказывания (Уровень 1)', // Обязателен префикс "Урок X"
    action_type: 'level_complete', // 'in_progress', 'level_complete', или 'hardcore_reset'
    status: 'completed',           // 'in_progress' или 'completed'
    start_time: new Date(startTime).toISOString(),
    time_spent_sec: 45,            // Секунд с начала уровня
    attempts_count: 1,             // Количество попыток/ошибок
    success: true,                 // true только при успешном завершении уровня
    action_log: [{ time: '...', action: 'step_done' }] // Опционально
}, '*');
```

> **Важно по `mission_name`:** Название миссии **обязательно** должно содержать префикс урока (например, `Урок 7`, `Урок 20`). Платформа на странице `src/pages/lesson/[class]/[id].astro` обогащает событие параметрами текущего URL (`course_slug: classSlug`, `lesson_id: lessonId`) и постоянным классом ученика из `localStorage` (`student_class`).

### 4.2 Режим Хардкора и Сигнал Сброса
В шапке урока находится глобальный переключатель «Режим Хардкора».
* Тренажеру **не нужно** проверять состояние этого флага на клиенте.
* При любой фатальной ошибке пользователя тренажер **всегда обязан отправлять сигнал сброса**:

```javascript
window.parent.postMessage({
    type: 'TELEMETRY_EVENT',
    action_type: 'hardcore_reset'
}, '*');
```

* Если режим хардкора активен на платформе, платформа обнуляет прогресс всех уровней урока, перезагружает все `<iframe>` и фиксирует сброс в телеметрии.
* Если хардкор выключен, платформа регистрирует ошибку в статистике без стирания прогресса других уровней.

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
  "action_log": []
}
```

**Особенности обработки бэкендом:**
* Если `level_number` не передан явно, он автоматически парсится из `mission_name` (`Уровень 1` -> `1`, `Уровень 2` -> `2`, `Уровень 3` -> `3`).
* Если `lesson_id` не передан, он извлекается из регулярного выражения `Урок (\d+)`.
* Если `course_slug` не передан, используется `student_class`.
* В колонку `class_name` записывается `student_class` для сохранения совместимости.
* Ограничение времени: `time_spent_sec` валидируется в диапазоне от `0` до `86400` секунд.

**Ответ:** `200 OK` `{"success": true}` или `400 / 500`.

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
Выборка производится с защитой от изменения класса:
```sql
SELECT action_type, mission_name, is_hardcore 
FROM telemetry 
WHERE (first_name = ? AND last_name = ?)
  AND (student_class = ? OR class_name = ?)
  AND ((course_slug = ? AND lesson_id = ?) OR mission_name LIKE ?)
ORDER BY timestamp ASC
```

**Ответ:**
```json
{
  "unlockedNormal": 2,
  "unlockedHardcore": 1,
  "isNormalCompleted": false,
  "isHardcoreCompleted": false
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
  AND (lesson_id = ? OR mission_name LIKE ?)
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
        "1": { "status": "completed", "timeSpentSec": 45, "errors": 0, "completed": true, "hardcore": true },
        "2": { "status": "completed", "timeSpentSec": 120, "errors": 1, "completed": true, "hardcore": true },
        "3": { "status": "in_progress", "timeSpentSec": 60, "errors": 0, "completed": false, "hardcore": false }
      },
      "totalActiveTimeSec": 225,
      "totalErrors": 1,
      "lessonStatus": "in_progress",
      "isHardcoreLegend": false,
      "isActiveNow": true
    }
  ],
  "kpi": {
    "totalStudents": 28,
    "completedCount": 19,
    "hardcoreCount": 8,
    "inProgressCount": 7,
    "avgTimeSec": 340,
    "totalErrors": 24
  },
  "availableDates": ["2026-10-12", "2026-10-11"],
  "classes": [...]
}
```

---

## 6. Пользовательские Интерфейсы

### 6.1 Личный Кабинет Ученика (`/courses`)
* Позволяет учащемуся свободно выбирать любую учебную программу (выпадающий список программ в шапке).
* При выборе другой программы (например, ученик 10-го класса выбирает программу 8-го класса) **профиль учащегося не сбрасывается**: его постоянный класс в `localStorage` остается неизменным.

### 6.2 Панель Мониторинга Учителя (`/teacher`)
* **Фильтры тулбара:**
  1. **«Классы учащихся»:** мультивыбор когорт через чекбоксы (позволяет сформировать единый рейтинг для нескольких параллелей).
  2. **«Курс задания»:** выбор учебной программы задания (`#filter-course`).
  3. **«Урок»:** выпадающий список тем, динамически обновляемый в зависимости от выбранного курса задания.
  4. **«Дата»:** фильтр по датам с поддержкой «Сегодня».
* **Мульти-сортировка таблицы:**
  * Клик по заголовку сортирует по одной колонке.
  * Клик с удержанием клавиши `Ctrl` или `Shift` включает многоколоночную сортировку с визуальными индикаторами приоритета (`#1`, `#2`).
* **Живой мониторинг (Live Polling):** автоматический опрос каждые 5 секунд с индикатором сетевой активности и кнопкой паузы.
* **Экспорт:** выгрузка таблицы результатов в формат CSV для интеграции с электронным журналом.
