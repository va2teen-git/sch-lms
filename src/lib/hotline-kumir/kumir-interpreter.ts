import type {
  ActionCommandKind,
  AlgDeclNode,
  BoolExprNode,
  Direction,
  KumirActionRequest,
  KumirError,
  KumirErrorCode,
  KumirSensorReader,
  ProgramNode,
  SensorDirection,
  SensorKind,
  SourceSpan,
  StepResult,
  StmtNode,
} from './types.ts';

export const KUMIR_LIMITS = {
  MAX_SOURCE_LENGTH: 8192,
  MAX_AST_NODES: 400,
  MAX_LOOP_COUNT_ARG: 99,
  MAX_CALL_DEPTH: 16,
  MAX_TICKS_PER_TURN: 32,
  MAX_VM_OPS_PER_TURN: 512,
  MAX_TOTAL_STEPS_SESSION: 5000,
} as const;

type TokenKind = 'WORD' | 'INT' | 'SEMI' | 'NEWLINE' | 'LPAREN' | 'RPAREN' | 'EOF';

interface Token {
  kind: TokenKind;
  raw: string;
  norm: string;
  line: number;
  col: number;
}

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

function makeError(
  code: KumirErrorCode,
  line: number,
  column: number,
  messageRu: string,
  isFatalToTurn = false
): KumirError {
  return { code, line, column, messageRu, isFatalToTurn };
}

function isIdentStart(ch: string): boolean {
  return /[a-zA-Zа-яА-ЯёЁ_]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[a-zA-Zа-яА-ЯёЁ0-9_]/.test(ch);
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

export function tokenizeKumir(source: string): { ok: true; tokens: Token[]; locCount: number } | { ok: false; errors: KumirError[] } {
  if (source.length > KUMIR_LIMITS.MAX_SOURCE_LENGTH) {
    return {
      ok: false,
      errors: [
        makeError(
          'E_LEX_TOO_LARGE',
          1,
          1,
          `Исходный код превышает лимит ${KUMIR_LIMITS.MAX_SOURCE_LENGTH} символов.`
        ),
      ],
    };
  }

  const tokens: Token[] = [];
  const errors: KumirError[] = [];
  let line = 1;
  let col = 1;
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\r') {
      i++;
      continue;
    }

    if (ch === '\n') {
      tokens.push({ kind: 'NEWLINE', raw: '\n', norm: '\n', line, col });
      i++;
      line++;
      col = 1;
      continue;
    }

    if (ch === ' ' || ch === '\t') {
      i++;
      col++;
      continue;
    }

    if (ch === '|') {
      while (i < source.length && source[i] !== '\n') {
        i++;
        col++;
      }
      continue;
    }

    if (ch === ';') {
      tokens.push({ kind: 'SEMI', raw: ';', norm: ';', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ kind: 'LPAREN', raw: '(', norm: '(', line, col });
      i++;
      col++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ kind: 'RPAREN', raw: ')', norm: ')', line, col });
      i++;
      col++;
      continue;
    }

    if (isDigit(ch)) {
      const startCol = col;
      let raw = '';
      while (i < source.length && isDigit(source[i])) {
        raw += source[i];
        i++;
        col++;
      }
      tokens.push({ kind: 'INT', raw, norm: raw, line, col: startCol });
      continue;
    }

    if (isIdentStart(ch)) {
      const startCol = col;
      let raw = '';
      while (i < source.length && isIdentPart(source[i])) {
        raw += source[i];
        i++;
        col++;
      }
      tokens.push({
        kind: 'WORD',
        raw,
        norm: normalizeWord(raw),
        line,
        col: startCol,
      });
      continue;
    }

    errors.push(
      makeError(
        'E_LEX_UNKNOWN_TOKEN',
        line,
        col,
        `Строка ${line}: недопустимый символ «${ch}». Используйте кириллические команды КуМир.`
      )
    );
    i++;
    col++;
  }

  tokens.push({ kind: 'EOF', raw: '', norm: '', line, col });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nonEmptyLines = new Set<number>();
  for (const t of tokens) {
    if (t.kind !== 'NEWLINE' && t.kind !== 'SEMI' && t.kind !== 'EOF') {
      nonEmptyLines.add(t.line);
    }
  }

  return { ok: true, tokens, locCount: nonEmptyLines.size };
}

const DIRECTION_MAP: Record<string, Direction> = {
  вверх: 'UP',
  вниз: 'DOWN',
  влево: 'LEFT',
  вправо: 'RIGHT',
};

const SENSOR_DIR_MAP: Record<string, SensorDirection> = {
  сверху: 'UP',
  снизу: 'DOWN',
  слева: 'LEFT',
  справа: 'RIGHT',
};

const BASIC_ACTION_MAP: Record<string, ActionCommandKind> = {
  вверх: 'MOVE',
  вниз: 'MOVE',
  влево: 'MOVE',
  вправо: 'MOVE',
  пометить: 'PAINT',
  активировать: 'PAINT',
};

class KumirParser {
  private readonly tokens: Token[];
  private readonly locCount: number;
  private pos = 0;
  private astNodes = 0;
  private usedLoops = false;
  private usedConditions = false;
  private usedSubprograms = false;
  private readonly errors: KumirError[] = [];

  constructor(tokens: Token[], locCount: number) {
    this.tokens = tokens;
    this.locCount = locCount;
  }

  private peek(offset = 0): Token {
    const idx = Math.min(this.pos + offset, this.tokens.length - 1);
    return this.tokens[idx];
  }

  private advance(): Token {
    const tok = this.peek();
    if (tok.kind !== 'EOF') this.pos++;
    return tok;
  }

  private isSep(tok = this.peek()): boolean {
    return tok.kind === 'NEWLINE' || tok.kind === 'SEMI';
  }

  private skipSeps(): boolean {
    let skipped = false;
    while (this.isSep()) {
      this.advance();
      skipped = true;
    }
    return skipped;
  }

  private addNode(): void {
    this.astNodes++;
    if (this.astNodes > KUMIR_LIMITS.MAX_AST_NODES) {
      const t = this.peek();
      this.fail(
        'E_PARSE_AST_LIMIT',
        t.line,
        t.col,
        `Строка ${t.line}: превышен лимит сложности программы (${KUMIR_LIMITS.MAX_AST_NODES} узлов AST).`
      );
    }
  }

  private fail(code: KumirErrorCode, line: number, col: number, msg: string): never {
    const err = makeError(code, line, col, msg);
    this.errors.push(err);
    throw err;
  }

  private expectWord(expectedNorm: string, code: KumirErrorCode, msg: string, lineOverride?: number): Token {
    const t = this.peek();
    if (t.kind !== 'WORD' || t.norm !== expectedNorm) {
      this.fail(code, lineOverride ?? t.line, t.col, msg);
    }
    return this.advance();
  }

  private spanFrom(start: Token, end: Token): SourceSpan {
    return {
      startLine: start.line,
      startCol: start.col,
      endLine: end.line,
      endCol: end.col + end.raw.length,
    };
  }

  parseProgram(): { ok: true; program: ProgramNode } | { ok: false; errors: KumirError[] } {
    try {
      this.skipSeps();

      if (this.peek().kind === 'WORD' && this.peek().norm === 'использовать') {
        const useTok = this.advance();
        const modTok = this.peek();
        if (modTok.kind !== 'WORD' || (modTok.norm !== 'робот' && modTok.norm !== 'агент')) {
          this.fail(
            'E_PARSE_UNEXPECTED_TOKEN',
            modTok.line,
            modTok.col,
            `Строка ${useTok.line}: после «использовать» ожидалось «Робот» или «Агент».`
          );
        }
        this.advance();
        this.skipSeps();
      }

      const algorithms: Record<string, AlgDeclNode> = {};
      let entryAlg = 'Ход';
      let isSpeedWrapped = false;

      if (this.peek().kind === 'EOF') {
        this.fail(
          'E_PARSE_UNEXPECTED_TOKEN',
          1,
          1,
          'Строка 1: редактор пуст. Введите хотя бы одну команду для Агента (например: «вправо»).'
        );
      }

      if (this.peek().kind === 'WORD' && this.peek().norm === 'алг') {
        let index = 0;
        while (this.peek().kind === 'WORD' && this.peek().norm === 'алг') {
          const decl = this.parseAlgDecl(index);
          index++;
          const key = normalizeWord(decl.name);
          if (algorithms[key]) {
            this.fail(
              'E_SEM_DUPLICATE_ALG',
              decl.span.startLine,
              decl.span.startCol,
              `Строка ${decl.span.startLine}: алгоритм «${decl.name}» уже объявлен ранее.`
            );
          }
          algorithms[key] = decl;
          if (index === 1) {
            entryAlg = decl.name;
          }
          this.skipSeps();
        }
        if (index > 1) {
          this.usedSubprograms = true;
        }
      } else {
        isSpeedWrapped = true;
        const firstTok = this.peek();
        const body = this.parseStmtList([]);
        const lastTok = this.tokens[Math.max(0, this.pos - 1)] || firstTok;
        algorithms[normalizeWord(entryAlg)] = {
          name: entryAlg,
          body,
          span: this.spanFrom(firstTok, lastTok),
        };
      }

      this.skipSeps();
      if (this.peek().kind !== 'EOF') {
        const t = this.peek();
        this.fail(
          'E_PARSE_UNEXPECTED_TOKEN',
          t.line,
          t.col,
          `Строка ${t.line}: неожиданный фрагмент «${t.raw}».`
        );
      }

      this.validateCalls(algorithms);

      return {
        ok: true,
        program: {
          entryAlg,
          algorithms,
          isSpeedWrapped,
          locCount: this.locCount,
          usedLoops: this.usedLoops,
          usedConditions: this.usedConditions,
          usedSubprograms: this.usedSubprograms,
        },
      };
    } catch {
      return { ok: false, errors: this.errors };
    }
  }

  private validateCalls(algorithms: Record<string, AlgDeclNode>): void {
    const checkStmts = (stmts: StmtNode[]) => {
      for (const s of stmts) {
        if (s.kind === 'CALL') {
          const key = normalizeWord(s.algName);
          if (!algorithms[key]) {
            this.fail(
              'E_SEM_UNKNOWN_ALG',
              s.span.startLine,
              s.span.startCol,
              `Строка ${s.span.startLine}: команда или алгоритм «${s.algName}» не объявлены. Добавьте блок «алг ${s.algName} ... нач ... кон».`
            );
          }
        } else if (s.kind === 'IF') {
          checkStmts(s.thenBranch);
          if (s.elseBranch) checkStmts(s.elseBranch);
        } else if (s.kind === 'WHILE' || s.kind === 'REPEAT') {
          checkStmts(s.body);
        }
      }
    };

    for (const key of Object.keys(algorithms)) {
      checkStmts(algorithms[key].body);
    }
  }

  private parseAlgDecl(index: number): AlgDeclNode {
    const start = this.expectWord('алг', 'E_PARSE_UNEXPECTED_TOKEN', 'Ожидалось ключевое слово «алг».');
    let name = index === 0 ? 'Главный' : `Подпрограмма_${index}`;
    if (this.peek().kind === 'WORD' && this.peek().norm !== 'нач') {
      name = this.advance().raw;
    }
    this.skipSeps();
    this.expectWord(
      'нач',
      'E_PARSE_MISSING_END',
      `Строка ${start.line}: после «алг ${name}» ожидалось ключевое слово «нач».`
    );
    this.skipSeps();
    const body = this.parseStmtList(['кон']);
    const end = this.expectWord(
      'кон',
      'E_PARSE_MISSING_END',
      `Строка ${start.line}: алгоритм «${name}» не закрыт словом «кон».`,
      start.line
    );
    return {
      name,
      body,
      span: this.spanFrom(start, end),
    };
  }

  private parseStmtList(stopWords: string[]): StmtNode[] {
    const stmts: StmtNode[] = [];
    const stopSet = new Set(stopWords);

    while (true) {
      this.skipSeps();
      const t = this.peek();
      if (t.kind === 'EOF') break;
      if (t.kind === 'WORD' && stopSet.has(t.norm)) break;
      if (t.kind === 'WORD' && t.norm === 'алг' && stopWords.length === 0) break;

      stmts.push(this.parseStmt());
      if (this.peek().kind !== 'EOF' && !this.isSep()) {
        const next = this.peek();
        if (!(next.kind === 'WORD' && stopSet.has(next.norm))) {
          // Allow seamless block terminators without requiring explicit separator before stopword
          continue;
        }
      }
    }
    return stmts;
  }

  private parseOptDirection(allowSensorDirs = false): Direction | undefined {
    const t = this.peek();
    if (t.kind === 'WORD' && DIRECTION_MAP[t.norm]) {
      this.advance();
      return DIRECTION_MAP[t.norm];
    }
    if (allowSensorDirs && t.kind === 'WORD' && SENSOR_DIR_MAP[t.norm]) {
      const sdir = SENSOR_DIR_MAP[t.norm];
      if (sdir === 'UP' || sdir === 'DOWN' || sdir === 'LEFT' || sdir === 'RIGHT') {
        this.advance();
        return sdir;
      }
    }
    return undefined;
  }

  private parseStmt(): StmtNode {
    this.addNode();
    const t = this.peek();
    if (t.kind !== 'WORD') {
      this.fail(
        'E_PARSE_UNEXPECTED_TOKEN',
        t.line,
        t.col,
        `Строка ${t.line}: ожидалась команда Робота, получено «${t.raw}».`
      );
    }

    if (t.norm === 'если') return this.parseIfStmt();
    if (t.norm === 'нц') return this.parseLoopStmt();

    if (t.norm === 'закрасить') {
      this.fail(
        'E_PARSE_UNEXPECTED_TOKEN',
        t.line,
        t.col,
        `Строка ${t.line}: вместо «закрасить» в «Кибер-Boy» используется команда «пометить» (или «поставить метку») — она ставит ЭМИ-метку на реле (*).`
      );
    }

    if (t.norm === 'помощь' || t.norm === 'справка') {
      const tok = this.advance();
      let endTok = tok;
      let topic: string | undefined;
      const next = this.peek();
      const allowedTopics = new Set([
        'команды',
        'движение',
        'предметы',
        'интерьер',
        'стелс',
        'бой',
        'датчики',
        'условия',
        'циклы',
        'ветвление',
        'алгоритмы',
      ]);
      if (next.kind === 'WORD' && allowedTopics.has(next.norm)) {
        endTok = this.advance();
        topic = endTok.norm;
      }
      return {
        kind: 'ACTION',
        action: 'HELP',
        topic,
        span: this.spanFrom(tok, endTok),
      };
    }

    if (
      t.norm === 'осмотреть' ||
      t.norm === 'обыскать' ||
      t.norm === 'взаимодействовать' ||
      t.norm === 'взять'
    ) {
      const tok = this.advance();
      let endTok = tok;
      const obj = this.peek();
      const interactNouns = new Set([
        'предмет',
        'объект',
        'ящик',
        'цветок',
        'урну',
        'мебель',
        'диван',
        'кресло',
        'шкаф',
      ]);
      if (obj.kind === 'WORD' && interactNouns.has(obj.norm)) {
        endTok = this.advance();
      }
      const dir = this.parseOptDirection(true);
      return { kind: 'ACTION', action: 'INTERACT', dir, span: this.spanFrom(tok, endTok) };
    }

    if (t.norm === 'поставить' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'метку') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'ACTION', action: 'PAINT', span: this.spanFrom(start, end) };
    }

    if (BASIC_ACTION_MAP[t.norm]) {
      const tok = this.advance();
      const action = BASIC_ACTION_MAP[tok.norm];
      const dir = DIRECTION_MAP[tok.norm];
      return {
        kind: 'ACTION',
        action,
        dir,
        span: this.spanFrom(tok, tok),
      };
    }

    if (t.norm === 'ждать') {
      const tok = this.advance();
      return { kind: 'ACTION', action: 'WAIT', span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'присесть' || t.norm === 'укрыться') {
      const tok = this.advance();
      return { kind: 'ACTION', action: 'CROUCH', span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'в' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'укрытие') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'ACTION', action: 'CROUCH', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'взломать' || t.norm === 'подключиться') {
      const tok = this.advance();
      return { kind: 'ACTION', action: 'HACK', span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'выбить' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'дверь') {
      const start = this.advance();
      const end = this.advance();
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'BREACH_DOOR', dir, span: this.spanFrom(start, end) };
    }

    if (t.norm === 'открыть') {
      this.fail(
        'E_PARSE_UNEXPECTED_TOKEN',
        t.line,
        t.col,
        `Строка ${t.line}: электродверь заблокирована — открой её через ПК (T) командой «подключиться» или примени «выбить дверь» (поднимет тревогу!).`
      );
    }

    if (t.norm === 'отключить') {
      const tok = this.advance();
      let endTok = tok;
      const obj = this.peek();
      if (obj.kind === 'WORD' && (obj.norm === 'камеру' || obj.norm === 'лазер' || obj.norm === 'щиток')) {
        endTok = this.advance();
      }
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'DISABLE', dir, span: this.spanFrom(tok, endTok) };
    }

    if (t.norm === 'рывок') {
      const tok = this.advance();
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'DASH', dir, span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'удар' || t.norm === 'оглушить') {
      const tok = this.advance();
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'STRIKE', dir, span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'бросить') {
      const tok = this.advance();
      let endTok = tok;
      const obj = this.peek();
      if (obj.kind === 'WORD' && (obj.norm === 'маячок' || obj.norm === 'приманку')) {
        endTok = this.advance();
      }
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'THROW', dir, span: this.spanFrom(tok, endTok) };
    }

    if (t.norm === 'приманка') {
      const tok = this.advance();
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'THROW', dir, span: this.spanFrom(tok, tok) };
    }

    if (t.norm === 'обезвредить' || t.norm === 'вырубить' || t.norm === 'добить') {
      const tok = this.advance();
      const dir = this.parseOptDirection();
      return { kind: 'ACTION', action: 'FINISH', dir, span: this.spanFrom(tok, tok) };
    }

    // Reserve structural keywords so typos aren't mistaken for user procedures
    const reserved = new Set(['то', 'иначе', 'все', 'кц', 'пока', 'раз', 'нач', 'кон', 'алг']);
    if (reserved.has(t.norm)) {
      this.fail(
        'E_PARSE_UNEXPECTED_TOKEN',
        t.line,
        t.col,
        `Строка ${t.line}: неожиданное ключевое слово «${t.raw}» вне блока.`
      );
    }

    // User auxiliary subprogram call
    const callTok = this.advance();
    return {
      kind: 'CALL',
      algName: callTok.raw,
      span: this.spanFrom(callTok, callTok),
    };
  }

  private parseIfStmt(): StmtNode {
    this.usedConditions = true;
    const start = this.expectWord('если', 'E_PARSE_UNEXPECTED_TOKEN', 'Ожидалось «если».');
    const cond = this.parseBoolExpr();
    this.skipSeps();
    this.expectWord(
      'то',
      'E_PARSE_UNEXPECTED_TOKEN',
      `Строка ${start.line}: после условия «если» ожидалось слово «то».`
    );
    this.skipSeps();
    const thenBranch = this.parseStmtList(['иначе', 'все']);
    let elseBranch: StmtNode[] | undefined;
    if (this.peek().kind === 'WORD' && this.peek().norm === 'иначе') {
      this.advance();
      this.skipSeps();
      elseBranch = this.parseStmtList(['все']);
    }
    const end = this.expectWord(
      'все',
      'E_PARSE_MISSING_END',
      `Строка ${start.line}: ветвление «если» не закрыто словом «все».`,
      start.line
    );
    return {
      kind: 'IF',
      cond,
      thenBranch,
      elseBranch,
      span: this.spanFrom(start, end),
    };
  }

  private parseLoopStmt(): StmtNode {
    this.usedLoops = true;
    const start = this.expectWord('нц', 'E_PARSE_UNEXPECTED_TOKEN', 'Ожидалось «нц».');
    const next = this.peek();

    if (next.kind === 'WORD' && next.norm === 'пока') {
      this.advance();
      const cond = this.parseBoolExpr();
      this.skipSeps();
      const body = this.parseStmtList(['кц']);
      const end = this.expectWord(
        'кц',
        'E_PARSE_MISSING_END',
        `Строка ${start.line}: цикл «нц пока» не закрыт словом «кц».`,
        start.line
      );
      return {
        kind: 'WHILE',
        cond,
        body,
        span: this.spanFrom(start, end),
      };
    }

    if (next.kind === 'INT') {
      const countTok = this.advance();
      const count = parseInt(countTok.raw, 10);
      if (isNaN(count) || count < 1 || count > KUMIR_LIMITS.MAX_LOOP_COUNT_ARG) {
        this.fail(
          'E_SEM_LOOP_BOUND',
          countTok.line,
          countTok.col,
          `Строка ${countTok.line}: число повторений в «нц N раз» должно быть от 1 до ${KUMIR_LIMITS.MAX_LOOP_COUNT_ARG}.`
        );
      }
      this.expectWord(
        'раз',
        'E_PARSE_UNEXPECTED_TOKEN',
        `Строка ${countTok.line}: после числа повторений «${count}» ожидалось слово «раз».`
      );
      this.skipSeps();
      const body = this.parseStmtList(['кц']);
      const end = this.expectWord(
        'кц',
        'E_PARSE_MISSING_END',
        `Строка ${start.line}: цикл «нц ${count} раз» не закрыт словом «кц».`,
        start.line
      );
      return {
        kind: 'REPEAT',
        count,
        body,
        span: this.spanFrom(start, end),
      };
    }

    this.fail(
      'E_PARSE_UNEXPECTED_TOKEN',
      next.line,
      next.col,
      `Строка ${start.line}: после «нц» ожидалось «пока <условие>» или «<N> раз».`
    );
  }

  private parseBoolExpr(): BoolExprNode {
    return this.parseOrExpr();
  }

  private parseOrExpr(): BoolExprNode {
    let left = this.parseAndExpr();
    while (this.peek().kind === 'WORD' && this.peek().norm === 'или') {
      this.advance();
      this.addNode();
      const right = this.parseAndExpr();
      left = {
        kind: 'BINARY',
        op: 'OR',
        left,
        right,
        span: {
          startLine: left.span.startLine,
          startCol: left.span.startCol,
          endLine: right.span.endLine,
          endCol: right.span.endCol,
        },
      };
    }
    return left;
  }

  private parseAndExpr(): BoolExprNode {
    let left = this.parseNotExpr();
    while (this.peek().kind === 'WORD' && this.peek().norm === 'и') {
      this.advance();
      this.addNode();
      const right = this.parseNotExpr();
      left = {
        kind: 'BINARY',
        op: 'AND',
        left,
        right,
        span: {
          startLine: left.span.startLine,
          startCol: left.span.startCol,
          endLine: right.span.endLine,
          endCol: right.span.endCol,
        },
      };
    }
    return left;
  }

  private parseNotExpr(): BoolExprNode {
    if (this.peek().kind === 'WORD' && this.peek().norm === 'не') {
      const notTok = this.advance();
      this.addNode();
      const operand = this.parseNotExpr();
      return {
        kind: 'NOT',
        operand,
        span: {
          startLine: notTok.line,
          startCol: notTok.col,
          endLine: operand.span.endLine,
          endCol: operand.span.endCol,
        },
      };
    }
    return this.parsePrimaryCond();
  }

  private parsePrimaryCond(): BoolExprNode {
    const t = this.peek();
    if (t.kind === 'LPAREN') {
      this.advance();
      const inner = this.parseBoolExpr();
      const close = this.peek();
      if (close.kind !== 'RPAREN') {
        this.fail(
          'E_PARSE_BAD_EXPRESSION',
          t.line,
          t.col,
          `Строка ${t.line}: не закрыта круглая скобка в логическом выражении.`
        );
      }
      this.advance();
      return inner;
    }

    if (t.kind !== 'WORD') {
      this.fail(
        'E_PARSE_BAD_EXPRESSION',
        t.line,
        t.col,
        `Строка ${t.line}: ожидалось логическое условие (например, «справа свободно»).`
      );
    }

    this.addNode();

    if (SENSOR_DIR_MAP[t.norm]) {
      const dirTok = this.advance();
      const dir = SENSOR_DIR_MAP[dirTok.norm];
      const propTok = this.peek();
      if (propTok.kind !== 'WORD') {
        this.fail(
          'E_PARSE_BAD_EXPRESSION',
          dirTok.line,
          dirTok.col,
          `Строка ${dirTok.line}: после «${dirTok.raw}» ожидалось «свободно», «стена», «опасно», «враг», «дверь» или «предмет».`
        );
      }
      if (propTok.norm === 'свободно') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_CLEAR', dir, span: this.spanFrom(dirTok, propTok) };
      }
      if (propTok.norm === 'стена') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_WALL', dir, span: this.spanFrom(dirTok, propTok) };
      }
      if (propTok.norm === 'опасно') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_DANGER', dir, span: this.spanFrom(dirTok, propTok) };
      }
      if (propTok.norm === 'враг') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'HAS_ENEMY', dir, span: this.spanFrom(dirTok, propTok) };
      }
      if (propTok.norm === 'дверь') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'HAS_DOOR', dir, span: this.spanFrom(dirTok, propTok) };
      }
      if (propTok.norm === 'предмет') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'HAS_INTERACTABLE', dir, span: this.spanFrom(dirTok, propTok) };
      }
      this.fail(
        'E_PARSE_BAD_EXPRESSION',
        propTok.line,
        propTok.col,
        `Строка ${propTok.line}: неизвестный датчик «${dirTok.raw} ${propTok.raw}».`
      );
    }

    if (t.norm === 'метка' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'стоит') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'IS_PAINTED', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'метки' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'нет') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'IS_PAINTED', negatePainted: true, span: this.spanFrom(start, end) };
    }

    if (t.norm === 'реле') {
      const start = this.advance();
      const p = this.peek();
      if (p.kind === 'WORD' && p.norm === 'активно') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_PAINTED', span: this.spanFrom(start, p) };
      }
      if (p.kind === 'WORD' && p.norm === 'неактивно') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_PAINTED', negatePainted: true, span: this.spanFrom(start, p) };
      }
      this.fail(
        'E_PARSE_BAD_EXPRESSION',
        start.line,
        start.col,
        `Строка ${start.line}: после «реле» ожидалось «активно» или «неактивно».`
      );
    }

    if (t.norm === 'клетка') {
      const start = this.advance();
      const p = this.peek();
      if (p.kind === 'WORD' && p.norm === 'помечена') {
        this.advance();
        return { kind: 'SENSOR', sensor: 'IS_PAINTED', span: this.spanFrom(start, p) };
      }
      if (p.kind === 'WORD' && p.norm === 'без' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'метки') {
        this.advance();
        const end = this.advance();
        return { kind: 'SENSOR', sensor: 'IS_PAINTED', negatePainted: true, span: this.spanFrom(start, end) };
      }
      if (p.kind === 'WORD' && (p.norm === 'закрашена' || p.norm === 'чистая')) {
        this.fail(
          'E_PARSE_BAD_EXPRESSION',
          start.line,
          start.col,
          `Строка ${start.line}: используйте датчик «метка стоит» или «метки нет» (вместо «клетка закрашена / чистая»).`
        );
      }
      this.fail(
        'E_PARSE_BAD_EXPRESSION',
        start.line,
        start.col,
        `Строка ${start.line}: после «клетка» ожидалось «помечена» или «без метки» (рекомендуется «метка стоит» / «метки нет»).`
      );
    }

    if (t.norm === 'впереди' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'опасно') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'IS_DANGER', dir: 'FRONT', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'рядом' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'враг') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'HAS_ENEMY', dir: 'ANY', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'дверь' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'закрыта') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'HAS_DOOR', dir: 'ANY', span: this.spanFrom(start, end) };
    }

    if (
      (t.norm === 'рядом' && this.peek(1).kind === 'WORD' && (this.peek(1).norm === 'предмет' || this.peek(1).norm === 'объект')) ||
      ((t.norm === 'предмет' || t.norm === 'объект') && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'рядом')
    ) {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'HAS_INTERACTABLE', dir: 'ANY', span: this.spanFrom(start, end) };
    }

    if (
      (t.norm === 'рядом' && this.peek(1).kind === 'WORD' && (this.peek(1).norm === 'терминал' || this.peek(1).norm === 'пк')) ||
      ((t.norm === 'терминал' || t.norm === 'пк') && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'рядом')
    ) {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'NEAR_TERMINAL', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'тревога') {
      const start = this.advance();
      return { kind: 'SENSOR', sensor: 'IS_ALARM', span: this.spanFrom(start, start) };
    }

    if (
      t.norm === 'гбр' &&
      this.peek(1).kind === 'WORD' &&
      this.peek(1).norm === 'в' &&
      this.peek(2).kind === 'WORD' &&
      this.peek(2).norm === 'здании'
    ) {
      const start = this.advance();
      this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'GBR_INSIDE', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'враг' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'оглушен') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'ENEMY_STUNNED', dir: 'ANY', span: this.spanFrom(start, end) };
    }

    if (t.norm === 'рывок' && this.peek(1).kind === 'WORD' && this.peek(1).norm === 'готов') {
      const start = this.advance();
      const end = this.advance();
      return { kind: 'SENSOR', sensor: 'DASH_READY', span: this.spanFrom(start, end) };
    }

    this.fail(
      'E_PARSE_BAD_EXPRESSION',
      t.line,
      t.col,
      `Строка ${t.line}: ожидалось условие (например, «справа свободно» или «не тревога»), получено «${t.raw}».`
    );
  }
}

export function compileKumir(
  source: string
): { ok: true; program: ProgramNode } | { ok: false; errors: KumirError[] } {
  const lexed = tokenizeKumir(source);
  if (!lexed.ok) return lexed;
  const parser = new KumirParser(lexed.tokens, lexed.locCount);
  return parser.parseProgram();
}

export function* executeKumirProgram(
  program: ProgramNode,
  sensors: KumirSensorReader
): Generator<StepResult, StepResult, void> {
  let ticksUsed = 0;
  let vmOpsUsed = 0;
  const callStack: string[] = [];

  const bumpVmOp = (line: number): StepResult | null => {
    vmOpsUsed++;
    if (vmOpsUsed > KUMIR_LIMITS.MAX_VM_OPS_PER_TURN) {
      return {
        status: 'RUNTIME_ERROR',
        ticksUsed,
        error: makeError(
          'E_RT_INFINITE_LOOP',
          line,
          1,
          `Строка ${line}: обнаружено зацикливание (превышен лимит ${KUMIR_LIMITS.MAX_VM_OPS_PER_TURN} проверок без шага). Проверьте условие «нц пока».`,
          true
        ),
      };
    }
    return null;
  };

  const evalBool = (node: BoolExprNode): boolean | StepResult => {
    const err = bumpVmOp(node.span.startLine);
    if (err) return err;

    if (node.kind === 'NOT') {
      const v = evalBool(node.operand);
      return typeof v === 'boolean' ? !v : v;
    }

    if (node.kind === 'BINARY') {
      const l = evalBool(node.left);
      if (typeof l !== 'boolean') return l;
      if (node.op === 'AND') {
        if (!l) return false;
        return evalBool(node.right);
      }
      if (l) return true;
      return evalBool(node.right);
    }

    const res = sensors.evalSensor(node.sensor, node.dir);
    return node.negatePainted ? !res : res;
  };

  function* runBlock(stmts: StmtNode[]): Generator<StepResult, StepResult | null, void> {
    for (const stmt of stmts) {
      if (stmt.kind === 'ACTION') {
        if (stmt.action === 'HELP') {
          const request: KumirActionRequest = {
            action: stmt.action,
            dir: stmt.dir,
            topic: stmt.topic,
            line: stmt.span.startLine,
          };
          yield {
            status: 'YIELD_ACTION',
            request,
            line: stmt.span.startLine,
            callStack: [...callStack],
          };
          continue;
        }
        if (ticksUsed >= KUMIR_LIMITS.MAX_TICKS_PER_TURN) {
          return {
            status: 'PAUSED_TURN_LIMIT',
            ticksUsed,
            line: stmt.span.startLine,
          };
        }
        ticksUsed++;
        const request: KumirActionRequest = {
          action: stmt.action,
          dir: stmt.dir,
          topic: stmt.topic,
          line: stmt.span.startLine,
        };
        yield {
          status: 'YIELD_ACTION',
          request,
          line: stmt.span.startLine,
          callStack: [...callStack],
        };
        continue;
      }

      if (stmt.kind === 'IF') {
        const condVal = evalBool(stmt.cond);
        if (typeof condVal !== 'boolean') return condVal;
        const branch = condVal ? stmt.thenBranch : stmt.elseBranch;
        if (branch) {
          const stop = yield* runBlock(branch);
          if (stop) return stop;
        }
        continue;
      }

      if (stmt.kind === 'REPEAT') {
        for (let idx = 0; idx < stmt.count; idx++) {
          const err = bumpVmOp(stmt.span.startLine);
          if (err) return err;
          const stop = yield* runBlock(stmt.body);
          if (stop) return stop;
        }
        continue;
      }

      if (stmt.kind === 'WHILE') {
        while (true) {
          const condVal = evalBool(stmt.cond);
          if (typeof condVal !== 'boolean') return condVal;
          if (!condVal) break;
          const stop = yield* runBlock(stmt.body);
          if (stop) return stop;
        }
        continue;
      }

      if (stmt.kind === 'CALL') {
        const err = bumpVmOp(stmt.span.startLine);
        if (err) return err;
        if (callStack.length >= KUMIR_LIMITS.MAX_CALL_DEPTH) {
          return {
            status: 'RUNTIME_ERROR',
            ticksUsed,
            error: makeError(
              'E_RT_STACK_OVERFLOW',
              stmt.span.startLine,
              stmt.span.startCol,
              `Строка ${stmt.span.startLine}: превышена глубина вложенности вызовов (${KUMIR_LIMITS.MAX_CALL_DEPTH}). Возможна бесконечная рекурсия «алг».`,
              true
            ),
          };
        }
        const target = program.algorithms[normalizeWord(stmt.algName)];
        if (!target) {
          return {
            status: 'RUNTIME_ERROR',
            ticksUsed,
            error: makeError(
              'E_SEM_UNKNOWN_ALG',
              stmt.span.startLine,
              stmt.span.startCol,
              `Строка ${stmt.span.startLine}: алгоритм «${stmt.algName}» не найден.`,
              true
            ),
          };
        }
        callStack.push(target.name);
        const stop = yield* runBlock(target.body);
        callStack.pop();
        if (stop) return stop;
      }
    }
    return null;
  }

  const entry = program.algorithms[normalizeWord(program.entryAlg)];
  callStack.push(entry.name);
  const stop = yield* runBlock(entry.body);
  callStack.pop();

  if (stop) return stop;
  return {
    status: 'COMPLETED',
    ticksUsed,
    vmOpsUsed,
  };
}
