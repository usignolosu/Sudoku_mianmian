// 主入口文件

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'

// 导入样式
import './styles/themes.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化用户数据
const userStore = useUserStore()
userStore.init()

app.mount('#app')