<template>
  <div class="sudoku-board-wrapper" :class="wrapperClass">
    <!-- 27×27:小地图 + 缩放控制 -->
    <div v-if="isLargeBoard" class="pan-controls">
      <button
        class="pan-btn"
        :class="{ 'active': showMinimap }"
        @click="showMinimap = !showMinimap"
        title="小地图"
      >🗺️</button>
      <button class="pan-btn" @click="zoomOut" title="缩小">－</button>
      <span class="zoom-label">{{ zoomPercent }}%</span>
      <button class="pan-btn" @click="zoomIn" title="放大">＋</button>
      <button class="pan-btn" @click="resetView" title="重置视图">⟲</button>
      <span class="gesture-tip">拖动浏览 · 双指缩放</span>
    </div>

    <!-- 棋盘视口 -->
    <div
      ref="wrapperEl"
      class="board-viewport"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @wheel="onWheel"
    >
      <div
        class="sudoku-board"
        :class="boardClass"
        :style="boardStyle"
        v-if="grid && grid.length > 0"
      >
        <div
          v-for="(row, rowIndex) in grid"
          :key="rowIndex"
          class="sudoku-row"
        >
          <div
            v-for="(cell, colIndex) in row"
            :key="colIndex"
            class="sudoku-cell"
            :class="getCellClass(rowIndex, colIndex, cell)"
            @click="handleCellClick(rowIndex, colIndex)"
          >
            <template v-if="cell.value !== null">
              <span class="cell-value" :class="{ 'is-fixed': cell.fixed, 'is-error': cell.error }">
                {{ cell.value }}
              </span>
            </template>
            <template v-else-if="cell.notes.length > 0">
              <div class="cell-notes">
                <span
                  v-for="n in noteNumbers"
                  :key="n"
                  class="note-number"
                  :class="{ 'has-note': cell.notes.includes(n) }"
                >
                  {{ cell.notes.includes(n) ? n : '' }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="board-loading">
        加载中...
      </div>
    </div>

    <!-- 小地图 -->
    <div
      v-if="isLargeBoard && showMinimap"
      class="minimap"
      @click="onMinimapClick"
    >
      <div
        v-for="n in props.size"
        :key="'r' + n"
        class="minimap-row"
      >
        <span
          v-for="c in props.size"
          :key="'c' + c"
          class="minimap-cell"
          :class="{
            'filled': !!grid?.[n - 1]?.[c - 1]?.value,
            'wrong': !!grid?.[n - 1]?.[c - 1]?.error,
            'box-right': (c) % 9 === 0 && c < props.size,
            'box-bottom': (n) % 9 === 0 && n < props.size
          }"
        ></span>
      </div>
      <div class="minimap-viewport" :style="viewportBoxStyle"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { Cell, GridSize } from '../types'
import {
  panBy, zoomAtPoint, jumpToCell, visibleRect, initialViewport, toTransform,
  applyPinch, touchDistance, touchCenter,
  type ViewportState, type PanZoomOptions
} from '../utils/panZoom'

const props = defineProps<{
  grid: Cell[][] | null
  size: GridSize
  selectedCell: { row: number; col: number } | null
  highlightedCells: Set<string>
  showError: boolean
}>()

const emit = defineEmits<{
  (e: 'cell-click', row: number, col: number): void
}>()

// ── 棋盘原始尺寸(px)──
const BOARD_SIZE_PX: Record<GridSize, number> = { 3: 180, 9: 450, 27: 810 }

/** 仅 27×27 需要手势;9×9 在手机上已能完整显示 */
const isLargeBoard = computed(() => props.size === 27)

const wrapperEl = ref<HTMLElement | null>(null)

/** 视口参数 */
const viewport = reactive<{ w: number; h: number }>({ w: 400, h: 500 })

function panZoomOptions(): PanZoomOptions {
  const base = BOARD_SIZE_PX[props.size]
  return {
    baseWidth: base,
    baseHeight: base,
    viewportWidth: viewport.w,
    viewportHeight: viewport.h
  }
}

const view = ref<ViewportState>(initialViewport(panZoomOptions()))

/**
 * 重新测量容器尺寸(旋转屏幕 / 布局变化时)
 *
 * 用 ResizeObserver 而不是只靠 onMounted + window.resize:
 * 父级 flex 链(game-page 100dvh → board-container flex:1 → wrapper
 * height:100% → viewport flex:1)在首次挂载时可能还没完成布局,
 * 一次性测量会拿到 0 或错误高度,导致 clamp 边界算错、拖不到边。
 *
 * 关键:只在尺寸真的变了时才重置视口。
 * ResizeObserver 会在任意布局变化时触发,若无脑重置,
 * 用户刚放大完就会被拉回初始缩放。
 */
let resizeObserver: ResizeObserver | null = null
/** 上次重建视口时的可用空间,用于判断是否需要重置 */
let lastW = 0
let lastH = 0

function measure(): void {
  const el = wrapperEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  // 高度为 0 说明布局未就绪,保留旧值而不是写入 0
  if (rect.width > 0) viewport.w = rect.width
  if (rect.height > 0) viewport.h = rect.height

  // 仅在可用空间真的变化时重建视口,避免抹掉用户的缩放/位置
  if (viewport.w !== lastW || viewport.h !== lastH) {
    lastW = viewport.w
    lastH = viewport.h
    view.value = initialViewport(panZoomOptions())
  }
}

onMounted(() => {
  // 先同步测一次,再观察后续变化
  measure()
  nextTick(() => measure())

  if (typeof ResizeObserver !== 'undefined' && wrapperEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(wrapperEl.value)
  }

  window.addEventListener('resize', measure)
  window.addEventListener('orientationchange', measure)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  window.removeEventListener('resize', measure)
  window.removeEventListener('orientationchange', measure)
})

// 切换尺寸时强制重置视口(棋盘基准尺寸变了,旧缩放不再适用)
watch(() => props.size, async () => {
  lastW = 0
  lastH = 0
  await nextTick()
  measure()
})

const boardStyle = computed(() => {
  if (!isLargeBoard.value) return {}
  return { transform: toTransform(view.value), transformOrigin: '0 0' }
})

/** 是否处于拖拽中(用于屏蔽误触点击) */
const isDragging = ref(false)
let movedDistance = 0

// ── 触摸手势 ────────────────────────────────────────────────────
const touches = new Map<number, { x: number; y: number }>()
let lastPinchDistance = 0
let lastPanPoint: { x: number; y: number } | null = null

function onTouchStart(e: TouchEvent): void {
  if (!isLargeBoard.value) return
  for (const t of Array.from(e.changedTouches)) {
    touches.set(t.identifier, { x: t.clientX, y: t.clientY })
  }
  movedDistance = 0

  if (touches.size === 2) {
    const [a, b] = Array.from(touches.values())
    lastPinchDistance = touchDistance(a, b)
    lastPanPoint = null
  } else if (touches.size === 1) {
    const p = Array.from(touches.values())[0]
    lastPanPoint = { ...p }
  }
}

function onTouchMove(e: TouchEvent): void {
  if (!isLargeBoard.value) return
  e.preventDefault()

  for (const t of Array.from(e.changedTouches)) {
    touches.set(t.identifier, { x: t.clientX, y: t.clientY })
  }

  if (touches.size === 2) {
    // 双指缩放
    const [a, b] = Array.from(touches.values())
    const dist = touchDistance(a, b)
    const anchor = touchCenter(a, b)
    const rect = wrapperEl.value?.getBoundingClientRect()
    const localAnchor = rect
      ? { x: anchor.x - rect.left, y: anchor.y - rect.top }
      : anchor

    const { state } = applyPinch(
      view.value, lastPinchDistance, dist,
      localAnchor.x, localAnchor.y, panZoomOptions()
    )
    view.value = state
    lastPinchDistance = dist
    isDragging.value = true
    return
  }

  if (touches.size === 1 && lastPanPoint) {
    // 单指平移
    const p = Array.from(touches.values())[0]
    const dx = p.x - lastPanPoint.x
    const dy = p.y - lastPanPoint.y
    movedDistance += Math.abs(dx) + Math.abs(dy)
    if (movedDistance > 4) isDragging.value = true
    view.value = panBy(view.value, dx, dy, panZoomOptions())
    lastPanPoint = { ...p }
  }
}

function onTouchEnd(e: TouchEvent): void {
  for (const t of Array.from(e.changedTouches)) {
    touches.delete(t.identifier)
  }
  if (touches.size < 2) lastPinchDistance = 0
  if (touches.size === 1) {
    const p = Array.from(touches.values())[0]
    lastPanPoint = { ...p }
  } else if (touches.size === 0) {
    lastPanPoint = null
  }
  // 延迟复位,避免 touchend 后紧接着的 click 被吞
  setTimeout(() => { isDragging.value = false }, 0)
}

/** 滚轮缩放(桌面端调试 / 笔记本触控板) */
function onWheel(e: WheelEvent): void {
  if (!isLargeBoard.value) return
  e.preventDefault()
  const rect = wrapperEl.value?.getBoundingClientRect()
  const anchor = {
    x: e.clientX - (rect?.left ?? 0),
    y: e.clientY - (rect?.top ?? 0)
  }
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  view.value = zoomAtPoint(view.value, factor, anchor.x, anchor.y, panZoomOptions())
}

function resetView(): void {
  view.value = initialViewport(panZoomOptions())
}

/** 以视口中心为锚点放大/缩小 */
function zoomBy(factor: number): void {
  view.value = zoomAtPoint(
    view.value, factor,
    viewport.w / 2, viewport.h / 2,
    panZoomOptions()
  )
}

function zoomIn(): void {
  zoomBy(1.2)
}

function zoomOut(): void {
  zoomBy(1 / 1.2)
}

const zoomPercent = computed(() => Math.round(view.value.scale * 100))

// ── 小地图 ──────────────────────────────────────────────────────
const showMinimap = ref(false)

const visible = computed(() => {
  if (!isLargeBoard.value) return null
  return visibleRect(view.value, props.size, panZoomOptions())
})

/** 高亮框在缩略图上的位置(百分比) */
const viewportBoxStyle = computed(() => {
  const v = visible.value
  if (!v) return {}
  const n = props.size
  return {
    left: `${(v.colStart / n) * 100}%`,
    top: `${(v.rowStart / n) * 100}%`,
    width: `${((v.colEnd - v.colStart) / n) * 100}%`,
    height: `${((v.rowEnd - v.rowStart) / n) * 100}%`
  }
})

/** 点击小地图跳转 */
function onMinimapClick(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const ratioX = (e.clientX - rect.left) / rect.width
  const ratioY = (e.clientY - rect.top) / rect.height
  const col = Math.min(props.size - 1, Math.max(0, Math.floor(ratioX * props.size)))
  const row = Math.min(props.size - 1, Math.max(0, Math.floor(ratioY * props.size)))
  view.value = jumpToCell(view.value, row, col, props.size, panZoomOptions())
}

// ── 棋盘样式类 ──────────────────────────────────────────────────
const boardClass = computed(() => `size-${props.size}`)

const wrapperClass = computed(() => ({
  'scrollable': props.size >= 9,
  'pan-zoom': isLargeBoard.value
}))

// 笔记显示的数字范围
const noteNumbers = computed(() => {
  if (props.size === 3) return [1, 2, 3]
  if (props.size === 9) return [1, 2, 3, 4, 5, 6, 7, 8, 9]
  // 27×27 不显示笔记(格子太小,显示不下)
  return []
})

// 获取格子样式类
function getCellClass(row: number, col: number, cell: Cell) {
  const classes: string[] = []

  if (props.selectedCell?.row === row && props.selectedCell?.col === col) {
    classes.push('selected')
  }

  if (props.highlightedCells.has(`${row}-${col}`)) {
    classes.push('highlighted')
  }

  if (cell.fixed) {
    classes.push('fixed')
  }

  if (props.showError && cell.error) {
    classes.push('error')
  }

  const boxSize = props.size === 3 ? 3 : props.size === 9 ? 3 : 9
  const isRightBorder = (col + 1) % boxSize === 0 && col < props.size - 1
  const isBottomBorder = (row + 1) % boxSize === 0 && row < props.size - 1

  if (isRightBorder) classes.push('box-right')
  if (isBottomBorder) classes.push('box-bottom')

  return classes
}

function handleCellClick(row: number, col: number) {
  // 刚拖拽完的误触不触发选中
  if (isDragging.value) return
  emit('cell-click', row, col)
}
</script>

<style scoped>
.sudoku-board-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  padding: 10px;
  box-sizing: border-box;
}

/*
  27×27 专用:撑满父容器高度,让"控制条 / 视口 / 小地图"三段能正常分配。
  小棋盘(3×3/9×9)不需要 height:100%,否则会被拉成整屏高。
*/
.sudoku-board-wrapper.pan-zoom {
  height: 100%;
}

/* 9×9 及以下仍用原生滚动 */
.sudoku-board-wrapper.scrollable:not(.pan-zoom) {
  overflow-x: auto;
  overflow-y: auto;
}

/* ── 27×27:手势视口 ─────────────────────────────────────────── */
/*
  必须有确定的高度,否则棋盘(810px)会把视口撑开,
  父容器 overflow:hidden 裁掉溢出部分且无法滚动到 —— 表现为"上下拖不动"。
  flex:1 + min-height:0 让它在"控制条 / 视口 / 小地图"三段中占中间弹性段。
*/
.board-viewport {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex;
  /* 3×3 / 9×9 棋盘比视口小 → 居中显示
     (此前误用 align-items:flex-start 且无 justify-content,
      导致棋盘贴在页面左上角 —— 用户反馈的布局问题) */
  justify-content: center;
  align-items: center;
  touch-action: none;          /* 交给 JS 处理手势,避免浏览器抢走 */
  overflow: hidden;
  will-change: transform;
}

/*
  27×27 必须用 flex-start 而不是 center,原因有二:
    1. flex 居中 + overflow:hidden 时,内容比容器宽会导致左侧溢出
       被裁掉且无法拖到(用户反馈"左边拖不到最左")
    2. panZoom.clampOffset 的计算前提是"棋盘原始左边缘 = 0"
*/
.pan-zoom .board-viewport {
  justify-content: flex-start;
  align-items: flex-start;
  cursor: grab;
}

.pan-zoom .board-viewport:active {
  cursor: grabbing;
}

/* 顶部控制条 */
.pan-controls {
  flex-shrink: 0;
  width: 100%;
  max-width: 560px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: var(--bg-card);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-light);
  flex-wrap: wrap;
}

.pan-btn {
  /* 44px 最小触摸目标;27×27 下缩放按钮使用频繁 */
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-small);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.pan-btn:hover {
  border-color: var(--accent-primary);
}

.pan-btn.active {
  background: var(--accent-light);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.zoom-label {
  min-width: 46px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.gesture-tip {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
}

/* ── 小地图 ─────────────────────────────────────────────────── */
.minimap {
  flex-shrink: 0;
  position: relative;
  margin-top: 10px;
  padding: 4px;
  background: var(--bg-card);
  border: 2px solid var(--border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-medium);
  cursor: crosshair;
  /* 27 格每格 6px */
  width: 184px;
  height: 184px;
}

.minimap-row {
  display: flex;
  height: 6px;
}

.minimap-cell {
  width: 6px;
  height: 6px;
  background: var(--bg-tertiary);
  flex: 0 0 auto;
}

.minimap-cell.filled {
  background: var(--text-primary);
}

.minimap-cell.wrong {
  background: var(--error-color);
}

.minimap-cell.box-right {
  border-right: 1px solid var(--border-primary);
}

.minimap-cell.box-bottom {
  border-bottom: 1px solid var(--border-primary);
}

/* 当前视口高亮框 */
.minimap-viewport {
  position: absolute;
  border: 2px solid var(--accent-primary);
  background: var(--accent-light);
  opacity: 0.5;
  pointer-events: none;
  border-radius: 2px;
}

.board-loading {
  padding: 40px;
  color: var(--text-secondary);
  text-align: center;
}

.sudoku-board {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-medium, 14px);
  overflow: hidden;
  background: var(--bg-card);
  box-shadow: var(--shadow-medium, 0 4px 18px rgba(233, 69, 96, 0.16));
}

/* 3×3 迷你数独 */
.sudoku-board.size-3 {
  width: 180px;
}

.size-3 .sudoku-row {
  display: flex;
}

.size-3 .sudoku-cell {
  width: 60px;
  height: 60px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 24px;
  font-weight: 600;
}

/* 9×9 标准数独 */
.sudoku-board.size-9 {
  width: min(90vw, 450px);
}

.size-9 .sudoku-row {
  display: flex;
}

.size-9 .sudoku-cell {
  flex: 1;
  aspect-ratio: 1;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  font-size: clamp(14px, 4vw, 20px);
  font-weight: 500;
}

/* 27×27 巨型数独 */
.sudoku-board.size-27 {
  min-width: 810px;
}

.size-27 .sudoku-row {
  display: flex;
}

.size-27 .sudoku-cell {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 11px;
  font-weight: 500;
}

/* 通用样式 */
.sudoku-cell:hover {
  background: var(--bg-hover);
}

/* F11: 按下瞬间的更强调底色(与 hover 区分) */
.sudoku-cell:active {
  background: var(--bg-active);
}

.sudoku-cell.selected {
  background: var(--accent-gradient, linear-gradient(135deg, #ff6b8a, #e94560)) !important;
  color: white;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.45);
}

.sudoku-cell.highlighted {
  background: var(--highlight-bg);
}

/*
  数字配色语义:
    --fixed-number  题目给定的数字(不可改)→ 用固定数字色 + 加粗
    --user-number   用户填入的数字      → 用强调色,与给定数字一眼可分
  (此前这里有两条重复的 .fixed .cell-value,后者用 --text-primary 覆盖了
   --fixed-number,导致 fixed/user 两个语义色都没生效)
*/
.sudoku-cell.fixed .cell-value {
  color: var(--fixed-number);
  font-weight: 700;
}

.sudoku-cell:not(.fixed) .cell-value {
  color: var(--user-number);
  font-weight: 500;
}

.sudoku-cell.error .cell-value {
  color: var(--error-color);
}

.sudoku-cell.selected .cell-value {
  color: var(--text-inverse) !important;
}

.sudoku-cell.box-right {
  border-right: 2px solid var(--border-color);
}

.sudoku-cell.box-bottom {
  border-bottom: 2px solid var(--border-color);
}

.cell-value {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 笔记模式 */
.cell-notes {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 2px;
}

.size-3 .cell-notes {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(1, 1fr);
  font-size: 12px;
}

.size-9 .cell-notes {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  font-size: 10px;
}

/* F11: 笔记占位数字(该格没有此候选)用 --note-number,比正文更淡 */
.note-number {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--note-number);
  font-weight: 400;
}

.note-number.has-note {
  color: var(--accent-ink, var(--primary-color));
}
</style>
