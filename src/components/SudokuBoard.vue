<template>
  <div class="sudoku-board-wrapper" :class="wrapperClass">
    <div class="sudoku-board" :class="boardClass" v-if="grid && grid.length > 0">
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Cell, GridSize } from '../types'

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

// 棋盘样式类
const boardClass = computed(() => {
  return `size-${props.size}`
})

const wrapperClass = computed(() => {
  return {
    'scrollable': props.size >= 9
  }
})

// 笔记显示的数字范围
const noteNumbers = computed(() => {
  if (props.size === 3) return [1, 2, 3]
  if (props.size === 9) return [1, 2, 3, 4, 5, 6, 7, 8, 9]
  // 27×27 不显示笔记（太多了）
  return []
})

// 获取格子样式类
function getCellClass(row: number, col: number, cell: Cell) {
  const classes: string[] = []

  // 是否选中
  if (props.selectedCell?.row === row && props.selectedCell?.col === col) {
    classes.push('selected')
  }

  // 是否高亮
  if (props.highlightedCells.has(`${row}-${col}`)) {
    classes.push('highlighted')
  }

  // 是否是固定数字
  if (cell.fixed) {
    classes.push('fixed')
  }

  // 是否错误
  if (props.showError && cell.error) {
    classes.push('error')
  }

  // 宫格边界
  const boxSize = props.size === 3 ? 3 : props.size === 9 ? 3 : 9
  const isRightBorder = (col + 1) % boxSize === 0 && col < props.size - 1
  const isBottomBorder = (row + 1) % boxSize === 0 && row < props.size - 1

  if (isRightBorder) classes.push('box-right')
  if (isBottomBorder) classes.push('box-bottom')

  return classes
}

function handleCellClick(row: number, col: number) {
  emit('cell-click', row, col)
}
</script>

<style scoped>
.sudoku-board-wrapper {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 10px;
  overflow: auto;
}

.sudoku-board-wrapper.scrollable {
  overflow-x: auto;
  overflow-y: auto;
}

.board-loading {
  padding: 40px;
  color: var(--text-secondary);
  text-align: center;
}

.sudoku-board {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-card);
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
  background: var(--hover-bg);
}

.sudoku-cell.selected {
  background: var(--primary-color) !important;
  color: white;
}

.sudoku-cell.highlighted {
  background: var(--highlight-bg);
}

.sudoku-cell.fixed .cell-value {
  color: var(--text-primary);
  font-weight: 700;
}

.sudoku-cell:not(.fixed) .cell-value {
  color: var(--text-primary);
  font-weight: 500;
}

.sudoku-cell.selected .cell-value {
  color: white !important;
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

.note-number {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-weight: 400;
}

.note-number.has-note {
  color: var(--primary-color);
}
</style>
