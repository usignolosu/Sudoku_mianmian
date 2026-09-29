// 27×27 棋盘的平移 / 缩放视口 —— 需求 §13
//
// 27 格棋盘在手机上放不下,需要:
//   1. 拖拽浏览(单指平移)
//   2. 双指缩放
//   3. 小地图点击快速跳转
//
// 这里只做纯计算,不碰 DOM,便于单元测试。

export interface ViewportState {
  /** 水平平移偏移(px) */
  x: number
  /** 垂直平移偏移(px) */
  y: number
  /** 缩放比例 */
  scale: number
}

export interface PanZoomOptions {
  /** 棋盘原始尺寸(px) */
  baseWidth: number
  /** 棋盘原始尺寸(px) */
  baseHeight: number
  /** 视口尺寸(px) */
  viewportWidth: number
  viewportHeight: number
  /** 最小缩放 */
  minScale?: number
  /** 最大缩放 */
  maxScale?: number
}

export const DEFAULT_MIN_SCALE = 0.35
export const DEFAULT_MAX_SCALE = 2.4

/**
 * 夹紧偏移量,保证棋盘始终有一部分留在视口内,
 * 且不会拖到完全看不见的地方。
 */
export function clampOffset(
  offset: number,
  baseSize: number,
  viewportSize: number,
  scale: number
): number {
  const rendered = baseSize * scale
  if (rendered <= viewportSize) return (viewportSize - rendered) / 2
  const maxOffset = rendered - viewportSize
  return Math.min(0, Math.max(-maxOffset, offset))
}

/** 夹紧缩放比例 */
export function clampScale(scale: number, min = DEFAULT_MIN_SCALE, max = DEFAULT_MAX_SCALE): number {
  return Math.min(max, Math.max(min, scale))
}

/**
 * 以某个点为锚点缩放。
 * 缩放时锚点下的内容应保持不动,否则手感会「飘」。
 */
export function zoomAtPoint(
  state: ViewportState,
  factor: number,
  anchorX: number,
  anchorY: number,
  opts: PanZoomOptions
): ViewportState {
  const min = opts.minScale ?? DEFAULT_MIN_SCALE
  const max = opts.maxScale ?? DEFAULT_MAX_SCALE

  const nextScale = clampScale(state.scale * factor, min, max)
  // 缩放比例为 1 时坐标不变
  const ratio = nextScale / state.scale

  const rawX = anchorX - (anchorX - state.x) * ratio
  const rawY = anchorY - (anchorY - state.y) * ratio

  return {
    scale: nextScale,
    x: clampOffset(rawX, opts.baseWidth, opts.viewportWidth, nextScale),
    y: clampOffset(rawY, opts.baseHeight, opts.viewportHeight, nextScale)
  }
}

/** 平移指定距离并夹紧 */
export function panBy(
  state: ViewportState,
  dx: number,
  dy: number,
  opts: PanZoomOptions
): ViewportState {
  const nextX = state.x + dx
  const nextY = state.y + dy
  return {
    scale: state.scale,
    x: clampOffset(nextX, opts.baseWidth, opts.viewportWidth, state.scale),
    y: clampOffset(nextY, opts.baseHeight, opts.viewportHeight, state.scale)
  }
}

/**
 * 把 (row, col) 单元格居中显示 —— 小地图点击跳转用
 */
export function jumpToCell(
  state: ViewportState,
  row: number,
  col: number,
  gridSize: number,
  opts: PanZoomOptions
): ViewportState {
  const cellW = opts.baseWidth / gridSize
  const cellH = opts.baseHeight / gridSize
  const cellCenterX = (col + 0.5) * cellW
  const cellCenterY = (row + 0.5) * cellH

  // 要让单元格中心落在视口中心,偏移量 = 视口中心 - 内容中心(乘以缩放)
  const rawX = opts.viewportWidth / 2 - cellCenterX * state.scale
  const rawY = opts.viewportHeight / 2 - cellCenterY * state.scale

  return {
    scale: state.scale,
    x: clampOffset(rawX, opts.baseWidth, opts.viewportWidth, state.scale),
    y: clampOffset(rawY, opts.baseHeight, opts.viewportHeight, state.scale)
  }
}

/** 当前视口在棋盘内容坐标系中的矩形(小地图高亮框用) */
export function visibleRect(
  state: ViewportState,
  gridSize: number,
  opts: PanZoomOptions
): { rowStart: number; rowEnd: number; colStart: number; colEnd: number } {
  const cellW = opts.baseWidth / gridSize
  const cellH = opts.baseHeight / gridSize

  // 视口左上角对应的棋盘坐标
  const originX = -state.x / state.scale
  const originY = -state.y / state.scale

  const colStart = Math.max(0, Math.floor(originX / cellW))
  const rowStart = Math.max(0, Math.floor(originY / cellH))
  const colEnd = Math.min(gridSize, Math.ceil((originX + opts.viewportWidth / state.scale) / cellW))
  const rowEnd = Math.min(gridSize, Math.ceil((originY + opts.viewportHeight / state.scale) / cellH))

  return { rowStart, rowEnd, colStart, colEnd }
}

/** 初始视口:棋盘小于视口时居中,否则从左上角开始 */
export function initialViewport(opts: PanZoomOptions): ViewportState {
  const min = opts.minScale ?? DEFAULT_MIN_SCALE
  const max = opts.maxScale ?? DEFAULT_MAX_SCALE

  // 自动选一个能看全的缩放,但不低于 minScale
  const fitX = opts.viewportWidth / opts.baseWidth
  const fitY = opts.viewportHeight / opts.baseHeight
  const fit = Math.min(fitX, fitY)
  const scale = clampScale(Math.min(1, fit), min, max)

  return {
    scale,
    x: clampOffset(0, opts.baseWidth, opts.viewportWidth, scale),
    y: clampOffset(0, opts.baseHeight, opts.viewportHeight, scale)
  }
}

/** 重置到初始视口 */
export function resetViewport(opts: PanZoomOptions): ViewportState {
  return initialViewport(opts)
}

/** 应用到 DOM 的 transform 字符串 */
export function toTransform(state: ViewportState): string {
  return `translate(${state.x}px, ${state.y}px) scale(${state.scale})`
}

/**
 * 从两次 touch 事件计算捏合缩放参数
 * 纯函数,便于测试:返回新的视口状态
 */
export function applyPinch(
  state: ViewportState,
  prevDistance: number,
  nextDistance: number,
  anchorX: number,
  anchorY: number,
  opts: PanZoomOptions
): { state: ViewportState; distance: number } {
  if (prevDistance <= 0) return { state, distance: nextDistance }
  const factor = nextDistance / prevDistance
  return {
    state: zoomAtPoint(state, factor, anchorX, anchorY, opts),
    distance: nextDistance
  }
}

/** 两点间距离 */
export function touchDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** 两点中点(捏合锚点) */
export function touchCenter(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
