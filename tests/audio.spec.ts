import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  SoundManager,
  sound,
  SOUND_SCORES,
  ALL_SOUNDS,
  type SoundName
} from '@/utils/audio'

/**
 * 音效系统测试 (需求 §7)
 *
 * jsdom 没有 Web Audio API,这里注入一个可控的假 AudioContext,
 * 以便断言「哪个音效排程了几个音符 / 频率是多少 / 关掉开关是否静音」。
 */

// ── 假 AudioContext ─────────────────────────────────────────────
class FakeOscillator {
  type = 'sine'
  frequency = { setValueAtTime: vi.fn() }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  }
  connect = vi.fn()
}

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = { id: 'destination' }
  oscillators: FakeOscillator[] = []
  gains: FakeGain[] = []
  resume = vi.fn().mockResolvedValue(undefined)
  suspend = vi.fn().mockResolvedValue(undefined)
  close = vi.fn().mockResolvedValue(undefined)

  createOscillator(): FakeOscillator {
    const osc = new FakeOscillator()
    this.oscillators.push(osc)
    return osc
  }

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }
}

/** 最近一次创建的假 context */
let lastCtx: FakeAudioContext | null = null
const originalAudioContext = (window as any).AudioContext

function installFakeAudioContext(): void {
  lastCtx = null
  ;(window as any).AudioContext = class extends FakeAudioContext {
    constructor() {
      super()
      lastCtx = this
    }
  }
}

function removeAudioContext(): void {
  delete (window as any).AudioContext
  delete (window as any).webkitAudioContext
}

afterEach(() => {
  if (originalAudioContext) {
    ;(window as any).AudioContext = originalAudioContext
  } else {
    removeAudioContext()
  }
  lastCtx = null
  vi.restoreAllMocks()
})

// ── 乐谱完整性 ──────────────────────────────────────────────────
describe('音效乐谱 — 需求 §7 覆盖', () => {
  it('需求要求的 7 种音效全部有乐谱定义', () => {
    expect(ALL_SOUNDS).toHaveLength(7)
    for (const name of ALL_SOUNDS) {
      expect(SOUND_SCORES[name], `缺少 ${name} 的音效定义`).toBeDefined()
      expect(SOUND_SCORES[name].length).toBeGreaterThan(0)
    }
  })

  it('需求 §7 的 7 个触发点分别对应: 按钮/填入/错误/暂停/继续/胜利/勋章', () => {
    expect([...ALL_SOUNDS].sort()).toEqual(
      ['click', 'error', 'fill', 'medal', 'pause', 'resume', 'win'].sort()
    )
  })

  it('每个音符都有合法频率、时长与非负延迟', () => {
    for (const name of ALL_SOUNDS) {
      for (const note of SOUND_SCORES[name]) {
        expect(note.freq).toBeGreaterThan(0)
        expect(note.dur).toBeGreaterThan(0)
        expect(note.at).toBeGreaterThanOrEqual(0)
        if (note.gain !== undefined) {
          expect(note.gain).toBeGreaterThan(0)
          expect(note.gain).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('胜利音效是 4 个音符的琶音', () => {
    expect(SOUND_SCORES.win).toHaveLength(4)
    // 音高递增
    const freqs = SOUND_SCORES.win.map(n => n.freq)
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1])
    }
  })

  it('暂停是下行、继续是上行 (两者音高序列相反)', () => {
    const pauseFreqs = SOUND_SCORES.pause.map(n => n.freq)
    const resumeFreqs = SOUND_SCORES.resume.map(n => n.freq)
    expect(pauseFreqs[0]).toBeGreaterThan(pauseFreqs[1])
    expect(resumeFreqs[0]).toBeLessThan(resumeFreqs[1])
  })
})

// ── 开关行为 ────────────────────────────────────────────────────
describe('SoundManager — 开关', () => {
  let mgr: SoundManager

  beforeEach(() => {
    installFakeAudioContext()
    mgr = new SoundManager()
  })

  afterEach(() => mgr.dispose())

  it('默认开启', () => {
    expect(mgr.isEnabled()).toBe(true)
  })

  it('setEnabled(false) 后 play() 不创建任何 oscillator', () => {
    mgr.setEnabled(false)
    mgr.play('fill')
    expect(lastCtx).toBeNull()  // 连 context 都不该创建
  })

  it('重新开启后能正常播放', () => {
    mgr.setEnabled(false)
    mgr.play('fill')
    mgr.setEnabled(true)
    mgr.play('fill')
    expect(lastCtx).not.toBeNull()
    expect(lastCtx!.oscillators.length).toBe(SOUND_SCORES.fill.length)
  })

  it('error 音效受「错误提示」开关独立约束 (需求 §7)', () => {
    mgr.setErrorHintEnabled(false)
    mgr.play('error')
    expect(lastCtx).toBeNull()

    // 其他音效不受影响
    mgr.play('fill')
    expect(lastCtx).not.toBeNull()
  })

  it('canPlay() 准确反映可播放性', () => {
    expect(mgr.canPlay('fill')).toBe(true)
    mgr.setEnabled(false)
    expect(mgr.canPlay('fill')).toBe(false)
    mgr.setEnabled(true)
    mgr.setErrorHintEnabled(false)
    expect(mgr.canPlay('error')).toBe(false)
    expect(mgr.canPlay('win')).toBe(true)
  })
})

// ── 播放行为 ────────────────────────────────────────────────────
describe('SoundManager — 播放', () => {
  let mgr: SoundManager

  beforeEach(() => {
    installFakeAudioContext()
    mgr = new SoundManager()
  })

  afterEach(() => mgr.dispose())

  it('play() 为每个音符创建一个 oscillator + gain', () => {
    mgr.play('win')
    expect(lastCtx!.oscillators.length).toBe(SOUND_SCORES.win.length)
    expect(lastCtx!.gains.length).toBe(SOUND_SCORES.win.length)
  })

  it('oscillator 频率与乐谱一致', () => {
    mgr.play('click')
    expect(lastCtx!.oscillators[0].frequency.setValueAtTime)
      .toHaveBeenCalledWith(SOUND_SCORES.click[0].freq, expect.any(Number))
  })

  it('oscillator 从 gain 走到 destination', () => {
    mgr.play('fill')
    const osc = lastCtx!.oscillators[0]
    const gain = lastCtx!.gains[0]
    expect(osc.connect).toHaveBeenCalledWith(gain)
    expect(gain.connect).toHaveBeenCalledWith(lastCtx!.destination)
  })

  it('每个 oscillator 都被 start + stop', () => {
    mgr.play('error')
    for (const osc of lastCtx!.oscillators) {
      expect(osc.start).toHaveBeenCalled()
      expect(osc.stop).toHaveBeenCalled()
    }
  })

  it('使用指数包络衰减到近静音 (不传 0,避免 WebAudio 抛错)', () => {
    mgr.play('click')
    const gain = lastCtx!.gains[0]
    const calls = gain.gain.exponentialRampToValueAtTime.mock.calls
    expect(calls.length).toBe(2)
    for (const [value] of calls) {
      expect(value).toBeGreaterThan(0)
    }
  })

  it('context 被挂起时会先 resume', () => {
    mgr.play('fill')
    lastCtx!.state = 'suspended'
    mgr.play('win')
    expect(lastCtx!.resume).toHaveBeenCalled()
  })

  it('全部 7 种音效都能播放且不抛错', () => {
    for (const name of ALL_SOUNDS) {
      expect(() => mgr.play(name), `${name} 播放失败`).not.toThrow()
    }
    const total = ALL_SOUNDS.reduce((sum, n) => sum + SOUND_SCORES[n].length, 0)
    expect(lastCtx!.oscillators.length).toBe(total)
  })
})

// ── 降级 / 健壮性 ───────────────────────────────────────────────
describe('SoundManager — 无 Web Audio 环境下降级', () => {
  beforeEach(() => removeAudioContext())

  it('没有 AudioContext 时 play() 静默无操作 (jsdom 默认环境)', () => {
    const mgr = new SoundManager()
    expect(() => mgr.play('fill')).not.toThrow()
    expect(() => mgr.play('win')).not.toThrow()
  })

  it('AudioContext 构造函数抛异常时不影响调用方', () => {
    ;(window as any).AudioContext = function () {
      throw new Error('AudioContext blocked by autoplay policy')
    }
    const mgr = new SoundManager()
    expect(() => mgr.play('fill')).not.toThrow()
  })

  it('createOscillator 抛异常时不影响调用方', () => {
    installFakeAudioContext()
    const mgr = new SoundManager()
    mgr.play('fill')  // 先建好 context
    lastCtx!.createOscillator = () => {
      throw new Error('boom')
    }
    expect(() => mgr.play('win')).not.toThrow()
  })

  it('未知音效名不抛错', () => {
    installFakeAudioContext()
    const mgr = new SoundManager()
    expect(() => mgr.play('nope' as SoundName)).not.toThrow()
  })

  it('suspend() 在无 context 时安全', () => {
    const mgr = new SoundManager()
    expect(() => mgr.suspend()).not.toThrow()
  })

  it('dispose() 可重复调用', () => {
    installFakeAudioContext()
    const mgr = new SoundManager()
    mgr.play('fill')
    expect(() => {
      mgr.dispose()
      mgr.dispose()
    }).not.toThrow()
  })
})

// ── 单例 ────────────────────────────────────────────────────────
describe('sound 全局单例', () => {
  beforeEach(() => installFakeAudioContext())

  it('是 SoundManager 的实例', () => {
    expect(sound).toBeInstanceOf(SoundManager)
  })

  it('setEnabled 会影响后续播放', () => {
    sound.setEnabled(false)
    sound.play('click')
    expect(lastCtx).toBeNull()
    sound.setEnabled(true)
    sound.setErrorHintEnabled(true)
    sound.play('click')
    expect(lastCtx).not.toBeNull()
  })
})
