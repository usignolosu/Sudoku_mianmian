import { describe, it, expect } from 'vitest'
import {
  clampOffset,
  clampScale,
  zoomAtPoint,
  panBy,
  jumpToCell,
  visibleRect,
  initialViewport,
  resetViewport,
  toTransform,
  applyPinch,
  touchDistance,
  touchCenter,
  DEFAULT_MIN_SCALE,
  DEFAULT_MAX_SCALE,
  type PanZoomOptions,
  type ViewportState
} from '@/utils/panZoom'

/**
 * 27×27 平移/缩放视口的纯逻辑测试
 * 不依赖 DOM,可完整覆盖边界条件
 */

// 27×27 棋盘在手机上:棋盘 810px,视口 375×400
const OPTS: PanZoomOptions = {
  baseWidth: 810,
  baseHeight: 810,
  viewportWidth: 375,
  viewportHeight: 400
}

// 小棋盘(3×3 180px)完全放得下
const SMALL_OPTS: PanZoomOptions = {
  baseWidth: 180,
  baseHeight: 180,
  viewportWidth: 375,
  viewportHeight: 600
}

const ZERO: ViewportState = { x: 0, y: 0, scale: 1 }

describe('clampScale', () => {
  it('限制在最小/最大值之间', () => {
    expect(clampScale(0.01)).toBe(DEFAULT_MIN_SCALE)
    expect(clampScale(100)).toBe(DEFAULT_MAX_SCALE)
    expect(clampScale(1.5)).toBe(1.5)
  })

  it('支持自定义边界', () => {
    expect(clampScale(5, 1, 2)).toBe(2)
    expect(clampScale(0.5, 1, 2)).toBe(1)
  })
})

describe('clampOffset', () => {
  it('棋盘小于视口时居中', () => {
    // 180 * 1 = 180 < 视口 375 → 居中偏移 (375-180)/2 = 97.5
    expect(clampOffset(0, 180, 375, 1)).toBeCloseTo(97.5)
  })

  it('棋盘大于视口时限制在可见范围内', () => {
    // 810*1 = 810 > 375,允许范围 [-435, 0](0 表示贴左边,负值表示左移)
    expect(clampOffset(-99999, 810, 375, 1)).toBe(-435)  // 拖过头 → 贴到最左
    expect(clampOffset(99999, 810, 375, 1)).toBe(0)      // 拖过头 → 回到最右
  })

  it('缩放后边界随之变化', () => {
    // scale 2 → 1620,允许范围 [-1245, 0]
    expect(clampOffset(-99999, 810, 375, 2)).toBe(-1245)
    expect(clampOffset(99999, 810, 375, 2)).toBe(0)
  })
})

describe('initialViewport', () => {
  it('大棋盘:自动缩小到能看全,并贴左上', () => {
    const v = initialViewport(OPTS)
    // 375/810 = 0.46,取 fit 与 1 的较小值
    expect(v.scale).toBeCloseTo(0.4629, 3)
    expect(v.scale).toBeGreaterThan(DEFAULT_MIN_SCALE)
  })

  it('小棋盘:保持 scale 1 并居中', () => {
    const v = initialViewport(SMALL_OPTS)
    expect(v.scale).toBe(1)
    expect(v.x).toBeCloseTo(97.5)
  })

  it('不会低于 minScale', () => {
    const tiny: PanZoomOptions = { baseWidth: 5000, baseHeight: 5000, viewportWidth: 375, viewportHeight: 400 }
    const v = initialViewport(tiny)
    expect(v.scale).toBeGreaterThanOrEqual(DEFAULT_MIN_SCALE)
  })

  it('resetViewport 等同于 initialViewport', () => {
    expect(resetViewport(OPTS)).toEqual(initialViewport(OPTS))
  })
})

describe('panBy 拖拽平移', () => {
  it('向右下拖动,偏移量随之变化', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const next = panBy(start, -50, -30, OPTS)
    expect(next.x).toBe(-50)
    expect(next.y).toBe(-30)
    expect(next.scale).toBe(1)
  })

  it('超出边界时被夹紧', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const next = panBy(start, -99999, -99999, OPTS)
    // x 方向:810-375=435;y 方向:810-400=410(视口高度不同,边界也不同)
    expect(next.x).toBe(-435)
    expect(next.y).toBe(-410)
  })

  it('不改变缩放比例', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1.5 }
    const next = panBy(start, 10, 10, OPTS)
    expect(next.scale).toBe(1.5)
  })
})

describe('zoomAtPoint 锚点缩放', () => {
  it('以视口中心缩放时,中心点的棋盘坐标保持不变', () => {
    const start: ViewportState = { x: -100, y: -100, scale: 1 }
    const next = zoomAtPoint(start, 2, 187.5, 200, OPTS)
    expect(next.scale).toBe(2)
    // 缩放前后,视口中心对应的棋盘坐标应一致
    const before = (187.5 - start.x) / start.scale
    const after = (187.5 - next.x) / next.scale
    expect(after).toBeCloseTo(before, 3)
  })

  it('缩放后锚点下的内容保持不动', () => {
    // 缩放前后,锚点对应的棋盘坐标应一致
    const start: ViewportState = { x: -100, y: -100, scale: 1 }
    const anchor = { x: 50, y: 60 }
    const contentBefore = {
      x: (anchor.x - start.x) / start.scale,
      y: (anchor.y - start.y) / start.scale
    }
    const next = zoomAtPoint(start, 1.5, anchor.x, anchor.y, OPTS)
    const contentAfter = {
      x: (anchor.x - next.x) / next.scale,
      y: (anchor.y - next.y) / next.scale
    }
    expect(contentAfter.x).toBeCloseTo(contentBefore.x, 3)
    expect(contentAfter.y).toBeCloseTo(contentBefore.y, 3)
  })

  it('缩放被限制在 min/max 之间', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    expect(zoomAtPoint(start, 1000, 0, 0, OPTS).scale).toBe(DEFAULT_MAX_SCALE)
    expect(zoomAtPoint(start, 0.001, 0, 0, OPTS).scale).toBe(DEFAULT_MIN_SCALE)
  })
})

describe('jumpToCell 小地图跳转', () => {
  it('把指定单元格移到视口中心', () => {
    // scale 1 时棋盘大于视口,可以真正居中
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const next = jumpToCell(start, 13, 13, 27, OPTS)
    // 单元格中心 (13.5 * 30) = 405px
    const cellCenter = 13.5 * (OPTS.baseWidth / 27)
    expect(cellCenter * start.scale + next.x).toBeCloseTo(OPTS.viewportWidth / 2, 3)
    expect(cellCenter * start.scale + next.y).toBeCloseTo(OPTS.viewportHeight / 2, 3)
  })

  it('整盘可见时无法居中,保持整盘居中显示', () => {
    // initialViewport 会缩放到刚好能看全,此时 offset 被夹紧为居中值
    const start = initialViewport(OPTS)
    const next = jumpToCell(start, 0, 0, 27, OPTS)
    expect(next.x).toBeCloseTo(0)
    expect(next.y).toBeCloseTo(12.5)
  })

  it('跳转不改变缩放', () => {
    const start: ViewportState = { x: -50, y: -50, scale: 1.3 }
    const next = jumpToCell(start, 5, 5, 27, OPTS)
    expect(next.scale).toBe(1.3)
  })
})

describe('visibleRect 可见区域', () => {
  it('左上角时可见前几行', () => {
    const rect = visibleRect({ x: 0, y: 0, scale: 1 }, 27, OPTS)
    expect(rect.rowStart).toBe(0)
    expect(rect.colStart).toBe(0)
    expect(rect.rowEnd).toBeGreaterThan(0)
    expect(rect.colEnd).toBeGreaterThan(0)
  })

  it('右下角时可见末几行', () => {
    // 拖到最右下
    const state = { x: -435, y: -410, scale: 1 }
    const rect = visibleRect(state, 27, OPTS)
    expect(rect.rowEnd).toBe(27)
    expect(rect.colEnd).toBe(27)
  })

  it('结果不越界', () => {
    const state = { x: 999, y: -999, scale: 0.5 }
    const rect = visibleRect(state, 27, OPTS)
    expect(rect.rowStart).toBeGreaterThanOrEqual(0)
    expect(rect.colStart).toBeGreaterThanOrEqual(0)
    expect(rect.rowEnd).toBeLessThanOrEqual(27)
    expect(rect.colEnd).toBeLessThanOrEqual(27)
  })
})

describe('toTransform', () => {
  it('生成正确的 CSS transform', () => {
    expect(toTransform({ x: 10, y: -20, scale: 1.5 }))
      .toBe('translate(10px, -20px) scale(1.5)')
  })
})

describe('捏合手势', () => {
  it('touchDistance 计算两点距离', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(touchDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0)
  })

  it('touchCenter 计算中点', () => {
    expect(touchCenter({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })

  it('手指张开 → 放大', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const { state } = applyPinch(start, 100, 200, 187, 200, OPTS)
    expect(state.scale).toBeCloseTo(2, 2)
  })

  it('手指收拢 → 缩小', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const { state } = applyPinch(start, 200, 100, 187, 200, OPTS)
    expect(state.scale).toBeCloseTo(0.5, 2)
  })

  it('距离为 0 时不崩', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const { state } = applyPinch(start, 0, 100, 0, 0, OPTS)
    expect(state.scale).toBe(1)
  })

  it('返回新的距离供下一帧对比', () => {
    const start: ViewportState = { x: 0, y: 0, scale: 1 }
    const { distance } = applyPinch(start, 100, 150, 0, 0, OPTS)
    expect(distance).toBe(150)
  })
})
