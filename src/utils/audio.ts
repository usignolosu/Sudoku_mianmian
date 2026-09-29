// 音效系统 —— 需求文档 §7
//
// 设计选择:不使用音频资源文件,而是用 Web Audio API 程序化合成。
//   - 项目里没有任何 mp3/wav,凭空造二进制资源不可维护
//   - 合成音零体积、离线可用、可被单元测试完整覆盖
//   - 每种音效由一组「音符」(oscillator + gain 包络) 描述
//
// 注意:浏览器自动播放策略要求 AudioContext 必须在用户手势后创建,
// 因此这里全部惰性初始化 —— 第一次 play() 时才建 context。

/** 需求 §7 要求的 7 种音效 */
export type SoundName =
  | 'click'   // 按钮点击
  | 'fill'    // 填入数字(正确)
  | 'error'   // 错误提示(填入错误数字)
  | 'pause'   // 暂停
  | 'resume'  // 继续
  | 'win'     // 胜利音乐
  | 'medal'   // 勋章解锁

/** 单个音符 */
interface Note {
  /** 频率 (Hz) */
  freq: number
  /** 相对该音效起始时刻的延迟 (秒) */
  at: number
  /** 持续时长 (秒) */
  dur: number
  /** 波形,默认 sine */
  type?: OscillatorType
  /** 峰值音量 0-1,默认 0.12 */
  gain?: number
}

/**
 * 音效乐谱
 * 保持短促、音高差异明显,便于在移动端小喇叭上区分
 */
const SCORES: Record<SoundName, Note[]> = {
  // 清脆短促的「嗒」
  click: [
    { freq: 880, at: 0, dur: 0.05, gain: 0.09 }
  ],
  // 上扬的确认音,表示「填对了」
  fill: [
    { freq: 660, at: 0, dur: 0.07, gain: 0.13 },
    { freq: 990, at: 0.05, dur: 0.09, gain: 0.10 }
  ],
  // 低沉的双击嗡鸣,表示「错了」
  error: [
    { freq: 220, at: 0, dur: 0.12, type: 'sawtooth', gain: 0.11 },
    { freq: 165, at: 0.10, dur: 0.16, type: 'sawtooth', gain: 0.11 }
  ],
  // 下行两音:收起
  pause: [
    { freq: 520, at: 0, dur: 0.10, gain: 0.11 },
    { freq: 390, at: 0.09, dur: 0.14, gain: 0.11 }
  ],
  // 上行两音:展开
  resume: [
    { freq: 390, at: 0, dur: 0.10, gain: 0.11 },
    { freq: 520, at: 0.09, dur: 0.14, gain: 0.11 }
  ],
  // 胜利: C-E-G-C 大调琶音,末音拉长
  win: [
    { freq: 523.25, at: 0, dur: 0.12, gain: 0.13 },
    { freq: 659.25, at: 0.11, dur: 0.12, gain: 0.13 },
    { freq: 783.99, at: 0.22, dur: 0.12, gain: 0.13 },
    { freq: 1046.5, at: 0.33, dur: 0.30, gain: 0.15 }
  ],
  // 勋章解锁: 高音三连闪
  medal: [
    { freq: 880, at: 0, dur: 0.08, gain: 0.12 },
    { freq: 1174.66, at: 0.07, dur: 0.08, gain: 0.12 },
    { freq: 1567.98, at: 0.14, dur: 0.24, gain: 0.14 }
  ]
}

type AudioContextCtor = typeof AudioContext

/**
 * 音效管理器
 *
 * 全局单例。它不依赖 Pinia —— 由 userStore 在设置变化时调用 setEnabled /
 * setErrorHintEnabled 单向同步,避免 store 与工具模块循环依赖。
 */
export class SoundManager {
  private ctx: AudioContext | null = null
  /** 总开关 (设置页「音效开关」) */
  private enabled = true
  /**
   * 错误提示开关。
   * 需求 §7 明确:「错误提示 | 填入错误数字时（错误提示开启时）」,
   * 所以 error 音效同时受这个开关约束。
   */
  private errorHintEnabled = true

  /** 设置总开关。关闭时会尝试释放 AudioContext。 */
  setEnabled(value: boolean): void {
    this.enabled = value
    if (!value) this.suspend()
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** 设置错误提示开关(只影响 error 音效) */
  setErrorHintEnabled(value: boolean): void {
    this.errorHintEnabled = value
  }

  isErrorHintEnabled(): boolean {
    return this.errorHintEnabled
  }

  /** 该音效当前是否允许播放 */
  canPlay(name: SoundName): boolean {
    if (!this.enabled) return false
    if (!SCORES[name]) return false
    if (name === 'error' && !this.errorHintEnabled) return false
    return true
  }

  /**
   * 播放一个音效。任何环节失败都静默降级 —— 音效绝不能影响游戏主流程。
   */
  play(name: SoundName): void {
    if (!this.canPlay(name)) return

    const ctx = this.ensureContext()
    if (!ctx) return

    // 浏览器可能因自动播放策略把 context 挂起,恢复后再排程
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => { /* 静默 */ })
    }

    const base = ctx.currentTime
    for (const note of SCORES[name]) {
      this.scheduleNote(ctx, note, base)
    }
  }

  /**
   * 主动挂起音频上下文(关闭音效时调用),省电。
   * 不销毁 context —— 重新开启时无需再次等待用户手势。
   */
  suspend(): void {
    if (!this.ctx) return
    if (this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => { /* 静默 */ })
    }
  }

  /** 彻底释放(仅供测试与卸载清理) */
  dispose(): void {
    const ctx = this.ctx
    this.ctx = null
    if (ctx && typeof ctx.close === 'function') {
      void Promise.resolve(ctx.close()).catch(() => { /* 静默 */ })
    }
  }

  // ── 内部实现 ────────────────────────────────────────────────

  /**
   * 惰性创建 AudioContext。
   * jsdom / 老浏览器没有 AudioContext,返回 null 由调用方跳过。
   */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx

    const Ctor = getAudioContextCtor()
    if (!Ctor) return null

    try {
      this.ctx = new Ctor()
    } catch {
      return null
    }
    return this.ctx
  }

  /** 把单个音符排程到上下文中 */
  private scheduleNote(ctx: AudioContext, note: Note, base: number): void {
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      const startAt = base + note.at
      const endAt = startAt + note.dur
      const peak = note.gain ?? 0.12

      osc.type = note.type ?? 'sine'
      osc.frequency.setValueAtTime(note.freq, startAt)

      // 简易包络:极短起音 → 指数衰减到近似静音
      // exponentialRampToValueAtTime 不接受 0,故用极小正数
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(startAt)
      osc.stop(endAt + 0.02)
    } catch {
      // 单个音符失败不影响其余音符
    }
  }
}

/** 解析可用的 AudioContext 构造函数(兼容 webkit 前缀) */
function getAudioContextCtor(): AudioContextCtor | null {
  // TS 的 DOM lib 把 AudioContext 声明成全局 var,而不是 window 的属性,
  // 所以走 globalThis 索引访问;Node/SSR 环境下自然得到 undefined。
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

/** 全局单例 */
export const sound = new SoundManager()

/** 暴露乐谱给测试断言使用(只读) */
export const SOUND_SCORES: Readonly<Record<SoundName, readonly Note[]>> = SCORES

/** 需求 §7 的全部音效名 */
export const ALL_SOUNDS: readonly SoundName[] = [
  'click', 'fill', 'error', 'pause', 'resume', 'win', 'medal'
]
