// 主入口文件

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import { sound } from './utils/audio'

// 导入样式
import './styles/themes.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化用户数据(同时把音效开关同步给 SoundManager)
const userStore = useUserStore()
userStore.init()

// 需求 §7「按钮点击」音效。
// 用事件委托统一处理,避免在每个组件里散落 sound.play('click')。
// 这里也是创建 AudioContext 的理想时机 —— 点击本身就是用户手势,
// 满足浏览器自动播放策略。
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return

  const interactive = target.closest('button, [role="button"], a[href]')
  if (!interactive) return
  if (interactive.hasAttribute('disabled')) return

  sound.play('click')
})

app.mount('#app')
