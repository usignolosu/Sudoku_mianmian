import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, enableAutoUnmount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SudokuBoard from '@/components/SudokuBoard.vue'
import type { Cell } from '@/types'

/**
 * SudokuBoard.vue 组件测试
 * 覆盖渲染 / 点击 / 高亮类 / 笔记模式 / 错误标红
 */


// 自动卸载: 防止遗留组件的 watch 继续触发副作用,污染共享 store
enableAutoUnmount(afterEach)

function makeEmptyGrid(size: number): Cell[][] {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ({
      value: null as number | null,
      fixed: false,
      notes: [] as number[],
      error: false,
      row: r,
      col: c,
      box: Math.floor(r / 3) * 3 + Math.floor(c / 3)
    }))
  )
}

function makeGridWithValues(size: number, mapping: Record<string, number>): Cell[][] {
  return makeEmptyGrid(size).map(row =>
    row.map(cell => {
      const k = `${cell.row}-${cell.col}`
      if (mapping[k] !== undefined) {
        return { ...cell, value: mapping[k], fixed: true }
      }
      return cell
    })
  )
}

describe('SudokuBoard - 渲染', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('3×3 渲染 9 个格子', () => {
    const grid = makeEmptyGrid(3)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.findAll('.sudoku-cell').length).toBe(9)
  })

  it('9×9 渲染 81 个格子', () => {
    const grid = makeEmptyGrid(9)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 9, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.findAll('.sudoku-cell').length).toBe(81)
  })

  it('27×27 渲染 729 个格子', () => {
    const grid = makeEmptyGrid(27)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 27, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.findAll('.sudoku-cell').length).toBe(729)
  })

  it('grid 为空时显示加载提示', () => {
    const wrapper = mount(SudokuBoard, {
      props: { grid: null, size: 9, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.find('.board-loading').exists()).toBe(true)
    expect(wrapper.text()).toContain('加载中')
  })

  it('value 不为 null 时显示数字', () => {
    const grid = makeGridWithValues(3, { '0-0': 5 })
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.text()).toContain('5')
  })

  it('value 为 null 且无 notes 时显示空白', () => {
    const grid = makeEmptyGrid(3)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    // 第一个格子的 value 和 notes 都为空
    expect(cells[0].find('.cell-value').exists()).toBe(false)
    expect(cells[0].find('.cell-notes').exists()).toBe(false)
  })

  it('size 应用正确样式类', () => {
    const grid = makeEmptyGrid(9)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 9, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    expect(wrapper.find('.sudoku-board').classes()).toContain('size-9')
  })
})

describe('SudokuBoard - 点击', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('点击格子触发 cell-click 事件携带 row/col', async () => {
    const grid = makeEmptyGrid(3)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    await cells[4].trigger('click')
    expect(wrapper.emitted('cell-click')?.[0]).toEqual([1, 1])  // 4 = row 1 * 3 + col 1
  })

  it('多次点击触发多次事件', async () => {
    const grid = makeEmptyGrid(3)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    await cells[0].trigger('click')
    await cells[5].trigger('click')
    expect(wrapper.emitted('cell-click')?.length).toBe(2)
  })
})

describe('SudokuBoard - 选中态 / 高亮态 / fixed', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('selectedCell 匹配时加 .selected 类', () => {
    const grid = makeEmptyGrid(3)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: { row: 0, col: 1 }, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    expect(cells[1].classes()).toContain('selected')
    expect(cells[0].classes()).not.toContain('selected')
  })

  it('highlightedCells 中的格子加 .highlighted 类', () => {
    const grid = makeEmptyGrid(3)
    const highlighted = new Set(['0-0', '0-1', '0-2'])
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: highlighted, showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    expect(cells[0].classes()).toContain('highlighted')
    expect(cells[1].classes()).toContain('highlighted')
    expect(cells[2].classes()).toContain('highlighted')
    expect(cells[3].classes()).not.toContain('highlighted')
  })

  it('cell.fixed=true 时显示 .fixed 类', () => {
    const grid = makeGridWithValues(3, { '0-0': 1 })
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    expect(cells[0].classes()).toContain('fixed')
  })

  it('showError=true 且 cell.error=true 时显示 .error 类', () => {
    const grid = makeEmptyGrid(3)
    grid[0][1].value = 5
    grid[0][1].error = true
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    expect(cells[1].classes()).toContain('error')
  })

  it('showError=false 时 cell.error=true 不显示 .error 类 (Bug#1 验证)', () => {
    const grid = makeEmptyGrid(3)
    grid[0][1].value = 5
    grid[0][1].error = true
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: false }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    expect(cells[1].classes()).not.toContain('error')
  })

  it('fixed 格子的数字加粗 (.is-fixed)', () => {
    const grid = makeGridWithValues(3, { '0-0': 5 })
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const fixedCell = wrapper.findAll('.sudoku-cell')[0]
    const value = fixedCell.find('.cell-value')
    expect(value.classes()).toContain('is-fixed')
  })
})

describe('SudokuBoard - 笔记模式', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('cell.notes 不为空时显示笔记候选', () => {
    const grid = makeEmptyGrid(3)
    grid[0][0].notes = [1, 3]
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cell = wrapper.findAll('.sudoku-cell')[0]
    expect(cell.find('.cell-notes').exists()).toBe(true)
    const noteNumbers = cell.findAll('.note-number')
    expect(noteNumbers.length).toBe(3)  // size=3 笔记范围 1-3
  })

  it('笔记中标记的数字显示,其他为空', () => {
    const grid = makeEmptyGrid(3)
    grid[0][0].notes = [1, 3]
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cell = wrapper.findAll('.sudoku-cell')[0]
    const noteNumbers = cell.findAll('.note-number')
    const has1 = noteNumbers.find(n => n.text() === '1')
    const has2 = noteNumbers.find(n => n.text() === '2')
    const has3 = noteNumbers.find(n => n.text() === '3')
    expect(has1?.classes()).toContain('has-note')
    expect(has2).toBeUndefined()  // 空字符串不渲染 text,但 element 存在
    expect(has3?.classes()).toContain('has-note')
  })

  it('value 优先于 notes (有 value 时不显示 notes)', () => {
    const grid = makeEmptyGrid(3)
    grid[0][0].value = 5
    grid[0][0].notes = [1, 2, 3]
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cell = wrapper.findAll('.sudoku-cell')[0]
    expect(cell.find('.cell-value').exists()).toBe(true)
    expect(cell.find('.cell-notes').exists()).toBe(false)
  })

  it('27×27 不显示笔记 (避免 729 个小数字)', () => {
    const grid = makeEmptyGrid(27)
    grid[0][0].notes = [1, 5, 10]
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 27, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cell = wrapper.findAll('.sudoku-cell')[0]
    // 27×27 noteNumbers=[],所以 cell-notes 内部没有 .note-number 子元素
    expect(cell.findAll('.note-number').length).toBe(0)
  })
})

describe('SudokuBoard - 宫格边界 (box-right/box-bottom)', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('9×9 在 (col+1)%3===0 处加 .box-right', () => {
    const grid = makeEmptyGrid(9)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 9, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    // col=2 是每宫格最右列,且 col<size-1 (2<8)
    expect(cells[2].classes()).toContain('box-right')
    // col=5 也是宫格右边界
    expect(cells[5].classes()).toContain('box-right')
    // col=8 是最右列,不画 box-right (避免最右也加粗)
    expect(cells[8].classes()).not.toContain('box-right')
  })

  it('9×9 在 (row+1)%3===0 且不是最底行处加 .box-bottom', () => {
    const grid = makeEmptyGrid(9)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 9, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    // row=2, col=0
    expect(cells[2 * 9 + 0].classes()).toContain('box-bottom')
    // row=5, col=0
    expect(cells[5 * 9 + 0].classes()).toContain('box-bottom')
    // row=8 不画 box-bottom
    expect(cells[8 * 9 + 0].classes()).not.toContain('box-bottom')
  })

  it('27×27 宫格边界按 9 划分', () => {
    const grid = makeEmptyGrid(27)
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 27, selectedCell: null, highlightedCells: new Set(), showError: true }
    })
    const cells = wrapper.findAll('.sudoku-cell')
    // col=8 是每宫最右列 (boxSize=9 for 27×27)
    expect(cells[8].classes()).toContain('box-right')
    expect(cells[17].classes()).toContain('box-right')
    expect(cells[26].classes()).not.toContain('box-right')  // 最右
  })
})

describe('SudokuBoard - 多状态叠加', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('同一格子可以同时有 .fixed 和 .highlighted', () => {
    const grid = makeGridWithValues(3, { '0-0': 1 })
    const wrapper = mount(SudokuBoard, {
      props: { grid, size: 3, selectedCell: null, highlightedCells: new Set(['0-0']), showError: true }
    })
    const cell = wrapper.findAll('.sudoku-cell')[0]
    expect(cell.classes()).toContain('fixed')
    expect(cell.classes()).toContain('highlighted')
  })
})