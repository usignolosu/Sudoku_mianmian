import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 主题变量「接通性」测试
 *
 * 背景:补齐主题变量时,曾经出现 5 个变量「定义了却没有任何消费方」
 * (--user-number / --note-number / --bg-active / --shadow-heavy / --warning-color),
 * 导致「每个主题都定义了 36 个变量」≠「主题系统已打通」。
 *
 * 本测试用源码静态分析守住这条线:变量要么没人用(可以删),
 * 要么必须有消费方(不能白定义)。
 */

const SRC = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(vue|css|ts)$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(SRC)
const themesCss = readFileSync(join(SRC, 'styles/themes.css'), 'utf-8')
/** 消费方:themes.css 以外的所有源码 */
const consumers = files
  .filter(f => !f.endsWith('themes.css'))
  .map(f => ({ path: f, src: readFileSync(f, 'utf-8') }))

function definedInThemes(): Set<string> {
  return new Set([...themesCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]))
}

function usedInConsumers(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const { path, src } of consumers) {
    for (const m of src.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      const v = m[1]
      if (!map.has(v)) map.set(v, [])
      map.get(v)!.push(path)
    }
  }
  return map
}

function consumers_defined(): Set<string> {
  return usedInConsumers().keys ? new Set(usedInConsumers().keys()) : new Set()
}

/**
 * 切出 7 个主题块。
 * light 的选择器跨两行(:root,\n:root[data-theme="light"] {),
 * 所以用「从选择器行到下一个 } 」的宽松匹配,不能要求选择器单行闭合。
 */
function themeBlocks(): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  const re = /data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(themesCss)) !== null) {
    out.push({ name: m[1], body: m[2] })
  }
  return out
}

describe('主题变量接通性', () => {
  const defined = definedInThemes()
  const used = usedInConsumers()

  it('themes.css 恰好定义 7 个主题', () => {
    expect(themeBlocks().map(b => b.name)).toEqual([
      'light', 'sakura', 'dark',
      'macaron-pink', 'macaron-blue', 'macaron-green', 'macaron-purple'
    ])
  })

  it('此前 5 个「孤儿变量」都已接通', () => {
    const orphans = [
      '--user-number',
      '--note-number',
      '--bg-active',
      '--shadow-heavy',
      '--warning-color'
    ]
    const stillOrphan = orphans.filter(v => !used.has(v))
    expect(stillOrphan, `仍未被任何组件使用: ${stillOrphan.join(', ')}`).toEqual([])
  })

  it('不存在「定义了但零消费方」的业务变量', () => {
    // 允许存在的例外:仅在 :root 中声明、供 JS 读取的字体变量
    const allowedUnused = new Set(['--sans'])
    const orphan = [...defined].filter(v => !used.has(v) && !allowedUnused.has(v))
    expect(orphan, `零消费方: ${orphan.join(', ')}`).toEqual([])
  })

  it('所有消费方用到的变量都在 themes.css 或 style.css 中有定义', () => {
    const styleCss = readFileSync(join(SRC, 'style.css'), 'utf-8')
    const definedAnywhere = new Set([
      ...[...themesCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]),
      ...[...styleCss.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])
    ])
    // 排除注释/文档里的示意性写法(如 "var(--x, fallback)")
    const real = [...used.keys()].filter(v => v.length > 3)
    const undefinedVars = real.filter(v => !definedAnywhere.has(v))
    expect(undefinedVars, `消费方引用了未定义变量: ${undefinedVars.join(', ')}`).toEqual([])
  })

  it('var(--x, fallback) 的 fallback 不会造成主题污染', () => {
    const blocks = themeBlocks()
    expect(blocks.length).toBe(7)

    for (const { path, src } of consumers) {
      // 排除注释行里的示意性代码
      const codeOnly = src.split('\n').filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('/*') && !l.trim().startsWith('//')).join('\n')
      for (const m of codeOnly.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)) {
        const v = m[1]
        if (v === '--x') continue
        const missing = blocks
          .filter(({ body }) => !new RegExp(`${v}\\s*:`).test(body))
          .map(({ name }) => name)
        expect(missing, `${path} 用了带 fallback 的 ${v},但这些主题未定义: ${missing.join(',')}`).toEqual([])
      }
    }
  })
})

describe('棋盘居中布局(H5)', () => {
  const board = readFileSync(join(SRC, 'components/SudokuBoard.vue'), 'utf-8')
  const game = readFileSync(join(SRC, 'views/Game.vue'), 'utf-8')

  function rule(src: string, sel: string): string {
    const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = src.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'))
    return m ? m[1] : ''
  }

  it('3×3/9×9 的视口双向居中(回归:曾贴在左上角)', () => {
    const vp = rule(board, '.board-viewport')
    expect(vp, '未找到 .board-viewport 规则').toContain('justify-content: center')
    expect(vp).toContain('align-items: center')
  })

  it('27×27 视口必须 flex-start(居中会导致左侧拖不到)', () => {
    const vp = rule(board, '.pan-zoom .board-viewport')
    expect(vp).toContain('justify-content: flex-start')
    expect(vp).toContain('align-items: flex-start')
  })

  it('棋盘容器 small 模式居中', () => {
    const c = rule(game, '.game-board-container.is-small')
    expect(c).toContain('align-items: center')
    expect(c).toContain('justify-content: center')
  })

  it('只有 27×27 的 wrapper 才撑满高度(小棋盘不应被拉成整屏)', () => {
    const base = rule(board, '.sudoku-board-wrapper')
    expect(base).not.toMatch(/(?<!pan-zoom[^{]*)\bheight:\s*100%/)
    const panZoom = rule(board, '.sudoku-board-wrapper.pan-zoom')
    expect(panZoom).toContain('height: 100%')
  })

  it('9×9 棋盘用 vw 自适应,不写死像素', () => {
    const s9 = rule(board, '.sudoku-board.size-9')
    expect(s9).toContain('90vw')
  })
})

describe('数字配色语义(棋盘)', () => {
  const board = readFileSync(join(SRC, 'components/SudokuBoard.vue'), 'utf-8')

  it('固定数字用 --fixed-number', () => {
    const m = board.match(/\.sudoku-cell\.fixed \.cell-value\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toContain('var(--fixed-number)')
  })

  it('用户填入的数字用 --user-number', () => {
    const m = board.match(/\.sudoku-cell:not\(\.fixed\) \.cell-value\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toContain('var(--user-number)')
  })

  it('不同时存在两条 .fixed .cell-value 定义', () => {
    // 曾经有重复定义,后者用 --text-primary 覆盖了 --fixed-number
    const count = (board.match(/\.sudoku-cell\.fixed \.cell-value\s*\{/g) || []).length
    expect(count, `重复定义 ${count} 次,后者会覆盖前者`).toBe(1)
  })

  it('笔记占位数字用 --note-number', () => {
    const m = board.match(/\.note-number\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toContain('var(--note-number)')
  })
})
