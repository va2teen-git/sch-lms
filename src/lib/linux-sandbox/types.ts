export interface VfsFileNode {
  kind: 'file';
  name: string;
  content: string;
  mode: number;
  owner: string;
  size: number;
  isBinary?: boolean;
  stringsLines?: string[];
}

export interface VfsDirNode {
  kind: 'dir';
  name: string;
  mode: number;
  owner: string;
  children: Record<string, VfsNode>;
}

export type VfsNode = VfsFileNode | VfsDirNode;

export type LinuxWorldEffect =
  | { type: 'UNLOCK_DOOR'; doorId?: string }
  | { type: 'DISABLE_CAMERA'; cameraId?: string }
  | { type: 'DISABLE_LASER'; laserId?: string }
  | { type: 'COMPLETE_HACK' }
  | { type: 'TRIGGER_ALARM'; reason: string };

export interface LinuxExecResult {
  output: string;
  exitCode: number;
  clearScreen?: boolean;
  noiseDelta: number;
  commandTickCost: number;
  effects: LinuxWorldEffect[];
  objectiveCompletedNow: boolean;
}

export interface LinuxCustomCommandContext {
  flags: Set<string>;
  vfsRoot: VfsDirNode;
}

export interface LinuxCustomCommandResult {
  output: string;
  exitCode: number;
  noiseDelta?: number;
  setFlags?: string[];
  effects?: LinuxWorldEffect[];
}

export interface LinuxLevelConfig {
  user: string;
  host: string;
  homeDir: string;
  idInfo: string;
  sudoListOutput: string;
  crontabContent: string;
  processes: string[];
  sockets: string[];
  honeypotPaths: string[];
  requiredFlags: string[];
  customCommands: Record<
    string,
    (args: string[], ctx: LinuxCustomCommandContext) => LinuxCustomCommandResult
  >;
  vfsRoot: VfsDirNode;
  hints: string[];
  promptSymbol?: string;
  helpLines?: string[];
}

export interface TerminalAdapterExecResult {
  output?: string;
  exitCode: number;
  clearScreen?: boolean;
  objectiveCompletedNow?: boolean;
}

export interface TerminalAdapter {
  getPrompt(): string;
  execute(cmd: string): TerminalAdapterExecResult;
  autocomplete?(input: string): string[];
  getHistory?(): string[];
}

export function createVfsFile(
  name: string,
  content: string,
  options: Partial<Omit<VfsFileNode, 'kind' | 'name' | 'content'>> = {}
): VfsFileNode {
  return {
    kind: 'file',
    name,
    content,
    mode: options.mode ?? 0o644,
    owner: options.owner ?? 'root',
    size: options.size ?? content.length,
    isBinary: options.isBinary,
    stringsLines: options.stringsLines ? [...options.stringsLines] : undefined,
  };
}

export function createVfsDir(
  name: string,
  childrenList: VfsNode[] = [],
  options: Partial<Omit<VfsDirNode, 'kind' | 'name' | 'children'>> = {}
): VfsDirNode {
  const children: Record<string, VfsNode> = {};
  for (const child of childrenList) {
    children[child.name] = child;
  }
  return {
    kind: 'dir',
    name,
    mode: options.mode ?? 0o755,
    owner: options.owner ?? 'root',
    children,
  };
}
