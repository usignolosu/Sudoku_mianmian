// 路由配置

import { createRouter, createWebHistory } from 'vue-router'

/**
 * 开屏页只给「首次访问」显示。
 *
 * 原因:Splash.vue 是品牌固定配色(粉红 + 实拍底图),不跟随主题。
 * 如果每次冷启动都展示,白色/暗色主题用户会先看到一帧粉+黑的硬闪。
 * 看过一次之后直接进首页。
 */
const SPLASH_SEEN_KEY = 'sudoku_splash_seen'

function hasSeenSplash(): boolean {
  try {
    return localStorage.getItem(SPLASH_SEEN_KEY) === '1'
  } catch {
    // 隐私模式下 localStorage 不可用,退化为每次都显示
    return false
  }
}

const routes = [
  {
    path: '/',
    name: 'Splash',
    component: () => import('../views/Splash.vue'),
    meta: { title: '表姐的数独', splash: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/game/:size/:level',
    name: 'Game',
    component: () => import('../views/Game.vue'),
    meta: { title: '游戏' },
    props: true
  },
  {
    path: '/levels/:size',
    name: 'Levels',
    component: () => import('../views/Levels.vue'),
    meta: { title: '关卡选择' },
    props: true
  },
  {
    path: '/daily',
    name: 'Daily',
    component: () => import('../views/Daily.vue'),
    meta: { title: '每日挑战' }
  },
  {
    path: '/random',
    name: 'Random',
    component: () => import('../views/Random.vue'),
    meta: { title: '随机挑战' }
  },
  {
    path: '/records',
    name: 'Records',
    component: () => import('../views/Records.vue'),
    meta: { title: '挑战记录' }
  },
  {
    path: '/medals',
    name: 'Medals',
    component: () => import('../views/Medals.vue'),
    meta: { title: '勋章系统' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings.vue'),
    meta: { title: '设置' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 设置页面标题 + 开屏页首次访问门槛
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '表姐的数独'} - 表姐的数独`

  // 已看过开屏的用户,再访问 / 直接放行到首页
  if (to.meta.splash && hasSeenSplash()) {
    return next({ path: '/home', replace: true })
  }

  next()
})

export default router