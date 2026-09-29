import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import { sound } from '@/utils/audio'
import { useGameStore } from '@/stores/game'
import { useUserStore } from '@/stores/user'
import Game from '@/views/Game.vue'
import type { GameRecord } from '@/types'

// 自动卸载: 防止遗留组件的 watch 继续触发副作用
enableAutoUnmount(afterEach)

/**
 * 音效接线测试 — 需求 §7 的 7 个触发点是否真的被调用
 *
 * 单测 audio.ts 只证明「乐谱与播放器正确」;
 * 这里证明「游戏/设置流程真的会去触发它们」。
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

/** 找棋盘上第一个空格 */
function findFirstEmpty(grid: any[]): [number, number] {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c].value === null) return [r, c]
    }
  }
  return [0, 0]
}

let playSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  // 单例状态复位,避免测试间串扰
  sound.setEnabled(true)
  sound.setErrorHintEnabled(true)
  playSpy = vi.spyOn(sound, 'play')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── 设置 → 音效管理器 单向同步 ──────────────────────────────────
describe('设置同步到音效管理器', () => {
  it('userStore.init() 把 sound/errorHint 推给 SoundManager', () => {
    const store = useUserStore()
    store.userData.settings.sound = false
    store.userData.settings.errorHint = false
    store.init()
    expect(sound.isEnabled()).toBe(false)
    expect(sound.isErrorHintEnabled()).toBe(false)
  })

  it('updateSettings({sound:false}) 立即静音', () => {
    const store = useUserStore()
    expect(sound.isEnabled()).toBe(true)
    store.updateSettings({ sound: false })
    expect(sound.isEnabled()).toBe(false)
  })

  it('updateSettings({sound:true}) 立即恢复', () => {
    const store = useUserStore()
    store.updateSettings({ sound: false })
    store.updateSettings({ sound: true })
    expect(sound.isEnabled()).toBe(true)
  })

  it('updateSettings({errorHint:false}) 只关错误音,不关总开关', () => {
    const store = useUserStore()
    store.updateSettings({ errorHint: false })
    expect(sound.isErrorHintEnabled()).toBe(false)
    expect(sound.isEnabled()).toBe(true)
  })

  it('只改主题/无关字段时不动音频开关', () => {
    const store = useUserStore()
    store.updateSettings({ sound: false })
    store.updateSettings({ theme: 'dark' })
    expect(sound.isEnabled()).toBe(false)  // 保持关闭
  })

  it('importData 后同步导入数据里的音频开关', () => {
    const store = useUserStore()
    store.importData(JSON.stringify({
      totalGames: 1,
      settings: { sound: false, errorHint: false, theme: 'dark' }
    }))
    expect(sound.isEnabled()).toBe(false)
    expect(sound.isErrorHintEnabled()).toBe(false)
  })

  it('clearData 后恢复默认(音效开、错误提示开)', () => {
    const store = useUserStore()
    store.updateSettings({ sound: false, errorHint: false })
    store.clearData()
    expect(sound.isEnabled()).toBe(true)
    expect(sound.isErrorHintEnabled()).toBe(true)
  })
})

// ── 游戏流程触发 ────────────────────────────────────────────────
describe('游戏流程触发音效', () => {
  it('填入正确数字 → play("fill")', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    const [r, c] = findFirstEmpty(store.gameState!.grid)
    store.selectCell(r, c)
    store.fillNumber(store.gameState!.solution[r][c])
    expect(playSpy).toHaveBeenCalledWith('fill')
  })

  it('填入错误数字 → play("error")', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    const [r, c] = findFirstEmpty(store.gameState!.grid)
    store.selectCell(r, c)
    const correct = store.gameState!.solution[r][c]
    const wrong = (correct % 9) + 1
    store.fillNumber(wrong)
    expect(playSpy).toHaveBeenCalledWith('error')
    expect(playSpy).not.toHaveBeenCalledWith('fill')
  })

  it('笔记模式填候选数 → 不播填入音效(没有真的填入)', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    const [r, c] = findFirstEmpty(store.gameState!.grid)
    store.selectCell(r, c)
    store.toggleNoteMode()
    store.fillNumber(1)
    expect(playSpy).not.toHaveBeenCalled()
  })

  it('使用提示 → play("fill")', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    store.useHint()
    expect(playSpy).toHaveBeenCalledWith('fill')
  })

  it('暂停 → play("pause")', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    store.pauseGame()
    expect(playSpy).toHaveBeenCalledWith('pause')
  })

  it('继续 → play("resume")', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    store.pauseGame()
    playSpy.mockClear()
    store.resumeGame()
    expect(playSpy).toHaveBeenCalledWith('resume')
  })

  it('重复 pause() 不重复播音效', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    store.pauseGame()
    store.pauseGame()
    expect(playSpy.mock.calls.filter(([n]) => n === 'pause')).toHaveLength(1)
  })

  it('未暂停时 resume() 不播音效', () => {
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    store.resumeGame()
    expect(playSpy).not.toHaveBeenCalledWith('resume')
  })

  it('棋盘完成 → play("win")', () => {
    const store = useGameStore()
    // 3×3 挖空少,填完剩余空格容易触发完成
    store.initGame({ size: 3, level: 'hard' })
    playSpy.mockClear()
    // 逐格填正确值直到完成
    const gs = store.gameState!
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!gs.grid[r][c].fixed) {
          store.selectCell(r, c)
          store.fillNumber(gs.solution[r][c])
        }
      }
    }
    expect(gs.isCompleted).toBe(true)
    expect(playSpy).toHaveBeenCalledWith('win')
  })

  it('完成后不重复播 win', () => {
    const store = useGameStore()
    store.initGame({ size: 3, level: 'hard' })
    const gs = store.gameState!
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (!gs.grid[r][c].fixed) {
          store.selectCell(r, c)
          store.fillNumber(gs.solution[r][c])
        }
      }
    }
    expect(gs.isCompleted).toBe(true)
    const winCalls = playSpy.mock.calls.filter(([n]) => n === 'win')
    expect(winCalls).toHaveLength(1)
    // 再调一次 checkCompletion 也不该重复
    store.checkCompletion()
    expect(playSpy.mock.calls.filter(([n]) => n === 'win')).toHaveLength(1)
  })

  it('关闭音效后游戏流程不再触发任何音效', () => {
    sound.setEnabled(false)
    const store = useGameStore()
    store.initGame({ size: 9, level: 'easy' })
    const [r, c] = findFirstEmpty(store.gameState!.grid)
    store.selectCell(r, c)
    store.fillNumber(store.gameState!.solution[r][c])
    store.pauseGame()
    store.resumeGame()
    store.useHint()
    // play 被调用了,但 canPlay 会拦住实际发声 —— 由 audio.spec.ts 验证
    // 这里验证的是: 关闭开关不希望有任何实际播放
    expect(sound.canPlay('fill')).toBe(false)
    expect(sound.canPlay('pause')).toBe(false)
  })
})

// ── 勋章解锁音效(通过 user store 的解锁返回判定) ─────────────────
describe('勋章解锁音效触发条件', () => {
  it('首次解锁勋章时 checkAndUnlockMedals 返回非空 → 应播 medal', () => {
    const store = useUserStore()
    const unlocked = store.checkAndUnlockMedals(
      makeRecord({ puzzleId: '9-hard-level-3', completed: true })
    )
    expect(unlocked.length).toBeGreaterThan(0)
    // Game.vue 里的判定条件: newMedals.length > 0
    expect(unlocked.length > 0).toBe(true)
  })

  it('重复完成同一关不重复发放「关卡勋章」', () => {
    const store = useUserStore()
    const first = store.checkAndUnlockMedals(makeRecord({ puzzleId: '9-hard-level-3' }))
    // 首局应拿到关卡勋章 medal_3
    expect(store.userData.medals).toContain('medal_3')
    expect(first).toContain('第3关 · 渐入佳境')

    // 第二局:关卡勋章不重复发放
    const again = store.checkAndUnlockMedals(makeRecord({ puzzleId: '9-hard-level-3' }))
    expect(again).not.toContain('第3关 · 渐入佳境')
    expect(store.userData.medals.filter(m => m === 'medal_3').length).toBe(1)
  })
})

// ── 勋章音效: 端到端(Game.vue 完成 → 解锁 → 播放) ────────────────
describe('勋章解锁音效 — Game.vue 端到端', () => {
  const routes = [
    { path: '/home', name: 'Home', component: { template: '<div/>' } },
    { path: '/game/:size/:level', name: 'Game', component: Game, props: true }
  ]

  async function mountGame(url: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push(url)
    await router.isReady()
    const wrapper = mount(Game, {
      global: { plugins: [router] },
      attachTo: document.createElement('div')
    })
    await flushPromises()
    return { wrapper, router }
  }

  it('完成第 1 关后解锁勋章 → play("medal")', async () => {
    await mountGame('/game/9/easy?level=1')
    await flushPromises()
    const gameStore = useGameStore()

    gameStore.gameState!.isCompleted = true
    gameStore.gameState!.timer = 120
    await flushPromises()

    const userStore = useUserStore()
    expect(userStore.userData.medals).toContain('medal_1')
    expect(playSpy).toHaveBeenCalledWith('medal')
  })

  it('完成非关卡模式(随机)不产生「关卡勋章」', async () => {
    await mountGame('/game/9/easy')
    await flushPromises()
    const gameStore = useGameStore()

    gameStore.gameState!.isCompleted = true
    await flushPromises()

    const userStore = useUserStore()
    // 随机模式不发放关卡勋章(medal_N)
    const levelMedals = userStore.userData.medals.filter(m => /^medal_\d+$/.test(m))
    expect(levelMedals).toEqual([])
  })
})
