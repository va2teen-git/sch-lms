# Готовые UI Компоненты для заданий

В платформе School LMS предусмотрены готовые переиспользуемые Astro-компоненты для создания интерактивных заданий (находятся в `src/components/`). Они уже интегрированы с системой телеметрии и соответствуют дизайн-коду.

## 1. Эмулятор Linux Терминала (`Terminal.astro`)
Используется для заданий, где ученику нужно взаимодействовать с командной строкой (администрирование, ИБ).
Упоминание в старой документации: Да, в `docs/curriculum.md` есть ссылка на то, что можно использовать этот компонент.

**Пропсы:**
- `missionName` (string): Название миссии для телеметрии.
- `phases` (string): JSON-строка с конфигурацией фаз (ожидает `setup` и `onCommand` функции для обработки ввода).
- `requireStart` (boolean): Показать ли стартовый экран (для хардкорных уровней на время).
- `theme` (string): 'green', 'orange', 'red'.
- `hardcoreReset` (boolean): Выполнять ли сброс файловой системы при ошибке.

**Пример использования:**
```astro
---
import Terminal from '../../../components/Terminal.astro';
const phasesData = JSON.stringify([{
    timeLimit: 60,
    setup: "return 'Соединение установлено. Ожидание команд...';",
    onCommand: "if(cmd==='ls') return {success: true, message: 'secret.txt'}; return {success: false};"
}]);
---
<Terminal missionName="Урок 15 :: SSH" phases={phasesData} theme="green" />
```

## 2. Python IDE (`PythonIDE.astro`)
Используется для уроков программирования. Внутри работает автономный интерпретатор CPython (через Pyodide), исполняющийся полностью в браузере (WASM). Соответствует политике "Zero-Dependency", ядро загружается из локальной директории `/static/pyodide/`.

**Пропсы:**
- `missionName` (string, обязательно): Название миссии для телеметрии.
- `initialCode` (string, опционально): Стартовый код, который появится в редакторе (по умолчанию комментарий).
- `theme` (string, опционально): Цветовая тема ('green', 'orange', 'red').
- `hardcoreReset` (boolean, опционально): Нужно ли полностью стирать код ученика при ошибке.

**Особенности работы:**
1. Код выполняется локально. Запрещены сетевые запросы изнутри Python.
2. Поддерживает горячую клавишу **F5** для запуска.
3. Поддерживает клавишу **Tab** для отступов (4 пробела).
4. Весь вывод (`print`) и ошибки (`traceback`) автоматически перехватываются и выводятся в блок "ТЕРМИНАЛ".
5. Любое исключение (Exception) в Python-коде автоматически отправляет сигнал телеметрии `hardcore_reset` на родительскую платформу (строгое требование).

**Пример использования:**
```astro
---
import PythonIDE from '../../../components/PythonIDE.astro';
const initialCode = "def solve():\n    # Ваш код\n    pass\n\nprint(solve())";
---
<PythonIDE 
    missionName="Урок 23 :: Написание парсера" 
    theme="orange" 
    initialCode={initialCode} 
/>
```

## 3. LibreOffice Writer Эмулятор (`WriterEmulator.astro`)
Используется для уроков по форматированию текста. Построен на базе библиотеки **Jodit**. Внешний вид панели инструментов приближен к классическому текстовому процессору.

**Пропсы:**
- `missionName` (string, обязательно).
- `initialHTML` (string, опционально): Стартовый HTML код.
- `hardcoreReset` (boolean, опционально): При ошибке сбрасывать весь текст.

**Как проверять решения ученика:**
Скрипт генерирует кастомное событие `writer-check` при нажатии кнопки "ОТПРАВИТЬ НА ПРОВЕРКУ". В компоненте уровня (`levelX.astro`) вы можете слушать его и вызывать `e.detail.resolve(true/false)`:
```astro
<script>
document.addEventListener('writer-check', (e) => {
    const html = e.detail.html;
    if (html.includes('<strong>Важный текст</strong>')) {
        e.detail.resolve(true, "Отлично!");
    } else {
        e.detail.resolve(false, "Текст не выделен жирным!");
    }
});
</script>
```

## 4. LibreOffice Calc Эмулятор (`CalcEmulator.astro`)
Используется для уроков по электронным таблицам. Построен на базе библиотеки **Luckysheet**. Визуально идентичен Excel/Calc, полностью поддерживает формулы (включая русскоязычные, если настроить, но по умолчанию стандартные), форматирование, ссылки на ячейки.

**Пропсы:**
- `missionName` (string, обязательно).
- `initialData` (array, опционально): Конфигурация ячеек в формате Luckysheet.
- `hardcoreReset` (boolean, опционально): Сброс всех ячеек при ошибке.

**Как проверять решения ученика:**
Аналогично генерируется событие `calc-check`.
```astro
<script>
document.addEventListener('calc-check', (e) => {
    const sheetData = e.detail.data; // Двумерный массив ячеек
    const a1 = sheetData[0][0]; // Строка 0, Колонка 0
    if (a1 && a1.f === "=SUM(B1:B5)") { // Проверка формулы
        e.detail.resolve(true, "Формула верна!");
    } else {
        e.detail.resolve(false, "Формула в A1 не найдена или неверна.");
    }
});
</script>
```
