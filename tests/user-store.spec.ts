import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia, type Pinia } from 'pinia'
// (useUserStore 通过 dynamic import 获得)

// 测试隔离: 每次 test 前重置模块,确保 store 状态干净
async function getStore(pinia: Pinia) {
  const mod = await import('@/stores/user')
  const store = mod.useUserStore(pinia)
  // 强制重置 userData (因为 loadUserData 只在 setup 时跑一次)
  // setup store 在外部访问 ref 字段会被 Pinia 自动 unwrap,
  // store.userData 是 reactive 对象,直接 Object.assign 即可
  store.userData && Object.assign(store.userData, {
    totalGames: 0, totalTime: 0,
    bestTimes: {}, avgTimes: {},
    streak: 0, maxStreak: 0, lastPlayDate: '',
    dailyStreak: 0, maxDailyStreak: 0,
    medals: [], records: [],
    settings: { sound: true, errorHint: true, theme: 'light' }
  })
  return store
}


import type { GameRecord, UserData } from '@/types'

/**
 * Bug 修复: 用显式 pinia 参数传入 getStore(pinia),
 * 否则 Pinia 在 setActivePinia 后旧 store 实例仍被复用,
 * 导致测试间 userData 状态串扰
 */


const makeRecord = (overrides: Partial<GameRecord> = {}): GameRecord => ({
  id: 'rec-1',
  date: new Date().toISOString(),
  difficulty: { size: 9, level: 'hard' },
  time: 300,
  errors: 0,
  completed: true,
  medals: [],
  puzzleId: '9-hard-level-1',
  ...overrides
})

describe('useUserStore - 默认数据', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('初始 userData 来自默认值', async () => {
    const store = await getStore(pinia)
    expect(store.userData.totalGames).toBe(0)
    expect(store.userData.streak).toBe(0)
    expect(store.userData.medals).toEqual([])
    expect(store.userData.settings.theme).toBe('light')
    expect(store.userData.settings.sound).toBe(true)
  })

  it('unlockedMedalsCount 与 medals.length 一致', async () => {
    const store = await getStore(pinia)
    expect(store.unlockedMedalsCount).toBe(0)
    store.unlockMedal('medal_1')
    store.unlockMedal('medal_2')
    expect(store.unlockedMedalsCount).toBe(2)
  })
})

describe('useUserStore - addGameRecord Bug#6/#7 影响', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('完成记录 → totalGames+1,streak+1', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ completed: true }))
    expect(store.userData.totalGames).toBe(1)
    expect(store.userData.streak).toBe(1)
    expect(store.userData.maxStreak).toBe(1)
  })

  it('未完成记录 → streak 清零', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ completed: true }))
    store.addGameRecord(makeRecord({ id: 'rec-2', completed: false }))
    expect(store.userData.streak).toBe(0)
    expect(store.userData.maxStreak).toBe(1)  // 历史最大连胜保留
  })

  it('bestTime: 同难度多次完成保留最快', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ time: 500 }))
    store.addGameRecord(makeRecord({ id: 'r2', time: 300 }))
    store.addGameRecord(makeRecord({ id: 'r3', time: 700 }))
    expect(store.userData.bestTimes['9x9_hard']).toBe(300)
  })

  it('avgTimes 数组累加每次时间', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ time: 100 }))
    store.addGameRecord(makeRecord({ id: 'r2', time: 200 }))
    store.addGameRecord(makeRecord({ id: 'r3', time: 300 }))
    expect(store.userData.avgTimes['9x9_hard']).toEqual([100, 200, 300])
  })

  it('totalTime 累加', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ time: 100 }))
    store.addGameRecord(makeRecord({ id: 'r2', time: 200 }))
    expect(store.userData.totalTime).toBe(300)
  })

  it('lastPlayDate 更新到今天', async () => {
    const store = await getStore(pinia)
    const before = store.userData.lastPlayDate
    store.addGameRecord(makeRecord())
    const today = new Date().toISOString().split('T')[0]
    expect(store.userData.lastPlayDate).toBe(today)
    expect(store.userData.lastPlayDate).not.toBe(before)
  })

  it('addGameRecord 后持久化到 localStorage', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord())
    const raw = localStorage.getItem('sudoku_user_data')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.totalGames).toBe(1)
  })
})

describe('useUserStore - unlockMedal Bug#9 解锁日期', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('解锁新勋章返回 true', async () => {
    const store = await getStore(pinia)
    expect(store.unlockMedal('medal_5')).toBe(true)
    expect(store.userData.medals).toContain('medal_5')
  })

  it('重复解锁返回 false 且不会重复添加', async () => {
    const store = await getStore(pinia)
    store.unlockMedal('medal_5')
    expect(store.unlockMedal('medal_5')).toBe(false)
    expect(store.userData.medals.filter(m => m === 'medal_5').length).toBe(1)
  })

  it('解锁时写入 unlockedAt 时间戳 (Bug#9)', async () => {
    const store = await getStore(pinia)
    store.unlockMedal('medal_1')
    expect(store.userData.medalUnlockedAt).toBeDefined()
    expect(store.userData.medalUnlockedAt!['medal_1']).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('checkAndUnlockMedals: 解锁关卡 medal_N', async () => {
    const store = await getStore(pinia)
    const unlocked = store.checkAndUnlockMedals(
      makeRecord({ puzzleId: '9-hard-level-5', completed: true })
    )
    expect(unlocked).toContain('第5关 · 初窥门径')
    expect(store.userData.medals).toContain('medal_5')
  })

  it('checkAndUnlockMedals: 集齐 99 关卡后解锁终极勋章', async () => {
    const store = await getStore(pinia)
    // 模拟已有 99 个关卡勋章
    for (let i = 1; i <= 99; i++) {
      store.unlockMedal(`medal_${i}`)
    }
    const unlocked = store.checkAndUnlockMedals(makeRecord({ puzzleId: '9-hard-level-99' }))
    expect(unlocked).toContain('数独之神')
    expect(store.userData.medals).toContain('medal_100')
  })

  it('未完成时不触发关卡勋章解锁', async () => {
    const store = await getStore(pinia)
    const unlocked = store.checkAndUnlockMedals(
      makeRecord({ puzzleId: '9-hard-level-5', completed: false })
    )
    expect(store.userData.medals).not.toContain('medal_5')
    expect(unlocked).toEqual([])
  })
})

describe('useUserStore - updateSettings Bug#7 主题切换', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('updateSettings 合并 + 持久化', async () => {
    const store = await getStore(pinia)
    store.updateSettings({ sound: false })
    expect(store.userData.settings.sound).toBe(false)
    expect(store.userData.settings.theme).toBe('light')  // 主题保留
  })

  it('updateSettings 传 theme 时 applyTheme (Bug#7)', async () => {
    const store = await getStore(pinia)
    store.updateSettings({ theme: 'dark' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('updateSettings 不传 theme 不应改变主题', async () => {
    const store = await getStore(pinia)
    store.setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    store.updateSettings({ sound: false })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')  // 不变
  })

  it('setTheme 单独切主题', async () => {
    const store = await getStore(pinia)
    store.setTheme('macaron-pink')
    expect(store.userData.settings.theme).toBe('macaron-pink')
    expect(document.documentElement.getAttribute('data-theme')).toBe('macaron-pink')
  })
})

describe('useUserStore - importData / exportData', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('exportData 返回 JSON 字符串', async () => {
    const store = await getStore(pinia)
    store.unlockMedal('medal_3')
    const json = store.exportData()
    expect(() => JSON.parse(json)).not.toThrow()
    const parsed = JSON.parse(json)
    expect(parsed.medals).toContain('medal_3')
  })

  it('importData 成功 → 覆盖数据 + 应用主题 (Bug#7)', async () => {
    const store = await getStore(pinia)
    const json = JSON.stringify({
      totalGames: 50,
      medals: ['medal_1', 'medal_2'],
      medalUnlockedAt: { medal_1: '2024-01-01T00:00:00Z' },
      records: [],
      settings: { sound: false, errorHint: false, theme: 'dark' }
    } as Partial<UserData>)
    const ok = store.importData(json)
    expect(ok).toBe(true)
    expect(store.userData.totalGames).toBe(50)
    expect(store.userData.medals).toEqual(['medal_1', 'medal_2'])
    expect(store.userData.medalUnlockedAt!['medal_1']).toBe('2024-01-01T00:00:00Z')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(store.userData.settings.sound).toBe(false)
  })

  it('importData 损坏 JSON 返回 false', async () => {
    const store = await getStore(pinia)
    const ok = store.importData('not-json{{{')
    expect(ok).toBe(false)
  })

  it('importData 缺失字段补默认值', async () => {
    const store = await getStore(pinia)
    const ok = store.importData(JSON.stringify({ totalGames: 5 }))
    expect(ok).toBe(true)
    expect(store.userData.totalGames).toBe(5)
    expect(store.userData.streak).toBe(0)  // 默认值
    expect(store.userData.settings.theme).toBe('light')
  })

  it('clearData 重置到默认值', async () => {
    const store = await getStore(pinia)
    store.unlockMedal('medal_1')
    store.clearData()
    expect(store.userData.totalGames).toBe(0)
    expect(store.userData.medals).toEqual([])
    expect(store.userData.settings.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('useUserStore - dailyStreak 跨天判定', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('首次调用 → dailyStreak=1', async () => {
    const store = await getStore(pinia)
    store.userData.lastPlayDate = ''
    store.updateDailyStreak()
    expect(store.userData.dailyStreak).toBe(1)
  })

  it('同一天再次调用 → dailyStreak 不变', async () => {
    const store = await getStore(pinia)
    const today = new Date().toISOString().split('T')[0]
    store.userData.lastPlayDate = today
    store.userData.dailyStreak = 5
    store.updateDailyStreak()
    expect(store.userData.dailyStreak).toBe(5)
  })

  it('连续第二天 → dailyStreak+1', async () => {
    const store = await getStore(pinia)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    store.userData.lastPlayDate = yesterday
    store.userData.dailyStreak = 5
    store.updateDailyStreak()
    expect(store.userData.dailyStreak).toBe(6)
  })

  it('中断超过 1 天 → dailyStreak 重置为 1', async () => {
    const store = await getStore(pinia)
    const longAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]
    store.userData.lastPlayDate = longAgo
    store.userData.dailyStreak = 10
    store.updateDailyStreak()
    expect(store.userData.dailyStreak).toBe(1)
  })

  it('maxDailyStreak 保留历史最大', async () => {
    const store = await getStore(pinia)
    store.userData.lastPlayDate = ''
    store.updateDailyStreak()
    store.userData.lastPlayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    store.userData.dailyStreak = 5
    const today = new Date().toISOString().split('T')[0]
    store.userData.lastPlayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    store.updateDailyStreak()
    expect(store.userData.maxDailyStreak).toBeGreaterThanOrEqual(5)
  })
})

describe('useUserStore - getRecords 分页', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('空记录返回空数组', async () => {
    const store = await getStore(pinia)
    expect(store.getRecords()).toEqual([])
  })

  it('最新记录排在前面', async () => {
    const store = await getStore(pinia)
    for (let i = 1; i <= 5; i++) {
      store.addGameRecord(makeRecord({ id: `r${i}`, date: `2024-01-0${i}T00:00:00Z` }))
    }
    const records = store.getRecords()
    expect(records[0].id).toBe('r5')
    expect(records[4].id).toBe('r1')
  })

  it('分页: page=1 返回前 20 条', async () => {
    const store = await getStore(pinia)
    for (let i = 1; i <= 25; i++) {
      store.addGameRecord(makeRecord({ id: `r${i}` }))
    }
    const page1 = store.getRecords(1, 20)
    expect(page1.length).toBe(20)
  })

  it('分页: page=2 返回剩余', async () => {
    const store = await getStore(pinia)
    console.log('records before add:', store.userData.records.length)
    for (let i = 1; i <= 25; i++) {
      store.addGameRecord(makeRecord({ id: `r${i}` }))
    }
    console.log('records after add:', store.userData.records.length)
    const page2 = store.getRecords(2, 20)
    console.log('page2 length:', page2.length)
    expect(page2.length).toBe(5)
  })
})

describe('useUserStore - getBestTime / getAvgTime', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('getBestTime 没记录返回 null', async () => {
    const store = await getStore(pinia)
    expect(store.getBestTime({ size: 9, level: 'hard' })).toBeNull()
  })

  it('getBestTime 有记录返回最小 time', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ time: 500 }))
    store.addGameRecord(makeRecord({ id: 'r2', time: 200 }))
    expect(store.getBestTime({ size: 9, level: 'hard' })).toBe(200)
  })

  it('getAvgTime 返回该难度平均值 (四舍五入)', async () => {
    const store = await getStore(pinia)
    store.addGameRecord(makeRecord({ time: 100 }))
    store.addGameRecord(makeRecord({ id: 'r2', time: 200 }))
    store.addGameRecord(makeRecord({ id: 'r3', time: 300 }))
    expect(store.getAvgTime({ size: 9, level: 'hard' })).toBe(200)
  })
})

describe('useUserStore - applyTheme / init', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('init 会应用当前主题到 documentElement', async () => {
    const store = await getStore(pinia)
    store.userData.settings.theme = 'macaron-purple'
    store.init()
    expect(document.documentElement.getAttribute('data-theme')).toBe('macaron-purple')
  })
})

describe('useUserStore - 持久化兼容性', () => {
  let pinia: Pinia
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('载入旧数据 (无 medalUnlockedAt 字段) 应正常工作', async () => {
    // 模拟旧版本 localStorage 数据
    const oldData: any = {
      totalGames: 5,
      totalTime: 1500,
      bestTimes: { '9x9_hard': 300 },
      avgTimes: {},
      streak: 3,
      maxStreak: 5,
      lastPlayDate: '2024-01-01',
      dailyStreak: 1,
      maxDailyStreak: 3,
      medals: ['medal_1'],
      records: [],
      settings: { sound: false, errorHint: true, theme: 'dark' }
      // 注意没有 medalUnlockedAt
    }
    localStorage.setItem('sudoku_user_data', JSON.stringify(oldData))

    // 重新 import 模块 → 触发 loadUserData → 读上面的旧数据
    vi.resetModules()
    pinia = createPinia()
    setActivePinia(pinia)
    const { useUserStore } = await import('@/stores/user')
    const store = useUserStore(pinia)
    expect(store.userData.medals).toContain('medal_1')
    expect(store.userData.medalUnlockedAt).toBeUndefined()  // 旧数据没有这个字段
    expect(store.userData.settings.theme).toBe('dark')
  })
})