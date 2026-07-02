// 勋章系统定义

import type { Medal, MedalCategory } from '../types'

export const medalCategories: { id: MedalCategory; name: string; icon: string }[] = [
  { id: 'level', name: '关卡勋章', icon: '🎯' },
  { id: 'ultimate', name: '终极勋章', icon: '👑' }
]

export const allMedals: Medal[] = generateAllMedals()

function generateAllMedals(): Medal[] {
  const medals: Medal[] = []

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

  medals.push({
    id: 'medal_100',
    name: '数独之神',
    description: '收集所有99个关卡勋章后获得的终极勋章',
    icon: '👑',
    category: 'ultimate',
    unlocked: false
  })

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
  const stats: Record<MedalCategory, { total: number; unlocked: number }> = {
    level: { total: 0, unlocked: 0 },
    ultimate: { total: 0, unlocked: 0 }
  }

  for (const medal of medals) {
    stats[medal.category].total++
    if (medal.unlocked) {
      stats[medal.category].unlocked++
    }
  }

  return stats
}
