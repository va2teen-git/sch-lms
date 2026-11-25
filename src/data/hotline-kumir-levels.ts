import type { LevelDefinition, VfsDirNode, VfsFileNode } from '../lib/hotline-kumir/types.ts';

function file(
  name: string,
  content: string,
  opts: { mode?: number; owner?: string; isBinary?: boolean; stringsLines?: string[] } = {}
): VfsFileNode {
  return {
    kind: 'file',
    name,
    content,
    mode: opts.mode ?? 0o644,
    owner: opts.owner ?? 'ops',
    size: content.length,
    isBinary: opts.isBinary,
    stringsLines: opts.stringsLines,
  };
}

function dir(
  name: string,
  children: Array<VfsDirNode | VfsFileNode>,
  opts: { mode?: number; owner?: string } = {}
): VfsDirNode {
  const map: Record<string, VfsDirNode | VfsFileNode> = {};
  for (const ch of children) {
    map[ch.name] = ch;
  }
  return {
    kind: 'dir',
    name,
    mode: opts.mode ?? 0o755,
    owner: opts.owner ?? 'ops',
    children: map,
  };
}

export const HOTLINE_KUMIR_LEVELS: LevelDefinition[] = [
  {
    id: 1,
    slug: 'night-kpp',
    theme: 'kpp_street',
    title: 'Ночной КПП',
    subtitle: 'Уличная будка и периметр',
    curriculumRef: '8 класс №13, №15 — Линейные алгоритмы',
    ccs: 3,
    tpr: 0.54,
    briefingTime: '00:14',
    briefingText:
      'На линии Куратор. Это внешний пост корпорации «Неон-Секьюрити». Проберись к уличной панели (T), достань PIN из скрытого конфига в Linux-терминале, открой шлюз (D), поставь ЭМИ-метку (*) и уходи на точку эвакуации (E). Не попадай в луч камеры у окна охраны — наряд ГБР дежурит в двух кварталах.',
    asciiMap: [
      '############',
      '#S..T.D.*..#',
      '#.###.###.##',
      '#....K~~..E#',
      '#..#.......#',
      '#..#......G#',
      '############',
    ],
    turnTimerStealthSec: 35,
    turnTimerAlertSec: 25,
    gbrEtaTurns: 6,
    gbrEtaSec: 120,
    gbrSquad: ['gbr_dog'],
    parLoc: 12,
    starterCode: [
      '| Уровень 1: линейный проход и первый взлом',
      '| Цель: дойти до (T), вызвать «подключиться», затем (*) и (E)',
      '| Команды: вправо, влево, вверх, вниз, закрасить, подключиться',
    ].join('\n'),
    hints: [
      'От старта (S) до уличного терминала (T) ровно 3 шага вправо.',
      'В терминале Linux введи: ls -la → cat .gate.conf → unlock 4821.',
      'После открытия двери (D) дойди до (*), вызови «закрасить» и спустись к выходу (E).',
    ],
    snippetPreset: ['вправо', 'вниз', 'нц 3 раз\n  вправо\nкц', 'подключиться', 'закрасить', 'выбить дверь', 'оглушить'],
    doors: [{ id: 'door-kpp', x: 6, y: 1 }],
    cameras: [
      {
        id: 'cam-kpp',
        x: 5,
        y: 3,
        phases: [
          [{ x: 6, y: 3 }, { x: 7, y: 3 }],
        ],
      },
    ],
    lasers: [],
    patrols: [],
    linuxConfig: {
      user: 'agent',
      host: 'kpp-gate',
      homeDir: '/home/agent',
      idInfo: 'uid=1000(agent) gid=1000(agent) groups=1000(agent)',
      sudoListOutput: 'Пользователь agent не может выполнять sudo на kpp-gate.',
      crontabContent: '# расписание пусто',
      processes: ['root         1  0.0  0.1 /sbin/init', 'kpp        112  0.1  0.4 /usr/sbin/gate-lockd --id kpp-01'],
      sockets: ['tcp   LISTEN 127.0.0.1:4801   0.0.0.0:*   gate-lockd'],
      honeypotPaths: ['/etc/shadow'],
      requiredFlags: ['DOOR_UNLOCKED'],
      vfsRoot: dir('', [
        dir('home', [
          dir('agent', [
            file('readme.txt', 'Сервисная панель КПП-01. По всем вопросам звоните дежурному.'),
            file(
              '.gate.conf',
              'GATE_ID=kpp-01\nUNLOCK_PIN=4821\n| Подсказка: введи команду unlock 4821',
              { mode: 0o640 }
            ),
          ]),
        ]),
        dir('etc', [file('shadow', 'root:*:19800:0:99999:7:::', { mode: 0o000, owner: 'root' })]),
      ]),
      customCommands: {
        unlock: (args) => {
          const pin = args[0] || '';
          if (pin === '4821') {
            return {
              output: '[GATE-LOCKD]: Код 4821 принят! Электродверь D(6,1) разблокирована.',
              exitCode: 0,
              setFlags: ['DOOR_UNLOCKED'],
              effects: [{ type: 'UNLOCK_DOOR', doorId: 'door-kpp' }],
            };
          }
          return {
            output: `[GATE-LOCKD]: ОШИБКА! Неверный PIN «${pin}». Проверьте скрытые файлы (ls -la).`,
            exitCode: 1,
            noiseDelta: 1,
          };
        },
      },
      hints: ['Используй «ls -la», чтобы увидеть скрытый файл .gate.conf, затем «cat .gate.conf» и «unlock 4821».'],
    },
  },
  {
    id: 2,
    slug: 'quiet-hall',
    theme: 'lobby_hall',
    title: 'Тихий холл',
    subtitle: 'Дежурный ПК администратора',
    curriculumRef: '8 класс №16, №26 — Оператор ветвления',
    ccs: 5,
    tpr: 0.66,
    briefingTime: '01:02',
    briefingText:
      'Ты внутри здания, но главный коридор перекрыт вращающейся камерой (K) и лазерами (===). Охранник в маске Крысы патрулирует восточное крыло (обзор 2 клетки). Загляни в дежурный ПК на ресепшене (T), найди в истории команд токен или прорвись через восточную дверь D2 штурмом!',
    asciiMap: [
      '##############',
      '#S...D..K~..E#',
      '#..#....~..#.#',
      '#..#.T..CP...#',
      '#..###===###D#',
      '#......*.....#',
      '#...........G#',
      '##############',
    ],
    turnTimerStealthSec: 32,
    turnTimerAlertSec: 22,
    gbrEtaTurns: 5,
    gbrEtaSec: 100,
    gbrSquad: ['gbr_dog', 'gbr_boar'],
    parLoc: 15,
    starterCode: [
      '| Уровень 2: используй циклы и «если дверь закрыта то ... все»',
      '| Цель: дойти до (T), отключить охрану, пометить (*) и выйти в (E)',
    ].join('\n'),
    hints: [
      'От (S) до (T): вправо до прохода, затем вниз и направо к стойке.',
      'В Linux-терминале начни с «pwd», «ls -la» и «cat ~/.bash_history», затем «grep -i token /srv/desk/.env».',
      'Восточную дверь D(12,4) можно выбить командой «выбить дверь» для быстрого штурма!',
    ],
    snippetPreset: [
      'если справа свободно то\n  вправо\nвсе',
      'если дверь закрыта то\n  выбить дверь\nвсе',
      'нц 4 раз\n  вверх\nкц',
      'укрыться',
      'подключиться',
      'закрасить',
      'рывок',
      'оглушить',
    ],
    doors: [
      { id: 'door-hall', x: 5, y: 1 },
      { id: 'door-hall-east', x: 12, y: 4 },
    ],
    cameras: [
      {
        id: 'cam-01',
        x: 8,
        y: 1,
        phases: [
          [{ x: 9, y: 1 }, { x: 8, y: 2 }, { x: 9, y: 2 }],
          [{ x: 7, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 2 }],
        ],
      },
    ],
    lasers: [{ id: 'L1', cells: [{ x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 }] }],
    patrols: [
      {
        id: 'guard-hall',
        kind: 'patrol_rat',
        route: [{ x: 9, y: 3 }, { x: 10, y: 3 }, { x: 11, y: 3 }],
        facing: 'RIGHT',
      },
    ],
    linuxConfig: {
      user: 'guard',
      host: 'hall-desk',
      homeDir: '/home/guard',
      idInfo: 'uid=1002(guard) gid=1002(guard) groups=1002(guard)',
      sudoListOutput: 'Пользователь guard не имеет прав sudo.',
      crontabContent: '# нет задач',
      processes: ['root       121  0.0  0.2 /usr/sbin/camctl-daemon', 'root       128  0.0  0.2 /usr/sbin/laser-grid'],
      sockets: ['tcp   LISTEN 127.0.0.1:7100   0.0.0.0:*   camctl-daemon'],
      honeypotPaths: ['/etc/shadow'],
      requiredFlags: ['CAM_OFF', 'LASER_OFF'],
      vfsRoot: dir('', [
        dir('home', [
          dir('guard', [
            file('notes.txt', 'Смена 23:00 — проверить консоль в /srv/desk'),
            file(
              '.bash_history',
              'cd /srv/desk\nls -la\ncat .env\ncamctl off cam-01 <TOKEN>\nlaserctl off L1 <TOKEN>',
              { mode: 0o600, owner: 'guard' }
            ),
          ]),
        ]),
        dir('srv', [
          dir('desk', [
            file('.env', 'NODE_ENV=production\nDESK_TOKEN=NEON-774\nHALL_CAM=cam-01\nHALL_LASER=L1', { mode: 0o644 }),
          ]),
        ]),
        dir('etc', [file('shadow', 'root:*:19800:0:99999:7:::', { mode: 0o000, owner: 'root' })]),
      ]),
      customCommands: {
        camctl: (args) => {
          if (args[0] === 'off' && args[1] === 'cam-01' && args[2] === 'NEON-774') {
            return {
              output: '[CAMCTL]: Камера cam-01 переведена в режим OFFLINE. Дверь D(5,1) открыта.',
              exitCode: 0,
              setFlags: ['CAM_OFF'],
              effects: [
                { type: 'DISABLE_CAMERA', cameraId: 'cam-01' },
                { type: 'UNLOCK_DOOR', doorId: 'door-hall' },
              ],
            };
          }
          return {
            output: 'Использование: camctl off cam-01 <DESK_TOKEN>',
            exitCode: 1,
            noiseDelta: 1,
          };
        },
        laserctl: (args) => {
          if (args[0] === 'off' && args[1] === 'L1' && args[2] === 'NEON-774') {
            return {
              output: '[LASERCTL]: Лазерный барьер L1 отключён.',
              exitCode: 0,
              setFlags: ['LASER_OFF'],
              effects: [{ type: 'DISABLE_LASER', laserId: 'L1' }],
            };
          }
          return {
            output: 'Использование: laserctl off L1 <DESK_TOKEN>',
            exitCode: 1,
            noiseDelta: 1,
          };
        },
      },
      hints: ['Посмотри ~/.bash_history, затем в /srv/desk найди DESK_TOKEN=NEON-774 и отключи cam-01 и L1.'],
    },
  },
  {
    id: 3,
    slug: 'analytics-office',
    theme: 'analytics_office',
    title: 'Офис аналитики',
    subtitle: 'Скрытый дамп памяти и права доступа',
    curriculumRef: '8 класс №17, №19 — Циклы «нц пока» и «нц N раз»',
    ccs: 6,
    tpr: 0.73,
    briefingTime: '02:18',
    briefingText:
      'Опенспейс третьего этажа. Вращающиеся камеры, укрытия (C) и зоркий Ворон (обзор 3 клетки!). Разработчики оставили в кеше дамп памяти core.dmp, а файл координат в /opt/vault закрыт правами 000. Выбери верхний стелс-маршрут с «укрыться» и ЭМИ-маячком «бросить» либо южный фланг через отключение камеры и штурмовую дверь D2.',
    asciiMap: [
      '################',
      '#S.....K~~..#..#',
      '#.#.#.C...P..D.#',
      '#.#...#...###..#',
      '#..K~.#.T.#...E#',
      '#...~.#===#D#..#',
      '#..C..#...#.#.##',
      '#.......*.....G#',
      '################',
    ],
    turnTimerStealthSec: 30,
    turnTimerAlertSec: 20,
    gbrEtaTurns: 5,
    gbrEtaSec: 95,
    gbrSquad: ['gbr_dog', 'gbr_dog', 'gbr_boar'],
    parLoc: 18,
    starterCode: [
      '| Уровень 3: циклы «нц пока», укрытия (C) и приманка «бросить»',
      '| Ворон (P) видит на 3 клетки! «укрыться» работает рядом с (C).',
    ].join('\n'),
    hints: [
      'Рядом со стойкой C(6,2) «укрыться» скрывает тебя от Ворона, а «бросить» отвлекает врагов в радиусе 2 клеток.',
      'В Linux выполни: find /home -name "*.dmp" → strings ... | grep PASS → echo ... | base64 -d → chmod +r /opt/vault/coords.txt && cat /opt/vault/coords.txt.',
      'После vault_unlock можно уйти на север через D1(13,2) или выбить южную дверь D2(11,5).',
    ],
    snippetPreset: [
      'нц пока справа свободно и не впереди опасно\n  вправо\nкц',
      'нц 3 раз\n  вниз\nкц',
      'укрыться',
      'бросить',
      'отключить',
      'подключиться',
      'закрасить',
      'рывок',
      'оглушить',
    ],
    doors: [
      { id: 'door-office', x: 13, y: 2 },
      { id: 'door-office-south', x: 11, y: 5 },
    ],
    cameras: [
      {
        id: 'cam-office-1',
        x: 3,
        y: 4,
        phases: [
          [{ x: 4, y: 4 }, { x: 4, y: 5 }],
          [{ x: 3, y: 5 }, { x: 4, y: 5 }],
        ],
      },
      {
        id: 'cam-office-2',
        x: 7,
        y: 1,
        phases: [
          [{ x: 8, y: 1 }, { x: 9, y: 1 }],
          [{ x: 7, y: 2 }, { x: 8, y: 2 }],
          [{ x: 6, y: 1 }, { x: 5, y: 1 }],
        ],
      },
    ],
    lasers: [{ id: 'L3', cells: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }] }],
    patrols: [
      {
        id: 'guard-office',
        kind: 'patrol_raven',
        route: [{ x: 10, y: 2 }, { x: 11, y: 2 }, { x: 12, y: 2 }],
        facing: 'RIGHT',
      },
    ],
    linuxConfig: {
      user: 'analyst',
      host: 'office-ws03',
      homeDir: '/home/analyst',
      idInfo: 'uid=1003(analyst) gid=1003(analyst) groups=1003(analyst)',
      sudoListOutput: 'Пользователь analyst не может запускать sudo.',
      crontabContent: '# пусто',
      processes: ['analyst    201  0.2  1.1 /opt/vault/vault-daemon'],
      sockets: ['tcp   LISTEN 127.0.0.1:8085   0.0.0.0:*   vault-daemon'],
      honeypotPaths: ['/etc/shadow'],
      requiredFlags: ['VAULT_OPEN'],
      vfsRoot: dir('', [
        dir('home', [
          dir('analyst', [
            dir('.cache', [
              file('core.dmp', '[BINARY DUMP]', {
                mode: 0o644,
                isBinary: true,
                stringsLines: [
                  'ALLOC_MEM_0x7ff1a',
                  'DEBUG_SESSION=office-03',
                  'PASS_B64=TUVPQS05MDI=',
                  'END_FRAME',
                ],
              }),
            ]),
            file('todo.md', 'Не забыть заблокировать /opt/vault/coords.txt перед уходом.'),
          ]),
        ]),
        dir('opt', [
          dir('vault', [
            file(
              'coords.txt',
              'SECTOR=ANALYTICS-SOUTH\nVAULT_KEY=MEOA-902\nКоманда отключения: vault_unlock MEOA-902',
              { mode: 0o000, owner: 'analyst' }
            ),
          ]),
        ]),
        dir('etc', [file('shadow', 'root:*:19800:0:99999:7:::', { mode: 0o000, owner: 'root' })]),
      ]),
      customCommands: {
        vault_unlock: (args) => {
          if (args[0] === 'MEOA-902') {
            return {
              output: '[VAULT]: Ключ MEOA-902 подтверждён! Лазеры (7..9,5), камера cam-office-2 и шлюз D(13,2) отключены.',
              exitCode: 0,
              setFlags: ['VAULT_OPEN'],
              effects: [
                { type: 'DISABLE_LASER', laserId: 'L3' },
                { type: 'DISABLE_CAMERA', cameraId: 'cam-office-2' },
                { type: 'UNLOCK_DOOR', doorId: 'door-office' },
              ],
            };
          }
          return {
            output: 'Использование: vault_unlock <КЛЮЧ_ИЗ_COORDS>',
            exitCode: 1,
            noiseDelta: 1,
          };
        },
      },
      hints: [
        'find /home -name "*.dmp" → strings /home/analyst/.cache/core.dmp | grep PASS → echo TUVPQS05MDI= | base64 -d → chmod +r /opt/vault/coords.txt && cat /opt/vault/coords.txt → vault_unlock MEOA-902',
      ],
    },
  },
  {
    id: 4,
    slug: 'cold-hall',
    theme: 'server_hall',
    title: 'Холодный зал',
    subtitle: 'Серверная, процессы, порты и скрипт 777',
    curriculumRef: '8 класс №20, №22 — Вложенные циклы и ветвления',
    ccs: 7,
    tpr: 0.79,
    briefingTime: '03:05',
    briefingText:
      'Серверный зал с ДВУМЯ ЭМИ-реле (*). Спустись в нижнюю галерею к терминалу (T) или прорвись через западный лазерный контур командой «отключить». Осмотри процессы, порты и cron — стажёр оставил скрипт 777. Упакуй секретный каталог на /mnt/usb, отметь оба реле (*) и остерегайся щитовика ГБР «Медведя».',
    asciiMap: [
      '##################',
      '#S..#...K~..*....#',
      '#.#.#.C...#.#.D###',
      '#...==P...#.#K~..#',
      '#.#.#...C...#.~#E#',
      '#.#.###===######D#',
      '#.......T.....*..#',
      '#...............G#',
      '##################',
    ],
    turnTimerStealthSec: 28,
    turnTimerAlertSec: 19,
    gbrEtaTurns: 4,
    gbrEtaSec: 75,
    gbrSquad: ['gbr_boar', 'gbr_bear'],
    parLoc: 20,
    starterCode: [
      'использовать Робот',
      '',
      'алг ХолодныйЗал',
      'нач',
      '  | Пометить оба реле (*), взломать (T) и уйти через D1(14,2) или штурм D2(16,5)',
      '  ',
      'кон',
    ].join('\n'),
    hints: [
      'Оба реле (*) находятся на (14,6) и (12,1). Западный лазер ===(4..5,3) можно временно отключить командой «отключить».',
      'В Linux: ps aux → ss -tulpn → sudo -l → cat /etc/crontab → cat /opt/scripts/backup.sh → gridctl reset --no-alarm → tar -czf /mnt/usb/audit.tar.gz /srv/secret.',
      'Против щита «Медведя» сначала используй «бросить», потом «оглушить»! Южная дверь D2(16,5) ведёт прямо к выходу.',
    ],
    snippetPreset: [
      'нц пока снизу свободно\n  вниз\nкц',
      'если впереди опасно то\n  рывок\nвсе',
      'если рядом враг то\n  бросить\n  оглушить\nвсе',
      'отключить',
      'подключиться',
      'закрасить',
      'выбить дверь',
      'добить',
    ],
    doors: [
      { id: 'door-srv', x: 14, y: 2 },
      { id: 'door-srv-south', x: 16, y: 5 },
    ],
    cameras: [
      {
        id: 'cam-srv-1',
        x: 8,
        y: 1,
        phases: [
          [{ x: 9, y: 1 }],
          [{ x: 7, y: 1 }],
        ],
      },
      {
        id: 'cam-srv-2',
        x: 13,
        y: 3,
        phases: [
          [{ x: 14, y: 3 }, { x: 15, y: 3 }],
          [{ x: 13, y: 4 }, { x: 14, y: 4 }],
        ],
      },
    ],
    lasers: [
      { id: 'L4-mid', cells: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }] },
      { id: 'L4-west', cells: [{ x: 4, y: 3 }, { x: 5, y: 3 }] },
    ],
    patrols: [
      {
        id: 'guard-srv',
        kind: 'patrol_rat',
        route: [{ x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }],
        facing: 'RIGHT',
      },
    ],
    linuxConfig: {
      user: 'ops',
      host: 'cold-srv',
      homeDir: '/home/ops',
      idInfo: 'uid=1001(ops) gid=1001(ops) groups=1001(ops),108(audit)',
      sudoListOutput: 'Пользователь ops может выполнять без пароля:\n    (ALL) NOPASSWD: /usr/local/bin/gridctl\nПроверьте расписание /etc/crontab.',
      crontabContent: '# /etc/crontab\n*/5 * * * * root /opt/scripts/backup.sh',
      processes: [
        'root       101  0.1  0.3 /usr/local/bin/guard-grid --port 9090',
        'ops        245  0.0  0.1 /bin/bash',
      ],
      sockets: ['tcp   LISTEN 127.0.0.1:9090   0.0.0.0:*   guard-grid'],
      honeypotPaths: ['/etc/shadow'],
      requiredFlags: ['GRID_RESET', 'EXFILTRATED_USB'],
      vfsRoot: dir('', [
        dir('home', [dir('ops', [file('README', 'Флешка смонтирована в /mnt/usb')])]),
        dir('etc', [
          file('crontab', '# /etc/crontab\n*/5 * * * * root /opt/scripts/backup.sh'),
          file('shadow', 'root:*:19800:0:99999:7:::', { mode: 0o000, owner: 'root' }),
        ]),
        dir('opt', [
          dir('scripts', [
            file(
              'backup.sh',
              '#!/bin/bash\n# Аварийный сброс контура без тревоги:\ngridctl reset --no-alarm\n# Данные аудита находятся в /srv/secret',
              { mode: 0o777, owner: 'root' }
            ),
          ]),
        ]),
        dir('srv', [dir('secret', [file('ledger.db', 'ENCRYPTED_EXAM_LEDGER_2026')])]),
        dir('mnt', [dir('usb', [])]),
      ]),
      customCommands: {
        gridctl: (args) => {
          if (args.includes('reset') && args.includes('--no-alarm')) {
            return {
              output: '[GUARD-GRID]: Сетка (7..9,5), камера cam-srv-1 и дверь D(14,2) сброшены без тревоги!',
              exitCode: 0,
              setFlags: ['GRID_RESET'],
              effects: [
                { type: 'DISABLE_LASER', laserId: 'L4-mid' },
                { type: 'DISABLE_CAMERA', cameraId: 'cam-srv-1' },
                { type: 'UNLOCK_DOOR', doorId: 'door-srv' },
              ],
            };
          }
          return {
            output: 'Использование: gridctl reset --no-alarm',
            exitCode: 1,
            noiseDelta: 1,
          };
        },
      },
      hints: ['Выполни «gridctl reset --no-alarm» и «tar -czf /mnt/usb/audit.tar.gz /srv/secret».'],
    },
  },
  {
    id: 5,
    slug: 'red-line',
    theme: 'master_vault',
    title: 'Красная линия',
    subtitle: 'Мастер-сервер и финальный прорыв',
    curriculumRef: '9 класс №15, №20, №22 — Вспомогательные алгоритмы (ОГЭ 15.1)',
    ccs: 8,
    tpr: 0.84,
    briefingTime: '04:30',
    briefingText:
      'Рассвет близко. Активируй ОБА ЭМИ-реле (* на юге и * на востоке), проникни в стеклянное ядро (T), найди ключ id_rsa, поправь права (chmod 600), скачай дамп базы через scp на /mnt/usb и зачисти журнал. Вращающиеся камеры, Ворон и Крыса патрулируют пути отхода — используй укрытия (C), приманку «бросить» и штурмовой прорыв через D2(15,1) или шлюз D1(17,2)!',
    asciiMap: [
      '####################',
      '#S......K~~..#.D..E#',
      '#.#.#..C...P.#.##D##',
      '#.#..====..#.#.#...#',
      '#...#....#.#...#.C*#',
      '#.C.#.T..#..K~.....#',
      '#...#....#..~~.#.P.#',
      '#.#.####.###...#...#',
      '#*...........G.....#',
      '####################',
    ],
    turnTimerStealthSec: 25,
    turnTimerAlertSec: 17,
    gbrEtaTurns: 4,
    gbrEtaSec: 65,
    gbrSquad: ['gbr_dog', 'gbr_boar', 'gbr_bear'],
    parLoc: 26,
    starterCode: [
      'использовать Робот',
      '',
      'алг КраснаяЛиния',
      'нач',
      '  | Декомпозируй маршрут на подпрограммы «алг»!',
      '  | Оба реле (*) + взлом (T) + выход (E)',
      '  ',
      'кон',
    ].join('\n'),
    hints: [
      'Реле (*) расположены в (1,8) и (18,4). Используй «укрыться» у C(17,4) и «бросить» для отвлечения патруля.',
      'В Linux: find / -name "id_rsa" 2>/dev/null → chmod 600 ... → scp -P 2222 -i ... master@127.0.0.1:/vault/dump.sql /mnt/usb/ → truncate -s 0 /var/log/access.log (призрак) или rm (тревога).',
      'Через D1(17,2) ведёт стелс-путь; северная дверь D2(15,1) — штурмовой шорткат к выходу!',
    ],
    snippetPreset: [
      'алг МояПроцедура\nнач\n  \nкон',
      'если рядом враг то\n  бросить\n  оглушить\n  добить\nвсе',
      'если дверь закрыта то\n  выбить дверь\nвсе',
      'укрыться',
      'бросить',
      'отключить',
      'рывок',
      'подключиться',
      'закрасить',
    ],
    doors: [
      { id: 'door-core', x: 17, y: 2 },
      { id: 'door-core-west', x: 15, y: 1 },
    ],
    cameras: [
      {
        id: 'cam-core-1',
        x: 8,
        y: 1,
        phases: [
          [{ x: 9, y: 1 }, { x: 10, y: 1 }],
          [{ x: 8, y: 2 }, { x: 9, y: 2 }],
          [{ x: 7, y: 1 }, { x: 6, y: 1 }],
        ],
      },
      {
        id: 'cam-core-2',
        x: 12,
        y: 5,
        phases: [
          [{ x: 13, y: 5 }, { x: 12, y: 6 }, { x: 13, y: 6 }],
          [{ x: 11, y: 5 }, { x: 11, y: 6 }, { x: 10, y: 5 }],
          [{ x: 13, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 5 }],
        ],
      },
    ],
    lasers: [{ id: 'L5-core', cells: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 }] }],
    patrols: [
      {
        id: 'guard-north',
        kind: 'patrol_raven',
        route: [{ x: 10, y: 2 }, { x: 11, y: 2 }],
        facing: 'RIGHT',
      },
      {
        id: 'guard-east',
        kind: 'patrol_rat',
        route: [{ x: 16, y: 6 }, { x: 17, y: 6 }, { x: 18, y: 6 }],
        facing: 'RIGHT',
      },
    ],
    linuxConfig: {
      user: 'netops',
      host: 'redline-master',
      homeDir: '/home/netops',
      idInfo: 'uid=1004(netops) gid=1004(netops) groups=1004(netops),110(ssh)',
      sudoListOutput: 'Пользователь netops не имеет прав sudo.',
      crontabContent: '# /etc/crontab пуст',
      processes: [
        'root       301  0.2  0.5 /usr/sbin/sshd-backup -p 2222',
        'root       302  0.4  0.8 /usr/sbin/core-shield --watch /var/log/access.log',
      ],
      sockets: ['tcp   LISTEN 127.0.0.1:2222   0.0.0.0:*   sshd-backup'],
      honeypotPaths: ['/etc/shadow'],
      requiredFlags: ['SCP_DUMP_DONE', 'LOGS_CLEANED'],
      vfsRoot: dir('', [
        dir('home', [
          dir('netops', [file('brief.txt', 'Задача: скачать /vault/dump.sql на /mnt/usb/ и очистить /var/log/access.log')]),
          dir('root_backup', [
            dir('.ssh', [
              file('id_rsa', '-----BEGIN OPENSSH PRIVATE KEY-----\nHOTLINE-REDLINE-SECRET\n-----END OPENSSH PRIVATE KEY-----', {
                mode: 0o644,
                owner: 'netops',
              }),
            ]),
          ]),
        ]),
        dir('etc', [
          dir('audit', [
            file(
              'rules.conf',
              '# Сигнатура tamper-датчика:\n# Удаление (rm) /var/log/access.log поднимает тревогу ГБР!\n# Бесшумное обнуление: truncate -s 0 /var/log/access.log',
              { mode: 0o644 }
            ),
          ]),
          file('shadow', 'root:*:19800:0:99999:7:::', { mode: 0o000, owner: 'root' }),
        ]),
        dir('var', [
          dir('log', [file('access.log', '04:12:01 netops CONNECTED to T(6,5)\n04:12:15 AUTH_AUDIT_PENDING')]),
        ]),
        dir('mnt', [dir('usb', [])]),
      ]),
      customCommands: {},
      hints: [
        'Найди id_rsa, сделай chmod 600, скачай через scp -P 2222 -i ... master@127.0.0.1:/vault/dump.sql /mnt/usb/ и удали или обнули /var/log/access.log.',
      ],
    },
  },
];

export function getHotlineLevel(levelId: number): LevelDefinition {
  return HOTLINE_KUMIR_LEVELS.find((l) => l.id === levelId) || HOTLINE_KUMIR_LEVELS[0];
}
