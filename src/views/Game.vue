<template>
  <div class="game-page">
    <!-- 游戏头部 -->
    <header class="game-header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <div class="game-info">
        <span class="difficulty-label">{{ difficultyLabel }}</span>
        <span class="timer">{{ gameStore.formattedTime }}</span>
      </div>
      <button class="btn btn-icon btn-secondary" @click="togglePause">
        {{ gameStore.gameState?.isPaused ? '▶' : '⏸' }}
      </button>
    </header>

    <!-- 数独棋盘 -->
    <div class="game-board-container" :class="{ 'blurred': gameStore.gameState?.isPaused }">
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">正在生成题目...</p>
      </div>
      <SudokuBoard
        v-else
        :grid="gameStore.gameState!.grid"
        :size="gameStore.gameState!.difficulty.size"
        :highlightedCells="gameStore.highlightedCells"
        :selectedCell="gameStore.selectedCell"
        :showError="userStore.userData.settings.errorHint"
        @cell-click="selectCell"
      />
    </div>

    <!-- 操作按钮 -->
    <div class="game-actions" :class="{ 'blurred': gameStore.gameState?.isPaused }">
      <button class="btn btn-secondary btn-small" @click="undo" :disabled="!canUndo">
        ↶ 撤销
      </button>
      <button class="btn btn-secondary btn-small" @click="redo" :disabled="!canRedo">
        ↷ 重做
      </button>
      <button class="btn btn-secondary btn-small" @click="deleteNumber" :disabled="!gameStore.currentCell">
        ✕ 清除
      </button>
      <button class="btn btn-secondary btn-small" @click="toggleNoteMode" :class="{ 'active': gameStore.isNoteMode }">
        ✏ 笔记
      </button>
      <button class="btn btn-secondary btn-small" @click="useHint">
        💡 提示
      </button>
    </div>

    <!-- 难度切换 -->
    <div class="difficulty-switch" :class="{ 'blurred': gameStore.gameState?.isPaused }">
      <span class="diff-label">难度：</span>
      <button 
        class="btn btn-small"
        :class="currentLevel === 'easy' ? 'btn-primary' : 'btn-outline'"
        @click="changeDifficulty('easy')"
      >初级</button>
      <button 
        class="btn btn-small"
        :class="currentLevel === 'medium' ? 'btn-primary' : 'btn-outline'"
        @click="changeDifficulty('medium')"
      >中级</button>
      <button 
        class="btn btn-small"
        :class="currentLevel === 'hard' ? 'btn-primary' : 'btn-outline'"
        @click="changeDifficulty('hard')"
      >高级</button>
    </div>

    <!-- 数字键盘 -->
    <div class="number-pad" :class="{ 'scrollable': gameStore.gameState?.difficulty.size === 27, 'blurred': gameStore.gameState?.isPaused }">
      <button
        v-for="num in gameStore.availableNumbers"
        :key="num"
        class="number-btn"
        @click="fillNumber(num)"
      >
        {{ num }}
      </button>
    </div>

    <!-- 暂停遮罩 -->
    <div v-if="gameStore.gameState?.isPaused" class="pause-overlay">
      <div class="pause-content">
        <h2>游戏暂停</h2>
        <p>点击继续按钮恢复游戏</p>
        <button class="btn btn-large" @click="togglePause">继续游戏</button>
      </div>
    </div>

    <!-- 完成弹窗 -->
    <div v-if="gameStore.gameState?.isCompleted" class="complete-overlay">
      <div class="complete-content">
        <div class="complete-icon">🎉</div>
        <h2>恭喜完成！</h2>
        <div class="complete-stats">
          <div class="stat">
            <span class="stat-label">用时</span>
            <span class="stat-value">{{ gameStore.formattedTime }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">错误次数</span>
            <span class="stat-value">{{ gameStore.gameState?.errors }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">使用提示</span>
            <span class="stat-value">{{ gameStore.gameState?.hintsUsed }}次</span>
          </div>
        </div>
        <div class="complete-medals" v-if="newMedals.length > 0">
          <h3>获得勋章</h3>
          <div class="medal-list">
            <span class="medal-item" v-for="medal in newMedals" :key="medal">{{ medal }}</span>
          </div>
        </div>
        <div class="complete-actions">
          <button class="btn btn-secondary" @click="goBack">返回首页</button>
          <button class="btn" @click="handlePlayAgain">{{ playAgainText }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useUserStore } from '../stores/user'
import SudokuBoard from '../components/SudokuBoard.vue'
import type { GridSize, DifficultyLevel, GameRecord } from '../types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const userStore = useUserStore()

const size = computed(() => parseInt(route.params.size as string) as GridSize)
const level = computed(() => route.params.level as DifficultyLevel)

const currentLevel = ref<DifficultyLevel>('hard')
const levelNum = ref<number | null>(null)
const isRandom = ref(false)
const isDaily = ref(false)

const hasNextLevel = computed(() => {
  return levelNum.value !== null && levelNum.value < 99
})

const playAgainText = computed(() => {
  if (isDaily.value || isRandom.value) return '再来一局'
  if (levelNum.value !== null && hasNextLevel.value) return '下一关'
  if (levelNum.value !== null && !hasNextLevel.value) return '重新挑战'
  return '再来一局'
})

const difficultyLabel = computed(() => {
  const sizeLabel = size.value === 3 ? '简单版' : size.value === 9 ? '标准版' : '大师版'
  const levelLabel = currentLevel.value === 'easy' ? '初级' : currentLevel.value === 'medium' ? '中级' : '高级'
  const levelText = levelNum.value ? ` 第${levelNum.value}关` : ''
  return `${sizeLabel} ${levelLabel}${levelText}`
})

const newMedals = ref<string[]>([])
const isLoading = ref(true)

const canUndo = computed(() => (gameStore.gameState?.historyIndex ?? -1) >= 0)
const canRedo = computed(() => {
  if (!gameStore.gameState) return false
  return gameStore.gameState.historyIndex < gameStore.gameState.history.length - 1
})

let timerInterval: number | null = null

onMounted(() => {
  // 解析 query 参数
  const lvl = route.query.level
  if (lvl) {
    levelNum.value = parseInt(lvl as string)
  }
  isRandom.value = !!route.query.random
  isDaily.value = !!route.query.daily
  currentLevel.value = level.value

  // 使用 setTimeout 让 UI 先渲染加载状态
  setTimeout(() => {
    initCurrentGame()
    // 如果是每日挑战，修改 puzzleId
    if (isDaily.value && levelNum.value && gameStore.gameState) {
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
      ;(gameStore.gameState as any).puzzleId = `daily-${dateStr}-${size.value}-${currentLevel.value}-level-${levelNum.value}`
    }
    isLoading.value = false
    startTimer()
  }, 50)
})

function initCurrentGame() {
  if (levelNum.value) {
    // 关卡模式：用关卡号做种子生成固定题目
    gameStore.initGameWithLevel(
      { size: size.value, level: currentLevel.value },
      levelNum.value,
      isRandom.value
    )
  } else {
    // 普通模式：随机生成
    gameStore.initGame({ size: size.value, level: currentLevel.value })
  }
}

function changeDifficulty(newLevel: DifficultyLevel) {
  if (newLevel === currentLevel.value) return
  currentLevel.value = newLevel
  isLoading.value = true
  stopTimer()
  newMedals.value = []
  
  setTimeout(() => {
    initCurrentGame()
    isLoading.value = false
    startTimer()
  }, 50)
}

onUnmounted(() => {
  stopTimer()
})

watch(() => gameStore.gameState?.isCompleted, (completed) => {
  if (completed) {
    stopTimer()
    saveGameRecord()
  }
})

function startTimer() {
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = window.setInterval(() => {
    gameStore.updateTimer()
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function selectCell(row: number, col: number) {
  gameStore.selectCell(row, col)
}

function fillNumber(num: number) {
  gameStore.fillNumber(num)
}

function deleteNumber() {
  gameStore.deleteNumber()
}

function undo() {
  gameStore.undo()
}

function redo() {
  gameStore.redo()
}

function useHint() {
  gameStore.useHint()
}

function toggleNoteMode() {
  gameStore.toggleNoteMode()
}

function togglePause() {
  if (gameStore.gameState?.isPaused) {
    gameStore.resumeGame()
    startTimer()
  } else {
    gameStore.pauseGame()
    stopTimer()
  }
}

function goBack() {
  router.push('/home')
}

function handlePlayAgain() {
  if (levelNum.value !== null && !isDaily.value && !isRandom.value && hasNextLevel.value) {
    router.push(`/game/${size.value}/${currentLevel.value}?level=${levelNum.value + 1}`)
    return
  }
  
  isLoading.value = true
  stopTimer()
  newMedals.value = []
  
  setTimeout(() => {
    initCurrentGame()
    isLoading.value = false
    startTimer()
  }, 50)
}

function saveGameRecord() {
  const result = gameStore.getGameResult()
  if (!result) return

  const record: GameRecord = {
    id: generateId(),
    date: new Date().toISOString(),
    difficulty: result.difficulty,
    time: result.time,
    errors: result.errors,
    completed: result.completed,
    medals: [],
    puzzleId: result.puzzleId
  }

  userStore.addGameRecord(record)
  newMedals.value = userStore.checkAndUnlockMedals(record)
}
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.game-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.difficulty-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.timer {
  font-size: 20px;
  font-weight: 600;
  color: var(--primary-color);
}

.game-board-container {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px 0;
  overflow: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--bg-tertiary);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  color: var(--text-secondary);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.game-board-container.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.game-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
}

.game-actions.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.game-actions .btn.active {
  background-color: var(--primary-color);
  color: var(--text-inverse);
}

.difficulty-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-secondary);
}

.difficulty-switch.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.diff-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.btn-primary {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
}

.btn-outline {
  background-color: transparent;
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.number-pad {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px 20px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.number-pad.scrollable {
  overflow-x: auto;
  justify-content: flex-start;
  -webkit-overflow-scrolling: touch;
}

.number-pad.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.number-btn {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-medium);
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.number-btn:hover {
  background-color: var(--primary-color);
  color: var(--text-inverse);
}

.number-btn:active {
  transform: scale(0.95);
}

.pause-overlay,
.complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.pause-content,
.complete-content {
  background-color: var(--bg-card);
  padding: 30px;
  border-radius: var(--radius-large);
  text-align: center;
  max-width: 320px;
  animation: slideUp 0.4s ease-out;
}

.pause-content h2,
.complete-content h2 {
  margin-bottom: 12px;
  color: var(--text-primary);
}

.pause-content p {
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.complete-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.complete-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
}

.complete-stats .stat {
  text-align: center;
}

.complete-stats .stat-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.complete-stats .stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--primary-color);
}

.complete-medals {
  margin-bottom: 20px;
}

.complete-medals h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.medal-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.medal-item {
  background-color: var(--accent-light);
  padding: 4px 12px;
  border-radius: var(--radius-medium);
  font-size: 12px;
  color: var(--primary-color);
}

.complete-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .number-btn {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }

  .game-actions {
    flex-wrap: wrap;
  }
}
</style>
