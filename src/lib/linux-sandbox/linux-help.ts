export interface LinuxHelpEntry {
  syntax: string;
  desc: string;
  example?: string;
}

export interface LinuxHelpSection {
  id: string;
  shortLabel: string;
  title: string;
  entries: LinuxHelpEntry[];
}

export const LINUX_HELP_SECTIONS: LinuxHelpSection[] = [
  {
    id: 'nav',
    shortLabel: 'Навигация',
    title: '1. Навигация и файловая система',
    entries: [
      {
        syntax: 'pwd',
        desc: 'Выводит полный абсолютный путь текущего рабочего каталога.',
        example: 'pwd',
      },
      {
        syntax: 'ls [-l] [-a] [-la] [путь]',
        desc: 'Показывает содержимое каталога. Флаг -a включает скрытые файлы (начинающиеся с точки), -l — подробный формат (права доступа, владелец, размер, имя).',
        example: 'ls -la /var/log',
      },
      {
        syntax: 'cd [путь]',
        desc: 'Меняет текущий каталог. Специальные обозначения: «~» — домашний каталог, «..» — переход на уровень выше, «/» — корень файловой системы.',
        example: 'cd /etc\ncd ..',
      },
      {
        syntax: 'find <путь> [-name <маска>]',
        desc: 'Рекурсивно ищет файлы и каталоги по маске имени (поддерживаются символы * и ?).',
        example: 'find /var -name "*.log" 2>/dev/null',
      },
    ],
  },
  {
    id: 'files',
    shortLabel: 'Файлы',
    title: '2. Чтение, копирование и архивация файлов',
    entries: [
      {
        syntax: 'cat <файл>',
        desc: 'Выводит текстовое содержимое файла в стандартный поток вывода.',
        example: 'cat /var/log/auth.log',
      },
      {
        syntax: 'cp <источник> <назначение>',
        desc: 'Копирует файл или каталог в указанное место.',
        example: 'cp /etc/hosts /tmp/hosts.bak',
      },
      {
        syntax: 'rm <файл>',
        desc: 'Удаляет файл из файловой системы (удаление необратимо).',
        example: 'rm /tmp/shadow.bak',
      },
      {
        syntax: 'truncate -s 0 <файл>',
        desc: 'Обнуляет размер файла до 0 байт, сохраняя сам файл и его права доступа.',
        example: 'truncate -s 0 /var/log/access.log',
      },
      {
        syntax: 'tar -czf <архив.tar.gz> <путь>',
        desc: 'Упаковывает файл или каталог в сжатый архив gzip (-c создать, -z gzip, -f имя файла).',
        example: 'tar -czf /tmp/backup.tar.gz /etc/nginx',
      },
    ],
  },
  {
    id: 'text',
    shortLabel: 'Текст',
    title: '3. Поиск, анализ текста и декодирование',
    entries: [
      {
        syntax: 'grep [-i] [-n] <шаблон> [файл]',
        desc: 'Фильтрует строки по подстроке. Флаг -i игнорирует регистр, -n добавляет номера строк. Без указания файла читает данные из конвейера (|).',
        example: 'grep -in "Failed password" /var/log/auth.log\nps aux | grep nginx',
      },
      {
        syntax: 'strings <файл>',
        desc: 'Извлекает читаемые текстовые строки из бинарного файла или дампа памяти.',
        example: 'strings /usr/local/bin/service_bin | grep -i token',
      },
      {
        syntax: 'base64 -d [файл]',
        desc: 'Декодирует данные из кодировки Base64 в исходный текст (из файла или из конвейера).',
        example: 'echo "SGVsbG8gTGludXg=" | base64 -d',
      },
      {
        syntax: 'echo <текст>',
        desc: 'Выводит переданную строку в стандартный поток вывода (удобно передавать в base64 или grep через конвейер).',
        example: 'echo "status=ok"',
      },
    ],
  },
  {
    id: 'perms',
    shortLabel: 'Права и процессы',
    title: '4. Права доступа, пользователи и процессы',
    entries: [
      {
        syntax: 'id  |  whoami',
        desc: 'Показывает имя текущего пользователя, его числовой UID, GID и список групп.',
        example: 'id',
      },
      {
        syntax: 'chmod <режим> <файл>',
        desc: 'Изменяет права доступа к файлу или каталогу (восьмеричный код вроде 600, 644, 755 или символьная запись +r, +x).',
        example: 'chmod 600 ~/.ssh/id_rsa\nchmod +r /tmp/report.txt',
      },
      {
        syntax: 'chown <владелец:группа> <файл>',
        desc: 'Меняет владельца и группу файла.',
        example: 'chown root:root /etc/shadow',
      },
      {
        syntax: 'passwd -l <пользователь>',
        desc: 'Блокирует учётную запись пользователя (флаг -l — lock).',
        example: 'passwd -l temp_user',
      },
      {
        syntax: 'sudo -l',
        desc: 'Показывает список команд, которые текущий пользователь может выполнять с повышенными привилегиями.',
        example: 'sudo -l',
      },
      {
        syntax: 'ps [aux]',
        desc: 'Выводит снимок запущенных процессов с указанием пользователя, PID, нагрузки CPU/RAM и команды.',
        example: 'ps aux',
      },
      {
        syntax: 'kill -9 <PID>',
        desc: 'Принудительно завершает процесс по его идентификатору PID (сигнал SIGKILL).',
        example: 'kill -9 4812',
      },
      {
        syntax: 'crontab -l  |  crontab -r',
        desc: 'Просматривает (-l) или удаляет (-r) расписание фоновых задач планировщика cron.',
        example: 'crontab -l',
      },
    ],
  },
  {
    id: 'net',
    shortLabel: 'Сеть',
    title: '5. Сеть, удалённое копирование и брандмауэр',
    entries: [
      {
        syntax: 'ss -tulpn  |  netstat',
        desc: 'Показывает открытые TCP/UDP-порты, слушающие сокеты и активные сетевые соединения.',
        example: 'ss -tulpn',
      },
      {
        syntax: 'ip  |  ifconfig',
        desc: 'Отображает сетевые интерфейсы, их IPv4/IPv6-адреса и MAC-адреса.',
        example: 'ip',
      },
      {
        syntax: 'ping <узел>',
        desc: 'Проверяет сетевую доступность узла и задержку отклика по протоколу ICMP.',
        example: 'ping 192.168.1.1',
      },
      {
        syntax: 'nmap <цель>',
        desc: 'Сканирует открытые сетевые порты и службы на целевом узле.',
        example: 'nmap 127.0.0.1',
      },
      {
        syntax: 'ssh <user@host>',
        desc: 'Устанавливает защищённое удалённое подключение по протоколу SSH.',
        example: 'ssh admin@10.0.0.5',
      },
      {
        syntax: 'scp [-P порт] [-i ключ] <источник> <назначение>',
        desc: 'Безопасно копирует файлы между узлами по SSH. Ключ -P задаёт порт (в верхнем регистре), -i — путь к приватному ключу.',
        example: 'scp -P 2222 -i ~/.ssh/key user@127.0.0.1:/data/dump.sql /tmp/',
      },
      {
        syntax: 'ufw deny from <IP>  |  ufw deny out to <IP>',
        desc: 'Добавляет правило брандмауэра UFW для блокировки входящего (from) или исходящего (out to) трафика по IP.',
        example: 'ufw deny from 203.0.113.45',
      },
    ],
  },
  {
    id: 'shell',
    shortLabel: 'Оболочка',
    title: '6. Конвейеры, цепочки команд и горячие клавиши',
    entries: [
      {
        syntax: 'команда1 | команда2',
        desc: 'Конвейер (pipe): передаёт текстовый вывод первой команды на вход второй команде для фильтрации или обработки.',
        example: 'cat /var/log/auth.log | grep -i "Failed"',
      },
      {
        syntax: 'команда1 && команда2  |  команда1 ; команда2',
        desc: 'Цепочка команд: «&&» запускает вторую команду только при успешном завершении первой (код 0); «;» запускает команды последовательно в любом случае.',
        example: 'cd /var/log && ls -la',
      },
      {
        syntax: '2>/dev/null',
        desc: 'Подавляет вывод сообщений об ошибках (поток stderr) в пустое устройство /dev/null.',
        example: 'find / -name "*.conf" 2>/dev/null',
      },
      {
        syntax: 'clear',
        desc: 'Полностью очищает экран терминала.',
        example: 'clear',
      },
      {
        syntax: 'man [команда|раздел]  |  help [раздел]  |  справка [раздел]',
        desc: 'Открывает это справочное руководство. Можно указать имя команды (например, man grep) или название раздела.',
        example: 'man chmod\nсправка сеть',
      },
      {
        syntax: 'Tab  |  ↑ / ↓  |  Esc',
        desc: 'Tab — автодополнение команд и путей к файлам; стрелки ↑ / ↓ — навигация по истории введённых команд; Esc — закрытие окна.',
      },
    ],
  },
];

const TOPIC_SECTION_MAP: Record<string, string> = {
  // Названия разделов и темы
  nav: 'nav',
  navigation: 'nav',
  навигация: 'nav',
  каталоги: 'nav',
  пути: 'nav',
  files: 'files',
  файлы: 'files',
  архивы: 'files',
  архивация: 'files',
  text: 'text',
  текст: 'text',
  поиск: 'text',
  декодирование: 'text',
  perms: 'perms',
  permissions: 'perms',
  права: 'perms',
  доступ: 'perms',
  пользователи: 'perms',
  процессы: 'perms',
  net: 'net',
  network: 'net',
  сеть: 'net',
  брандмауэр: 'net',
  файрвол: 'net',
  shell: 'shell',
  оболочка: 'shell',
  конвейеры: 'shell',
  конвейер: 'shell',
  цепочки: 'shell',
  клавиши: 'shell',
  // Имена команд
  pwd: 'nav',
  ls: 'nav',
  cd: 'nav',
  find: 'nav',
  cat: 'files',
  cp: 'files',
  rm: 'files',
  truncate: 'files',
  tar: 'files',
  grep: 'text',
  strings: 'text',
  base64: 'text',
  echo: 'text',
  id: 'perms',
  whoami: 'perms',
  chmod: 'perms',
  chown: 'perms',
  passwd: 'perms',
  sudo: 'perms',
  ps: 'perms',
  kill: 'perms',
  crontab: 'perms',
  ss: 'net',
  netstat: 'net',
  ip: 'net',
  ifconfig: 'net',
  ping: 'net',
  nmap: 'net',
  ssh: 'net',
  scp: 'net',
  ufw: 'net',
  clear: 'shell',
  man: 'shell',
  help: 'shell',
  справка: 'shell',
  помощь: 'shell',
};

export function resolveLinuxHelpSectionId(topic?: string): string | null {
  if (!topic) return null;
  const norm = topic.trim().toLowerCase().replace(/ё/g, 'е');
  if (!norm) return null;
  if (TOPIC_SECTION_MAP[norm]) return TOPIC_SECTION_MAP[norm];
  for (const [key, secId] of Object.entries(TOPIC_SECTION_MAP)) {
    if (norm.includes(key)) return secId;
  }
  return null;
}

export function formatLinuxHelpPlainText(topic?: string): string {
  const sectionId = resolveLinuxHelpSectionId(topic);
  const targetSections = sectionId
    ? LINUX_HELP_SECTIONS.filter((s) => s.id === sectionId)
    : LINUX_HELP_SECTIONS;

  const lines: string[] = ['Справка по командам терминала Linux:'];
  for (const sec of targetSections) {
    lines.push(`${sec.title}:`);
    for (const entry of sec.entries) {
      lines.push(`  ${entry.syntax} — ${entry.desc}`);
      if (entry.example) {
        lines.push(`    Пример: ${entry.example.replace(/\n/g, ' ; ')}`);
      }
    }
  }
  return lines.join('\n');
}
