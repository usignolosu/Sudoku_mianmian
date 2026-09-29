// 勋章解锁引擎 —— 需求 §5
//
// 职责:根据玩家的历史战绩(userData.records)与当前进度(userData 统计字段),
//       判定每个勋章的 condition 是否满足,并返回本次新解锁的勋章。
//
// 设计要点:
//   1. 纯函数判定,不改状态 —— 便于单元测试
//   2. 统计一次(buildStats),然后 O(勋章数) 扫描 —— 每局只跑一次,1000 个也很快
//   3. 'special' 类条件依赖「当下这一局的情境」(时段/是否用提示等),
//      属于事件驱动,不在此处自动判定,由调用方显式授予

import type {
  GameRecord,
  MedalCategory,
  MedalCondition,
  DifficultyLevel,
  GridSize,
  UserData
} from '../types'
import { allMedals, medalCategories } from '../data/medals'

const SIZES: GridSize[] = [3, 9, 27]

function levelKey(size: GridSize | 'all' | number, level: DifficultyLevel | 'all'): string {
  return `${size}-${level}`
}

/** 从记录构建的统计快照 */
export interface MedalStats {
  /** 总完成局数 */
  totalCompleted: number
  /** 每个尺寸的完成局数,key 为 'all' / '3' / '9' / '27' */
  completedBySize: Record<string, number>
  /** 每个 (尺寸,难度) 的完成局数,key 为 '9-hard' */
  completedBySizeLevel: Record<string, number>
  /** 每个难度的完成局数(跨尺寸),key 为 'easy' / 'medium' / 'hard' */
  completedByLevel: Record<string, number>
  /** 0 错误完成的局数 */
  perfectTotal: number
  perfectBySize: Record<string, number>
  /** 每个 (尺寸,难度) 的最快完成时间(秒) */
  bestTimeBySizeLevel: Record<string, number>
  /** 每日挑战完成次数 */
  dailyCount: number
  /** 当前连胜 */
  streak: number
  /** 每日挑战连续天数 */
  dailyStreak: number
  /** 各分类已解锁数量 */
  unlockedByCategory: Record<string, number>
  /** 已解锁总数 */
  unlockedTotal: number
  /** 非隐藏勋章总数 */
  visibleTotal: number
}

function emptySizeRecord(): Record<string, number> {
  return { all: 0, '3': 0, '9': 0, '27': 0 }
}

function emptyLevelRecord(): Record<string, number> {
  return { easy: 0, medium: 0, hard: 0 }
}

/** 从 userData 构建统计快照 */
export function buildStats(userData: UserData): MedalStats {
  const completedBySize = emptySizeRecord()
  const completedBySizeLevel: Record<string, number> = {}
  const completedByLevel = emptyLevelRecord()
  const perfectBySize = emptySizeRecord()
  const perfectTotal = { value: 0 }
  let totalCompleted = 0
  let dailyCount = 0
  const bestTimeBySizeLevel: Record<string, number> = {}

  const records = userData.records || []
  for (const r of records) {
    if (!r.completed) continue
    totalCompleted++

    const sizeKey = String(r.difficulty.size)
    const slKey = levelKey(r.difficulty.size, r.difficulty.level)
    completedBySize.all++
    completedBySize[sizeKey] = (completedBySize[sizeKey] || 0) + 1
    completedBySizeLevel[slKey] = (completedBySizeLevel[slKey] || 0) + 1
    completedByLevel[r.difficulty.level] = (completedByLevel[r.difficulty.level] || 0) + 1

    if (r.errors === 0) {
      perfectTotal.value++
      perfectBySize.all++
      perfectBySize[sizeKey] = (perfectBySize[sizeKey] || 0) + 1
    }

    if (r.puzzleId.includes('daily')) dailyCount++

    const prev = bestTimeBySizeLevel[slKey]
    if (prev === undefined || r.time < prev) bestTimeBySizeLevel[slKey] = r.time
  }

  // 各分类已解锁数量
  const unlockedByCategory: Record<string, number> = {}
  for (const cat of medalCategories) unlockedByCategory[cat.id] = 0
  const owned = new Set(userData.medals || [])
  for (const m of allMedals) {
    if (owned.has(m.id) && unlockedByCategory[m.category] !== undefined) {
      unlockedByCategory[m.category]++
    }
  }

  // 非隐藏勋章总数(用于 all_medals 判定)
  const visibleTotal = allMedals.filter(m => !m.condition?.hidden).length

  return {
    totalCompleted,
    completedBySize,
    completedBySizeLevel,
    completedByLevel,
    perfectTotal: perfectTotal.value,
    perfectBySize,
    bestTimeBySizeLevel,
    dailyCount,
    streak: userData.streak || 0,
    dailyStreak: userData.dailyStreak || 0,
    unlockedByCategory,
    unlockedTotal: owned.size,
    visibleTotal
  }
}

/**
 * 判定单个勋章的解锁条件是否满足
 *
 * `record` 为「刚结束的这一局」,special 类勋章依赖它的情境字段
 * (时段/周末/是否用提示/是否出错后翻盘);其余类型只看历史统计。
 */
export function evaluateCondition(
  cond: MedalCondition | undefined,
  stats: MedalStats,
  record?: GameRecord
): boolean {
  if (!cond) return false
  const need = cond.count ?? cond.time ?? cond.percent ?? 1

  switch (cond.type) {
    case 'special':
      return evaluateSpecial(cond, record)

    case 'complete_first': {
      const key = cond.size ? String(cond.size) : 'all'
      return (stats.completedBySize[key] || 0) >= 1
    }

    case 'complete_all_level': {
      // 某难度下,三种尺寸各完成至少 1 局(cond.size 指定时只看该尺寸)
      if (cond.size) {
        return (stats.completedBySizeLevel[levelKey(cond.size, cond.level ?? 'easy')] || 0) >= 1
      }
      const target = cond.level
      if (!target) return false
      return SIZES.every(s => (stats.completedBySizeLevel[levelKey(s, target)] || 0) >= 1)
    }

    case 'cumulative': {
      const key = cond.size ? String(cond.size) : 'all'
      if (cond.level) {
        return (stats.completedBySizeLevel[levelKey(cond.size ?? 9, cond.level)] || 0) >= need
      }
      return (stats.completedBySize[key] || 0) >= need
    }

    case 'speed': {
      const key = levelKey(cond.size ?? 9, cond.level ?? 'easy')
      const best = stats.bestTimeBySizeLevel[key]
      if (best === undefined) return false
      return best <= (cond.time ?? Infinity)
    }

    case 'streak': {
      return stats.streak >= need
    }

    case 'perfect': {
      const key = cond.size ? String(cond.size) : 'all'
      return (stats.perfectBySize[key] || 0) >= need
    }

    case 'daily_streak': {
      return stats.dailyStreak >= need
    }

    case 'daily_count': {
      return stats.dailyCount >= need
    }

    case 'collection_category': {
      const owned = stats.unlockedByCategory[cond.category as string] || 0
      return owned >= need
    }

    case 'collection_percent': {
      const owned = stats.unlockedByCategory[cond.category as string] || 0
      const total = categoryTotal(cond.category as MedalCategory)
      if (total <= 0) return false
      return (owned / total) * 100 >= need
    }

    case 'all_medals': {
      // 隐藏勋章:集齐所有「非隐藏」勋章后解锁。
      // 统计时排除自己,避免自指导致永远差 1 个。
      return stats.unlockedTotal >= stats.visibleTotal
    }

    default:
      return false
  }
}

/**
 * 特殊类勋章判定
 *
 * 依赖「这一局」的情境,而不是历史累计:
 *   night      0-4 点完成
 *   early      6-8 点完成
 *   weekend    周末完成
 *   hint       使用过提示仍完成
 *   comeback   出过错仍完成
 *   speedrun   用时 <= threshold
 *   marathon   用时 >= threshold
 *   flawless   0 错误完成
 */
function evaluateSpecial(cond: MedalCondition, record?: GameRecord): boolean {
  if (!record) return false
  if (!record.completed) return false

  // 尺寸/难度不匹配直接排除
  if (cond.size !== undefined && record.difficulty.size !== cond.size) return false
  if (cond.level !== undefined && record.difficulty.level !== cond.level) return false

  switch (cond.context) {
    case 'night':
      return record.hourOfDay !== undefined && record.hourOfDay >= 0 && record.hourOfDay <= 4
    case 'early':
      return record.hourOfDay !== undefined && record.hourOfDay >= 6 && record.hourOfDay <= 8
    case 'weekend':
      return record.isWeekend === true
    case 'hint':
      return record.usedHint === true
    case 'comeback':
      return record.recoveredFromError === true
    case 'speedrun':
      return cond.threshold !== undefined && record.time <= cond.threshold
    case 'marathon':
      return cond.threshold !== undefined && record.time >= cond.threshold
    case 'flawless':
      return record.errors === 0
    default:
      return false
  }
}

/** 某分类的勋章总数 */
export function categoryTotal(category: MedalCategory): number {
  return allMedals.filter(m => m.category === category).length
}

/**
 * 扫描全部勋章,返回条件已满足的勋章 id 列表
 * (不负责写入 userData,由调用方执行解锁以保证去重)
 */
export function findUnlockableMedals(stats: MedalStats, record?: GameRecord): string[] {
  const result: string[] = []
  for (const medal of allMedals) {
    // all_medals 隐藏勋章需排除自身,由调用方在最后单独处理
    if (medal.condition?.type === 'all_medals') continue
    if (evaluateCondition(medal.condition, stats, record)) {
      result.push(medal.id)
    }
  }
  return result
}

/** 关卡勋章:根据 puzzleId 解析关卡号并返回对应 medal id */
export function levelMedalId(puzzleId: string): string | null {
  const m = puzzleId.match(/level-(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (n >= 1 && n <= 99) return `medal_${n}`
  return null
}

/** 终极勋章「数独之神」:集齐 99 个关卡勋章 */
export const ULTIMATE_MEDAL_ID = 'medal_100'
export const ULTIMATE_MEDAL_NAME = '数独之神'
