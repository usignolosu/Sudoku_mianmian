// 数独游戏类型定义

// 难度等级
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

// 宫格尺寸
export type GridSize = 3 | 9 | 27

// 游戏难度配置
export interface DifficultyConfig {
  size: GridSize
  level: DifficultyLevel
}

// 单个格子
export interface Cell {
  value: number | null          // 当前填入的值
  fixed: boolean                // 是否是初始固定值
  notes: number[]               // 笔记候选数
  error: boolean                // 是否填错
  row: number                   // 行索引
  col: number                   // 列索引
  box: number                   // 宫格索引
}

// 游戏状态
export interface GameState {
  grid: Cell[][]                // 棋盘数据
  solution: number[][]          // 正确答案
  difficulty: DifficultyConfig  // 当前难度
  timer: number                 // 计时（秒）
  errors: number                // 错误次数
  hintsUsed: number             // 已使用提示次数
  isPaused: boolean             // 是否暂停
  isCompleted: boolean          // 是否完成
  history: HistoryStep[]        // 操作历史（用于撤销）
  historyIndex: number          // 当前历史索引
  startTime: number             // 开始时间戳
  puzzleId: string              // 题目ID
}

// 操作历史步骤
export interface HistoryStep {
  row: number
  col: number
  oldValue: number | null
  newValue: number | null
  oldNotes: number[]
  newNotes: number[]
}

// 游戏记录
export interface GameRecord {
  id: string
  date: string                  // 完成日期
  difficulty: DifficultyConfig
  time: number                  // 用时（秒）
  errors: number
  completed: boolean
  medals: string[]              // 本局获得的勋章
  puzzleId: string
  // ── 情境字段(special 类勋章判定用,可选以兼容旧存档)──
  /** 完成时刻的小时 (0-23) */
  hourOfDay?: number
  /** 完成时刻是否为周末 */
  isWeekend?: boolean
  /** 本局是否使用过提示 */
  usedHint?: boolean
  /** 本局是否「出错后仍完成」(errors>0 且完成) */
  recoveredFromError?: boolean
}

// 特殊类勋章的情境类型
export type SpecialContext =
  | 'night'        // 深夜玩家: 凌晨 0-4 点
  | 'early'        // 早鸟玩家: 早晨 6-8 点
  | 'weekend'      // 周末战士: 周末完成
  | 'hint'         // 提示达人: 使用提示后完成
  | 'comeback'     // 逆袭之王: 出错后完成
  | 'speedrun'     // 极速过关: 远快于该难度常规耗时
  | 'marathon'     // 持久战: 耗时较长
  | 'flawless'     // 一气呵成: 0 错误完成

// 用户数据
export interface UserData {
  totalGames: number            // 总游戏次数
  totalTime: number             // 总用时
  bestTimes: Record<string, number>  // 各难度最佳时间
  avgTimes: Record<string, number[]> // 各难度用时历史（计算平均值）
  streak: number                // 当前连胜
  maxStreak: number             // 最大连胜
  lastPlayDate: string          // 最后游戏日期
  dailyStreak: number           // 每日挑战连续天数
  maxDailyStreak: number        // 最大每日挑战连胜天数
  medals: string[]              // 已解锁勋章
  medalUnlockedAt?: Record<string, string>  // 勋章解锁时间 (ISO string)
  records: GameRecord[]         // 游戏记录
  settings: Settings
}

// 设置
export interface Settings {
  sound: boolean                // 音效开关
  errorHint: boolean            // 错误提示开关
  theme: ThemeType              // 主题
}

// 主题类型
export type ThemeType = 'light' | 'sakura' | 'dark' | 'macaron-pink' | 'macaron-blue' | 'macaron-green' | 'macaron-purple'

// 导出 ThemeType 别名以兼容导入
export type { ThemeType as ThemeTypeAlias }

// 勋章定义
export type MedalConditionType = 
  | 'complete_first'
  | 'complete_all_level'
  | 'cumulative'
  | 'speed'
  | 'streak'
  | 'perfect'
  | 'daily_streak'
  | 'daily_count'
  | 'collection_category'
  | 'collection_percent'
  | 'all_medals'
  | 'special'

export interface MedalCondition {
  type: MedalConditionType
  size?: number
  level?: DifficultyLevel
  count?: number
  time?: number
  category?: MedalCategory
  percent?: number
  hidden?: boolean
  /** type='special' 时指明情境类型 */
  context?: SpecialContext
  /** type='special' 且 context='speedrun'/'marathon' 时的秒数阈值 */
  threshold?: number
}

export interface Medal {
  id: string
  name: string
  description: string
  icon: string                  // 勋章图标
  category: MedalCategory
  condition?: MedalCondition    // 解锁条件（可选，逐步添加）
  unlocked: boolean
  unlockedAt?: string
}

// 勋章分类
// level / ultimate 为既有关卡体系;其余为需求 §5.2 的九大类
export type MedalCategory =
  | 'level'         // 关卡勋章（99 个）
  | 'ultimate'      // 终极勋章（数独之神）
  | 'starter'       // 入门类
  | 'speed'         // 速度类
  | 'streak'        // 连胜类
  | 'perfect'       // 完美类
  | 'cumulative'    // 累计类
  | 'attendance'    // 全勤类
  | 'daily'         // 每日挑战类
  | 'collection'    // 收集类
  | 'special'       // 特殊类

// 题目数据
export interface Puzzle {
  id: string
  size: GridSize
  level: DifficultyLevel
  puzzle: number[][]            // 题目（0表示空）
  solution: number[][]          // 答案
}

// 每日挑战
export interface DailyChallenge {
  date: string
  puzzleId: string
  completed: boolean
}