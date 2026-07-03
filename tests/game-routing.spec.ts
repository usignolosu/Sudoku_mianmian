import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import Game from '@/views/Game.vue'
import { useGameStore } from '@/stores/game'

/**
 * 修复「点击下一关没反应」bug 的回归测试
 *
 * 根因: router.push 到同 name+同 path 仅 query 不同的路由时，
 *       vue-router 默认复用组件实例，onMounted 不会再次执行。
 *       Game.vue 之前把初始化逻辑全放在 onMounted 里，导致
 *       levelNum / 棋盘 / solution 全部不刷新。
 *
 * 修复: 抽出 initFromRoute()，并用 watch(() => [route.query.*, route.params.*])
 *       在路由变化时重新执行。
 */

const routes = [
  { path: '/', name: 'Splash', component: { template: '<div/>' } },
  { path: '/home', name: 'Home', component: { template: '<div/>' } },
  { path: '/game/:size/:level', name: 'Game', component: Game }
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

  it('bug repro & fix: ?level=2 → ?level=3 时棋盘真的换关', async () => {
    const { router, store } = await mountAt('/game/3/easy?level=2')
    await flushPromises()
    expect(store.gameState?.puzzleId).toBe('3-easy-level-2')

    await router.push('/game/3/easy?level=3')
    await flushPromises()

    expect(store.gameState?.puzzleId).toBe('3-easy-level-3')
  })

  it('修复验证: 跨多关连跳都能换', async () => {
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

  it('修复验证: 切难度时保留 levelNum', async () => {
    const { wrapper, router } = await mountAt('/game/3/easy?level=7')
    await flushPromises()
    const mediumBtn = wrapper.findAll('button').find(b => b.text() === '中级')
    expect(mediumBtn).toBeTruthy()
    await mediumBtn!.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.params.level).toBe('medium')
    expect(router.currentRoute.value.query.level).toBe('7')
  })

  it('回归: 每日挑战模式不破坏', async () => {
    const { router, store } = await mountAt('/game/9/easy?daily=1')
    await flushPromises()
    expect(store.gameState).toBeTruthy()
    await router.push('/game/9/hard?daily=1')
    await flushPromises()
    expect(router.currentRoute.value.query.daily).toBe('1')
  })
})
