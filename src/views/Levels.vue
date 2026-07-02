<template>
  <div class="levels-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">{{ modeLabel }} · 关卡选择</h1>
      <div></div>
    </header>

    <div class="levels-content">
      <!-- 难度选择 -->
      <div class="level-difficulty">
        <span class="diff-label">当前难度：</span>
        <div class="diff-buttons">
          <button 
            class="btn btn-small" 
            :class="currentLevel === 'easy' ? 'btn-primary' : 'btn-outline'"
            @click="currentLevel = 'easy'"
          >初级</button>
          <button 
            class="btn btn-small" 
            :class="currentLevel === 'medium' ? 'btn-primary' : 'btn-outline'"
            @click="currentLevel = 'medium'"
          >中级</button>
          <button 
            class="btn btn-small" 
            :class="currentLevel === 'hard' ? 'btn-primary' : 'btn-outline'"
            @click="currentLevel = 'hard'"
          >高级</button>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-section">
        <div class="progress-info">
          <span>已完成 {{ completedCount }} / 99 关</span>
          <span>{{ Math.floor(completedCount / 99 * 100) }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: (completedCount / 99 * 100) + '%' }"></div>
        </div>
      </div>

      <!-- 关卡网格 -->
      <div class="levels-grid">
        <button
          v-for="level in 99"
          :key="level"
          class="level-btn"
          :class="{
            'completed': isCompleted(level),
            'current': isCurrentLevel(level),
            'locked': !isUnlocked(level)
          }"
          @click="startLevel(level)"
          :disabled="!isUnlocked(level)"
        >
          <span class="level-num">{{ level }}</span>
          <span v-if="isCompleted(level)" class="level-star">⭐</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import type { GridSize, DifficultyLevel } from '../types'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const size = Number(route.params.size) as GridSize
const currentLevel = ref<DifficultyLevel>('hard')

const modeLabel = computed(() => {
  if (size === 3) return '简单版'
  if (size === 9) return '标准版'
  return '大师版'
})

// 已完成的关卡数（当前难度下）
const completedCount = computed(() => {
  return userStore.userData.records.filter(r => {
    return r.completed && 
           r.difficulty.size === size && 
           r.difficulty.level === currentLevel.value &&
           !r.puzzleId.includes('daily') &&
           !r.puzzleId.includes('random')
  }).length
})

// 检查某关是否完成
function isCompleted(levelNum: number): boolean {
  return userStore.userData.records.some(r => {
    return r.completed && 
           r.difficulty.size === size && 
           r.difficulty.level === currentLevel.value &&
           r.puzzleId === `${size}-${currentLevel.value}-level-${levelNum}`
  })
}

// 检查是否是当前关卡（最近未完成的那关）
function isCurrentLevel(levelNum: number): boolean {
  // 第一关默认解锁，之后每关需前一关完成
  return levelNum === completedCount.value + 1
}

// 检查是否解锁
function isUnlocked(levelNum: number): boolean {
  // 前 10 关直接解锁，之后需要依次解锁
  if (levelNum <= 10) return true
  return isCompleted(levelNum - 1)
}

// 开始某一关
function startLevel(levelNum: number) {
  if (!isUnlocked(levelNum)) return
  router.push(`/game/${size}/${currentLevel.value}?level=${levelNum}`)
}

function goBack() {
  router.push('/home')
}
</script>

<style scoped>
.levels-page {
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

.levels-content {
  padding: 16px 20px;
}

.level-difficulty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.diff-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.diff-buttons {
  display: flex;
  gap: 8px;
}

.progress-section {
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.progress-bar {
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
  border-radius: 4px;
  transition: width 0.3s;
}

.levels-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.level-btn {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 2px solid var(--border-secondary);
  border-radius: var(--radius-medium);
  background-color: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.level-btn:hover:not(:disabled) {
  border-color: var(--accent-primary);
  transform: scale(1.05);
}

.level-btn.completed {
  background-color: var(--accent-light);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.level-btn.current {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.level-btn.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.level-num {
  font-size: 16px;
  font-weight: 600;
}

.level-star {
  font-size: 12px;
  margin-top: 2px;
}

.btn-primary {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
}

@media (max-width: 480px) {
  .levels-grid {
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  .level-btn {
    font-size: 12px;
  }

  .level-num {
    font-size: 14px;
  }
}
</style>
