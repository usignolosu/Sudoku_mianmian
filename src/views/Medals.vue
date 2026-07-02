<template>
  <div class="medals-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">勋章系统</h1>
      <div></div>
    </header>

    <div class="medals-content">
      <!-- 进度概览 -->
      <section class="progress-section">
        <div class="card progress-card">
          <div class="progress-header">
            <span class="progress-label">解锁进度</span>
            <span class="progress-value">{{ userStore.unlockedMedalsCount }}/100</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
      </section>

      <!-- 已拥有/未拥有 Tab -->
      <section class="tab-section">
        <div class="tab-container">
          <button
            class="tab-btn"
            :class="{ 'active': activeTab === 'owned' }"
            @click="activeTab = 'owned'"
          >
            <span class="tab-icon">✅</span>
            <span class="tab-name">已拥有徽章</span>
            <span class="tab-count">({{ ownedMedals.length }})</span>
          </button>
          <button
            class="tab-btn"
            :class="{ 'active': activeTab === 'unowned' }"
            @click="activeTab = 'unowned'"
          >
            <span class="tab-icon">🔒</span>
            <span class="tab-name">未拥有徽章</span>
            <span class="tab-count">({{ unownedMedals.length }})</span>
          </button>
        </div>
      </section>

      <!-- 勋章列表 -->
      <section class="medals-list-section">
        <div class="medals-grid">
          <div
            v-for="medal in displayedMedals"
            :key="medal.id"
            class="medal-item"
            :class="{ 'unlocked': isUnlocked(medal.id) }"
          >
            <div class="medal-icon">{{ isUnlocked(medal.id) ? medal.icon : '❓' }}</div>
            <div class="medal-info">
              <span class="medal-name">{{ medal.name }}</span>
              <span class="medal-desc">{{ medal.description }}</span>
            </div>
            <div v-if="isUnlocked(medal.id)" class="medal-status">
              <span class="unlock-badge">已解锁</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <nav class="bottom-nav">
      <button class="nav-item" @click="goHome">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </button>
      <button class="nav-item" @click="goToRecords">
        <span class="nav-icon">📊</span>
        <span class="nav-label">记录</span>
      </button>
      <button class="nav-item active" @click="goToMedals">
        <span class="nav-icon">🏆</span>
        <span class="nav-label">勋章</span>
      </button>
      <button class="nav-item" @click="goToSettings">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { allMedals } from '../data/medals'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref<'owned' | 'unowned'>('owned')

const progressPercent = computed(() => {
  return Math.round((userStore.unlockedMedalsCount / 100) * 100)
})

const ownedMedals = computed(() => {
  return allMedals.filter(m => userStore.userData.medals.includes(m.id))
})

const unownedMedals = computed(() => {
  return allMedals.filter(m => !userStore.userData.medals.includes(m.id))
})

const displayedMedals = computed(() => {
  return activeTab.value === 'owned' ? ownedMedals.value : unownedMedals.value
})

function isUnlocked(medalId: string): boolean {
  return userStore.userData.medals.includes(medalId)
}

function goBack() {
  router.push('/home')
}

function goHome() {
  router.push('/home')
}

function goToRecords() {
  router.push('/records')
}

function goToMedals() {
  router.push('/medals')
}

function goToSettings() {
  router.push('/settings')
}
</script>

<style scoped>
.medals-page {
  min-height: 100vh;
  padding-bottom: 70px;
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

.medals-content {
  padding: 16px 20px;
}

.progress-section {
  margin-bottom: 20px;
}

.progress-card {
  padding: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-primary);
}

.progress-bar {
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-small);
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-primary);
  border-radius: var(--radius-small);
  transition: width 0.3s;
}

.tab-section {
  margin-bottom: 16px;
}

.tab-container {
  display: flex;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-medium);
  padding: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-medium);
  background-color: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.tab-btn.active {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
}

.tab-icon {
  font-size: 14px;
}

.tab-name {
  font-weight: 500;
}

.tab-count {
  font-size: 12px;
  opacity: 0.8;
}

.medals-list-section {
  margin-bottom: 20px;
}

.medals-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.medal-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: var(--bg-card);
  border-radius: var(--radius-medium);
  border: 1px solid var(--border-secondary);
  opacity: 0.5;
  transition: all 0.2s;
}

.medal-item.unlocked {
  opacity: 1;
  border-color: var(--accent-primary);
}

.medal-icon {
  font-size: 24px;
  margin-right: 12px;
}

.medal-info {
  flex: 1;
}

.medal-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.medal-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.medal-status {
  margin-left: 8px;
}

.unlock-badge {
  font-size: 10px;
  padding: 2px 6px;
  background-color: var(--accent-primary);
  color: var(--text-inverse);
  border-radius: var(--radius-small);
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-medium);
  padding: 8px 0;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.nav-item.active {
  color: var(--accent-primary);
}

.nav-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.nav-label {
  font-size: 12px;
}

@media (max-width: 480px) {
  .medals-grid {
    grid-template-columns: 1fr;
  }
}
</style>
