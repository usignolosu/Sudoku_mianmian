import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { allMedals, medalCategories, getMedalById, getMedalStats, TOTAL_MEDAL_COUNT } from '@/data/medals'
import { buildStats, evaluateCondition, categoryTotal, levelMedalId } from '@/utils/medalEngine'
import { useUserStore } from '@/stores/user'
import type { GameRecord, UserData, MedalCategory } from '@/types'

/**
 * 1000 个勋章体系测试 (需求 §5)
 *
 * 覆盖:
 *   A. 数据完整性 —— 数量、id 唯一、分类分布、条件完整性
 *   B. 解锁引擎   —— buildStats 统计 + evaluateCondition 判定
 *   C. 集成       —— checkAndUnlockMedals 实际发放
 */

// ── A. 数据完整性 ───────────────────────────────────────────────
describe('勋章数据完整性', () => {
  it('总数恰好 1000', () => {
    expect(allMedals.length).toBe(1000)
    expect(TOTAL_MEDAL_COUNT).toBe(1000)
  })

  it('所有 id 唯一', () => {
    const ids = allMedals.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('既有 99 个关卡勋章 + 1 个终极勋章保持原有 id', () => {
    for (let i = 1; i <= 99; i++) {
      expect(getMedalById(`medal_${i}`), `缺少 medal_${i}`).toBeDefined()
    }
    expect(getMedalById('medal_100')?.name).toBe('数独之神')
    expect(getMedalById('medal_100')?.category).toBe('ultimate')
  })

  it('九大类分类数量符合设计', () => {
    const expected: Record<string, number> = {
      level: 99,
      ultimate: 1,
      starter: 10,
      speed: 50,
      streak: 100,
      perfect: 100,
      cumulative: 200,
      attendance: 100,
      daily: 100,
      collection: 150,
      special: 90
    }
    const stats = getMedalStats(allMedals)
    for (const [cat, total] of Object.entries(expected)) {
      expect(stats[cat as MedalCategory].total, `${cat} 数量不符`).toBe(total)
    }
  })

  it('各分类数量之和等于 1000', () => {
    const sum = Object.values(getMedalStats(allMedals))
      .reduce((acc, s) => acc + s.total, 0)
    expect(sum).toBe(1000)
  })

  it('medalCategories 覆盖所有实际用到的分类', () => {
    const declared = new Set(medalCategories.map(c => c.id))
    for (const m of allMedals) {
      expect(declared.has(m.category), `分类 ${m.category} 未在 medalCategories 中声明`).toBe(true)
    }
  })

  it('每个勋章都有非空名称、描述、图标', () => {
    for (const m of allMedals) {
      expect(m.name, `${m.id} 名称为空`).toBeTruthy()
      expect(m.description, `${m.id} 描述为空`).toBeTruthy()
      expect(m.icon, `${m.id} 图标为空`).toBeTruthy()
    }
  })

  it('九大类勋章(除关卡/终极)都带 condition', () => {
    const needCondition = allMedals.filter(m => m.category !== 'level' && m.category !== 'ultimate')
    for (const m of needCondition) {
      expect(m.condition, `${m.id} 缺少 condition`).toBeDefined()
    }
  })

  it('恰好有 1 个隐藏勋章「全能选手」', () => {
    const hidden = allMedals.filter(m => m.condition?.hidden)
    expect(hidden.length).toBe(1)
    expect(hidden[0].id).toBe('starter_10')
    expect(hidden[0].name).toBe('全能选手')
    expect(hidden[0].condition?.type).toBe('all_medals')
  })

  it('speed 类勋章的 time 阈值递增可用(正数)', () => {
    const speeds = allMedals.filter(m => m.category === 'speed' && m.condition?.type === 'speed')
    expect(speeds.length).toBe(36)  // 3 尺寸 × 3 难度 × 4 档
    for (const m of speeds) {
      expect(m.condition!.time!).toBeGreaterThan(0)
    }
  })

  it('cumulative 类里程碑阈值递增', () => {
    const all = allMedals.filter(m => m.category === 'cumulative' && m.id.includes('_all_'))
      .map(m => m.condition!.count!)
    expect(all.length).toBeGreaterThan(1)
    for (let i = 1; i < all.length; i++) {
      expect(all[i]).toBeGreaterThan(all[i - 1])
    }
  })
})

// ── 构造测试数据 ────────────────────────────────────────────────
function makeRecord(over: Partial<GameRecord> = {}): GameRecord {
  return {
    id: 'r',
    date: new Date().toISOString(),
    difficulty: { size: 9, level: 'hard' },
    time: 300,
    errors: 0,
    completed: true,
    medals: [],
    puzzleId: '9-hard-level-1',
    ...over
  }
}

function makeUser(over: Partial<UserData> = {}): UserData {
  return {
    totalGames: 0,
    totalTime: 0,
    bestTimes: {},
    avgTimes: {},
    streak: 0,
    maxStreak: 0,
    lastPlayDate: '',
    dailyStreak: 0,
    maxDailyStreak: 0,
    medals: [],
    records: [],
    settings: { sound: true, errorHint: true, theme: 'light' },
    ...over
  }
}

// ── B. 解锁引擎 ─────────────────────────────────────────────────
describe('buildStats 统计', () => {
  it('空数据时全部为 0', () => {
    const s = buildStats(makeUser())
    expect(s.totalCompleted).toBe(0)
    expect(s.completedBySize.all).toBe(0)
    expect(s.perfectTotal).toBe(0)
    expect(s.dailyCount).toBe(0)
  })

  it('只统计 completed 的记录', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ completed: true }),
        makeRecord({ completed: false })
      ]
    }))
    expect(s.totalCompleted).toBe(1)
  })

  it('按尺寸分组统计', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ difficulty: { size: 3, level: 'easy' } }),
        makeRecord({ difficulty: { size: 9, level: 'hard' } }),
        makeRecord({ difficulty: { size: 9, level: 'hard' } })
      ]
    }))
    expect(s.completedBySize['3']).toBe(1)
    expect(s.completedBySize['9']).toBe(2)
    expect(s.completedBySize['27']).toBe(0)
    expect(s.completedBySize.all).toBe(3)
  })

  it('按尺寸+难度分组统计', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ difficulty: { size: 9, level: 'hard' } }),
        makeRecord({ difficulty: { size: 9, level: 'hard' } }),
        makeRecord({ difficulty: { size: 9, level: 'easy' } })
      ]
    }))
    expect(s.completedBySizeLevel['9-hard']).toBe(2)
    expect(s.completedBySizeLevel['9-easy']).toBe(1)
  })

  it('0 错误完成计入 perfect', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ errors: 0 }),
        makeRecord({ errors: 3 })
      ]
    }))
    expect(s.perfectTotal).toBe(1)
  })

  it('最快完成时间取最小值', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ time: 500 }),
        makeRecord({ time: 200 }),
        makeRecord({ time: 900 })
      ]
    }))
    expect(s.bestTimeBySizeLevel['9-hard']).toBe(200)
  })

  it('统计每日挑战次数(puzzleId 含 daily)', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ puzzleId: 'daily-2024-1-1-9-hard-level-5' }),
        makeRecord({ puzzleId: '9-hard-level-2' })
      ]
    }))
    expect(s.dailyCount).toBe(1)
  })

  it('visibleTotal 排除隐藏勋章', () => {
    const s = buildStats(makeUser())
    expect(s.visibleTotal).toBe(999)  // 1000 - 1 隐藏
  })
})

describe('evaluateCondition 判定', () => {
  it('complete_first: 完成对应尺寸即满足', () => {
    const s = buildStats(makeUser({ records: [makeRecord({ difficulty: { size: 9, level: 'easy' } })] }))
    expect(evaluateCondition({ type: 'complete_first', size: 9 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'complete_first', size: 27 }, s)).toBe(false)
  })

  it('complete_all_level: 三种尺寸各完成 1 局才满足', () => {
    const two = buildStats(makeUser({
      records: [
        makeRecord({ difficulty: { size: 3, level: 'easy' } }),
        makeRecord({ difficulty: { size: 9, level: 'easy' } })
      ]
    }))
    expect(evaluateCondition({ type: 'complete_all_level', level: 'easy' }, two)).toBe(false)

    const three = buildStats(makeUser({
      records: [
        makeRecord({ difficulty: { size: 3, level: 'easy' } }),
        makeRecord({ difficulty: { size: 9, level: 'easy' } }),
        makeRecord({ difficulty: { size: 27, level: 'easy' } })
      ]
    }))
    expect(evaluateCondition({ type: 'complete_all_level', level: 'easy' }, three)).toBe(true)
  })

  it('cumulative: 累计数达标', () => {
    const s = buildStats(makeUser({
      records: Array.from({ length: 10 }, () => makeRecord({ difficulty: { size: 3, level: 'easy' } }))
    }))
    expect(evaluateCondition({ type: 'cumulative', size: 3, count: 10 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'cumulative', size: 3, count: 11 }, s)).toBe(false)
  })

  it('speed: 最佳时间不超过阈值', () => {
    const s = buildStats(makeUser({ records: [makeRecord({ time: 280 })] }))  // 9-hard
    expect(evaluateCondition({ type: 'speed', size: 9, level: 'hard', time: 300 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'speed', size: 9, level: 'hard', time: 200 }, s)).toBe(false)
  })

  it('streak: 当前连胜达标', () => {
    const s = buildStats(makeUser({ streak: 12 }))
    expect(evaluateCondition({ type: 'streak', count: 10 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'streak', count: 20 }, s)).toBe(false)
  })

  it('perfect: 0 错误完成数达标', () => {
    const s = buildStats(makeUser({
      records: [
        makeRecord({ errors: 0 }),
        makeRecord({ errors: 0 }),
        makeRecord({ errors: 5 })
      ]
    }))
    expect(evaluateCondition({ type: 'perfect', count: 2 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'perfect', count: 3 }, s)).toBe(false)
  })

  it('daily_streak / daily_count', () => {
    const s = buildStats(makeUser({
      dailyStreak: 8,
      records: [makeRecord({ puzzleId: 'daily-x' }), makeRecord({ puzzleId: 'daily-y' })]
    }))
    expect(evaluateCondition({ type: 'daily_streak', count: 7 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'daily_count', count: 2 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'daily_count', count: 3 }, s)).toBe(false)
  })

  it('collection_category / collection_percent', () => {
    const s = buildStats(makeUser({ medals: ['medal_1', 'medal_2', 'medal_3'] }))
    expect(evaluateCondition({ type: 'collection_category', category: 'level', count: 3 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'collection_category', category: 'level', count: 4 }, s)).toBe(false)
    // level 分类共 99 个,3/99 ≈ 3%
    expect(evaluateCondition({ type: 'collection_percent', category: 'level', percent: 3 }, s)).toBe(true)
    expect(evaluateCondition({ type: 'collection_percent', category: 'level', percent: 50 }, s)).toBe(false)
  })

  it('special 类: 无 record 时不满足', () => {
    const s = buildStats(makeUser())
    expect(evaluateCondition({ type: 'special', context: 'night' }, s)).toBe(false)
  })

  it('无 condition 时返回 false', () => {
    const s = buildStats(makeUser())
    expect(evaluateCondition(undefined, s)).toBe(false)
  })
})

// ── special 类勋章:情境判定 ────────────────────────────────────
describe('special 类勋章判定', () => {
  const s = buildStats(makeUser())

  function rec(over: Partial<GameRecord> = {}): GameRecord {
    return makeRecord(over)
  }

  it('night: 0-4 点完成', () => {
    const cond = { type: 'special' as const, context: 'night' as const }
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 0 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 4 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 5 }))).toBe(false)
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 23 }))).toBe(false)
  })

  it('early: 6-8 点完成', () => {
    const cond = { type: 'special' as const, context: 'early' as const }
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 6 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 8 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ hourOfDay: 9 }))).toBe(false)
  })

  it('weekend: 周末完成', () => {
    const cond = { type: 'special' as const, context: 'weekend' as const }
    expect(evaluateCondition(cond, s, rec({ isWeekend: true }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ isWeekend: false }))).toBe(false)
  })

  it('hint: 使用提示后完成', () => {
    const cond = { type: 'special' as const, context: 'hint' as const }
    expect(evaluateCondition(cond, s, rec({ usedHint: true }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ usedHint: false }))).toBe(false)
  })

  it('comeback: 出错后仍完成', () => {
    const cond = { type: 'special' as const, context: 'comeback' as const }
    expect(evaluateCondition(cond, s, rec({ recoveredFromError: true }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ recoveredFromError: false }))).toBe(false)
  })

  it('speedrun: 用时不超阈值', () => {
    const cond = { type: 'special' as const, context: 'speedrun' as const, threshold: 300 }
    expect(evaluateCondition(cond, s, rec({ time: 200 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ time: 300 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ time: 400 }))).toBe(false)
  })

  it('marathon: 用时不短于阈值', () => {
    const cond = { type: 'special' as const, context: 'marathon' as const, threshold: 1800 }
    expect(evaluateCondition(cond, s, rec({ time: 1800 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ time: 2400 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ time: 900 }))).toBe(false)
  })

  it('flawless: 0 错误完成', () => {
    const cond = { type: 'special' as const, context: 'flawless' as const }
    expect(evaluateCondition(cond, s, rec({ errors: 0 }))).toBe(true)
    expect(evaluateCondition(cond, s, rec({ errors: 1 }))).toBe(false)
  })

  it('未完成的记录一律不满足', () => {
    const cond = { type: 'special' as const, context: 'flawless' as const }
    expect(evaluateCondition(cond, s, rec({ completed: false, errors: 0 }))).toBe(false)
  })

  it('尺寸/难度不匹配时不满足', () => {
    const cond = { type: 'special' as const, context: 'flawless' as const, size: 27, level: 'hard' }
    const wrong = rec({ errors: 0, difficulty: { size: 3, level: 'easy' } })
    expect(evaluateCondition(cond, s, wrong)).toBe(false)
    const right = rec({ errors: 0, difficulty: { size: 27, level: 'hard' } })
    expect(evaluateCondition(cond, s, right)).toBe(true)
  })

  it('90 个 special 勋章全部带 context 与必要的 threshold', () => {
    const specials = allMedals.filter(m => m.category === 'special')
    expect(specials.length).toBe(90)
    for (const m of specials) {
      expect(m.condition?.context, `${m.id} 缺少 context`).toBeDefined()
      const ctx = m.condition!.context
      if (ctx === 'speedrun' || ctx === 'marathon') {
        expect(m.condition!.threshold, `${m.id} 缺少 threshold`).toBeGreaterThan(0)
      }
    }
  })
})

describe('levelMedalId 解析', () => {
  it('解析标准关卡 id', () => {
    expect(levelMedalId('9-hard-level-7')).toBe('medal_7')
    expect(levelMedalId('3-easy-level-1')).toBe('medal_1')
  })
  it('解析 random- 前缀', () => {
    expect(levelMedalId('random-9-hard-level-12')).toBe('medal_12')
  })
  it('越界关卡号返回 null', () => {
    expect(levelMedalId('9-hard-level-0')).toBeNull()
    expect(levelMedalId('9-hard-level-100')).toBeNull()
  })
  it('非关卡 id 返回 null', () => {
    expect(levelMedalId('9-easy-12345')).toBeNull()
  })
})

describe('categoryTotal', () => {
  it('返回该分类的勋章总数', () => {
    expect(categoryTotal('level')).toBe(99)
    expect(categoryTotal('cumulative')).toBe(200)
  })
})

// ── C. 集成:checkAndUnlockMedals ────────────────────────────────
describe('checkAndUnlockMedals 集成', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  async function getStore() {
    const mod = await import('@/stores/user')
    return mod.useUserStore()
  }

  it('完成关卡发放对应关卡勋章', async () => {
    const store = await getStore()
    const rec = makeRecord({ puzzleId: '9-hard-level-5' })
    store.addGameRecord(rec)
    const unlocked = store.checkAndUnlockMedals(rec)
    expect(store.userData.medals).toContain('medal_5')
    expect(unlocked).toContain('第5关 · 初窥门径')
  })

  it('首次完成 9×9 发放入门类勋章', async () => {
    const store = await getStore()
    const rec = makeRecord({ difficulty: { size: 9, level: 'hard' }, puzzleId: '9-hard-level-1' })
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    expect(store.userData.medals).toContain('starter_2')  // 小试牛刀 = 完成1局9×9
  })

  it('0 错误完成发放完美类勋章', async () => {
    const store = await getStore()
    const rec = makeRecord({ errors: 0 })
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    // 总完美·1局
    expect(store.userData.medals).toContain('perfect_all_1')
  })

  it('集齐 99 个关卡勋章解锁终极「数独之神」', async () => {
    const store = await getStore()
    for (let i = 1; i <= 99; i++) store.unlockMedal(`medal_${i}`)
    const rec = makeRecord()
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    expect(store.userData.medals).toContain('medal_100')
  })

  it('累计类勋章随完成局数解锁', async () => {
    const store = await getStore()
    // 造 5 局 9×9 hard 完成记录
    for (let i = 0; i < 5; i++) {
      store.addGameRecord(makeRecord({ difficulty: { size: 9, level: 'hard' } }))
    }
    const rec = makeRecord({ difficulty: { size: 9, level: 'hard' } })
    store.checkAndUnlockMedals(rec)
    // 注意:id 后缀是「第几个阈值」的序号,不是阈值本身
    // cumulative_9_1 = 1局, _9_2 = 3局, _9_3 = 5局
    expect(store.userData.medals).toContain('cumulative_9_1')  // 1 局
    expect(store.userData.medals).toContain('cumulative_9_2')  // 3 局
    expect(store.userData.medals).toContain('cumulative_9_3')  // 5 局
    expect(store.userData.medals).not.toContain('cumulative_9_4') // 8 局,未达标
  })

  it('unlockMedal 去重: 重复解锁返回 false', async () => {
    const store = await getStore()
    expect(store.unlockMedal('medal_1')).toBe(true)
    expect(store.unlockMedal('medal_1')).toBe(false)
    expect(store.userData.medals.filter(m => m === 'medal_1').length).toBe(1)
  })

  it('未完成的记录不发放关卡勋章', async () => {
    const store = await getStore()
    const rec = makeRecord({ completed: false, puzzleId: '9-hard-level-5' })
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    expect(store.userData.medals).not.toContain('medal_5')
  })

  it('special 勋章可通过情境自动解锁', async () => {
    const store = await getStore()
    const rec = makeRecord({
      difficulty: { size: 9, level: 'hard' },
      time: 120,          // <= 300 → speedrun
      errors: 0,           // → flawless
      hourOfDay: 2,        // → night
      isWeekend: false,
      usedHint: false,
      recoveredFromError: false
    })
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    const specialCount = store.userData.medals.filter(id => id.startsWith('special_')).length
    expect(specialCount).toBeGreaterThan(0)
  })

  it('无情境字段的旧记录不发放 special 勋章', async () => {
    const store = await getStore()
    const rec = makeRecord({ difficulty: { size: 9, level: 'hard' } })
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    // time 条件仍可判定,但时段/周末/提示类没有字段就不该解锁
    const hasTimeBased = store.userData.medals.some(id => {
      const m = getMedalById(id)
      return m?.condition?.context === 'speedrun' || m?.condition?.context === 'marathon'
    })
    const hasContextOnly = store.userData.medals.some(id => {
      const m = getMedalById(id)
      return m?.condition?.context === 'night' || m?.condition?.context === 'weekend'
    })
    expect(hasTimeBased).toBe(true)   // time/errors 是 record 原有字段
    expect(hasContextOnly).toBe(false) // hourOfDay 缺失 → night/weekend 不解锁
  })

  it('解锁全部非隐藏勋章后发放「全能选手」', async () => {
    const store = await getStore()
    // 先解锁除隐藏外的所有勋章
    for (const m of allMedals) {
      if (!m.condition?.hidden) store.unlockMedal(m.id)
    }
    const rec = makeRecord()
    store.addGameRecord(rec)
    store.checkAndUnlockMedals(rec)
    expect(store.userData.medals).toContain('starter_10')
  })

  it('性能: 一局扫描 1000 个勋章应在合理耗时内', async () => {
    const store = await getStore()
    for (let i = 0; i < 20; i++) {
      store.addGameRecord(makeRecord({ difficulty: { size: 9, level: 'hard' } }))
    }
    const rec = makeRecord()
    store.addGameRecord(rec)
    const start = performance.now()
    store.checkAndUnlockMedals(rec)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(200)  // 200ms 宽松上限
  })
})
