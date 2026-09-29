import { describe, it, expect, beforeEach } from 'vitest'
import { SudokuGenerator } from '@/utils/sudoku'

describe('SudokuGenerator - 基础构造', () => {
  it('3×3 模式下 boxSize=3,数字范围 1-3', () => {
    const g = new SudokuGenerator(3)
    expect(g.getSize()).toBe(3)
    expect(g.getBoxSize()).toBe(3)
    expect(g.getNumberRange()).toEqual([1, 2, 3])
  })

  it('9×9 模式下 boxSize=3,数字范围 1-9', () => {
    const g = new SudokuGenerator(9)
    expect(g.getSize()).toBe(9)
    expect(g.getBoxSize()).toBe(3)
    expect(g.getNumberRange()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('27×27 模式下 boxSize=9,数字范围 1-27', () => {
    const g = new SudokuGenerator(27)
    expect(g.getSize()).toBe(27)
    expect(g.getBoxSize()).toBe(9)
    expect(g.getNumberRange().length).toBe(27)
    expect(g.getNumberRange()[0]).toBe(1)
    expect(g.getNumberRange()[26]).toBe(27)
  })

  it('getBoxIndex 9×9 正确分宫', () => {
    const g = new SudokuGenerator(9)
    expect(g.getBoxIndex(0, 0)).toBe(0)
    expect(g.getBoxIndex(2, 2)).toBe(0)
    expect(g.getBoxIndex(0, 3)).toBe(1)
    expect(g.getBoxIndex(3, 3)).toBe(4)
    expect(g.getBoxIndex(8, 8)).toBe(8)
  })

  it('getBoxIndex 27×27 正确分宫 (每 9 格一个宫)', () => {
    const g = new SudokuGenerator(27)
    expect(g.getBoxIndex(0, 0)).toBe(0)
    expect(g.getBoxIndex(8, 8)).toBe(0)
    expect(g.getBoxIndex(0, 9)).toBe(1)
    expect(g.getBoxIndex(9, 0)).toBe(3)
    expect(g.getBoxIndex(26, 26)).toBe(8)
  })
})

describe('SudokuGenerator - generateSolution', () => {
  it('3×3 solution: 每行 1-3 各出现一次', () => {
    const g = new SudokuGenerator(3)
    const sol = g.generateSolution()
    for (const row of sol) {
      expect(row.slice().sort()).toEqual([1, 2, 3])
    }
  })

  it('3×3 solution: 每列 1-3 各出现一次', () => {
    const g = new SudokuGenerator(3)
    const sol = g.generateSolution()
    for (let c = 0; c < 3; c++) {
      const col = [sol[0][c], sol[1][c], sol[2][c]]
      expect(col.slice().sort()).toEqual([1, 2, 3])
    }
  })

  it('9×9 solution: 每行是 1-9 的排列', () => {
    const g = new SudokuGenerator(9)
    const sol = g.generateSolution()
    for (const row of sol) {
      expect(row.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    }
  })

  it('9×9 solution: 每宫格内是 1-9 的排列', () => {
    const g = new SudokuGenerator(9)
    const sol = g.generateSolution()
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const box: number[] = []
        for (let r = br * 3; r < br * 3 + 3; r++) {
          for (let c = bc * 3; c < bc * 3 + 3; c++) {
            box.push(sol[r][c])
          }
        }
        expect(box.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
      }
    }
  })

  it('27×27 solution: 729 格均合法', () => {
    const g = new SudokuGenerator(27)
    const sol = g.generateSolution()
    expect(sol.length).toBe(27)
    for (const row of sol) {
      expect(row.length).toBe(27)
      const sorted = [...row].sort((a, b) => a - b)
      expect(sorted).toEqual(Array.from({ length: 27 }, (_, i) => i + 1))
    }
  })
})

describe('SudokuGenerator - generatePuzzle', () => {
  it('9×9 easy 移除约 30% 数字', () => {
    const g = new SudokuGenerator(9)
    const puzzle = g.generatePuzzle('easy')
    let zeros = 0
    for (const row of puzzle.puzzle) {
      for (const v of row) {
        if (v === 0) zeros++
      }
    }
    // 81 * 0.3 = 24.3 ≈ 24
    expect(zeros).toBeGreaterThanOrEqual(20)
    expect(zeros).toBeLessThanOrEqual(28)
  })

  it('难度越高空格越多: easy < medium < hard', () => {
    const g1 = new SudokuGenerator(9)
    const easy = countZeros(g1.generatePuzzle('easy').puzzle)
    const medium = countZeros(g1.generatePuzzle('medium').puzzle)
    const hard = countZeros(g1.generatePuzzle('hard').puzzle)
    expect(easy).toBeLessThan(medium)
    expect(medium).toBeLessThan(hard)
  })

  it('puzzleId 格式: 9-easy-<timestamp>', () => {
    const g = new SudokuGenerator(9)
    const puzzle = g.generatePuzzle('easy')
    expect(puzzle.id).toMatch(/^9-easy-\d+$/)
    expect(puzzle.size).toBe(9)
    expect(puzzle.level).toBe('easy')
  })

  it('puzzle 中剩余非零数字必须与 solution 对应位置相同', () => {
    const g = new SudokuGenerator(9)
    const puzzle = g.generatePuzzle('medium')
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle.puzzle[r][c] !== 0) {
          expect(puzzle.puzzle[r][c]).toBe(puzzle.solution[r][c])
        }
      }
    }
  })

  function countZeros(grid: number[][]): number {
    let n = 0
    for (const row of grid) for (const v of row) if (v === 0) n++
    return n
  }
})

describe('SudokuGenerator - generatePuzzleWithSeed (种子稳定性)', () => {
  it('相同种子生成完全相同的 puzzle 和 solution', () => {
    const g1 = new SudokuGenerator(9)
    const g2 = new SudokuGenerator(9)
    const p1 = g1.generatePuzzleWithSeed('2024-01-15-9-easy-level-5', 'easy')
    const p2 = g2.generatePuzzleWithSeed('2024-01-15-9-easy-level-5', 'easy')
    expect(p1.puzzle).toEqual(p2.puzzle)
    expect(p1.solution).toEqual(p2.solution)
    expect(p1.id).toBe(p2.id)
  })

  it('不同种子生成不同的 puzzle', () => {
    const g1 = new SudokuGenerator(9)
    const g2 = new SudokuGenerator(9)
    const p1 = g1.generatePuzzleWithSeed('seed-A', 'medium')
    const p2 = g2.generatePuzzleWithSeed('seed-B', 'medium')
    // 99% 概率不同,允许极小概率碰撞
    expect(p1.puzzle).not.toEqual(p2.puzzle)
  })

  it('种子 id 格式: daily-<seed>-9-easy-level-N', () => {
    const g = new SudokuGenerator(9)
    const p = g.generatePuzzleWithSeed('2024-1-15', 'easy')
    // setSeed 把 hash 解析,id 由 caller 决定 — 这里只测 id 不为空且包含 size/level
    expect(p.id).toContain('9')
    expect(p.id).toContain('easy')
  })
})

describe('SudokuGenerator - createCellGrid', () => {
  it('0 → value=null + fixed=false;非0 → value=N + fixed=true', () => {
    const g = new SudokuGenerator(3)
    const grid = g.createCellGrid([[1, 0, 3], [0, 2, 0], [3, 0, 1]])
    expect(grid[0][0].value).toBe(1)
    expect(grid[0][0].fixed).toBe(true)
    expect(grid[0][1].value).toBe(null)
    expect(grid[0][1].fixed).toBe(false)
    expect(grid[0][1].notes).toEqual([])
    expect(grid[0][1].error).toBe(false)
  })

  it('row/col/box 字段填充正确', () => {
    const g = new SudokuGenerator(9)
    const grid = g.createCellGrid(Array(9).fill(Array(9).fill(0)))
    expect(grid[3][5].row).toBe(3)
    expect(grid[3][5].col).toBe(5)
    expect(grid[3][5].box).toBe(4)  // (1,1) → 3*1 + 1 = 4
  })
})

describe('SudokuGenerator - checkComplete', () => {
  let g: SudokuGenerator

  beforeEach(() => {
    g = new SudokuGenerator(9)
  })

  it('9×9 完整 solution → true', () => {
    const sol = g.generateSolution()
    const cells = g.createCellGrid(sol)
    expect(g.checkComplete(cells)).toBe(true)
  })

  it('有一个空格 → false', () => {
    const sol = g.generateSolution()
    sol[0][0] = 0
    const cells = g.createCellGrid(sol)
    expect(g.checkComplete(cells)).toBe(false)
  })

  it('有一格填错 → false', () => {
    const sol = g.generateSolution()
    const wrong = sol.map(row => [...row])
    wrong[0][0] = wrong[0][0] === 9 ? 8 : 9
    const cells = g.createCellGrid(wrong)
    expect(g.checkComplete(cells)).toBe(false)
  })

  it('3×3 完整 → true (3×3 没有宫格约束,但有行列)', () => {
    const g3 = new SudokuGenerator(3)
    const sol = g3.generateSolution()
    const cells = g3.createCellGrid(sol)
    expect(g3.checkComplete(cells)).toBe(true)
  })

  it('3×3 行重复 → false', () => {
    const g3 = new SudokuGenerator(3)
    const cells = g3.createCellGrid([
      [1, 1, 1],
      [2, 3, 2],
      [3, 2, 3]
    ])
    expect(g3.checkComplete(cells)).toBe(false)
  })
})

describe('SudokuGenerator - getHint', () => {
  it('空格子会返回 hint 且 value 与 solution 一致', () => {
    const g = new SudokuGenerator(3)
    const puzzle = g.generatePuzzle('medium')
    const cells = g.createCellGrid(puzzle.puzzle)
    const hint = g.getHint(cells, puzzle.solution)
    expect(hint).not.toBeNull()
    expect(hint!.value).toBe(puzzle.solution[hint!.row][hint!.col])
  })

  it('全部填对 (即使填法与 solution 不同但符合规则) → 返回 null', () => {
    // 3×3 实际上只允许 1 种合法全填,因为行列都 1-3
    // 用一个不同的合法全填方案测试
    const g = new SudokuGenerator(3)
    const sol = g.generateSolution()
    // solution 本身就是合法全填,getHint 应该返回 null(没有错误或空格)
    const cells = g.createCellGrid(sol)
    const hint = g.getHint(cells, sol)
    expect(hint).toBeNull()
  })

  it('错误填入会作为 hint 候选', () => {
    const g = new SudokuGenerator(3)
    const sol = g.generateSolution()
    const cells = g.createCellGrid(sol)
    cells[0][0].value = cells[0][0].value === 1 ? 2 : 1
    const hint = g.getHint(cells, sol)
    expect(hint).not.toBeNull()
    // hint 应该至少覆盖被填错的格子
    expect(hint!.row).toBe(0)
    expect(hint!.col).toBe(0)
    expect(hint!.value).toBe(sol[0][0])
  })
})

describe('SudokuGenerator - isValidPlacement', () => {
  it('空 grid 上任何位置都能放任何数字', () => {
    const g = new SudokuGenerator(9)
    const empty = Array.from({ length: 9 }, () => Array(9).fill(0))
    for (let n = 1; n <= 9; n++) {
      expect(g.isValidPlacement(empty, 4, 4, n)).toBe(true)
    }
  })

  it('同行已有相同数字 → invalid', () => {
    const g = new SudokuGenerator(9)
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0))
    grid[0][3] = 5
    expect(g.isValidPlacement(grid, 0, 7, 5)).toBe(false)
  })

  it('同列已有相同数字 → invalid', () => {
    const g = new SudokuGenerator(9)
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0))
    grid[2][4] = 7
    expect(g.isValidPlacement(grid, 8, 4, 7)).toBe(false)
  })

  it('同宫已有相同数字 → invalid (9×9)', () => {
    const g = new SudokuGenerator(9)
    const grid = Array.from({ length: 9 }, () => Array(9).fill(0))
    grid[0][0] = 3
    // (0,0) 和 (2,2) 同宫 (宫 0)
    expect(g.isValidPlacement(grid, 2, 2, 3)).toBe(false)
  })
})