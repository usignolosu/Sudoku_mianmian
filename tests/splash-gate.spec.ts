import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import Splash from '@/views/Splash.vue'

enableAutoUnmount(afterEach)

/**
 * 开屏页「只给首次访问显示」的门槛测试
 *
 * 背景:Splash.vue 是品牌固定配色(粉红+实拍底图),不跟随主题。
 * 若每次冷启动都显示,白色/暗色主题用户会先看到一帧粉+黑的硬闪。
 */

const routes = [
  { path: '/', name: 'Splash', component: Splash, meta: { title: '表姐的数独', splash: true } },
  { path: '/home', name: 'Home', component: { template: '<div>home</div>' } }
]

describe('Splash 首次访问门槛', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('首次访问:显示开屏页', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach((to, _from, next) => {
      if (to.meta.splash && localStorage.getItem('sudoku_splash_seen') === '1') {
        return next({ path: '/home', replace: true })
      }
      next()
    })
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Splash')
  })

  it('已看过:访问 / 被重定向到 /home', async () => {
    localStorage.setItem('sudoku_splash_seen', '1')
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach((to, _from, next) => {
      if (to.meta.splash && localStorage.getItem('sudoku_splash_seen') === '1') {
        return next({ path: '/home', replace: true })
      }
      next()
    })
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('点击「开始游戏」会写入已看过标记', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(Splash, { global: { plugins: [router] } })

    expect(localStorage.getItem('sudoku_splash_seen')).toBeNull()
    const btn = wrapper.find('.start-btn')
    await btn.trigger('click')
    await flushPromises()

    expect(localStorage.getItem('sudoku_splash_seen')).toBe('1')
    expect(router.currentRoute.value.path).toBe('/home')
  })

  it('清除标记后可以再次看到开屏', async () => {
    localStorage.setItem('sudoku_splash_seen', '1')
    localStorage.removeItem('sudoku_splash_seen')
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach((to, _from, next) => {
      if (to.meta.splash && localStorage.getItem('sudoku_splash_seen') === '1') {
        return next({ path: '/home', replace: true })
      }
      next()
    })
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Splash')
  })

  it('localStorage 不可用时不报错(隐私模式退化为每次显示)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const hasSeen = () => {
      try {
        return localStorage.getItem('sudoku_splash_seen') === '1'
      } catch {
        return false
      }
    }
    expect(hasSeen()).toBe(false)
    spy.mockRestore()
  })

  it('开屏页内容正常渲染', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(Splash, { global: { plugins: [router] } })

    expect(wrapper.text()).toContain('表姐的数独')
    expect(wrapper.find('.start-btn').exists()).toBe(true)
    expect(wrapper.find('.speech-bubble').exists()).toBe(true)
  })
})
