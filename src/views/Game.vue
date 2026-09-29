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
    <div
      class="game-board-container"
      :class="{ 'blurred': isBoardLocked, 'is-small': gameStore.gameState?.difficulty.size !== 27 }"
    >
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

    <!-- 27×27 在竖屏手机上过小,提示横屏(需求 §13) -->
    <div v-if="showRotateHint" class="rotate-hint">
      <span class="rotate-icon">📱</span>
      <span class="rotate-text">横屏体验更佳 · 支持拖动与双指缩放</span>
    </div>

    <!-- 操作按钮 -->
    <div class="game-actions" :class="{ 'blurred': isBoardLocked }">
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
      <button
        class="btn btn-secondary btn-small"
        :class="{ 'is-low-hints': isHintsLow }"
        @click="useHint"
        :disabled="!canUseHint"
      >
        💡 提示<span v-if="hintsLeft > 0" class="hint-count">({{ hintsLeft }})</span>
      </button>
    </div>

    <!-- 难度切换 -->
    <div class="difficulty-switch" :class="{ 'blurred': isBoardLocked }">
      <span class="diff-label">难度：</span>
      <button
        class="btn btn-small"
        :class="currentLevel === 'easy' ? 'btn-primary' : 'btn-outline'"
        :disabled="isBoardLocked"
        @click="changeDifficulty('easy')"
      >初级</button>
      <button
        class="btn btn-small"
        :class="currentLevel === 'medium' ? 'btn-primary' : 'btn-outline'"
        :disabled="isBoardLocked"
        @click="changeDifficulty('medium')"
      >中级</button>
      <button
        class="btn btn-small"
        :class="currentLevel === 'hard' ? 'btn-primary' : 'btn-outline'"
        :disabled="isBoardLocked"
        @click="changeDifficulty('hard')"
      >高级</button>
    </div>

    <!-- Bug#5 笔记模式下选了固定格子时给提示 -->
    <div v-if="gameStore.isNoteMode && gameStore.currentCell?.fixed" class="note-hint">
      💡 提示:笔记模式仅对空白格子生效
    </div>

    <!-- 数字键盘 -->
    <div class="number-pad" :class="{ 'scrollable': gameStore.gameState?.difficulty.size === 27, 'blurred': isBoardLocked }">
      <button
        v-for="num in gameStore.availableNumbers"
        :key="num"
        class="number-btn"
        :disabled="isBoardLocked || (gameStore.isNoteMode && gameStore.currentCell?.fixed)"
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
import { sound } from '../utils/audio'
import type { GridSize, DifficultyLevel, GameRecord } from '../types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const userStore = useUserStore()

// Bug 修复: URL 参数校验与降级 (TC-B03-02 / TC-B03-03)
// 非法 size (如 /game/abc/easy) → 降级为 9,避免 NaN 生成 0×0 空棋盘
// 非法 level (如 /game/9/abc) → 降级为 medium,避免 removeRatio=undefined 清空整盘
const VALID_SIZES: GridSize[] = [3, 9, 27]
const VALID_LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard']

const size = computed<GridSize>(() => {
  const parsed = parseInt(route.params.size as string)
  return VALID_SIZES.includes(parsed as GridSize) ? (parsed as GridSize) : 9
})
const level = computed<DifficultyLevel>(() => {
  const raw = route.params.level as DifficultyLevel
  return VALID_LEVELS.includes(raw) ? raw : 'medium'
})

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

const canUndo = computed(() => {
  if (!gameStore.gameState) return false
  if (gameStore.gameState.isCompleted) return false  // Bug#4 完成时锁
  return gameStore.gameState.historyIndex >= 0
})
const canRedo = computed(() => {
  if (!gameStore.gameState) return false
  if (gameStore.gameState.isCompleted) return false  // Bug#4 完成时锁
  return gameStore.gameState.historyIndex < gameStore.gameState.history.length - 1
})

// Bug#3/#4 提示按钮可用性
const canUseHint = computed(() => {
  if (!gameStore.gameState) return false
  if (gameStore.gameState.isPaused || gameStore.gameState.isCompleted) return false
  return gameStore.gameState.hintsUsed < 3
})

// F11: 提示快用完时给出警示(--warning-color 的消费方)
const hintsLeft = computed(() => Math.max(0, 3 - (gameStore.gameState?.hintsUsed ?? 0)))
const isHintsLow = computed(() => {
  if (!canUseHint.value) return false
  return hintsLeft.value <= 1
})

// Bug#4 完成后 / 暂停时所有可变操作都禁掉
const isBoardLocked = computed(() =>
  !!gameStore.gameState?.isPaused || !!gameStore.gameState?.isCompleted
)

// ── 27×27 横屏提示(需求 §13)──
const viewportW = ref(0)
const viewportH = ref(0)

function updateViewport(): void {
  viewportW.value = window.innerWidth
  viewportH.value = window.innerHeight
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.addEventListener('orientationchange', updateViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('orientationchange', updateViewport)
})

/** 27×27 + 竖屏 + 窄屏 → 提示横屏 */
const showRotateHint = computed(() => {
  const size = gameStore.gameState?.difficulty.size
  if (size !== 27) return false
  if (viewportW.value === 0) return false  // 测量前不显示,避免 SSR/测试闪烁
  return viewportH.value > viewportW.value && viewportW.value < 600
})

let timerInterval: number | null = null

function reinit() {
  // Bug 修复: 原本 setTimeout(50) 让测试无法断言,改成同步;UI 仍能看到 loading → content 的闪烁
  isLoading.value = true
  stopTimer()
  newMedals.value = []
  initCurrentGame()
  if (isDaily.value && levelNum.value && gameStore.gameState) {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    ;(gameStore.gameState as any).puzzleId = `daily-${dateStr}-${size.value}-${currentLevel.value}-level-${levelNum.value}`
  }
  isLoading.value = false
  startTimer()
}

function initFromRoute() {
  // Bug 修复: query.level 必须落在 1-99 的整数区间,否则视为无关卡
  // 此前 ?level=abc 会得到 NaN、?level=999 会生成越界关卡号
  const raw = route.query.level
  const parsed = raw !== undefined ? parseInt(raw as string, 10) : NaN
  levelNum.value = Number.isInteger(parsed) && parsed >= 1 && parsed <= 99 ? parsed : null
  isRandom.value = !!route.query.random
  isDaily.value = !!route.query.daily
  currentLevel.value = level.value
  reinit()
}

onMounted(initFromRoute)

// 修复：同 name+同 path 的 query 变化默认不会重挂载组件，
// 用 watch 显式重新初始化，保证「下一关」、切难度等行为能刷新棋盘。
watch(
  () => [route.query.level, route.query.random, route.query.daily, route.params.size, route.params.level],
  () => initFromRoute()
)

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
  // 同步 URL 后由 watch 触发 reinit，保证关卡号 / 模式不会丢
  const query: Record<string, string> = {}
  if (levelNum.value !== null) query.level = String(levelNum.value)
  if (isRandom.value) query.random = '1'
  if (isDaily.value) query.daily = '1'
  router.replace({ path: `/game/${size.value}/${newLevel}`, query })
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
  // 关卡模式：跳到下一关，由 watch 触发 reinit
  if (levelNum.value !== null && !isDaily.value && !isRandom.value && hasNextLevel.value) {
    router.push(`/game/${size.value}/${currentLevel.value}?level=${levelNum.value + 1}`)
    return
  }
  // 第 99 关 / 每日 / 随机 / 普通：原地重 init
  reinit()
}

function saveGameRecord() {
  const result = gameStore.getGameResult()
  if (!result) return

  // 情境字段:供 special 类勋章判定(时段/周末/是否用提示/是否翻盘)
  const now = new Date()

  const record: GameRecord = {
    id: generateId(),
    date: now.toISOString(),
    difficulty: result.difficulty,
    time: result.time,
    errors: result.errors,
    completed: result.completed,
    medals: [],
    puzzleId: result.puzzleId,
    hourOfDay: now.getHours(),
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    usedHint: (result.hintsUsed ?? 0) > 0,
    recoveredFromError: result.completed && result.errors > 0
  }

  userStore.addGameRecord(record)
  newMedals.value = userStore.checkAndUnlockMedals(record)
  // 音效(需求 §7): 有新勋章解锁时播放
  if (newMedals.value.length > 0) {
    sound.play('medal')
  }
}
</script>

<style scoped>
/*
  布局要点(修复「27×27 底部数字键盘点不到」):
  原本是 min-height:100vh + 棋盘区 flex:1,27×27 时棋盘把控制区
  和键盘挤出视口,必须滚动页面才能碰到。
  改为:页面高度锁定 100dvh(移动端动态视口),头部/控制区/键盘
  固定占位,只有棋盘区自己滚动,键盘永远在拇指可及范围内。
*/
.game-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--bg-primary);
}

.game-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  padding-top: calc(10px + env(safe-area-inset-top, 0px));
  background: var(--accent-gradient);
  color: var(--text-inverse, #fff);
  box-shadow: var(--shadow-medium);
}

/* 头部内的文字与图标用反色,压过全局文字色 */
.game-header .difficulty-label,
.game-header .timer {
  color: var(--text-inverse, #fff);
}

.game-header .btn {
  background: rgba(255, 255, 255, 0.22);
  color: var(--text-inverse, #fff);
  border-color: rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(4px);
}

.game-header .btn:active {
  background: rgba(255, 255, 255, 0.34);
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
  color: var(--accent-ink, var(--primary-color));
}

/*
  棋盘区是唯一可滚动区域。
  min-height:0 是关键 —— flex 子项默认 min-height:auto 会被内容撑开,
  27×27 时把下方操作区/数字键盘顶出视口,导致底部点不到。
*/
/*
  棋盘区:页面里唯一可伸缩的中间段。
  min-height:0 是必须的 —— flex 子项默认 min-height:auto 会被 810px 的
  27×27 棋盘撑开,把下方操作区和数字键盘顶出视口(底部点不到)。
  高度确定后由 SudokuBoard 内部自己做 transform 平移/缩放。
*/
.game-board-container {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 0;
  overflow: hidden;
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
  border-top-color: var(--accent-ink, var(--primary-color));
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

/* 3×3 / 9×9 棋盘较小,允许该区域自身滚动 */
/*
  3×3 / 9×9:棋盘较小,容器居中并允许自身滚动。
  之前这里是 align-items:flex-start,配合棋盘组件的 flex-start,
  造成棋盘贴在页面左上角。
*/
.game-board-container.is-small {
  overflow: auto;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

.game-actions {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
}

/* F11: 提示次数告急(仅剩 1 次)→ 用 --warning-color 提示 */
.btn.is-low-hints {
  color: var(--warning-color);
  border-color: var(--warning-color);
  background-color: var(--warning-color-light);
}

.hint-count {
  font-size: 11px;
  opacity: 0.85;
  margin-left: 2px;
}

.game-actions.blurred {
  filter: blur(8px);
  pointer-events: none;
}

.game-actions .btn.active {
  background-color: var(--accent-ink, var(--primary-color));
  color: var(--text-inverse);
}

.difficulty-switch {
  flex-shrink: 0;
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
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px 20px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.note-hint {
  flex-shrink: 0;
  text-align: center;
  padding: 6px 16px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 12px;
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

/* 27×27 横屏提示 */
.rotate-hint {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--accent-light);
  color: var(--accent-primary);
  font-size: 12px;
  border-bottom: 1px solid var(--border-secondary);
}

.rotate-icon {
  font-size: 16px;
}

.number-btn {
  /* 44px 是移动端可点击目标的最小舒适尺寸(Apple HIG / Material) */
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid var(--border-primary, #f7ccd7);
  border-radius: var(--radius-medium, 14px);
  background-color: var(--bg-secondary, #ffeef2);
  color: var(--accent-ink, var(--accent-primary));
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-light);
  transition: transform 0.12s, box-shadow 0.2s, background-color 0.2s;
}

/* 数字键也要有明确的按压反馈,移动端点击手感 */
.number-btn:active:not(:disabled) {
  transform: scale(0.9);
  background: var(--accent-light, #ffeef2);
}

.number-btn:hover {
  background-color: var(--accent-ink, var(--primary-color));
  color: var(--text-inverse);
}

.number-btn:active {
  transform: scale(0.95);
}

.number-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
  box-shadow: var(--shadow-heavy);
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
  color: var(--accent-ink, var(--primary-color));
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
  color: var(--accent-ink, var(--primary-color));
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
  /* 窄屏缩小间距但不缩到 44px 以下 —— 触摸目标不能因屏幕小而缩水 */
  .number-btn {
    font-size: 15px;
  }

  .number-pad {
    gap: 6px;
    padding: 8px 10px 12px;
  }

  .game-actions {
    flex-wrap: wrap;
  }
}
</style>
