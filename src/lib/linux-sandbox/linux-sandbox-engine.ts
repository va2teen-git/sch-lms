import type {
  LinuxExecResult,
  LinuxLevelConfig,
  LinuxWorldEffect,
  TerminalAdapter,
  VfsDirNode,
  VfsFileNode,
  VfsNode,
} from './types.ts';

function cloneVfsNode(node: VfsNode): VfsNode {
  if (node.kind === 'file') {
    return {
      ...node,
      stringsLines: node.stringsLines ? [...node.stringsLines] : undefined,
    };
  }
  const children: Record<string, VfsNode> = {};
  for (const [k, v] of Object.entries(node.children)) {
    children[k] = cloneVfsNode(v);
  }
  return {
    kind: 'dir',
    name: node.name,
    mode: node.mode,
    owner: node.owner,
    children,
  };
}

function decodeBase64Utf8(input: string): string | null {
  const clean = input.trim().replace(/\s+/g, '');
  if (!clean || !/^[A-Za-z0-9+/=]+$/.test(clean) || clean.length % 4 !== 0) {
    return null;
  }
  try {
    if (typeof atob === 'function') {
      const bin = atob(clean);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').toString('utf8');
    }
  } catch {
    return null;
  }
  return null;
}

function formatMode(node: VfsNode): string {
  const prefix = node.kind === 'dir' ? 'd' : '-';
  const m = node.mode & 0o777;
  const triad = (bits: number) =>
    `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${bits & 1 ? 'x' : '-'}`;
  return `${prefix}${triad((m >> 6) & 7)}${triad((m >> 3) & 7)}${triad(m & 7)}`;
}

function splitTokens(segment: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasToken = true;
      continue;
    }
    if (ch === ' ' || ch === '\t') {
      if (hasToken) {
        tokens.push(cur);
        cur = '';
        hasToken = false;
      }
      continue;
    }
    cur += ch;
    hasToken = true;
  }

  if (hasToken) {
    tokens.push(cur);
  }
  return tokens;
}

function splitChain(line: string): Array<{ op: 'START' | 'AND' | 'SEMI'; cmd: string }> {
  const parts: Array<{ op: 'START' | 'AND' | 'SEMI'; cmd: string }> = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let pendingOp: 'START' | 'AND' | 'SEMI' = 'START';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '&' && line[i + 1] === '&') {
      parts.push({ op: pendingOp, cmd: cur.trim() });
      cur = '';
      pendingOp = 'AND';
      i++;
      continue;
    }
    if (ch === ';') {
      parts.push({ op: pendingOp, cmd: cur.trim() });
      cur = '';
      pendingOp = 'SEMI';
      continue;
    }
    cur += ch;
  }
  parts.push({ op: pendingOp, cmd: cur.trim() });
  return parts.filter((p) => p.cmd.length > 0);
}

function splitPipes(cmd: string): string[] {
  const segments: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '|') {
      segments.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  segments.push(cur.trim());
  return segments.filter((s) => s.length > 0);
}

function wildcardToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export const BUILTIN_COMMANDS = [
  'ls',
  'cd',
  'pwd',
  'cat',
  'grep',
  'find',
  'strings',
  'base64',
  'echo',
  'chmod',
  'id',
  'ps',
  'ss',
  'netstat',
  'sudo',
  'crontab',
  'tar',
  'scp',
  'cp',
  'rm',
  'truncate',
  'help',
  'clear',
];

/**
 * Shared virtual Linux sandbox engine with VFS, pipes, command chains, and IDS hooks.
 */
export class LinuxSandboxEngine {
  private readonly config: LinuxLevelConfig;
  private readonly vfsRoot: VfsDirNode;
  private cwd: string;
  private readonly history: string[] = [];
  private readonly flags = new Set<string>();
  private objectiveCompleted = false;
  private commandsCount = 0;

  constructor(config: LinuxLevelConfig) {
    this.config = config;
    this.vfsRoot = cloneVfsNode(config.vfsRoot) as VfsDirNode;
    this.cwd = config.homeDir;
  }

  getPrompt(): string {
    const shortCwd =
      this.cwd === this.config.homeDir
        ? '~'
        : this.cwd.startsWith(this.config.homeDir + '/')
          ? '~' + this.cwd.slice(this.config.homeDir.length)
          : this.cwd;
    const symbol = this.config.promptSymbol ?? '>';
    return `${this.config.user}@${this.config.host}:${shortCwd}${symbol}`;
  }

  getCwd(): string {
    return this.cwd;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  getCommandsCount(): number {
    return this.commandsCount;
  }

  isObjectiveCompleted(): boolean {
    return this.objectiveCompleted;
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  toTerminalAdapter(): TerminalAdapter {
    return createLinuxSandboxAdapter(this);
  }

  resolvePath(rawPath: string): string {
    let target = rawPath.trim();
    if (!target || target === '~') return this.config.homeDir;
    if (target.startsWith('~/')) {
      target = `${this.config.homeDir}/${target.slice(2)}`;
    } else if (!target.startsWith('/')) {
      target = `${this.cwd === '/' ? '' : this.cwd}/${target}`;
    }

    const parts = target.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    return '/' + stack.join('/');
  }

  getNode(absPath: string): VfsNode | null {
    if (absPath === '/') return this.vfsRoot;
    const parts = absPath.split('/').filter(Boolean);
    let cur: VfsNode = this.vfsRoot;
    for (const p of parts) {
      if (cur.kind !== 'dir') return null;
      const next: VfsNode | undefined = cur.children[p];
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  private getParentAndName(absPath: string): { parent: VfsDirNode; name: string } | null {
    if (absPath === '/') return null;
    const parts = absPath.split('/').filter(Boolean);
    const name = parts[parts.length - 1];
    const parentPath = '/' + parts.slice(0, -1).join('/');
    const parentNode = this.getNode(parentPath);
    if (!parentNode || parentNode.kind !== 'dir') return null;
    return { parent: parentNode, name };
  }

  private ensureDir(absPath: string): VfsDirNode | null {
    const existing = this.getNode(absPath);
    if (existing && existing.kind === 'dir') return existing;
    const parts = absPath.split('/').filter(Boolean);
    let cur: VfsDirNode = this.vfsRoot;
    for (const p of parts) {
      const next = cur.children[p];
      if (!next) {
        const created: VfsDirNode = {
          kind: 'dir',
          name: p,
          mode: 0o755,
          owner: this.config.user,
          children: {},
        };
        cur.children[p] = created;
        cur = created;
      } else if (next.kind === 'dir') {
        cur = next;
      } else {
        return null;
      }
    }
    return cur;
  }

  autocomplete(input: string): string[] {
    const trimmedStart = input.trimStart();
    if (!trimmedStart) {
      return [...BUILTIN_COMMANDS, ...Object.keys(this.config.customCommands)];
    }

    const parts = trimmedStart.split(/\s+/);
    const endsWithSpace = /\s$/.test(input);
    if (parts.length === 1 && !endsWithSpace) {
      const prefix = parts[0];
      const allCmds = Array.from(new Set([...BUILTIN_COMMANDS, ...Object.keys(this.config.customCommands)]));
      return allCmds.filter((c) => c.startsWith(prefix)).sort();
    }

    const pathToken = endsWithSpace ? '' : parts[parts.length - 1];
    const slashIdx = pathToken.lastIndexOf('/');
    const dirPart = slashIdx >= 0 ? pathToken.slice(0, slashIdx + 1) : '';
    const basePart = slashIdx >= 0 ? pathToken.slice(slashIdx + 1) : pathToken;

    const resolvedDir = dirPart ? this.resolvePath(dirPart) : this.cwd;
    const dirNode = this.getNode(resolvedDir);
    if (!dirNode || dirNode.kind !== 'dir') return [];

    return Object.values(dirNode.children)
      .filter((n) => n.name.startsWith(basePart))
      .map((n) => `${dirPart}${n.name}${n.kind === 'dir' ? '/' : ''}`)
      .sort();
  }

  exec(rawLine: string): LinuxExecResult {
    const line = rawLine.trim();
    if (!line) {
      return {
        output: '',
        exitCode: 0,
        noiseDelta: 0,
        commandTickCost: 0,
        effects: [],
        objectiveCompletedNow: false,
      };
    }

    if (this.history[this.history.length - 1] !== line) {
      this.history.push(line);
    }
    this.commandsCount++;

    const chain = splitChain(line);
    const outputs: string[] = [];
    let lastCode = 0;
    let totalNoise = 0;
    let clearScreen = false;
    const allEffects: LinuxWorldEffect[] = [];

    for (const item of chain) {
      if (item.op === 'AND' && lastCode !== 0) {
        break;
      }

      const suppressErrors = /2\s*>\s*\/dev\/null/.test(item.cmd);
      const cleanedCmd = item.cmd.replace(/2\s*>\s*\/dev\/null/g, '').trim();
      const pipeSegments = splitPipes(cleanedCmd);

      let stdin = '';
      let segExit = 0;
      for (const seg of pipeSegments) {
        const res = this.execSingleSegment(seg, stdin);
        stdin = res.output;
        segExit = res.exitCode;
        totalNoise += res.noiseDelta;
        if (res.clearScreen) clearScreen = true;
        allEffects.push(...res.effects);
      }

      lastCode = segExit;
      if (stdin && !(suppressErrors && segExit !== 0)) {
        outputs.push(stdin);
      }
    }

    let objectiveCompletedNow = false;
    if (!this.objectiveCompleted && this.config.requiredFlags.every((f) => this.flags.has(f))) {
      this.objectiveCompleted = true;
      objectiveCompletedNow = true;
      allEffects.push({ type: 'COMPLETE_HACK' });
    }

    return {
      output: outputs.join('\n'),
      exitCode: lastCode,
      clearScreen,
      noiseDelta: totalNoise,
      commandTickCost: clearScreen ? 0 : 1,
      effects: allEffects,
      objectiveCompletedNow,
    };
  }

  private execSingleSegment(
    seg: string,
    stdin: string
  ): { output: string; exitCode: number; noiseDelta: number; clearScreen?: boolean; effects: LinuxWorldEffect[] } {
    const tokens = splitTokens(seg);
    if (tokens.length === 0) {
      return { output: '', exitCode: 0, noiseDelta: 0, effects: [] };
    }

    const cmd = tokens[0];
    const args = tokens.slice(1);

    if (this.config.customCommands[cmd]) {
      const customRes = this.config.customCommands[cmd](args, {
        flags: this.flags,
        vfsRoot: this.vfsRoot,
      });
      if (customRes.setFlags) {
        for (const f of customRes.setFlags) this.flags.add(f);
      }
      return {
        output: customRes.output,
        exitCode: customRes.exitCode,
        noiseDelta: customRes.noiseDelta || 0,
        effects: customRes.effects || [],
      };
    }

    switch (cmd) {
      case 'clear':
        return { output: '', exitCode: 0, noiseDelta: 0, clearScreen: true, effects: [] };

      case 'help':
      case 'помощь':
      case 'справка': {
        if (this.config.helpLines && this.config.helpLines.length > 0) {
          return { output: this.config.helpLines.join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
        }
        const customNames = Object.keys(this.config.customCommands);
        const lines = [
          'Доступные команды песочницы Linux:',
          '  ls [-la], cd <путь>, pwd, cat <файл>, grep [-i] <шаблон> [файл]',
          '  find <путь> -name <маска>, strings <файл>, base64 -d, echo <текст>',
          '  chmod <права> <файл>, id, ps aux, ss -tulpn / netstat, sudo -l, crontab -l',
          '  tar -czf <архив> <цель>, scp [-P порт] [-i ключ] ..., cp, rm, truncate -s 0 <файл>',
        ];
        if (customNames.length > 0) {
          lines.push(`  Утилиты узла: ${customNames.join(', ')}`);
        }
        lines.push('  Для справки по языку КуМир введите «помощь» или «справка» в редакторе слева.');
        return { output: lines.join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'pwd':
        return { output: this.cwd, exitCode: 0, noiseDelta: 0, effects: [] };

      case 'id':
        return { output: this.config.idInfo, exitCode: 0, noiseDelta: 0, effects: [] };

      case 'echo':
        return { output: args.join(' '), exitCode: 0, noiseDelta: 0, effects: [] };

      case 'cd': {
        const target = args[0] ? this.resolvePath(args[0]) : this.config.homeDir;
        const node = this.getNode(target);
        if (!node) {
          return { output: `cd: ${args[0] || target}: Нет такого файла или каталога`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if (node.kind !== 'dir') {
          return { output: `cd: ${args[0]}: Не является каталогом`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        this.cwd = target;
        return { output: '', exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'ls': {
        let showAll = false;
        let longFmt = false;
        const paths: string[] = [];
        for (const a of args) {
          if (a.startsWith('-')) {
            if (a.includes('a')) showAll = true;
            if (a.includes('l')) longFmt = true;
          } else {
            paths.push(a);
          }
        }
        const targetPath = this.resolvePath(paths[0] || '.');
        const node = this.getNode(targetPath);
        if (!node) {
          return { output: `ls: невозможно получить доступ к '${paths[0] || '.'}': Нет такого файла или каталога`, exitCode: 2, noiseDelta: 0, effects: [] };
        }
        if (node.kind === 'file') {
          if (longFmt) {
            return {
              output: `${formatMode(node)} 1 ${node.owner} ${String(node.size).padStart(5)} Nov 25 02:14 ${node.name}`,
              exitCode: 0,
              noiseDelta: 0,
              effects: [],
            };
          }
          return { output: node.name, exitCode: 0, noiseDelta: 0, effects: [] };
        }

        const entries = Object.values(node.children)
          .filter((child) => showAll || !child.name.startsWith('.'))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!longFmt) {
          return {
            output: entries.map((e) => (e.kind === 'dir' ? `${e.name}/` : e.name)).join('  '),
            exitCode: 0,
            noiseDelta: 0,
            effects: [],
          };
        }

        const lines = entries.map(
          (e) =>
            `${formatMode(e)} 1 ${e.owner.padEnd(8)} ${String(e.kind === 'dir' ? 4096 : e.size).padStart(5)} Nov 25 02:14 ${e.name}${e.kind === 'dir' ? '/' : ''}`
        );
        return { output: lines.join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'cat': {
        if (!args[0]) {
          return { output: 'cat: не указан путь к файлу', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const abs = this.resolvePath(args[0]);
        if (this.config.honeypotPaths.includes(abs)) {
          return {
            output: `cat: ${args[0]}: Отказано в доступе [IDS ALERT: попытка чтения защищённого файла]`,
            exitCode: 1,
            noiseDelta: 1,
            effects: [],
          };
        }
        const node = this.getNode(abs);
        if (!node) {
          return { output: `cat: ${args[0]}: Нет такого файла или каталога`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if (node.kind === 'dir') {
          return { output: `cat: ${args[0]}: Это каталог`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if ((node.mode & 0o444) === 0) {
          return { output: `cat: ${args[0]}: Отказано в доступе (права 000)`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if (node.isBinary) {
          return { output: '[BINARY DUMP — используйте утилиту strings]', exitCode: 0, noiseDelta: 0, effects: [] };
        }
        return { output: node.content, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'strings': {
        if (!args[0]) {
          return { output: 'strings: не указан файл дампа', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const abs = this.resolvePath(args[0]);
        const node = this.getNode(abs);
        if (!node || node.kind !== 'file') {
          return { output: `strings: '${args[0]}': Файл не найден`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if ((node.mode & 0o444) === 0) {
          return { output: `strings: '${args[0]}': Отказано в доступе`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const out = node.stringsLines ? node.stringsLines.join('\n') : node.content;
        return { output: out, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'grep': {
        let ignoreCase = false;
        let withLineNum = false;
        const posArgs: string[] = [];
        for (const a of args) {
          if (a.startsWith('-')) {
            if (a.includes('i')) ignoreCase = true;
            if (a.includes('n')) withLineNum = true;
          } else {
            posArgs.push(a);
          }
        }
        const pattern = posArgs[0];
        if (!pattern) {
          return { output: 'grep: укажите шаблон поиска', exitCode: 2, noiseDelta: 0, effects: [] };
        }
        let sourceText = stdin;
        if (posArgs[1]) {
          const abs = this.resolvePath(posArgs[1]);
          const node = this.getNode(abs);
          if (!node || node.kind !== 'file') {
            return { output: `grep: ${posArgs[1]}: Файл не найден`, exitCode: 2, noiseDelta: 0, effects: [] };
          }
          if ((node.mode & 0o444) === 0) {
            return { output: `grep: ${posArgs[1]}: Отказано в доступе`, exitCode: 2, noiseDelta: 0, effects: [] };
          }
          sourceText = node.stringsLines ? node.stringsLines.join('\n') : node.content;
        }
        const lines = sourceText.split('\n');
        const needle = ignoreCase ? pattern.toLowerCase() : pattern;
        const matched: string[] = [];
        lines.forEach((ln, idx) => {
          const hay = ignoreCase ? ln.toLowerCase() : ln;
          if (hay.includes(needle)) {
            matched.push(withLineNum ? `${idx + 1}:${ln}` : ln);
          }
        });
        return { output: matched.join('\n'), exitCode: matched.length > 0 ? 0 : 1, noiseDelta: 0, effects: [] };
      }

      case 'find': {
        const startArg = args[0] && !args[0].startsWith('-') ? args[0] : '.';
        const startAbs = this.resolvePath(startArg);
        const startNode = this.getNode(startAbs);
        if (!startNode) {
          return { output: `find: '${startArg}': Нет такого файла или каталога`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        let namePattern: RegExp | null = null;
        const nameIdx = args.indexOf('-name');
        if (nameIdx >= 0 && args[nameIdx + 1]) {
          namePattern = wildcardToRegex(args[nameIdx + 1]);
        }
        const found: string[] = [];
        const walk = (node: VfsNode, curPath: string) => {
          if (!namePattern || namePattern.test(node.name)) {
            found.push(curPath);
          }
          if (node.kind === 'dir') {
            for (const child of Object.values(node.children)) {
              const childPath = curPath === '/' ? `/${child.name}` : `${curPath}/${child.name}`;
              walk(child, childPath);
            }
          }
        };
        walk(startNode, startAbs);
        return { output: found.join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'base64': {
        const decodeMode = args.includes('-d') || args.includes('--decode');
        if (!decodeMode) {
          return { output: 'Использование: echo "<строка>" | base64 -d', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const fileArg = args.find((a) => !a.startsWith('-'));
        let rawInput = stdin;
        if (fileArg) {
          const node = this.getNode(this.resolvePath(fileArg));
          if (!node || node.kind !== 'file') {
            return { output: `base64: ${fileArg}: Файл не найден`, exitCode: 1, noiseDelta: 0, effects: [] };
          }
          rawInput = node.content;
        }
        const decoded = decodeBase64Utf8(rawInput);
        if (decoded === null) {
          return { output: 'base64: некорректные входные данные', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        return { output: decoded, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'chmod': {
        if (args.length < 2) {
          return { output: 'chmod: недостаточно аргументов (пример: chmod +r файл или chmod 600 ключ)', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const modeSpec = args[0];
        const targetAbs = this.resolvePath(args[1]);
        const node = this.getNode(targetAbs);
        if (!node) {
          return { output: `chmod: невозможно получить доступ к '${args[1]}': Нет такого файла`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        if (/^[0-7]{3,4}$/.test(modeSpec)) {
          node.mode = parseInt(modeSpec, 8);
        } else if (modeSpec === '+r' || modeSpec === 'a+r' || modeSpec === 'u+r') {
          node.mode |= 0o444;
        } else if (modeSpec === '+x' || modeSpec === 'a+x' || modeSpec === 'u+x') {
          node.mode |= 0o111;
        } else {
          return { output: `chmod: неподдерживаемый режим '${modeSpec}'`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        return { output: `Права доступа для ${targetAbs} обновлены (${formatMode(node)})`, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'ps': {
        const header = 'USER       PID %CPU %MEM COMMAND';
        return { output: [header, ...this.config.processes].join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'ss':
      case 'netstat': {
        const header = 'Netid State   Local Address:Port   Peer Address:Port   Process';
        return { output: [header, ...this.config.sockets].join('\n'), exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'sudo': {
        if (args[0] === '-l') {
          return { output: this.config.sudoListOutput, exitCode: 0, noiseDelta: 0, effects: [] };
        }
        return {
          output: `sudo: пользователь ${this.config.user} не имеет прав на '${args.join(' ') || ''}' [IDS: инцидент зафиксирован]`,
          exitCode: 1,
          noiseDelta: 1,
          effects: [],
        };
      }

      case 'crontab': {
        if (args.includes('-l')) {
          return { output: this.config.crontabContent, exitCode: 0, noiseDelta: 0, effects: [] };
        }
        return { output: 'Использование: crontab -l', exitCode: 1, noiseDelta: 0, effects: [] };
      }

      case 'tar': {
        const positional = args.filter((a) => !a.startsWith('-'));
        if (positional.length < 2) {
          return { output: 'tar: укажите архив и исходный путь (например: tar -czf /mnt/usb/audit.tar.gz /srv/secret)', exitCode: 2, noiseDelta: 0, effects: [] };
        }
        const archiveAbs = this.resolvePath(positional[0]);
        const srcAbs = this.resolvePath(positional[1]);
        const srcNode = this.getNode(srcAbs);
        if (!srcNode) {
          return { output: `tar: ${positional[1]}: Нет такого файла или каталога`, exitCode: 2, noiseDelta: 0, effects: [] };
        }
        const targetInfo = this.getParentAndName(archiveAbs);
        if (!targetInfo) {
          return { output: `tar: некорректный путь назначения ${positional[0]}`, exitCode: 2, noiseDelta: 0, effects: [] };
        }
        const fileNode: VfsFileNode = {
          kind: 'file',
          name: targetInfo.name,
          mode: 0o644,
          owner: this.config.user,
          size: 4096,
          content: `[TAR.GZ ARCHIVE OF ${srcAbs}]`,
        };
        targetInfo.parent.children[targetInfo.name] = fileNode;
        if (archiveAbs.startsWith('/mnt/usb/')) {
          this.flags.add('EXFILTRATED_USB');
        }
        return { output: `Архив ${archiveAbs} успешно создан из ${srcAbs}`, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'cp': {
        const positional = args.filter((a) => !a.startsWith('-'));
        if (positional.length < 2) {
          return { output: 'cp: укажите источник и назначение', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const srcAbs = this.resolvePath(positional[0]);
        const dstAbs = this.resolvePath(positional[1]);
        const srcNode = this.getNode(srcAbs);
        if (!srcNode) {
          return { output: `cp: не удалось выполнить stat для '${positional[0]}': Нет такого файла`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const dstNode = this.getNode(dstAbs);
        if (dstNode && dstNode.kind === 'dir') {
          dstNode.children[srcNode.name] = cloneVfsNode(srcNode);
        } else {
          const pInfo = this.getParentAndName(dstAbs);
          if (!pInfo) return { output: `cp: неверный путь ${positional[1]}`, exitCode: 1, noiseDelta: 0, effects: [] };
          const copy = cloneVfsNode(srcNode);
          copy.name = pInfo.name;
          pInfo.parent.children[pInfo.name] = copy;
        }
        if (dstAbs.startsWith('/mnt/usb')) {
          this.flags.add('EXFILTRATED_USB');
        }
        return { output: `Скопировано: ${srcAbs} -> ${dstAbs}`, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'scp': {
        let port = '22';
        let keyPath = '';
        const positional: string[] = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] === '-P' && args[i + 1]) {
            port = args[++i];
          } else if (args[i] === '-i' && args[i + 1]) {
            keyPath = args[++i];
          } else if (!args[i].startsWith('-')) {
            positional.push(args[i]);
          }
        }
        if (positional.length < 2) {
          return {
            output: 'scp: использование: scp -P <порт> -i <ключ> master@127.0.0.1:/vault/dump.sql /mnt/usb/',
            exitCode: 1,
            noiseDelta: 0,
            effects: [],
          };
        }
        const resolvedKey = keyPath ? this.resolvePath(keyPath) : '';
        const keyNode = resolvedKey ? this.getNode(resolvedKey) : null;
        if (!keyNode || keyNode.kind !== 'file') {
          return { output: `scp: ключ '${keyPath || '(не указан)'}' не найден`, exitCode: 1, noiseDelta: 1, effects: [] };
        }
        if ((keyNode.mode & 0o077) !== 0) {
          return {
            output: `@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@\n@ WARNING: UNPROTECTED PRIVATE KEY FILE! (${formatMode(keyNode)})\n@ Выполните: chmod 600 ${resolvedKey}\n@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@`,
            exitCode: 1,
            noiseDelta: 0,
            effects: [],
          };
        }
        if (port !== '2222' || !positional[0].includes('/vault/dump.sql')) {
          return { output: `ssh: connect to host 127.0.0.1 port ${port}: Connection refused`, exitCode: 255, noiseDelta: 1, effects: [] };
        }
        const usbDir = this.ensureDir('/mnt/usb');
        if (usbDir) {
          usbDir.children['dump.sql'] = {
            kind: 'file',
            name: 'dump.sql',
            mode: 0o600,
            owner: this.config.user,
            size: 16384,
            content: '-- EXFILTRATED SCHOOL OGE ARCHIVE DUMP --',
          };
        }
        this.flags.add('SCP_DUMP_DONE');
        return {
          output: 'dump.sql                                      100%   16KB   4.2MB/s   00:00\n[CORE-SHIELD]: лазерный контур L5-core (5..8,3) и шлюз D(17,2) разблокированы.',
          exitCode: 0,
          noiseDelta: 0,
          effects: [
            { type: 'DISABLE_LASER', laserId: 'L5-core' },
            { type: 'UNLOCK_DOOR', doorId: 'door-core' },
          ],
        };
      }

      case 'rm': {
        const targetArg = args.find((a) => !a.startsWith('-'));
        if (!targetArg) {
          return { output: 'rm: пропущен операнд', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const targetAbs = this.resolvePath(targetArg);
        const pInfo = this.getParentAndName(targetAbs);
        if (!pInfo || !pInfo.parent.children[pInfo.name]) {
          return { output: `rm: невозможно удалить '${targetArg}': Нет такого файла`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        delete pInfo.parent.children[pInfo.name];
        if (targetAbs === '/var/log/access.log') {
          this.flags.add('LOGS_CLEANED');
          return {
            output: '[TAMPER SENSOR]: Удаление файла журнала /var/log/access.log вызвало аппаратную тревогу! Наряд ГБР выехал!',
            exitCode: 0,
            noiseDelta: 0,
            effects: [{ type: 'TRIGGER_ALARM', reason: 'Аппаратный датчик: удаление /var/log/access.log' }],
          };
        }
        return { output: `Удалено: ${targetAbs}`, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      case 'truncate': {
        const targetArg = args[args.length - 1];
        if (!targetArg || targetArg.startsWith('-')) {
          return { output: 'truncate: использование: truncate -s 0 <файл>', exitCode: 1, noiseDelta: 0, effects: [] };
        }
        const targetAbs = this.resolvePath(targetArg);
        const node = this.getNode(targetAbs);
        if (!node || node.kind !== 'file') {
          return { output: `truncate: '${targetArg}': Файл не найден`, exitCode: 1, noiseDelta: 0, effects: [] };
        }
        node.content = '';
        node.size = 0;
        if (targetAbs === '/var/log/access.log') {
          this.flags.add('LOGS_CLEANED');
          return {
            output: 'Размер /var/log/access.log обнулён без нарушения целостности инода. Датчик целостности молчит!',
            exitCode: 0,
            noiseDelta: 0,
            effects: [],
          };
        }
        return { output: `Файл ${targetAbs} усечён до 0 байт`, exitCode: 0, noiseDelta: 0, effects: [] };
      }

      default:
        return {
          output: `${cmd}: команда не найдена (введите «help» для справки)`,
          exitCode: 127,
          noiseDelta: 0,
          effects: [],
        };
    }
  }
}

export function createLinuxSandboxAdapter(engine: LinuxSandboxEngine): TerminalAdapter {
  return {
    getPrompt: () => engine.getPrompt(),
    execute: (cmd: string) => engine.exec(cmd),
    autocomplete: (input: string) => engine.autocomplete(input),
    getHistory: () => engine.getHistory(),
  };
}

export { LinuxSandboxEngine as LinuxHackEngine };
