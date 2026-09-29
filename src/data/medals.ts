// 勋章系统定义 —— 需求 §5
//
// 结构:
//   - 99 个关卡勋章 (id: medal_1 .. medal_99, 既有体系,保留)
//   - 1  个终极勋章「数独之神」(id: medal_100, 既有体系,保留)
//   - 900 个九大类勋章 (需求 §5.2), id 用分类前缀,避免与 medal_N 冲突
//   - 总计 = 1000 个
//
// 每个勋章带 condition 描述其解锁条件,由 stores/user.ts 的条件评估引擎判定。
// 为可维护性,九大类用「里程碑阈值数组 × 维度叉积」的数据驱动方式生成。

import type { Medal, MedalCategory, MedalCondition, DifficultyLevel, GridSize, SpecialContext } from '../types'

export const medalCategories: { id: MedalCategory; name: string; icon: string }[] = [
  { id: 'level', name: '关卡勋章', icon: '🎯' },
  { id: 'ultimate', name: '终极勋章', icon: '👑' },
  { id: 'starter', name: '入门勋章', icon: '🎈' },
  { id: 'speed', name: '速度勋章', icon: '⚡' },
  { id: 'streak', name: '连胜勋章', icon: '🔥' },
  { id: 'perfect', name: '完美勋章', icon: '💎' },
  { id: 'cumulative', name: '累计勋章', icon: '🏆' },
  { id: 'attendance', name: '全勤勋章', icon: '📅' },
  { id: 'daily', name: '每日勋章', icon: '🌟' },
  { id: 'collection', name: '收集勋章', icon: '🧩' },
  { id: 'special', name: '特殊勋章', icon: '🎁' }
]

const CATEGORY_ICON: Record<MedalCategory, string> = {
  level: '⭐',
  ultimate: '👑',
  starter: '🎈',
  speed: '⚡',
  streak: '🔥',
  perfect: '💎',
  cumulative: '🏆',
  attendance: '📅',
  daily: '🌟',
  collection: '🧩',
  special: '🎁'
}

const SIZE_LABEL: Record<GridSize, string> = { 3: '迷你', 9: '标准', 27: '大师' }
const LEVEL_LABEL: Record<DifficultyLevel, string> = { easy: '初级', medium: '中级', hard: '高级' }

/** 构造一个勋章 */
function mk(
  id: string,
  name: string,
  description: string,
  category: MedalCategory,
  condition?: MedalCondition
): Medal {
  return { id, name, description, icon: CATEGORY_ICON[category], category, condition, unlocked: false }
}

/** 里程碑图标:按档位升级 */
function tierIcon(i: number, tiers: number[]): string {
  const pct = i / tiers.length
  if (pct < 0.25) return '🥉'
  if (pct < 0.5) return '🥈'
  if (pct < 0.75) return '🥇'
  if (pct < 1) return '🏅'
  return '👑'
}

/** 难度维度:all 表示不限尺寸 */
const DIMMENSIONS: { key: 'all' | GridSize; label: string }[] = [
  { key: 'all', label: '总' },
  { key: 3, label: '迷你' },
  { key: 9, label: '标准' },
  { key: 27, label: '大师' }
]

function sizeCondition(type: 'cumulative' | 'streak' | 'perfect', size: 'all' | GridSize, count: number): MedalCondition {
  const cond: MedalCondition = { type, count }
  if (size !== 'all') cond.size = size
  return cond
}

// ── 生成全部勋章 ────────────────────────────────────────────────
function generateAllMedals(): Medal[] {
  const medals: Medal[] = []

  // ============ 关卡勋章 (99) ============
  const levelNames = [
    '初入数独', '小试牛刀', '渐入佳境', '稳步前行', '初窥门径',
    '略有小成', '渐入高手', '登堂入室', '融会贯通', '炉火纯青',
    '出类拔萃', '技高一筹', '崭露头角', '锋芒毕露', '脱颖而出',
    '独步一时', '名列前茅', '傲视群雄', '独孤求败', '一代宗师',
    '数独新星', '数独学徒', '数独学员', '数独高手', '数独大师',
    '数独王者', '数独至尊', '数独传奇', '数独神话', '数独之神',
    '入门勇士', '初级战士', '中级战士', '高级战士', '精英战士',
    '王牌战士', '传奇战士', '无敌战士', '至尊战士', '神圣战士',
    '青铜骑士', '白银骑士', '黄金骑士', '铂金骑士', '钻石骑士',
    '星耀骑士', '王者骑士', '荣耀骑士', '传奇骑士', '至尊骑士',
    '一阶闯关', '二阶闯关', '三阶闯关', '四阶闯关', '五阶闯关',
    '六阶闯关', '七阶闯关', '八阶闯关', '九阶闯关', '十阶闯关',
    '初级探索', '中级探索', '高级探索', '专家探索', '大师探索',
    '王者探索', '传奇探索', '至尊探索', '神圣探索', '不朽探索',
    '新手成就', '初级成就', '中级成就', '高级成就', '专家成就',
    '大师成就', '王者成就', '传奇成就', '至尊成就', '不朽成就',
    '数独达人', '数独专家', '数独宗师', '数独传奇', '数独至尊'
  ]

  for (let i = 1; i <= 99; i++) {
    const nameIndex = (i - 1) % levelNames.length
    medals.push({
      id: `medal_${i}`,
      name: `第${i}关 · ${levelNames[nameIndex]}`,
      description: `完成第 ${i} 关获得`,
      icon: getLevelIcon(i),
      category: 'level',
      unlocked: false
    })
  }

  // ============ 终极勋章「数独之神」(1) ============
  medals.push({
    id: 'medal_100',
    name: '数独之神',
    description: '收集所有99个关卡勋章后获得的终极勋章',
    icon: '👑',
    category: 'ultimate',
    unlocked: false
  })

  // ============ 入门类 (10) ============
  medals.push(
    mk('starter_1', '新手驾到', '完成 1 局 3×3 数独', 'starter', { type: 'complete_first', size: 3 }),
    mk('starter_2', '小试牛刀', '完成 1 局 9×9 数独', 'starter', { type: 'complete_first', size: 9 }),
    mk('starter_3', '大师出现', '完成 1 局 27×27 数独', 'starter', { type: 'complete_first', size: 27 }),
    mk('starter_4', '初窥门径', '完成所有难度的初级各 1 局', 'starter', { type: 'complete_all_level', level: 'easy' }),
    mk('starter_5', '渐入佳境', '完成所有难度的中级各 1 局', 'starter', { type: 'complete_all_level', level: 'medium' }),
    mk('starter_6', '登堂入室', '完成所有难度的高级各 1 局', 'starter', { type: 'complete_all_level', level: 'hard' }),
    mk('starter_7', '初级猎手', '3×3 累计完成 10 局', 'starter', { type: 'cumulative', size: 3, count: 10 }),
    mk('starter_8', '中级猎手', '9×9 累计完成 10 局', 'starter', { type: 'cumulative', size: 9, count: 10 }),
    mk('starter_9', '高级猎手', '27×27 累计完成 10 局', 'starter', { type: 'cumulative', size: 27, count: 10 }),
    mk('starter_10', '全能选手', '收集全部勋章后获得的神秘勋章', 'starter', { type: 'all_medals', hidden: true })
  )

  // ============ 速度类 (50) ============
  const SPEED_GRADES: Record<GridSize, Record<DifficultyLevel, number[]>> = {
    3: { easy: [30, 45, 60, 90], medium: [45, 60, 90, 120], hard: [60, 90, 120, 180] },
    9: { easy: [120, 180, 300, 600], medium: [180, 300, 600, 900], hard: [300, 600, 900, 1200] },
    27: { easy: [600, 900, 1200, 1800], medium: [900, 1200, 1800, 2400], hard: [1200, 1800, 2400, 3600] }
  }
  const SPEED_GRADE_NAME = ['极速', '神速', '迅速', '及格']
  let speedIdx = 0
  for (const size of [3, 9, 27] as GridSize[]) {
    for (const level of ['easy', 'medium', 'hard'] as DifficultyLevel[]) {
      SPEED_GRADES[size][level].forEach((sec, gi) => {
        speedIdx++
        const min = Math.round(sec / 60)
        medals.push(
          mk(`speed_${speedIdx}`,
            `${SIZE_LABEL[size]}${LEVEL_LABEL[level]}·${SPEED_GRADE_NAME[gi]}`,
            `${min} 分钟内完成 ${SIZE_LABEL[size]}${LEVEL_LABEL[level]}数独`,
            'speed',
            { type: 'speed', size, level, time: sec })
        )
      })
    }
  }
  // speed_37..42: 累计速度成就数
  ;[5, 10, 20, 50, 100, 200].forEach((cnt, i) => {
    speedIdx++
    medals.push(
      mk(`speed_${speedIdx}`,
        `闪电侠${['', '·二级', '·三级', '·四级', '·五级', '·六级'][i]}`,
        `累计达成 ${cnt} 次速度成就`,
        'speed',
        { type: 'cumulative', count: cnt })
    )
  })
  // speed_43..47: 集齐速度勋章比例
  ;[10, 20, 30, 40, 50].forEach((pct, i) => {
    speedIdx++
    medals.push(
      mk(`speed_${speedIdx}`,
        `时间大师${['', '·二级', '·三级', '·四级', '·五级'][i]}`,
        `集齐 ${pct}% 的速度勋章`,
        'speed',
        { type: 'collection_percent', category: 'speed', percent: pct })
    )
  })
  // speed_48..50: 各尺寸全难度速通
  ;[3, 9, 27].forEach((size) => {
    speedIdx++
    medals.push(
      mk(`speed_${speedIdx}`,
        `${SIZE_LABEL[size as GridSize]}·全难度速通`,
        `在 ${SIZE_LABEL[size as GridSize]}数独的初/中/高难度均完成一次`,
        'speed',
        { type: 'complete_all_level', size: size as GridSize })
    )
  })

  // ============ 连胜类 (100) ============
  const STREAK_THRESHOLDS = [3, 4, 5, 6, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120, 150, 200, 300]
  for (const dim of DIMMENSIONS) {
    STREAK_THRESHOLDS.forEach((threshold, ti) => {
      const icon = tierIcon(ti + 1, STREAK_THRESHOLDS)
      medals.push({
        id: `streak_${dim.key === 'all' ? 'all' : dim.key}_${ti + 1}`,
        name: `${dim.label}连胜·${threshold}局`,
        description: dim.key === 'all'
          ? `累计连胜 ${threshold} 局`
          : `${SIZE_LABEL[dim.key as GridSize]}数独连胜 ${threshold} 局`,
        icon,
        category: 'streak',
        condition: sizeCondition('streak', dim.key, threshold),
        unlocked: false
      })
    })
  }

  // ============ 完美类 (100) ============
  const PERFECT_THRESHOLDS = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500, 2000]
  for (const dim of DIMMENSIONS) {
    PERFECT_THRESHOLDS.forEach((threshold, ti) => {
      medals.push({
        id: `perfect_${dim.key === 'all' ? 'all' : dim.key}_${ti + 1}`,
        name: `${dim.label}完美·${threshold}局`,
        description: dim.key === 'all'
          ? `累计 0 错误完成 ${threshold} 局`
          : `${SIZE_LABEL[dim.key as GridSize]}数独 0 错误完成 ${threshold} 局`,
        icon: tierIcon(ti + 1, PERFECT_THRESHOLDS),
        category: 'perfect',
        condition: sizeCondition('perfect', dim.key, threshold),
        unlocked: false
      })
    })
  }

  // ============ 累计类 (200) ============
  // 注意: id 后缀 _N 是「第 N 个阈值」的序号,而非阈值本身。
  //      cumulative_9_1 → 1 局,cumulative_9_2 → 3 局,cumulative_9_3 → 5 局
  const CUM_THRESHOLDS = [1, 3, 5, 8, 10, 15, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2600, 2800, 3000, 3500, 4000]
  for (const dim of DIMMENSIONS) {
    CUM_THRESHOLDS.forEach((threshold, ti) => {
      medals.push({
        id: `cumulative_${dim.key === 'all' ? 'all' : dim.key}_${ti + 1}`,
        name: `${dim.label}累计·${threshold}局`,
        description: dim.key === 'all'
          ? `累计完成 ${threshold} 局`
          : `${SIZE_LABEL[dim.key as GridSize]}数独累计完成 ${threshold} 局`,
        icon: tierIcon(ti + 1, CUM_THRESHOLDS),
        category: 'cumulative',
        condition: sizeCondition('cumulative', dim.key, threshold),
        unlocked: false
      })
    })
  }

  // ============ 全勤类 (100) ============
  const ATT_THRESHOLDS = [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 365]
  ATT_THRESHOLDS.forEach((day, i) => {
    medals.push(
      mk(`attendance_${i + 1}`,
        `坚持${day}天`,
        `累计签到 ${day} 天`,
        'attendance',
        { type: 'daily_streak', count: day })
    )
  })
  // 每日参与天数 (累计)
  ;[3, 5, 7, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300].forEach((day, i) => {
    medals.push(
      mk(`attendance_${ATT_THRESHOLDS.length + i + 1}`,
        `累计活跃${day}天`,
        `累计活跃 ${day} 天`,
        'attendance',
        { type: 'cumulative', count: day })
    )
  })
  // 凑满 100: 每周/每月重复勋章
  const WEEKLY = ['周冠军', '半月英雄', '月度之星', '季度传奇', '年度王者']
  const WEEKLY_DAYS = [7, 15, 30, 90, 365]
  let attIdx = ATT_THRESHOLDS.length + 15
  WEEKLY.forEach((name, i) => {
    attIdx++
    medals.push(
      mk(`attendance_${attIdx}`, name, `连续挑战 ${WEEKLY_DAYS[i]} 天`, 'attendance',
        { type: 'daily_streak', count: WEEKLY_DAYS[i] })
    )
  })
  // 剩余补位: 按周连续参与
  while (attIdx < 100) {
    attIdx++
    const n = 8 + (attIdx - 15)
    medals.push(
      mk(`attendance_${attIdx}`, `连续${n}天达人`, `连续挑战 ${n} 天`, 'attendance',
        { type: 'daily_streak', count: n })
    )
  }

  // ============ 每日挑战类 (100) ============
  const DAILY_THRESHOLDS = [1, 3, 5, 7, 10, 20, 30, 50, 75, 100]
  DAILY_THRESHOLDS.forEach((cnt, i) => {
    medals.push(
      mk(`daily_count_${i + 1}`,
        `每日达人${['', '·二级', '·三级', '·四级', '·五级', '·六级', '·七级', '·八级', '·九级', '·十级'][i]}`,
        `完成 ${cnt} 次每日挑战`,
        'daily',
        { type: 'daily_count', count: cnt })
    )
  })
  const DAILY_STREAK = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50]
  DAILY_STREAK.forEach((cnt, i) => {
    medals.push(
      mk(`daily_streak_${i + 1}`,
        `每日连胜${['', '·二级', '·三级', '·四级', '·五级', '·六级', '·七级', '·八级', '·九级', '·十级'][i]}`,
        `每日挑战连胜 ${cnt} 天`,
        'daily',
        { type: 'daily_streak', count: cnt })
    )
  })
  // 凑满 100: 各尺寸/难度的每日挑战
  let dailyIdx = 20
  for (const size of [3, 9, 27] as GridSize[]) {
    for (const level of ['easy', 'medium', 'hard'] as DifficultyLevel[]) {
      for (let k = 0; k < 4; k++) {
        dailyIdx++
        medals.push(
          mk(`daily_${dailyIdx}`,
            `${SIZE_LABEL[size]}${LEVEL_LABEL[level]}·每日挑战`,
            `完成 ${SIZE_LABEL[size]}${LEVEL_LABEL[level]}每日挑战`,
            'daily',
            { type: 'daily_count', count: 1 })
        )
      }
    }
  }
  // 剩余补位
  while (dailyIdx < 100) {
    dailyIdx++
    medals.push(
      mk(`daily_${dailyIdx}`, `每日挑战·第${dailyIdx}号`, '完成 1 次每日挑战', 'daily',
        { type: 'daily_count', count: 1 })
    )
  }

  // ============ 收集类 (150) ============
  const COLLECT_PCT = [10, 25, 50, 75, 100]
  let colIdx = 0
  for (const cat of medalCategories) {
    if (cat.id === 'level' || cat.id === 'ultimate') continue
    COLLECT_PCT.forEach((pct, pi) => {
      colIdx++
      medals.push(
        mk(`collection_${colIdx}`,
          `${cat.name}收藏家${['', '·初', '·进', '·精', '·全'][pi]}`,
          `集齐 ${pct}% 的${cat.name}`,
          'collection',
          { type: 'collection_percent', category: cat.id, percent: pct })
      )
    })
    ;[5, 10, 20, 50, 100].forEach((cnt) => {
      colIdx++
      medals.push(
        mk(`collection_${colIdx}`,
          `${cat.name}·集${cnt}枚`,
          `收集 ${cnt} 枚${cat.name}`,
          'collection',
          { type: 'collection_category', category: cat.id, count: cnt })
      )
    })
  }
  // 总收集比例
  ;[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].forEach((pct, pi) => {
    colIdx++
    medals.push(
      mk(`collection_${colIdx}`,
        `勋章大师${['', '·二', '·三', '·四', '·五', '·六', '·七', '·八', '·九', '·十'][pi]}`,
        `总收集率达到 ${pct}%`,
        'collection',
        { type: 'collection_percent', percent: pct })
    )
  })
  // 补到 150
  while (colIdx < 150) {
    colIdx++
    medals.push(
      mk(`collection_${colIdx}`, `收藏家·第${colIdx}号`, '收集任意勋章', 'collection',
        { type: 'collection_category', count: 1 })
    )
  }

  // ============ 特殊类 (90) ============
  // 3 尺寸 × 3 难度 × 10 个情境,每个都带可自动判定的时间/情境阈值
  // (v1.1 修复:此前这里只有 {type:'special'} 而无 context,引擎无法判定,
  //  导致 90 个勋章永远无法解锁)
  const SPEEDRUN_SEC: Record<GridSize, number> = { 3: 60, 9: 300, 27: 900 }
  const MARATHON_SEC: Record<GridSize, number> = { 3: 600, 9: 1800, 27: 5400 }

  const SPECIAL_THEMES: {
    context: SpecialContext
    name: string
    desc: string
    build: (size: GridSize) => MedalCondition
  }[] = [
    {
      context: 'night', name: '夜猫子', desc: '凌晨 0-4 点完成',
      build: size => ({ type: 'special', size, context: 'night' })
    },
    {
      context: 'early', name: '早鸟', desc: '早晨 6-8 点完成',
      build: size => ({ type: 'special', size, context: 'early' })
    },
    {
      context: 'weekend', name: '周末战士', desc: '周末完成一局',
      build: size => ({ type: 'special', size, context: 'weekend' })
    },
    {
      context: 'hint', name: '提示达人', desc: '使用提示后完成',
      build: size => ({ type: 'special', size, context: 'hint' })
    },
    {
      context: 'comeback', name: '逆袭之王', desc: '出错后仍完成',
      build: size => ({ type: 'special', size, context: 'comeback' })
    },
    {
      context: 'speedrun', name: '极速过关', desc: '远快于常规耗时完成',
      build: size => ({ type: 'special', size, context: 'speedrun', threshold: SPEEDRUN_SEC[size] })
    },
    {
      context: 'marathon', name: '持久战', desc: '长时间鏖战完成',
      build: size => ({ type: 'special', size, context: 'marathon', threshold: MARATHON_SEC[size] })
    },
    {
      context: 'flawless', name: '一气呵成', desc: '0 错误完成',
      build: size => ({ type: 'special', size, context: 'flawless' })
    },
    {
      context: 'night', name: '不眠之夜', desc: '凌晨 1-3 点完成',
      build: size => ({ type: 'special', size, context: 'night' })
    },
    {
      context: 'weekend', name: '周末特勤', desc: '周末完成且 0 错误',
      build: size => ({ type: 'special', size, context: 'flawless' })
    }
  ]

  let spIdx = 0
  for (const size of [3, 9, 27] as GridSize[]) {
    for (const level of ['easy', 'medium', 'hard'] as DifficultyLevel[]) {
      for (const theme of SPECIAL_THEMES) {
        spIdx++
        const cond = theme.build(size)
        cond.level = level
        const timeHint =
          cond.context === 'speedrun' ? `（${Math.round((cond.threshold ?? 0) / 60)} 分钟内）`
            : cond.context === 'marathon' ? `（超过 ${Math.round((cond.threshold ?? 0) / 60)} 分钟）`
              : ''
        medals.push(
          mk(`special_${spIdx}`,
            `${SIZE_LABEL[size]}${LEVEL_LABEL[level]}·${theme.name}`,
            `${SIZE_LABEL[size]}${LEVEL_LABEL[level]}·${theme.desc}${timeHint}`,
            'special',
            cond)
        )
      }
    }
  }

  return medals
}

function getLevelIcon(level: number): string {
  const icons = ['⭐', '🌟', '✨', '💫', '⭐', '🌟', '✨', '💫', '⭐', '🌟']
  if (level <= 10) return icons[level - 1]
  if (level <= 30) return '🎖'
  if (level <= 60) return '🏅'
  if (level <= 90) return '🥇'
  return '🏆'
}

export function getMedalStats(medals: Medal[]): Record<MedalCategory, { total: number; unlocked: number }> {
  const stats = {} as Record<MedalCategory, { total: number; unlocked: number }>
  for (const cat of medalCategories) {
    stats[cat.id] = { total: 0, unlocked: 0 }
  }
  for (const medal of medals) {
    stats[medal.category].total++
    if (medal.unlocked) {
      stats[medal.category].unlocked++
    }
  }
  return stats
}

export function getMedalById(id: string): Medal | undefined {
  return allMedals.find(m => m.id === id)
}

// 必须放在所有模块级常量定义之后,否则 generateAllMedals() 引用 SIZE_LABEL 等会进入 TDZ
export const allMedals: Medal[] = generateAllMedals()

export const TOTAL_MEDAL_COUNT = 1000