// 路由配置

import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Splash',
    component: () => import('../views/Splash.vue'),
    meta: { title: '表姐的数独' }
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
  history: createWebHistory('/sudoku-mianmian/'),
  routes
})

// 设置页面标题
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || '表姐的数独'} - 表姐的数独`
  next()
})

export default router