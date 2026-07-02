<template>
  <div class="home-page">
    <!-- 头部导航 -->
    <header class="header">
      <h1 class="title">表姐的数独</h1>
      <div class="header-actions">
        <button class="btn btn-icon btn-secondary" @click="goToSettings">
          ⚙️
        </button>
      </div>
    </header>

    <!-- 统计信息 -->
    <section class="stats-section">
      <div class="card stats-card">
        <div class="stat-item">
          <span class="stat-label">总游戏次数</span>
          <span class="stat-value">{{ userStore.totalGames }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">当前连胜</span>
          <span class="stat-value">{{ userStore.userData.streak }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">勋章数量</span>
          <span class="stat-value">{{ userStore.unlockedMedalsCount }}/1000</span>
        </div>
      </div>
    </section>

    <!-- 每日挑战 -->
    <section class="daily-section">
      <div class="card daily-card" @click="goToDaily">
        <div class="daily-icon">📅</div>
        <div class="daily-info">
          <h3>每日挑战</h3>
          <p>{{ dailyStatus }}</p>
        </div>
        <div class="daily-arrow">→</div>
      </div>
    </section>

    <!-- 随机挑战 -->
    <section class="daily-section">
      <div class="card daily-card" @click="goToRandom">
        <div class="daily-icon">🎲</div>
        <div class="daily-info">
          <h3>随机挑战</h3>
          <p>标准版随机关卡，考验实力</p>
        </div>
        <div class="daily-arrow">→</div>
      </div>
    </section>

    <!-- 难度选择 -->
    <section class="difficulty-section">
      <h2 class="section-title">选择模式</h2>

      <!-- 3×3 简单版 -->
      <div class="card difficulty-card" @click="goToLevels(3)">
        <div class="difficulty-header">
          <span class="difficulty-icon">🎯</span>
          <h3 class="difficulty-title">简单版 3×3</h3>
        </div>
        <p class="difficulty-desc">适合新手入门，轻松愉快</p>
        <div class="difficulty-stats">
          <span>累计: {{ getGameCount(3) }} 局</span>
          <span>最佳: {{ formatTime(userStore.getBestTime({ size: 3, level: 'hard' })) }}</span>
        </div>
        <div class="difficulty-arrow">
          <span>开始挑战 →</span>
        </div>
      </div>

      <!-- 9×9 标准版 -->
      <div class="card difficulty-card featured" @click="goToLevels(9)">
        <div class="difficulty-header">
          <span class="difficulty-icon">🧩</span>
          <h3 class="difficulty-title">标准版 9×9</h3>
        </div>
        <p class="difficulty-desc">经典数独，挑战智力</p>
        <div class="difficulty-stats">
          <span>累计: {{ getGameCount(9) }} 局</span>
          <span>最佳: {{ formatTime(userStore.getBestTime({ size: 9, level: 'hard' })) }}</span>
        </div>
        <div class="difficulty-arrow">
          <span>开始挑战 →</span>
        </div>
      </div>

      <!-- 27×27 大师版 -->
      <div class="card difficulty-card" @click="goToLevels(27)">
        <div class="difficulty-header">
          <span class="difficulty-icon">👑</span>
          <h3 class="difficulty-title">大师版 27×27</h3>
        </div>
        <p class="difficulty-desc">超级挑战，极致体验</p>
        <div class="difficulty-stats">
          <span>累计: {{ getGameCount(27) }} 局</span>
          <span>最佳: {{ formatTime(userStore.getBestTime({ size: 27, level: 'hard' })) }}</span>
        </div>
        <div class="difficulty-arrow">
          <span>开始挑战 →</span>
        </div>
      </div>
    </section>

    <!-- 底部导航 -->
    <nav class="bottom-nav">
      <button class="nav-item active" @click="goToHome">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </button>
      <button class="nav-item" @click="goToRecords">
        <span class="nav-icon">📊</span>
        <span class="nav-label">记录</span>
      </button>
      <button class="nav-item" @click="goToMedals">
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
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import type { GridSize } from '../types'

const router = useRouter()
const userStore = useUserStore()

const dailyStatus = computed(() => {
  // 检查今天是否完成每日挑战
  const today = new Date().toISOString().split('T')[0]
  const todayRecord = userStore.userData.records.find(
    r => r.date.startsWith(today) && r.completed
  )
  return todayRecord ? '今日已完成 ✓' : '今日未完成'
})

function formatTime(time: number | null): string {
  if (!time) return '--'
  const minutes = Math.floor(time / 60)
  const seconds = time % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function goToLevels(size: GridSize) {
  router.push(`/levels/${size}`)
}

function goToRandom() {
  router.push('/random')
}

function getGameCount(size: GridSize): number {
  return userStore.userData.records.filter(r => r.difficulty.size === size).length
}

function goToHome() {
  router.push('/home')
}

function goToDaily() {
  router.push('/daily')
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
.home-page {
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

.header-actions {
  display: flex;
  gap: 8px;
}

.stats-section {
  padding: 16px 20px;
}

.stats-card {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: 600;
  color: var(--accent-primary);
}

.daily-section {
  padding: 0 20px 16px;
}

.daily-card {
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.daily-card:hover {
  transform: translateY(-2px);
}

.daily-icon {
  font-size: 32px;
  margin-right: 12px;
}

.daily-info {
  flex: 1;
}

.daily-info h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.daily-info p {
  font-size: 12px;
  color: var(--text-secondary);
}

.daily-arrow {
  font-size: 20px;
  color: var(--text-tertiary);
}

.difficulty-section {
  padding: 16px 20px;
}

.section-title {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.difficulty-card {
  margin-bottom: 16px;
  transition: transform 0.2s;
}

.difficulty-card:hover {
  transform: translateY(-2px);
}

.difficulty-card.featured {
  border: 2px solid var(--accent-primary);
}

.difficulty-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.difficulty-icon {
  font-size: 24px;
  margin-right: 12px;
}

.difficulty-title {
  font-size: 16px;
  font-weight: 600;
}

.difficulty-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.difficulty-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.difficulty-buttons .btn {
  flex: 1;
}

.difficulty-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary);
}

.difficulty-arrow {
  margin-top: 12px;
  text-align: right;
  font-size: 14px;
  font-weight: 500;
  color: var(--accent-primary);
}

.difficulty-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.difficulty-card:hover {
  transform: translateY(-2px);
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
  transition: color 0.2s;
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
  .header {
    padding: 12px 16px;
  }

  .stats-section,
  .daily-section,
  .difficulty-section {
    padding: 12px 16px;
  }

  .difficulty-buttons {
    flex-wrap: wrap;
  }
}
</style>