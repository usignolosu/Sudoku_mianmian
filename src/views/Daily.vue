<template>
  <div class="daily-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">每日挑战</h1>
      <div></div>
    </header>

    <div class="daily-content">
      <!-- 今日挑战状态 -->
      <section class="today-section">
        <div class="card today-card">
          <div class="today-header">
            <span class="today-date">{{ todayDate }}</span>
            <span class="today-streak">连续挑战 {{ userStore.userData.dailyStreak }} 天</span>
          </div>
          <div class="today-info">
            <div class="difficulty-badge" :class="dailyLevel">
              {{ sizeLabel }} · {{ levelLabel }}
            </div>
          </div>
          <div class="today-status">
            <div v-if="todayCompleted" class="completed-status">
              <div class="status-icon">✅</div>
              <h3>今日已完成</h3>
              <p>明天再来挑战吧！</p>
            </div>
            <div v-else class="pending-status">
              <div class="status-icon">🎯</div>
              <h3>今日挑战等待你</h3>
              <p>完成今日挑战，延续连胜记录</p>
              <button class="btn btn-large" @click="startDaily">开始挑战</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 历史挑战记录 -->
      <section class="history-section">
        <h2 class="section-title">挑战历史</h2>
        <div class="card history-card">
          <div class="history-stats">
            <div class="history-stat">
              <span class="label">总挑战次数</span>
              <span class="value">{{ totalDailyChallenges }}</span>
            </div>
            <div class="history-stat">
              <span class="label">完成率</span>
              <span class="value">{{ completionRate }}%</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 每日挑战说明 -->
      <section class="info-section">
        <div class="card info-card">
          <h3>关于每日挑战</h3>
          <ul class="info-list">
            <li>每天固定一道题目，难度随机</li>
            <li>完成每日挑战可获得专属勋章</li>
            <li>连续挑战天数越多，获得的勋章越稀有</li>
            <li>中断挑战会导致连胜天数清零</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useGameStore } from '../stores/game'
import type { GridSize, DifficultyLevel } from '../types'

const router = useRouter()
const userStore = useUserStore()
const gameStore = useGameStore()

// 今日日期字符串（用作种子）
const todaySeed = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
})

const todayDate = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
})

// 基于日期确定今日关卡（固定，从标准版中抽取）
const dailyLevelNum = computed(() => {
  const dayOfYear = getDayOfYear()
  return (dayOfYear % 99) + 1  // 1-99 循环
})

// 基于日期确定今日难度（固定）
const dailyLevel = computed((): DifficultyLevel => {
  const day = new Date().getDate()
  const levels: DifficultyLevel[] = ['hard', 'medium', 'hard']  // 默认高级为主
  return levels[day % 3]
})

const dailySize = computed((): GridSize => 9)  // 每日挑战从标准版抽取

function getDayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

const sizeLabel = computed(() => {
  return dailySize.value === 3 ? '简单版' : dailySize.value === 9 ? '标准版' : '大师版'
})

const levelLabel = computed(() => {
  return dailyLevel.value === 'easy' ? '初级' : dailyLevel.value === 'medium' ? '中级' : '高级'
})

const todayCompleted = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return userStore.userData.records.some(
    r => r.date.startsWith(today) && r.completed && r.puzzleId.includes('daily')
  )
})

const totalDailyChallenges = computed(() => {
  return userStore.userData.records.filter(r => r.puzzleId.includes('daily')).length
})

const completionRate = computed(() => {
  const total = totalDailyChallenges.value
  if (total === 0) return 0
  const completed = userStore.userData.records.filter(
    r => r.puzzleId.includes('daily') && r.completed
  ).length
  return Math.round((completed / total) * 100)
})

function startDaily() {
  const puzzleId = `daily-${todaySeed.value}-${dailySize.value}-${dailyLevel.value}-level-${dailyLevelNum.value}`
  
  gameStore.initGameWithLevel(
    { size: dailySize.value, level: dailyLevel.value },
    dailyLevelNum.value
  )
  
  // 修改 puzzleId 为 daily 前缀
  if (gameStore.gameState) {
    ;(gameStore.gameState as any).puzzleId = puzzleId
  }
  
  router.push(`/game/${dailySize.value}/${dailyLevel.value}?level=${dailyLevelNum.value}&daily=true`)
}

function goBack() {
  router.push('/home')
}
</script>

<style scoped>
.daily-page {
  min-height: 100vh;
  background-color: var(--bg-primary);
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
  color: var(--text-primary);
}

.daily-content {
  padding: 16px 20px;
}

.today-section {
  margin-bottom: 20px;
}

.today-card {
  padding: 20px;
}

.today-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.today-date {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.today-streak {
  font-size: 14px;
  color: var(--primary-color);
}

.today-info {
  text-align: center;
  margin-bottom: 16px;
}

.difficulty-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.difficulty-badge.easy {
  background-color: #dcfce7;
  color: #16a34a;
}

.difficulty-badge.medium {
  background-color: #fef3c7;
  color: #d97706;
}

.difficulty-badge.hard {
  background-color: #fee2e2;
  color: #dc2626;
}

.today-status {
  text-align: center;
}

.status-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.completed-status h3,
.pending-status h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.completed-status p,
.pending-status p {
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.history-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.history-card {
  padding: 16px;
}

.history-stats {
  display: flex;
  justify-content: space-around;
}

.history-stat {
  text-align: center;
}

.history-stat .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.history-stat .value {
  font-size: 20px;
  font-weight: 600;
  color: var(--primary-color);
}

.info-section {
  margin-bottom: 20px;
}

.info-card {
  padding: 16px;
}

.info-card h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.info-list {
  list-style: none;
  padding: 0;
}

.info-list li {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding-left: 20px;
  position: relative;
}

.info-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--primary-color);
}
</style>
