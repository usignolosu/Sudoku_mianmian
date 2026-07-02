// 数独核心算法

import type { GridSize, Cell, DifficultyLevel, Puzzle } from '../types'

/**
 * 数独生成器类
 * 支持 3×3（迷你）、9×9（标准）、27×27（巨型）三种尺寸
 */
export class SudokuGenerator {
  private size: GridSize
  private boxSize: number  // 每个宫格的边长

  constructor(size: GridSize) {
    this.size = size
    // 宫格大小：3×3没有宫格(或说1个宫格)，9×9是3×3宫格，27×27是9×9宫格
    if (size === 3) {
      this.boxSize = 3  // 3×3 迷你数独，整个就是一个宫格
    } else if (size === 9) {
      this.boxSize = 3  // 9×9 标准数独，3×3 宫格
    } else {
      this.boxSize = 9  // 27×27 巨型数独，9×9 宫格
    }
  }

  /**
   * 获取数字范围（1 到 size）
   */
  getNumberRange(): number[] {
    return Array.from({ length: this.size }, (_, i) => i + 1)
  }

  /**
   * 计算格子所属的宫格索引
   */
  getBoxIndex(row: number, col: number): number {
    const boxRow = Math.floor(row / this.boxSize)
    const boxCol = Math.floor(col / this.boxSize)
    const boxesPerRow = this.size / this.boxSize
    return boxRow * boxesPerRow + boxCol
  }

  /**
   * 获取宫格大小
   */
  getBoxSize(): number {
    return this.boxSize
  }

  /**
   * 获取棋盘大小
   */
  getSize(): number {
    return this.size
  }

  /**
   * 生成完整的数独解
   * 大尺寸使用模式构建法，小尺寸使用回溯
   */
  generateSolution(): number[][] {
    const grid: number[][] = Array.from({ length: this.size }, () =>
      Array.from({ length: this.size }, () => 0)
    )

    // 27×27 使用模式构建法（快速生成）
    if (this.size === 27) {
      this.fillGridPattern(grid)
    } else {
      // 3×3 和 9×9 使用回溯
      this.fillGrid(grid)
    }

    return grid
  }

  /**
   * 模式构建法（用于大尺寸数独快速生成）
   * 使用分组构造法：将数字分组，保证宫格约束
   */
  private fillGridPattern(grid: number[][]): void {
    const n = this.boxSize // 宫格边长（9）
    const boxesPerRow = this.size / this.boxSize // 每边宫格数（3）
    const allNumbers = this.shuffleArray(this.getNumberRange())

    // 第一步：将数字分成 boxesPerRow 组，每组 n 个数字
    const groups: number[][] = []
    for (let g = 0; g < boxesPerRow; g++) {
      groups.push(allNumbers.slice(g * n, (g + 1) * n))
    }

    // 第二步：构造宏观布局（3×3 的拉丁方，决定每个宫格用哪组数字）
    // 对于 3×3 宏观，简单构造：
    // [0, 1, 2]
    // [1, 2, 0]
    // [2, 0, 1]
    const macro: number[][] = []
    for (let r = 0; r < boxesPerRow; r++) {
      const row: number[] = []
      for (let c = 0; c < boxesPerRow; c++) {
        row.push((r + c) % boxesPerRow)
      }
      macro.push(row)
    }
    // 随机打乱宏观行和列
    const shuffledRows = this.shuffleArray([...Array(boxesPerRow).keys()])
    const shuffledCols = this.shuffleArray([...Array(boxesPerRow).keys()])
    const newMacro: number[][] = Array.from({ length: boxesPerRow }, () =>
      Array(boxesPerRow).fill(0)
    )
    for (let r = 0; r < boxesPerRow; r++) {
      for (let c = 0; c < boxesPerRow; c++) {
        newMacro[r][c] = macro[shuffledRows[r]][shuffledCols[c]]
      }
    }

    // 第三步：填充每个宫格
    for (let boxRow = 0; boxRow < boxesPerRow; boxRow++) {
      for (let boxCol = 0; boxCol < boxesPerRow; boxCol++) {
        const groupIdx = newMacro[boxRow][boxCol]
        const groupNumbers = this.shuffleArray([...groups[groupIdx]])

        // 在宫格内填充：用偏移法保证宫格内每行每列都不同
        // 对于 9×9 宫格，9 个数字，我们需要一个 9×9 的拉丁方
        // 简单方法：第 r 行是 groupNumbers 循环偏移 r 位
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const idx = (r + c) % n
            grid[boxRow * n + r][boxCol * n + c] = groupNumbers[idx]
          }
        }
      }
    }

    // 第四步：在同一宫格带内随机交换行（保持数独有效性）
    for (let boxRow = 0; boxRow < boxesPerRow; boxRow++) {
      // 收集这一宫格带的所有行
      const rowsInBand = Array.from({ length: n }, (_, i) => boxRow * n + i)
      const shuffled = this.shuffleArray([...rowsInBand])
      // 保存原始数据
      const originalRows = rowsInBand.map(r => [...grid[r]])
      // 重新赋值
      for (let i = 0; i < n; i++) {
        grid[rowsInBand[i]] = originalRows[shuffled.indexOf(rowsInBand[i])]
      }
    }

    // 第五步：在同一宫格栈内随机交换列（保持数独有效性）
    for (let boxCol = 0; boxCol < boxesPerRow; boxCol++) {
      const colsInStack = Array.from({ length: n }, (_, i) => boxCol * n + i)
      const shuffled = this.shuffleArray([...colsInStack])
      // 保存原始列数据
      const originalCols: number[][] = []
      for (const c of colsInStack) {
        const col: number[] = []
        for (let r = 0; r < this.size; r++) {
          col.push(grid[r][c])
        }
        originalCols.push(col)
      }
      // 重新赋值
      for (let i = 0; i < n; i++) {
        const targetCol = colsInStack[i]
        const sourceIdx = shuffled.indexOf(colsInStack[i])
        for (let r = 0; r < this.size; r++) {
          grid[r][targetCol] = originalCols[sourceIdx][r]
        }
      }
    }

    // 第六步：随机交换整个宫格行和宫格列（保持数独有效性）
    const shuffledBoxRows = this.shuffleArray([...Array(boxesPerRow).keys()])
    const originalBandRows: number[][] = []
    for (let br = 0; br < boxesPerRow; br++) {
      for (let r = 0; r < n; r++) {
        originalBandRows.push([...grid[br * n + r]])
      }
    }
    for (let newBr = 0; newBr < boxesPerRow; newBr++) {
      const oldBr = shuffledBoxRows[newBr]
      for (let r = 0; r < n; r++) {
        grid[newBr * n + r] = originalBandRows[oldBr * n + r]
      }
    }

    const shuffledBoxCols = this.shuffleArray([...Array(boxesPerRow).keys()])
    const originalStackCols: number[][] = []
    for (let bc = 0; bc < boxesPerRow; bc++) {
      for (let c = 0; c < n; c++) {
        const col: number[] = []
        for (let r = 0; r < this.size; r++) {
          col.push(grid[r][bc * n + c])
        }
        originalStackCols.push(col)
      }
    }
    for (let newBc = 0; newBc < boxesPerRow; newBc++) {
      const oldBc = shuffledBoxCols[newBc]
      for (let c = 0; c < n; c++) {
        const targetCol = newBc * n + c
        const sourceColIdx = oldBc * n + c
        for (let r = 0; r < this.size; r++) {
          grid[r][targetCol] = originalStackCols[sourceColIdx][r]
        }
      }
    }
  }

  /**
   * 递归填充网格（带性能优化）
   */
  private fillGrid(grid: number[][]): boolean {
    const numbers = this.getNumberRange()
    const emptyCell = this.findEmptyCell(grid)

    if (!emptyCell) return true

    const [row, col] = emptyCell
    const shuffled = this.shuffleArray([...numbers])

    for (const num of shuffled) {
      if (this.isValidPlacement(grid, row, col, num)) {
        grid[row][col] = num

        if (this.fillGrid(grid)) {
          return true
        }

        grid[row][col] = 0
      }
    }

    return false
  }

  /**
   * 找空格子（MRV启发式：找候选最少的格子）
   */
  private findEmptyCell(grid: number[][]): [number, number] | null {
    let minCount = Infinity
    let bestCell: [number, number] | null = null

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (grid[row][col] === 0) {
          const count = this.countCandidates(grid, row, col)
          if (count < minCount) {
            minCount = count
            bestCell = [row, col]
          }
          // 快速路径：只有1个候选直接返回
          if (minCount === 1) return bestCell
        }
      }
    }

    return bestCell
  }

  /**
   * 计算某个格子的候选数数量
   */
  private countCandidates(grid: number[][], row: number, col: number): number {
    let count = 0
    for (let num = 1; num <= this.size; num++) {
      if (this.isValidPlacement(grid, row, col, num)) {
        count++
      }
    }
    return count
  }

  /**
   * 检查数字放置是否有效
   */
  isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
    // 检查行
    for (let c = 0; c < this.size; c++) {
      if (grid[row][c] === num) return false
    }

    // 检查列
    for (let r = 0; r < this.size; r++) {
      if (grid[r][col] === num) return false
    }

    // 检查宫格（仅 size=9 时严格检查，size=27 时宫格仅作视觉参考）
    if (this.size === 9) {
      const boxRowStart = Math.floor(row / this.boxSize) * this.boxSize
      const boxColStart = Math.floor(col / this.boxSize) * this.boxSize

      for (let r = boxRowStart; r < boxRowStart + this.boxSize; r++) {
        for (let c = boxColStart; c < boxColStart + this.boxSize; c++) {
          if (grid[r][c] === num) return false
        }
      }
    }

    return true
  }

  /**
   * 根据难度生成题目
   */
  generatePuzzle(level: DifficultyLevel): Puzzle {
    const solution = this.generateSolution()
    const puzzle = solution.map(row => [...row])

    // 根据难度决定移除比例
    let removeRatio: number
    switch (level) {
      case 'easy':
        removeRatio = 0.3  // 移除 30%
        break
      case 'medium':
        removeRatio = 0.5  // 移除 50%
        break
      case 'hard':
        removeRatio = 0.7  // 移除 70%
        break
    }

    const totalCells = this.size * this.size
    const cellsToRemove = Math.floor(totalCells * removeRatio)

    // 随机移除数字
    const positions = this.getAllPositions()
    const shuffledPositions = this.shuffleArray(positions)

    let removed = 0
    for (const [row, col] of shuffledPositions) {
      if (removed >= cellsToRemove) break
      puzzle[row][col] = 0
      removed++
    }

    const puzzleId = `${this.size}-${level}-${Date.now()}`

    return {
      id: puzzleId,
      size: this.size,
      level,
      puzzle,
      solution
    }
  }

  /**
   * 基于种子生成固定题目（用于每日挑战）
   */
  generatePuzzleWithSeed(seed: string, level: DifficultyLevel): Puzzle {
    // 用种子初始化随机数生成器
    this.setSeed(seed)

    const solution = this.generateSolution()
    const puzzle = solution.map(row => [...row])

    let removeRatio: number
    switch (level) {
      case 'easy':
        removeRatio = 0.3
        break
      case 'medium':
        removeRatio = 0.5
        break
      case 'hard':
        removeRatio = 0.7
        break
    }

    const totalCells = this.size * this.size
    const cellsToRemove = Math.floor(totalCells * removeRatio)

    const positions = this.getAllPositions()
    const shuffledPositions = this.shuffleArray(positions)

    let removed = 0
    for (const [row, col] of shuffledPositions) {
      if (removed >= cellsToRemove) break
      puzzle[row][col] = 0
      removed++
    }

    const puzzleId = `daily-${seed}-${this.size}-${level}`

    // 重置随机种子
    this.resetSeed()

    return {
      id: puzzleId,
      size: this.size,
      level,
      puzzle,
      solution
    }
  }

  // 种子随机数相关
  private seedValue: number = 0
  private useSeed: boolean = false

  private setSeed(seed: string): void {
    this.seedValue = this.hashString(seed)
    this.useSeed = true
  }

  private resetSeed(): void {
    this.useSeed = false
  }

  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  private seededRandom(): number {
    this.seedValue = (this.seedValue * 9301 + 49297) % 233280
    return this.seedValue / 233280
  }

  /**
   * 获取所有格子位置
   */
  private getAllPositions(): [number, number][] {
    const positions: [number, number][] = []
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        positions.push([row, col])
      }
    }
    return positions
  }

  /**
   * 随机打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.useSeed
        ? Math.floor(this.seededRandom() * (i + 1))
        : Math.floor(Math.random() * (i + 1))
      const temp = result[i]
      result[i] = result[j]
      result[j] = temp
    }
    return result
  }

  /**
   * 将数字网格转换为Cell网格
   */
  createCellGrid(puzzle: number[][]): Cell[][] {
    return puzzle.map((row, rowIndex) =>
      row.map((value, colIndex) => ({
        value: value === 0 ? null : value,
        fixed: value !== 0,
        notes: [],
        error: false,
        row: rowIndex,
        col: colIndex,
        box: this.getBoxIndex(rowIndex, colIndex)
      }))
    )
  }

  /**
   * 检查是否完成（使用数独规则验证，而非与单一solution比较）
   * 验证条件：
   * 1. 所有格子都有值（没有空格）
   * 2. 每行包含 1-size 各一次
   * 3. 每列包含 1-size 各一次
   * 4. 每个宫格包含 1-size 各一次（size > 3时）
   */
  checkComplete(grid: Cell[][]): boolean {
    const size = this.size
    const numbers = this.getNumberRange()

    // 检查每行
    for (let row = 0; row < size; row++) {
      const rowValues = new Set<number>()
      for (let col = 0; col < size; col++) {
        const val = grid[row][col].value
        if (val === null) return false
        rowValues.add(val)
      }
      for (const num of numbers) {
        if (!rowValues.has(num)) return false
      }
    }

    // 检查每列
    for (let col = 0; col < size; col++) {
      const colValues = new Set<number>()
      for (let row = 0; row < size; row++) {
        colValues.add(grid[row][col].value!)
      }
      for (const num of numbers) {
        if (!colValues.has(num)) return false
      }
    }

    // 检查每个宫格（只有 9×9 和 27×27 有宫格概念）
    if (size > 3) {
      const boxesPerRow = size / this.boxSize
      for (let boxRow = 0; boxRow < boxesPerRow; boxRow++) {
        for (let boxCol = 0; boxCol < boxesPerRow; boxCol++) {
          const boxValues = new Set<number>()
          const startRow = boxRow * this.boxSize
          const startCol = boxCol * this.boxSize
          for (let r = startRow; r < startRow + this.boxSize; r++) {
            for (let c = startCol; c < startCol + this.boxSize; c++) {
              boxValues.add(grid[r][c].value!)
            }
          }
          for (const num of numbers) {
            if (!boxValues.has(num)) return false
          }
        }
      }
    }

    return true
  }

  /**
   * 获取提示（返回一个空格子的正确答案）
   */
  getHint(grid: Cell[][], solution: number[][]): { row: number; col: number; value: number } | null {
    const emptyCells: { row: number; col: number; value: number }[] = []

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (grid[row][col].value === null || grid[row][col].value !== solution[row][col]) {
          emptyCells.push({ row, col, value: solution[row][col] })
        }
      }
    }

    if (emptyCells.length === 0) return null

    const randomIndex = this.useSeed
      ? Math.floor(this.seededRandom() * emptyCells.length)
      : Math.floor(Math.random() * emptyCells.length)

    return emptyCells[randomIndex]
  }
}
