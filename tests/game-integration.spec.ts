import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import Game from '@/views/Game.vue'
import Home from '@/views/Home.vue'
import Levels from '@/views/Levels.vue'
import { useGameStore } from '@/stores/game'

/**
 * Game.vue 集成测试
 * 覆盖路由响应 / 关卡跳转 / 难度切换 / 撤销按钮 disabled / 完成态锁
 */

// 自动卸载: 防止遗留组件的 watch 继续触发副作用,污染共享 store
enableAutoUnmount(afterEach)

const routes = [
  { path: '/', name: 'Splash', component: { template: '<div/>' } },
  { path: '/home', name: 'Home', component: Home },
  { path: '/game/:size/:level', name: 'Game', component: Game, props: true },
  { path: '/levels/:size', name: 'Levels', component: Levels, props: true }
]

async function mountAt(url: string) {
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

describe('Game.vue 路由响应', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('?level=2 → ?level=3 时棋盘真的换关', async () => {
    const { router, store } = await mountAt('/game/3/easy?level=2')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('3-easy-level-2')

    await router.push('/game/3/easy?level=3')
    await flushPromises()

    expect(store.gameState?.puzzleId).toBe('3-easy-level-3')
  })

  it('跨多关连跳都能换', async () => {
    const { router, store } = await mountAt('/game/3/easy?level=5')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('3-easy-level-5')

    await router.push('/game/3/easy?level=10')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('3-easy-level-10')

    await router.push('/game/3/easy?level=50')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('3-easy-level-50')
  })

  it('切难度时保留 levelNum', async () => {
    const { wrapper, router } = await mountAt('/game/3/easy?level=7')
    await flushPromises()
    const mediumBtn = wrapper.findAll('button').find(b => b.text() === '中级')
    expect(mediumBtn).toBeTruthy()
    await mediumBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.params.level).toBe('medium')
    expect(router.currentRoute.value.query.level).toBe('7')
  })

  it('每日挑战模式不破坏', async () => {
    const { router, store } = await mountAt('/game/9/easy?daily=1')
    await flushPromises()
    expect(store.gameState).toBeTruthy()
    await router.push('/game/9/hard?daily=1')
    await flushPromises()
    expect(router.currentRoute.value.query.daily).toBe('1')
  })

  it('随机模式 puzzleId 带 random- 前缀', async () => {
    const { router, store } = await mountAt('/game/9/hard?level=12&random=true')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('random-9-hard-level-12')
  })
})

describe('Game.vue 按钮交互', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('撤销按钮初始禁用 (history 为空)', async () => {
    const { wrapper } = await mountAt('/game/9/easy')
    await flushPromises()
    const undoBtn = wrapper.findAll('button').find(b => b.text().includes('撤销'))
    expect(undoBtn).toBeTruthy()
    expect(undoBtn!.attributes('disabled')).toBeDefined()
  })

  it('填数字后撤销按钮启用', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    // 选空格 + 填一个数
    let r = -1, c = -1
    for (let i = 0; i < 9 && r === -1; i++) {
      for (let j = 0; j < 9; j++) {
        if (store.gameState!.grid[i][j].value === null) { r = i; c = j; break }
      }
    }
    store.selectCell(r, c)
    store.fillNumber(store.gameState!.solution[r][c])
    await flushPromises()
    const undoBtn = wrapper.findAll('button').find(b => b.text().includes('撤销'))
    expect(undoBtn!.attributes('disabled')).toBeUndefined()
  })

  it('重做按钮在撤销前禁用', async () => {
    const { wrapper } = await mountAt('/game/9/easy')
    await flushPromises()
    const redoBtn = wrapper.findAll('button').find(b => b.text().includes('重做'))
    expect(redoBtn!.attributes('disabled')).toBeDefined()
  })

  it('提示按钮初始启用 (剩余 3 次)', async () => {
    const { wrapper } = await mountAt('/game/9/easy')
    await flushPromises()
    const hintBtn = wrapper.findAll('button').find(b => b.text().includes('提示'))
    expect(hintBtn!.attributes('disabled')).toBeUndefined()
  })

  it('使用 3 次后提示按钮禁用 (Bug#3)', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    store.useHint()
    store.useHint()
    store.useHint()
    await flushPromises()
    expect(store.gameState!.hintsUsed).toBe(3)
    const hintBtn = wrapper.findAll('button').find(b => b.text().includes('提示'))
    expect(hintBtn!.attributes('disabled')).toBeDefined()
  })

  it('暂停时棋盘、操作区、难度切换、数字键盘都 blur', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    // 找暂停按钮 (header 内 ⏸)
    const pauseBtn = wrapper.findAll('button').find(b => b.text().includes('⏸') || b.text().includes('暂停'))
    expect(pauseBtn).toBeTruthy()
    await pauseBtn!.trigger('click')
    await flushPromises()
    expect(store.gameState!.isPaused).toBe(true)
    // 棋盘、操作区、难度、数字键盘都应该有 blurred 类
    expect(wrapper.find('.game-board-container').classes()).toContain('blurred')
    expect(wrapper.find('.game-actions').classes()).toContain('blurred')
    expect(wrapper.find('.difficulty-switch').classes()).toContain('blurred')
    expect(wrapper.find('.number-pad').classes()).toContain('blurred')
  })

  it('点暂停按钮变成 ▶,再点恢复', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    const pauseBtn = wrapper.findAll('button').find(b => b.text().includes('⏸'))
    await pauseBtn!.trigger('click')
    await flushPromises()
    expect(store.gameState!.isPaused).toBe(true)
    const resumeBtn = wrapper.findAll('button').find(b => b.text().includes('▶'))
    expect(resumeBtn).toBeTruthy()
    await resumeBtn!.trigger('click')
    await flushPromises()
    expect(store.gameState!.isPaused).toBe(false)
  })

  it('笔记按钮激活态 (Bug#5 视觉)', async () => {
    const { wrapper } = await mountAt('/game/9/easy')
    await flushPromises()
    const noteBtn = wrapper.findAll('button').find(b => b.text().includes('笔记'))
    expect(noteBtn).toBeTruthy()
    expect(noteBtn!.classes()).not.toContain('active')
    await noteBtn!.trigger('click')
    await flushPromises()
    expect(noteBtn!.classes()).toContain('active')
  })

  it('笔记模式下选 fixed 格子显示提示文字 (Bug#5)', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    // 找一个 fixed 格子
    let fr = 0, fc = 0
    outer: for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (store.gameState!.grid[r][c].fixed) { fr = r; fc = c; break outer }
      }
    }
    // 开启笔记模式
    const noteBtn = wrapper.findAll('button').find(b => b.text().includes('笔记'))!
    await noteBtn.trigger('click')
    await flushPromises()
    // 选 fixed 格子
    store.selectCell(fr, fc)
    await flushPromises()
    expect(wrapper.find('.note-hint').exists()).toBe(true)
    expect(wrapper.text()).toContain('笔记模式仅对空白格子生效')
  })

  it('完成的游戏: 数字键盘 + 难度切换 + 提示按钮都禁用 (Bug#4)', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    store.gameState!.isCompleted = true
    await flushPromises()
    const hintBtn = wrapper.findAll('button').find(b => b.text().includes('提示'))
    expect(hintBtn!.attributes('disabled')).toBeDefined()
    // 数字键盘按钮禁用
    const numberBtns = wrapper.findAll('.number-btn')
    expect(numberBtns.length).toBeGreaterThan(0)
    expect(numberBtns[0].attributes('disabled')).toBeDefined()
    // 难度切换按钮禁用
    const easyBtn = wrapper.findAll('button').find(b => b.text() === '初级')
    expect(easyBtn!.attributes('disabled')).toBeDefined()
  })
})

describe('Game.vue 返回 / 再来一局', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('返回首页按钮跳到 /home', async () => {
    const { wrapper, router } = await mountAt('/game/9/easy?level=3')
    await flushPromises()
    // 返回按钮
    const backBtn = wrapper.findAll('button').find(b => b.text().includes('←'))
    expect(backBtn).toBeTruthy()
    await backBtn!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('完成弹窗显示用时/错误/提示数', async () => {
    const { wrapper, store } = await mountAt('/game/9/easy')
    await flushPromises()
    store.gameState!.isCompleted = true
    store.gameState!.timer = 125
    store.gameState!.errors = 3
    store.gameState!.hintsUsed = 2
    await flushPromises()
    const completeContent = wrapper.find('.complete-content')
    expect(completeContent.exists()).toBe(true)
    expect(completeContent.text()).toContain('02:05')
    expect(completeContent.text()).toContain('3')  // errors
    expect(completeContent.text()).toContain('2次')  // hintsUsed
  })

  it('完成弹窗"再来一局"按钮在关卡模式下显示"下一关"', async () => {
    const { wrapper } = await mountAt('/game/9/easy?level=3')
    await flushPromises()
    const store = useGameStore()
    store.gameState!.isCompleted = true
    await flushPromises()
    const playAgainBtn = wrapper.findAll('button').find(b => b.text().includes('下一关') || b.text().includes('再来一局'))
    expect(playAgainBtn).toBeTruthy()
    expect(playAgainBtn!.text()).toContain('下一关')
  })

  it('完成弹窗"再来一局"在第 99 关显示"重新挑战"', async () => {
    const { wrapper } = await mountAt('/game/9/easy?level=99')
    await flushPromises()
    const store = useGameStore()
    store.gameState!.isCompleted = true
    await flushPromises()
    const playAgainBtn = wrapper.findAll('button').find(b => b.text().includes('重新挑战') || b.text().includes('再来一局'))
    expect(playAgainBtn!.text()).toContain('重新挑战')
  })

  it('完成时把游戏记录写入 user store 并解锁关卡勋章', async () => {
    const { wrapper } = await mountAt('/game/9/easy?level=1')
    await flushPromises()
    const store = useGameStore()
    // 模拟完成 — 走 watch 触发 saveGameRecord
    store.gameState!.isCompleted = true
    store.gameState!.timer = 100
    store.gameState!.errors = 0
    await flushPromises()
    // userStore records 应该多了 1 条
    // 这里 import 需要动态,因为 userStore 用了 default 常量,跨测试要 reset
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    expect(userStore.userData.records.length).toBeGreaterThanOrEqual(1)
    // 解锁 medal_1
    expect(userStore.userData.medals).toContain('medal_1')
  })
})

describe('Levels.vue 关卡解锁', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('未完成任何关卡时: 前 10 关解锁,11 关及之后锁定', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/levels/9')
    await router.isReady()
    const wrapper = mount(Levels, {
      global: { plugins: [router] },
      attachTo: document.createElement('div')
    })
    await flushPromises()
    // 第 1 关可点,第 11 关不可点
    const buttons = wrapper.findAll('.level-btn')
    expect(buttons[0].attributes('disabled')).toBeUndefined()  // 1
    expect(buttons[9].attributes('disabled')).toBeUndefined()  // 10
    expect(buttons[10].attributes('disabled')).toBeDefined()  // 11
  })

  it('完成第 5 关后: 第 6 关解锁', async () => {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    userStore.addGameRecord({
      id: 'r', date: new Date().toISOString(),
      difficulty: { size: 9, level: 'hard' },
      time: 100, errors: 0, completed: true, medals: [],
      puzzleId: '9-hard-level-5'
    })

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/levels/9')
    await router.isReady()
    const wrapper = mount(Levels, {
      global: { plugins: [router] },
      attachTo: document.createElement('div')
    })
    await flushPromises()
    const buttons = wrapper.findAll('.level-btn')
    // 默认 level='hard',所以第 5 关 puzzleId='9-hard-level-5' 应算完成
    expect(buttons[4].classes()).toContain('completed')
    expect(buttons[5].attributes('disabled')).toBeUndefined()  // 6 解锁
  })

  it('Random 模式完成的关卡也算关卡完成 (Bug#6)', async () => {
    const { useUserStore } = await import('@/stores/user')
    const userStore = useUserStore()
    userStore.addGameRecord({
      id: 'r', date: new Date().toISOString(),
      difficulty: { size: 9, level: 'hard' },
      time: 100, errors: 0, completed: true, medals: [],
      puzzleId: 'random-9-hard-level-7'  // ← random- 前缀
    })

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/levels/9')
    await router.isReady()
    const wrapper = mount(Levels, {
      global: { plugins: [router] },
      attachTo: document.createElement('div')
    })
    await flushPromises()
    const buttons = wrapper.findAll('.level-btn')
    expect(buttons[6].classes()).toContain('completed')  // 第 7 关
    expect(buttons[7].attributes('disabled')).toBeUndefined()  // 第 8 关解锁
  })
})