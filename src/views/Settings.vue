<template>
  <div class="settings-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">设置</h1>
      <div></div>
    </header>

    <div class="settings-content">
      <!-- 音效设置 -->
      <section class="settings-section">
        <h2 class="section-title">音效设置</h2>
        <div class="card">
          <div class="setting-item">
            <span class="setting-label">音效开关</span>
            <button class="toggle-btn" :class="{ 'active': userStore.userData.settings.sound }" @click="toggleSound">
              {{ userStore.userData.settings.sound ? '开' : '关' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 游戏设置 -->
      <section class="settings-section">
        <h2 class="section-title">游戏设置</h2>
        <div class="card">
          <div class="setting-item">
            <span class="setting-label">错误提示</span>
            <button class="toggle-btn" :class="{ 'active': userStore.userData.settings.errorHint }" @click="toggleErrorHint">
              {{ userStore.userData.settings.errorHint ? '开' : '关' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 主题设置 -->
      <section class="settings-section">
        <h2 class="section-title">主题设置</h2>
        <div class="card theme-card">
          <div class="theme-list">
            <button
              v-for="theme in themes"
              :key="theme.id"
              class="theme-btn"
              :class="{ 'active': userStore.userData.settings.theme === theme.id }"
              @click="setTheme(theme.id)"
            >
              <span class="theme-preview" :style="{ backgroundColor: theme.color }"></span>
              <span class="theme-name">{{ theme.name }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 数据管理 -->
      <section class="settings-section">
        <h2 class="section-title">数据管理</h2>
        <div class="card">
          <div class="setting-item">
            <span class="setting-label">导出数据</span>
            <button class="btn btn-small btn-secondary" @click="exportData">导出</button>
          </div>
          <div class="setting-item">
            <span class="setting-label">导入数据</span>
            <button class="btn btn-small btn-secondary" @click="importData">导入</button>
          </div>
          <div class="setting-item danger">
            <span class="setting-label">清除数据</span>
            <button class="btn btn-small" @click="showClearConfirm = true">清除</button>
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section class="settings-section">
        <h2 class="section-title">关于</h2>
        <div class="card about-card">
          <div class="about-logo">🧩</div>
          <h3>表姐的数独</h3>
          <p class="version">版本 1.0.0</p>
          <p class="desc">一款可爱的数独游戏，包含多种难度和丰富的勋章系统</p>
        </div>
      </section>
    </div>

    <!-- 清除确认弹窗 -->
    <div v-if="showClearConfirm" class="confirm-overlay">
      <div class="confirm-content">
        <h3>确认清除</h3>
        <p>清除后所有游戏数据将不可恢复，确定要清除吗？</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" @click="showClearConfirm = false">取消</button>
          <button class="btn" @click="clearAllData">确认清除</button>
        </div>
      </div>
    </div>

    <!-- 导入文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import type { ThemeType } from '../types'

const router = useRouter()
const userStore = useUserStore()

const showClearConfirm = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const themes: { id: ThemeType; name: string; color: string }[] = [
  { id: 'light', name: '浅色', color: '#ffffff' },
  { id: 'dark', name: '深色', color: '#1a1a1a' },
  { id: 'macaron-pink', name: '马卡龙粉', color: '#fff5f8' },
  { id: 'macaron-blue', name: '马卡龙蓝', color: '#f0f8ff' },
  { id: 'macaron-green', name: '马卡龙绿', color: '#f0fff0' },
  { id: 'macaron-purple', name: '马卡龙紫', color: '#f8f0ff' }
]

function goBack() {
  router.push('/home')
}

function toggleSound() {
  userStore.updateSettings({ sound: !userStore.userData.settings.sound })
}

function toggleErrorHint() {
  userStore.updateSettings({ errorHint: !userStore.userData.settings.errorHint })
}

function setTheme(theme: ThemeType) {
  userStore.setTheme(theme)
}

function exportData() {
  const data = userStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sudoku_data_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  fileInput.value?.click()
}

function handleFileImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (userStore.importData(content)) {
      alert('数据导入成功！')
    } else {
      alert('数据导入失败，请检查文件格式。')
    }
  }
  reader.readAsText(file)
}

function clearAllData() {
  userStore.clearData()
  showClearConfirm.value = false
  alert('数据已清除。')
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.header .title {
  font-size: 18px;
}

.settings-content {
  padding: 20px;
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-secondary);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.danger .btn {
  background-color: var(--error-color);
}

.setting-label {
  font-size: 14px;
}

.toggle-btn {
  padding: 6px 16px;
  border: none;
  border-radius: var(--radius-medium);
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
}

.theme-card {
  padding: 12px;
}

.theme-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.theme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border: 2px solid transparent;
  border-radius: var(--radius-medium);
  background-color: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn.active {
  border-color: var(--accent-primary);
}

.theme-preview {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-round);
  border: 2px solid var(--border-primary);
  margin-bottom: 8px;
}

.theme-name {
  font-size: 12px;
}

.about-card {
  text-align: center;
  padding: 24px;
}

.about-logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.about-card h3 {
  font-size: 20px;
  margin-bottom: 8px;
}

.version {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 12px;
}

.desc {
  font-size: 14px;
  color: var(--text-secondary);
}

.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.confirm-content {
  background-color: var(--bg-card);
  padding: 24px;
  border-radius: var(--radius-large);
  text-align: center;
  max-width: 300px;
}

.confirm-content h3 {
  margin-bottom: 12px;
}

.confirm-content p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@media (max-width: 480px) {
  .settings-content {
    padding: 16px;
  }

  .theme-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>