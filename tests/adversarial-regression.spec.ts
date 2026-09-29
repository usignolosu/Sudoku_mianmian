import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import Game from '@/views/Game.vue'
import Levels from '@/views/Levels.vue'
import { useGameStore } from '@/stores/game'
import { SudokuGenerator } from '@/utils/sudoku'

/**
 * 对抗性代码审查发现的缺陷 — 永久回归测试
 *
 * 这些用例是「子代理对抗审查」阶段实测确认的真实 bug,
 * 不属于最初 10 项修复清单,但同样会造成用户可感知的故障。
 *
 * FINDING-A: importData 浅拷贝导致 defaultUserData 被污染
 * FINDING-B: URL 非法 level (/game/9/abc) 清空整盘 81 格
 * FINDING-C: URL 非法 size (/game/abc/easy) 生成 0×0 空棋盘
 */

// 自动卸载: 防止遗留组件的 watch 继续触发副作用,污染共享 store
enableAutoUnmount(afterEach)

const routes = [
  { path: '/home', name: 'Home', component: { template: '<div/>' } },
  { path: '/game/:size/:level', name: 'Game', component: Game, props: true },
  { path: '/levels/:size', name: 'Levels', component: Levels, props: true }
]

async function mountGameAt(url: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(Game, {
    global: { plugins: [router] },
    attachTo: document.createElement('div')
  })
  await flushPromises()
  return { wrapper, router, store: useGameStore() }
}

// ─────────────────────────────────────────────────────────────
// FINDING-A: importData 污染 defaultUserData
// ─────────────────────────────────────────────────────────────
describe('FINDING-A: importData 必须深拷贝默认值', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('导入缺失 medals 的 JSON 后,unlockMedal 不得污染模块常量', async () => {
    const mod = await import('@/stores/user')
    const store = mod.useUserStore()
    // 导入一个完全没有 medals 字段的数据
    expect(store.importData(JSON.stringify({ totalGames: 5 }))).toBe(true)
    store.unlockMedal('medal_1')

    // 换全新 pinia + 清空 localStorage → 全新 store 必须回到默认空勋章
    const freshPinia = createPinia()
    setActivePinia(freshPinia)
    localStorage.clear()
    const freshStore = mod.useUserStore(freshPinia)
    expect(freshStore.userData.medals).toEqual([])
  })

  it('导入缺失 medals 的 JSON 后,medals 是独立数组', async () => {
    const mod = await import('@/stores/user')
    const store = mod.useUserStore()
    store.importData(JSON.stringify({ totalGames: 1 }))
    const firstMedalsRef = store.userData.medals
    store.importData(JSON.stringify({ totalGames: 2 }))
    const secondMedalsRef = store.userData.medals
    // 两次导入产生的 medals 数组不能是同一引用
    expect(firstMedalsRef).not.toBe(secondMedalsRef)
  })

  it('导入缺失 records/bestTimes/avgTimes 的 JSON 后不污染默认值', async () => {
    const mod = await import('@/stores/user')
    const store = mod.useUserStore()
    store.importData(JSON.stringify({ totalGames: 7 }))
    store.userData.records.push({
      id: 'x', date: new Date().toISOString(),
      difficulty: { size: 9, level: 'hard' },
      time: 1, errors: 0, completed: true, medals: [], puzzleId: 'p'
    })
    store.userData.bestTimes['9x9_hard'] = 1
    store.userData.avgTimes['9x9_hard'] = [1]

    // 全新 store 不得看到这些写入
    const freshPinia = createPinia()
    setActivePinia(freshPinia)
    localStorage.clear()
    const freshStore = mod.useUserStore(freshPinia)
    expect(freshStore.userData.records).toEqual([])
    expect(freshStore.userData.bestTimes).toEqual({})
    expect(freshStore.userData.avgTimes).toEqual({})
  })

  it('导入含 medals 的 JSON 时保留导入值且不与源数组共享', async () => {
    const mod = await import('@/stores/user')
    const store = mod.useUserStore()
    const source = ['medal_2', 'medal_3']
    store.importData(JSON.stringify({ medals: source }))
    expect(store.userData.medals).toEqual(source)
    store.userData.medals.push('medal_9')
    expect(source).toEqual(['medal_2', 'medal_3'])  // 源数组未被改动
  })
})

// ─────────────────────────────────────────────────────────────
// FINDING-B / FINDING-C: 非法 URL 参数必须降级
// ─────────────────────────────────────────────────────────────
describe('FINDING-B: 非法 level URL 降级 (TC-B03-03)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('generatePuzzle(非法 level) 不得清空整盘', () => {
    const g = new SudokuGenerator(9)
    const puzzle = g.generatePuzzle('abc' as any)
    let zeros = 0
    for (const row of puzzle.puzzle) for (const v of row) if (v === 0) zeros++
    // 修复前是 81 (全空),修复后应接近中级的 50%
    expect(zeros).toBeLessThan(81)
    expect(zeros).toBeGreaterThan(0)
  })

  it('generatePuzzleWithSeed(非法 level) 不得清空整盘', () => {
    const g = new SudokuGenerator(9)
    const puzzle = g.generatePuzzleWithSeed('seed', 'zzz' as any)
    let zeros = 0
    for (const row of puzzle.puzzle) for (const v of row) if (v === 0) zeros++
    expect(zeros).toBeLessThan(81)
    expect(zeros).toBeGreaterThan(0)
  })

  it('/game/9/abc 渲染出合法难度而非非法值', async () => {
    const { store } = await mountGameAt('/game/9/abc')
    expect(['easy', 'medium', 'hard']).toContain(store.gameState?.difficulty.level)
    expect(store.gameState?.difficulty.level).toBe('medium')
  })

  it('/game/9/abc 的棋盘仍有初始数字 (不是全空)', async () => {
    const { store } = await mountGameAt('/game/9/abc')
    let fixedCount = 0
    for (const row of store.gameState!.grid) {
      for (const cell of row) if (cell.fixed) fixedCount++
    }
    expect(fixedCount).toBeGreaterThan(0)
  })
})

describe('FINDING-C: 非法 size URL 降级 (TC-B03-02)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('/game/abc/easy 降级为 9×9 且棋盘非空', async () => {
    const { store } = await mountGameAt('/game/abc/easy')
    expect(store.gameState?.difficulty.size).toBe(9)
    expect(store.gameState?.grid.length).toBe(9)
    expect(store.gameState?.grid[0].length).toBe(9)
  })

  it('/game/0/easy 也不得生成空棋盘', async () => {
    const { store } = await mountGameAt('/game/0/easy')
    expect([3, 9, 27]).toContain(store.gameState?.difficulty.size)
    expect(store.gameState?.grid.length).toBeGreaterThan(0)
  })

  it('/game/999/easy 也不得生成异常棋盘', async () => {
    const { store } = await mountGameAt('/game/999/easy')
    expect([3, 9, 27]).toContain(store.gameState?.difficulty.size)
    expect(store.gameState?.grid.length).toBeGreaterThan(0)
  })

  it('合法尺寸 3 / 9 / 27 不受影响', async () => {
    for (const s of [3, 9, 27]) {
      setActivePinia(createPinia())
      localStorage.clear()
      const { store } = await mountGameAt(`/game/${s}/easy`)
      expect(store.gameState?.difficulty.size).toBe(s)
      expect(store.gameState?.grid.length).toBe(s)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// FINDING-D: Levels.vue 非法 size 参数
// ─────────────────────────────────────────────────────────────
describe('FINDING-D: Levels.vue 非法 size 参数降级', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    setActivePinia(createPinia())
  })

  async function mountLevelsAt(url: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(url)
    await router.isReady()
    const wrapper = mount(Levels, {
      global: { plugins: [router] },
      attachTo: document.createElement('div')
    })
    await flushPromises()
    return { wrapper, router }
  }

  it('/levels/abc 不崩溃且渲染 99 个关卡按钮', async () => {
    const { wrapper } = await mountLevelsAt('/levels/abc')
    expect(wrapper.findAll('.level-btn').length).toBe(99)
  })

  it('/levels/abc 降级为 9×9,可正常判定标准版完成记录', async () => {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    userStore.addGameRecord({
      id: 'r', date: new Date().toISOString(),
      difficulty: { size: 9, level: 'hard' },
      time: 100, errors: 0, completed: true, medals: [],
      puzzleId: '9-hard-level-3'
    })
    const { wrapper } = await mountLevelsAt('/levels/abc')
    const buttons = wrapper.findAll('.level-btn')
    // 降级为 size=9 后第 3 关应被识别为已完成
    expect(buttons[2].classes()).toContain('completed')
  })

  it('/levels/3 与 /levels/27 正常工作', async () => {
    const r3 = await mountLevelsAt('/levels/3')
    expect(r3.wrapper.findAll('.level-btn').length).toBe(99)
    const r27 = await mountLevelsAt('/levels/27')
    expect(r27.wrapper.findAll('.level-btn').length).toBe(99)
  })
})

// ─────────────────────────────────────────────────────────────
// FINDING-E: Game.vue query.level 越界/非法值
// ─────────────────────────────────────────────────────────────
describe('FINDING-E: query.level 越界与非法值', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('?level=abc 降级为随机模式 (不产生越界关卡号)', async () => {
    const { store } = await mountGameAt('/game/9/easy?level=abc')
    expect(store.gameState?.puzzleId).toMatch(/^9-easy-\d+$/)  // 随机,非 level-
  })

  it('?level=0 降级为随机模式', async () => {
    const { store } = await mountGameAt('/game/9/easy?level=0')
    expect(store.gameState?.puzzleId).toMatch(/^9-easy-\d+$/)
  })

  it('?level=999 降级为随机模式 (不再生成越界关卡)', async () => {
    const { store } = await mountGameAt('/game/9/easy?level=999')
    expect(store.gameState?.puzzleId).not.toContain('level-999')
  })

  it('?level=-5 降级为随机模式', async () => {
    const { store } = await mountGameAt('/game/9/easy?level=-5')
    expect(store.gameState?.puzzleId).toMatch(/^9-easy-\d+$/)
  })

  it('合法 ?level=1 与 ?level=99 仍正常工作且显示正确按钮文案', async () => {
    const r1 = await mountGameAt('/game/9/easy?level=1')
    expect(r1.store.gameState?.puzzleId).toBe('9-easy-level-1')

    setActivePinia(createPinia())
    localStorage.clear()
    const r99 = await mountGameAt('/game/9/easy?level=99')
    expect(r99.store.gameState?.puzzleId).toBe('9-easy-level-99')
  })
})

// ─────────────────────────────────────────────────────────────
// 子代理提出但实测排除的疑点 — 固化为守护测试
// ─────────────────────────────────────────────────────────────
describe('审查疑点排除: 无双重初始化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('onMounted 与 watch 不会重复初始化同一关', async () => {
    const { store } = await mountGameAt('/game/9/easy?level=5')
    const id1 = store.gameState?.puzzleId
    await flushPromises()
    await flushPromises()
    expect(id1).toBe('9-easy-level-5')
    expect(store.gameState?.puzzleId).toBe('9-easy-level-5')
  })

  it('redo 两次错误填入后 errors 精确回到 2', () => {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    const empties: [number, number][] = []
    for (let r = 0; r < 9 && empties.length < 2; r++) {
      for (let c = 0; c < 9 && empties.length < 2; c++) {
        if (store.gameState!.grid[r][c].value === null) empties.push([r, c])
      }
    }
    const [[r1, c1], [r2, c2]] = empties
    const wrong1 = (store.gameState!.solution[r1][c1] % 9) + 1
    const wrong2 = (store.gameState!.solution[r2][c2] % 9) + 1

    store.selectCell(r1, c1); store.fillNumber(wrong1)
    store.selectCell(r2, c2); store.fillNumber(wrong2)
    expect(store.gameState!.errors).toBe(2)

    store.undo(); expect(store.gameState!.errors).toBe(1)
    store.undo(); expect(store.gameState!.errors).toBe(0)

    store.redo(); expect(store.gameState!.errors).toBe(1)
    store.redo(); expect(store.gameState!.errors).toBe(2)
  })
})
