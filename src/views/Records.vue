<template>
  <div class="records-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">挑战记录</h1>
      <div></div>
    </header>

    <div class="records-content">
      <!-- 统计概览 -->
      <section class="stats-section">
        <div class="card stats-card">
          <div class="stat-item">
            <span class="stat-label">总游戏次数</span>
            <span class="stat-value">{{ userStore.totalGames }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">总用时</span>
            <span class="stat-value">{{ formatTotalTime(userStore.userData.totalTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最大连胜</span>
            <span class="stat-value">{{ userStore.userData.maxStreak }}</span>
          </div>
        </div>
      </section>

      <!-- 记录列表 -->
      <section class="records-list-section">
        <h2 class="section-title">历史记录</h2>

        <div v-if="records.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <p>暂无游戏记录</p>
          <button class="btn" @click="goHome">开始游戏</button>
        </div>

        <div v-else class="records-list">
          <div v-for="record in records" :key="record.id" class="card record-card">
            <div class="record-header">
              <span class="record-difficulty">{{ getDifficultyLabel(record.difficulty) }}</span>
              <span class="record-date">{{ formatDate(record.date) }}</span>
            </div>
            <div class="record-stats">
              <div class="record-stat">
                <span class="label">用时</span>
                <span class="value">{{ formatTime(record.time) }}</span>
              </div>
              <div class="record-stat">
                <span class="label">错误</span>
                <span class="value">{{ record.errors }}</span>
              </div>
              <div class="record-stat">
                <span class="label">状态</span>
                <span class="value" :class="record.completed ? 'success' : 'fail'">
                  {{ record.completed ? '完成' : '放弃' }}
                </span>
              </div>
            </div>
            <div v-if="record.medals.length > 0" class="record-medals">
              <span class="medal-label">获得勋章:</span>
              <span class="medal-tags">
                <span v-for="medal in record.medals" :key="medal" class="medal-tag">{{ medal }}</span>
              </span>
            </div>
            <div class="record-actions">
              <button class="btn btn-small btn-secondary" @click="replay(record)">
                再次挑战
              </button>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="hasMore" class="load-more">
          <button class="btn btn-secondary" @click="loadMore">加载更多</button>
        </div>
      </section>
    </div>

    <!-- 底部导航 -->
    <nav class="bottom-nav">
      <button class="nav-item" @click="goHome">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </button>
      <button class="nav-item active" @click="goToRecords">
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
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import type { GameRecord, DifficultyConfig } from '../types'

const router = useRouter()
const userStore = useUserStore()

const currentPage = ref(1)
const pageSize = 20

const records = computed(() => {
  return userStore.getRecords(currentPage.value, pageSize)
})

const hasMore = computed(() => {
  return userStore.userData.records.length > currentPage.value * pageSize
})

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatTotalTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

function getDifficultyLabel(config: DifficultyConfig): string {
  const sizeLabel = config.size === 3 ? '简单版' : config.size === 9 ? '标准版' : '大师版'
  const levelLabel = config.level === 'easy' ? '初级' : config.level === 'medium' ? '中级' : '高级'
  return `${sizeLabel} ${levelLabel}`
}

function loadMore() {
  currentPage.value++
}

function replay(record: GameRecord) {
  router.push(`/game/${record.difficulty.size}/${record.difficulty.level}`)
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
.records-page {
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

.records-content {
  padding: 16px 20px;
}

.stats-section {
  margin-bottom: 20px;
}

.stats-card {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-primary);
}

.section-title {
  font-size: 16px;
  margin-bottom: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-card {
  padding: 12px;
}

.record-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.record-difficulty {
  font-size: 14px;
  font-weight: 500;
}

.record-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.record-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
}

.record-stat {
  display: flex;
  flex-direction: column;
}

.record-stat .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.record-stat .value {
  font-size: 14px;
  font-weight: 500;
}

.record-stat .value.success {
  color: var(--success-color);
}

.record-stat .value.fail {
  color: var(--error-color);
}

.record-medals {
  margin-bottom: 8px;
}

.medal-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.medal-tags {
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
}

.medal-tag {
  font-size: 12px;
  padding: 2px 8px;
  background-color: var(--accent-light);
  color: var(--accent-primary);
  border-radius: var(--radius-small);
}

.record-actions {
  display: flex;
  justify-content: flex-end;
}

.load-more {
  text-align: center;
  padding: 20px;
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
</style>