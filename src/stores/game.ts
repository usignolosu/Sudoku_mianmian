// 游戏状态管理 Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, DifficultyConfig, HistoryStep } from '../types'
import { SudokuGenerator } from '../utils/sudoku'

export const useGameStore = defineStore('game', () => {
  // 游戏状态
  const gameState = ref<GameState | null>(null)
  const selectedCell = ref<{ row: number; col: number } | null>(null)
  const isNoteMode = ref(false)
  const generator = ref<SudokuGenerator | null>(null)

  // 计算属性：当前选中的格子
  const currentCell = computed(() => {
    if (!selectedCell.value || !gameState.value) return null
    return gameState.value.grid[selectedCell.value.row][selectedCell.value.col]
  })

  // 计算属性：高亮的格子（相关格子 + 相同数字格子）
  const highlightedCells = computed(() => {
    if (!selectedCell.value || !gameState.value || !generator.value) return new Set<string>()

    const { row, col } = selectedCell.value
    const size = generator.value.getSize()
    const boxSize = generator.value.getBoxSize()
    const related = new Set<string>()

    // 同行
    for (let c = 0; c < size; c++) {
      related.add(`${row}-${c}`)
    }
    // 同列
    for (let r = 0; r < size; r++) {
      related.add(`${r}-${col}`)
    }
    // 同宫格（size > 3 时才有宫格概念）
    if (size > 3) {
      const boxRowStart = Math.floor(row / boxSize) * boxSize
      const boxColStart = Math.floor(col / boxSize) * boxSize
      for (let r = boxRowStart; r < boxRowStart + boxSize; r++) {
        for (let c = boxColStart; c < boxColStart + boxSize; c++) {
          related.add(`${r}-${c}`)
        }
      }
    }

    // 相同数字高亮
    const cell = gameState.value.grid[row][col]
    if (cell.value !== null) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (gameState.value.grid[r][c].value === cell.value) {
            related.add(`${r}-${c}`)
          }
        }
      }
    }

    return related
  })

  // 计算属性：可用数字
  const availableNumbers = computed(() => {
    return generator.value?.getNumberRange() || []
  })

  // 计算属性：剩余提示次数
  const remainingHints = computed(() => {
    return 3 - (gameState.value?.hintsUsed || 0)
  })

  // 计算属性：格式化时间
  const formattedTime = computed(() => {
    const time = gameState.value?.timer || 0
    const minutes = Math.floor(time / 60)
    const seconds = time % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  /**
   * 初始化新游戏
   */
  function initGame(config: DifficultyConfig) {
    generator.value = new SudokuGenerator(config.size)
    const { puzzle, solution, id } = generator.value.generatePuzzle(config.level)
    const grid = generator.value.createCellGrid(puzzle)

    gameState.value = {
      grid,
      solution,
      difficulty: config,
      timer: 0,
      errors: 0,
      hintsUsed: 0,
      isPaused: false,
      isCompleted: false,
      history: [],
      historyIndex: -1,
      startTime: Date.now(),
      puzzleId: id
    }

    selectedCell.value = null
    isNoteMode.value = false
  }

  /**
   * 用预置题目初始化游戏（用于每日挑战）
   */
  function initGameWithPuzzle(config: DifficultyConfig, puzzleData: { puzzle: number[][]; solution: number[][]; id: string }) {
    generator.value = new SudokuGenerator(config.size)
    const grid = generator.value.createCellGrid(puzzleData.puzzle)

    gameState.value = {
      grid,
      solution: puzzleData.solution,
      difficulty: config,
      timer: 0,
      errors: 0,
      hintsUsed: 0,
      isPaused: false,
      isCompleted: false,
      history: [],
      historyIndex: -1,
      startTime: Date.now(),
      puzzleId: puzzleData.id
    }

    selectedCell.value = null
    isNoteMode.value = false
  }

  /**
   * 用关卡号初始化游戏（关卡号作为种子生成固定题目）
   */
  function initGameWithLevel(config: DifficultyConfig, levelNum: number, isRandom = false) {
    generator.value = new SudokuGenerator(config.size)
    const seed = `${config.size}-${config.level}-level-${levelNum}`
    const puzzle = generator.value.generatePuzzleWithSeed(seed, config.level)
    
    // 自定义 puzzleId
    const puzzleId = isRandom 
      ? `random-${config.size}-${config.level}-${levelNum}` 
      : `${config.size}-${config.level}-level-${levelNum}`

    const grid = generator.value.createCellGrid(puzzle.puzzle)

    gameState.value = {
      grid,
      solution: puzzle.solution,
      difficulty: config,
      timer: 0,
      errors: 0,
      hintsUsed: 0,
      isPaused: false,
      isCompleted: false,
      history: [],
      historyIndex: -1,
      startTime: Date.now(),
      puzzleId
    }

    selectedCell.value = null
    isNoteMode.value = false
  }

  /**
   * 选择格子
   */
  function selectCell(row: number, col: number) {
    if (!gameState.value || gameState.value.isPaused) return

    const cell = gameState.value.grid[row][col]
    if (!cell.fixed) {
      selectedCell.value = { row, col }
    } else {
      // 固定数字也可以选中（用于高亮相同数字）
      selectedCell.value = { row, col }
    }
  }

  /**
   * 填入数字
   */
  function fillNumber(num: number) {
    if (!gameState.value || !selectedCell.value || gameState.value.isPaused) return

    const { row, col } = selectedCell.value
    const cell = gameState.value.grid[row][col]

    if (cell.fixed) return

    // 同一格填相同数字不重复入 history
    if (!isNoteMode.value && cell.value === num) return
    if (isNoteMode.value && cell.notes.includes(num) && cell.value === null) {
      // toggle 行为：已有则删除
    }

    // 保存历史记录
    const historyStep: HistoryStep = {
      row,
      col,
      oldValue: cell.value,
      newValue: isNoteMode.value ? null : num,
      oldNotes: [...cell.notes],
      newNotes: isNoteMode.value
        ? (cell.notes.includes(num)
          ? cell.notes.filter(n => n !== num)
          : [...cell.notes, num].sort((a, b) => a - b))
        : []
    }

    // 更新格子
    if (isNoteMode.value) {
      cell.notes = historyStep.newNotes
      cell.value = null
    } else {
      cell.value = num
      cell.notes = []
    }

    // 新操作清空 index 后面的历史
    if (gameState.value.historyIndex < gameState.value.history.length - 1) {
      gameState.value.history = gameState.value.history.slice(0, gameState.value.historyIndex + 1)
    }

    // 添加到历史
    gameState.value.history.push(historyStep)
    gameState.value.historyIndex = gameState.value.history.length - 1

    // 检查是否完成
    checkCompletion()
  }

  /**
   * 删除数字
   */
  function deleteNumber() {
    if (!gameState.value || !selectedCell.value || gameState.value.isPaused) return

    const { row, col } = selectedCell.value
    const cell = gameState.value.grid[row][col]

    if (cell.fixed) return
    if (cell.value === null && cell.notes.length === 0) return

    // 保存历史记录
    const historyStep: HistoryStep = {
      row,
      col,
      oldValue: cell.value,
      newValue: null,
      oldNotes: [...cell.notes],
      newNotes: []
    }

    // 清空格子
    cell.value = null
    cell.notes = []

    // 新操作清空 index 后面的历史
    if (gameState.value.historyIndex < gameState.value.history.length - 1) {
      gameState.value.history = gameState.value.history.slice(0, gameState.value.historyIndex + 1)
    }

    // 添加到历史
    gameState.value.history.push(historyStep)
    gameState.value.historyIndex = gameState.value.history.length - 1
  }

  /**
   * 撤销
   */
  function undo() {
    if (!gameState.value || gameState.value.historyIndex < 0) return

    const step = gameState.value.history[gameState.value.historyIndex]
    const cell = gameState.value.grid[step.row][step.col]

    // 恢复之前的状态
    cell.value = step.oldValue
    cell.notes = [...step.oldNotes]

    gameState.value.historyIndex--
  }

  /**
   * 重做
   */
  function redo() {
    if (!gameState.value || gameState.value.historyIndex >= gameState.value.history.length - 1) return

    gameState.value.historyIndex++
    const step = gameState.value.history[gameState.value.historyIndex]
    const cell = gameState.value.grid[step.row][step.col]

    // 恢复之后的状态
    cell.value = step.newValue
    cell.notes = [...step.newNotes]
  }

  /**
   * 使用提示（无次数限制）
   */
  function useHint() {
    if (!gameState.value || !generator.value) return

    const hint = generator.value.getHint(gameState.value.grid, gameState.value.solution)
    if (!hint) return

    const cell = gameState.value.grid[hint.row][hint.col]

    // 保存历史
    const historyStep: HistoryStep = {
      row: hint.row,
      col: hint.col,
      oldValue: cell.value,
      newValue: hint.value,
      oldNotes: [...cell.notes],
      newNotes: []
    }

    // 填入正确答案
    cell.value = hint.value
    cell.notes = []
    cell.error = false
    cell.fixed = true

    gameState.value.hintsUsed++

    // 新操作清空 index 后面的历史
    if (gameState.value.historyIndex < gameState.value.history.length - 1) {
      gameState.value.history = gameState.value.history.slice(0, gameState.value.historyIndex + 1)
    }

    gameState.value.history.push(historyStep)
    gameState.value.historyIndex = gameState.value.history.length - 1

    // 选择提示的格子
    selectedCell.value = { row: hint.row, col: hint.col }

    // 检查是否完成
    checkCompletion()
  }

  /**
   * 切换笔记模式
   */
  function toggleNoteMode() {
    isNoteMode.value = !isNoteMode.value
  }

  /**
   * 暂停游戏
   */
  function pauseGame() {
    if (!gameState.value) return
    gameState.value.isPaused = true
  }

  /**
   * 继续游戏
   */
  function resumeGame() {
    if (!gameState.value) return
    gameState.value.isPaused = false
  }

  /**
   * 更新计时
   */
  function updateTimer() {
    if (!gameState.value || gameState.value.isPaused || gameState.value.isCompleted) return
    gameState.value.timer++
  }

  /**
   * 检查是否完成
   */
  function checkCompletion() {
    if (!gameState.value || !generator.value) return

    if (generator.value.checkComplete(gameState.value.grid)) {
      gameState.value.isCompleted = true
    }
  }

  /**
   * 获取游戏结果数据
   */
  function getGameResult() {
    if (!gameState.value) return null

    return {
      time: gameState.value.timer,
      errors: gameState.value.errors,
      hintsUsed: gameState.value.hintsUsed,
      completed: gameState.value.isCompleted,
      difficulty: gameState.value.difficulty,
      puzzleId: gameState.value.puzzleId
    }
  }

  return {
    gameState,
    selectedCell,
    isNoteMode,
    generator,
    currentCell,
    highlightedCells,
    availableNumbers,
    remainingHints,
    formattedTime,
    initGame,
    initGameWithPuzzle,
    initGameWithLevel,
    selectCell,
    fillNumber,
    deleteNumber,
    undo,
    redo,
    useHint,
    toggleNoteMode,
    pauseGame,
    resumeGame,
    updateTimer,
    checkCompletion,
    getGameResult
  }
})
