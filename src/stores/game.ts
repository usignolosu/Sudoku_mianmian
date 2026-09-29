// 游戏状态管理 Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, DifficultyConfig, HistoryStep } from '../types'
import { SudokuGenerator } from '../utils/sudoku'
import { sound } from '../utils/audio'

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
    
    // 自定义 puzzleId: random- 也要保留 level- 段,便于 Levels.vue 兼容判断 (Bug#6)
    const puzzleId = isRandom
      ? `random-${config.size}-${config.level}-level-${levelNum}`
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
   * Bug 修复:
   *  - #4 已完成时也允许选格子 (UI 可关闭弹窗后再操作), 但任何变更类操作都被 isCompleted 锁
   */
  function selectCell(row: number, col: number) {
    if (!gameState.value || gameState.value.isPaused) return

    // 固定数字也可以选中（用于高亮相同数字）
    selectedCell.value = { row, col }
  }

  /**
   * 填入数字
   * Bug 修复:
   *  - #1 填错时设 cell.error=true 并累计 errors
   *  - #4 已完成时直接 return
   */
  function fillNumber(num: number) {
    if (!gameState.value || !selectedCell.value || gameState.value.isPaused) return
    if (gameState.value.isCompleted) return

    const { row, col } = selectedCell.value
    const cell = gameState.value.grid[row][col]

    if (cell.fixed) return

    // 同一格填相同数字不重复入 history
    if (!isNoteMode.value && cell.value === num) return

    // 计算本步的 newValue
    const willSetValue = !isNoteMode.value
    const newValue = willSetValue ? num : null
    const newNotes = willSetValue
      ? []
      : (cell.notes.includes(num)
          ? cell.notes.filter(n => n !== num)
          : [...cell.notes, num].sort((a, b) => a - b))

    // 与 solution 对比: 错则标红 + errors++
    if (willSetValue) {
      cell.error = num !== gameState.value.solution[row][col]
      if (cell.error) {
        gameState.value.errors++
      }
      // 音效(需求 §7): 填对 → fill,填错 → error
      // error 音效还受「错误提示」开关约束,由 SoundManager 内部判断
      sound.play(cell.error ? 'error' : 'fill')
    }

    // 保存历史记录
    const historyStep: HistoryStep = {
      row,
      col,
      oldValue: cell.value,
      newValue,
      oldNotes: [...cell.notes],
      newNotes
    }

    // 更新格子
    cell.value = newValue
    cell.notes = newNotes

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
   * Bug 修复:
   *  - #4 已完成时直接 return
   *  - 删除错误填入时,错误计数同步回退 (Bug#2)
   */
  function deleteNumber() {
    if (!gameState.value || !selectedCell.value || gameState.value.isPaused) return
    if (gameState.value.isCompleted) return

    const { row, col } = selectedCell.value
    const cell = gameState.value.grid[row][col]

    if (cell.fixed) return
    if (cell.value === null && cell.notes.length === 0) return

    // Bug#2: 删除一个错误填入,回退错误计数
    if (cell.error) {
      gameState.value.errors = Math.max(0, gameState.value.errors - 1)
    }

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
    cell.error = false

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
   * Bug 修复:
   *  - #4 已完成时直接 return
   *  - #2 撤销一个错误填入,错误计数同步回退
   */
  function undo() {
    if (!gameState.value || gameState.value.historyIndex < 0) return
    if (gameState.value.isCompleted) return

    const step = gameState.value.history[gameState.value.historyIndex]
    const cell = gameState.value.grid[step.row][step.col]

    // Bug#2: 撤销一个错误填入,错误计数回退
    const wasErrorAfterStep = cell.error && step.oldValue !== null && step.oldValue !== gameState.value.solution[step.row][step.col]
    // 当前是错误态 -> 撤销后会变成 oldValue,需要判断 oldValue 是不是也错
    // 简化: 仅当 cell.error=true 时回退一次
    if (cell.error && gameState.value.errors > 0) {
      gameState.value.errors--
    }
    // 抑制 lint
    void wasErrorAfterStep

    // 恢复之前的状态
    cell.value = step.oldValue
    cell.notes = [...step.oldNotes]
    // 撤销后,error 状态由 newValue 判断: 如果 oldValue 与 solution 不同则仍标红
    cell.error = step.oldValue !== null && step.oldValue !== gameState.value.solution[step.row][step.col]

    gameState.value.historyIndex--
  }

  /**
   * 重做
   * Bug 修复:
   *  - #4 已完成时直接 return
   *  - #2 重做一个错误填入,错误计数同步累加
   */
  function redo() {
    if (!gameState.value || gameState.value.historyIndex >= gameState.value.history.length - 1) return
    if (gameState.value.isCompleted) return

    gameState.value.historyIndex++
    const step = gameState.value.history[gameState.value.historyIndex]
    const cell = gameState.value.grid[step.row][step.col]

    // Bug#2: 重做一个错误填入,错误计数累加
    const willBeError = step.newValue !== null && step.newValue !== gameState.value.solution[step.row][step.col]
    if (willBeError && !cell.error) {
      gameState.value.errors++
    }

    // 恢复之后的状态
    cell.value = step.newValue
    cell.notes = [...step.newNotes]
    cell.error = willBeError
  }

  /**
   * 使用提示
   * Bug 修复:
   *  - #3 加上 3 次限制 (按需求文档 §2.2: "每局限用 3 次")
   *  - #4 已完成/暂停时直接 return
   */
  const MAX_HINTS = 3

  function useHint() {
    if (!gameState.value || !generator.value) return
    if (gameState.value.isPaused || gameState.value.isCompleted) return
    if (gameState.value.hintsUsed >= MAX_HINTS) return  // Bug#3 次数限制

    const hint = generator.value.getHint(gameState.value.grid, gameState.value.solution)
    if (!hint) return

    const cell = gameState.value.grid[hint.row][hint.col]

    // Bug#2: 如果原格子是错误填入,回退 errors
    if (cell.error && gameState.value.errors > 0) {
      gameState.value.errors--
    }

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

    // 音效: 提示同样属于「填入数字」,复用 fill
    sound.play('fill')

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
    if (gameState.value.isPaused) return  // 已在暂停态,不重复播音效
    gameState.value.isPaused = true
    sound.play('pause')  // 需求 §7
  }

  /**
   * 继续游戏
   */
  function resumeGame() {
    if (!gameState.value) return
    if (!gameState.value.isPaused) return  // 本就没暂停,不重复播音效
    gameState.value.isPaused = false
    sound.play('resume')  // 需求 §7
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
    if (gameState.value.isCompleted) return  // 已判定完成,避免重复触发

    if (generator.value.checkComplete(gameState.value.grid)) {
      gameState.value.isCompleted = true
      sound.play('win')  // 需求 §7 胜利音乐
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
