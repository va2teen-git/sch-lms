export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type SensorDirection = Direction | 'FRONT' | 'ANY';

export interface SourceSpan {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export type ActionCommandKind =
  | 'MOVE'
  | 'PAINT'
  | 'WAIT'
  | 'CROUCH'
  | 'HACK'
  | 'DISABLE'
  | 'BREACH_DOOR'
  | 'DASH'
  | 'STRIKE'
  | 'THROW'
  | 'FINISH'
  | 'INTERACT'
  | 'HELP';

export type SensorKind =
  | 'IS_CLEAR'
  | 'IS_WALL'
  | 'IS_PAINTED'
  | 'IS_DANGER'
  | 'HAS_ENEMY'
  | 'HAS_DOOR'
  | 'HAS_INTERACTABLE'
  | 'NEAR_TERMINAL'
  | 'IS_ALARM'
  | 'GBR_INSIDE'
  | 'ENEMY_STUNNED'
  | 'DASH_READY';

export type BoolExprNode =
  | { kind: 'BINARY'; op: 'AND' | 'OR'; left: BoolExprNode; right: BoolExprNode; span: SourceSpan }
  | { kind: 'NOT'; operand: BoolExprNode; span: SourceSpan }
  | { kind: 'SENSOR'; sensor: SensorKind; dir?: SensorDirection; negatePainted?: boolean; span: SourceSpan };

export type StmtNode =
  | { kind: 'ACTION'; action: ActionCommandKind; dir?: Direction; topic?: string; span: SourceSpan }
  | { kind: 'IF'; cond: BoolExprNode; thenBranch: StmtNode[]; elseBranch?: StmtNode[]; span: SourceSpan }
  | { kind: 'WHILE'; cond: BoolExprNode; body: StmtNode[]; span: SourceSpan }
  | { kind: 'REPEAT'; count: number; body: StmtNode[]; span: SourceSpan }
  | { kind: 'CALL'; algName: string; span: SourceSpan };

export interface AlgDeclNode {
  name: string;
  body: StmtNode[];
  span: SourceSpan;
}

export interface ProgramNode {
  entryAlg: string;
  algorithms: Record<string, AlgDeclNode>;
  isSpeedWrapped: boolean;
  locCount: number;
  usedLoops: boolean;
  usedConditions: boolean;
  usedSubprograms: boolean;
}

export interface KumirActionRequest {
  action: ActionCommandKind;
  dir?: Direction;
  topic?: string;
  line: number;
}

export type KumirErrorCode =
  | 'E_LEX_TOO_LARGE'
  | 'E_LEX_UNKNOWN_TOKEN'
  | 'E_PARSE_UNEXPECTED_TOKEN'
  | 'E_PARSE_MISSING_END'
  | 'E_PARSE_BAD_EXPRESSION'
  | 'E_PARSE_AST_LIMIT'
  | 'E_SEM_UNKNOWN_ALG'
  | 'E_SEM_DUPLICATE_ALG'
  | 'E_SEM_LOOP_BOUND'
  | 'E_RT_STACK_OVERFLOW'
  | 'E_RT_INFINITE_LOOP'
  | 'E_RT_WALL_CRASH'
  | 'E_RT_NO_TERMINAL'
  | 'E_RT_DASH_COOLDOWN'
  | 'E_RT_NO_TARGET';

export interface KumirError {
  code: KumirErrorCode;
  line: number;
  column: number;
  messageRu: string;
  isFatalToTurn: boolean;
}

export type StepResult =
  | { status: 'YIELD_ACTION'; request: KumirActionRequest; line: number; callStack: string[] }
  | { status: 'COMPLETED'; ticksUsed: number; vmOpsUsed: number }
  | { status: 'PAUSED_TURN_LIMIT'; ticksUsed: number; line: number }
  | { status: 'RUNTIME_ERROR'; error: KumirError; ticksUsed: number };

export interface KumirSensorReader {
  evalSensor(sensor: SensorKind, dir?: SensorDirection): boolean;
}

export type MaskId = 'richard' | 'rasmus' | 'tony' | 'sprint';
export type LevelThemeId =
  | 'kpp_street'
  | 'lobby_hall'
  | 'analytics_office'
  | 'server_hall'
  | 'master_vault';

export type GamePhase =
  | 'BRIEFING'
  | 'STEALTH'
  | 'TERMINAL_HACK'
  | 'ALERT_DISPATCH'
  | 'ESCAPE_RACE'
  | 'GBR_BREACH_COMBAT'
  | 'EXTRACTION'
  | 'MISSION_KO';

export type OutcomeBranch = 'stealth' | 'escape_before_gbr' | 'combat_gbr';
export type StyleBadge = 'GHOST' | 'ESCAPE' | 'COMBAT';
export type RankGrade = 'S' | 'A' | 'B' | 'C';
export type AudioMood = 'SILENT' | 'STEALTH' | 'ALERT' | 'COMBAT';

export type TileKind = 'WALL' | 'WINDOW' | 'FLOOR' | 'COVER' | 'EXIT' | 'TERMINAL' | 'RELAY' | 'GBR_SPAWN';

export type FloorKind =
  | 'asphalt'
  | 'sidewalk'
  | 'grass'
  | 'gravel'
  | 'kpp_concrete'
  | 'lobby_marble'
  | 'lobby_rug'
  | 'office_carpet'
  | 'wood_parquet'
  | 'server_grate'
  | 'vault_obsidian'
  | 'vault_crimson'
  | 'bathroom_tile';

export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneZone {
  x: number;
  y: number;
  w: number;
  h: number;
  floor: FloorKind;
  label?: string;
  indoor?: boolean;
}

export interface SceneProp {
  sprite: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rot?: 0 | 90 | 180 | 270;
  layer?: 'floor' | 'prop' | 'overhead';
  flipX?: boolean;
}

export interface SceneLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  intensity?: number;
  kind?: 'lamp' | 'neon' | 'monitor' | 'headlight' | 'ceiling';
}

export interface LevelScene {
  exteriorMargin: number;
  buildingBounds: { x: number; y: number; w: number; h: number };
  zones: SceneZone[];
  props: SceneProp[];
  lights: SceneLight[];
  coupePos: { x: number; y: number; rot: 0 | 90 | 180 | 270 };
  gbrVanPos: { x: number; y: number; rot: 0 | 90 | 180 | 270 };
  neonSignPos?: { x: number; y: number; text: string; color: string };
}

export interface DoorState {
  id: string;
  x: number;
  y: number;
  open: boolean;
  broken: boolean;
}

export interface CameraState {
  id: string;
  x: number;
  y: number;
  enabled: boolean;
  disabledTurns: number;
  phases: Array<Array<{ x: number; y: number }>>;
  phaseIndex: number;
}

export interface LaserState {
  id: string;
  cells: Array<{ x: number; y: number }>;
  enabled: boolean;
  disabledTurns: number;
}

export type EnemyKind = 'patrol_rat' | 'patrol_raven' | 'gbr_dog' | 'gbr_boar' | 'gbr_bear';
export type EnemyStatus = 'active' | 'stunned' | 'offline';

export interface EnemyState {
  id: string;
  kind: EnemyKind;
  isGbr: boolean;
  x: number;
  y: number;
  facing: Direction;
  status: EnemyStatus;
  stunTurns: number;
  shielded: boolean;
  patrolRoute: Array<{ x: number; y: number }>;
  patrolIndex: number;
  patrolForward: boolean;
  telegraphNext: { x: number; y: number } | null;
  telegraphAttackCells: Array<{ x: number; y: number }>;
  alertedTurns: number;
  distractedTurns: number;
}

export interface PlayerState {
  x: number;
  y: number;
  facing: Direction;
  crouched: boolean;
  dashCooldown: number;
  hp: number;
  stepsTaken: number;
}

export type WorldEventType =
  | 'ROBOT_MOVED'
  | 'ROBOT_DASHED'
  | 'ROBOT_CROUCHED'
  | 'TILE_PAINTED'
  | 'OBJECT_INSPECTED'
  | 'HELP_OPENED'
  | 'DOOR_OPENED'
  | 'DOOR_BROKEN'
  | 'CAMERA_DISABLED'
  | 'LASER_DISABLED'
  | 'TERMINAL_OPENED'
  | 'TERMINAL_HACKED'
  | 'ENEMY_STUNNED'
  | 'ENEMY_SHIELD_BROKEN'
  | 'ENEMY_OFFLINE'
  | 'DECOY_THROWN'
  | 'ENEMY_MOVED'
  | 'ENEMY_ATTACK'
  | 'WALL_CRASH'
  | 'ALERT_TRIGGERED'
  | 'GBR_ARRIVED'
  | 'EXTRACTION'
  | 'PLAYER_KO'
  | 'TURN_TIMEOUT';

export interface WorldEvent {
  type: WorldEventType;
  line?: number;
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  dir?: Direction;
  label?: string;
  moodAfter: AudioMood;
}

export type {
  VfsFileNode,
  VfsDirNode,
  VfsNode,
  LinuxWorldEffect,
  LinuxExecResult,
  LinuxCustomCommandContext,
  LinuxCustomCommandResult,
  LinuxLevelConfig,
} from '../linux-sandbox/types.ts';

export interface LevelResult {
  levelId: number;
  mask: MaskId;
  styleBadge: StyleBadge;
  outcomeBranch: OutcomeBranch;
  grade: RankGrade;
  score: number;
  baseClear: number;
  timeBonus: number;
  styleBonus: number;
  algoBonus: number;
  alarmPenalty: number;
  locCount: number;
  parLoc: number;
  usedLoops: boolean;
  usedConditions: boolean;
  usedSubprograms: boolean;
  linuxCommandsCount: number;
  turnsUsed: number;
  timeSpentSec: number;
}

export type InteractableCategory = 'crate' | 'plant' | 'urn' | 'furniture' | 'item';

export interface InteractableDefinition {
  id: string;
  x: number;
  y: number;
  category: InteractableCategory;
  name: string;
  inspectText: string;
  intelCode?: string;
  required?: boolean;
  drawIcon?: 'urn';
}

export interface InteractableState extends InteractableDefinition {
  inspected: boolean;
}

export interface LevelDefinition {
  id: number;
  slug: string;
  theme: LevelThemeId;
  title: string;
  subtitle: string;
  curriculumRef: string;
  ccs: number;
  tpr: number;
  briefingTime: string;
  briefingText: string;
  missionSummary?: string;
  asciiMap: string[];
  turnTimerStealthSec: number;
  turnTimerAlertSec: number;
  gbrEtaTurns: number;
  gbrEtaSec: number;
  gbrSquad: Array<'gbr_dog' | 'gbr_boar' | 'gbr_bear'>;
  parLoc: number;
  starterCode: string;
  hints: string[];
  snippetPreset: string[];
  doors: Array<{ id: string; x: number; y: number }>;
  cameras: Array<{ id: string; x: number; y: number; phases: Array<Array<{ x: number; y: number }>> }>;
  lasers: Array<{ id: string; cells: Array<{ x: number; y: number }> }>;
  patrols: Array<{
    id: string;
    kind: 'patrol_rat' | 'patrol_raven';
    route: Array<{ x: number; y: number }>;
    facing: Direction;
  }>;
  interactables?: InteractableDefinition[];
  linuxConfig: LinuxLevelConfig;
  scene: LevelScene;
}

export interface WorldSnapshot {
  levelId: number;
  levelTitle: string;
  missionSummary: string;
  briefingText: string;
  theme: LevelThemeId;
  mask: MaskId;
  phase: GamePhase;
  audioMood: AudioMood;
  seed: number;
  turnIndex: number;
  turnTimeLeftSec: number;
  turnTimeMaxSec: number;
  alarmTriggered: boolean;
  alarmReason: string | null;
  gbrSpawned: boolean;
  gbrEtaTurns: number;
  gbrEtaMaxTurns: number;
  gbrEtaSec: number;
  idsNoise: number;
  idsMaxNoise: number;
  hackCompleted: boolean;
  paintedCount: number;
  requiredPaintCount: number;
  interactables: InteractableState[];
  inspectedCount: number;
  requiredInteractableCount: number;
  lastInspectMessage: string | null;
  collectedIntel: Array<{ id: string; name: string; text: string; code?: string; category?: InteractableCategory }>;
  exitUnlocked: boolean;
  activeLine: number | null;
  width: number;
  height: number;
  tiles: TileKind[][];
  paintedTiles: Array<{ x: number; y: number }>;
  player: PlayerState;
  doors: DoorState[];
  cameras: CameraState[];
  lasers: LaserState[];
  enemies: EnemyState[];
  terminalPos: { x: number; y: number };
  exitPos: { x: number; y: number };
  gbrSpawnPos: { x: number; y: number };
  scene: LevelScene;
  lastError: KumirError | null;
  lastResult: LevelResult | null;
}
