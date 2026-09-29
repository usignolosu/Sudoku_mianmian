// 用户数据管理 Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserData, Settings, GameRecord, ThemeType, DifficultyConfig } from '../types'
import { allMedals, getMedalById } from '../data/medals'
import {
  buildStats,
  findUnlockableMedals,
  levelMedalId,
  ULTIMATE_MEDAL_ID,
  ULTIMATE_MEDAL_NAME
} from '../utils/medalEngine'
import { sound } from '../utils/audio'

const STORAGE_KEY = 'sudoku_user_data'

/**
 * 把设置里的两个音频开关单向同步到音效管理器。
 * 音效模块不依赖 Pinia,由这里主动推送,避免循环依赖。
 */
function syncSoundSettings(settings: Settings): void {
  sound.setEnabled(settings.sound)
  sound.setErrorHintEnabled(settings.errorHint)
}

/** 全部合法主题,与 themes.css 的 [data-theme] 块一一对应 */
const VALID_THEMES: ThemeType[] = [
  'light', 'sakura', 'dark',
  'macaron-pink', 'macaron-blue', 'macaron-green', 'macaron-purple'
]

/** 校验主题名是否受支持(用于导入数据 / 旧存档的防御) */
function isValidTheme(theme: unknown): theme is ThemeType {
  return typeof theme === 'string' && (VALID_THEMES as string[]).includes(theme)
}

// 默认设置
const defaultSettings: Settings = {
  sound: true,
  errorHint: true,
  theme: 'light'
}

// 默认用户数据
const defaultUserData: UserData = {
  totalGames: 0,
  totalTime: 0,
  bestTimes: {},
  avgTimes: {},
  streak: 0,
  maxStreak: 0,
  lastPlayDate: '',
  dailyStreak: 0,
  maxDailyStreak: 0,
  medals: [],
  records: [],
  settings: defaultSettings
}

export const useUserStore = defineStore('user', () => {
  // 用户数据
  const userData = ref<UserData>(loadUserData())

  // 计算属性：各难度平均用时
  const avgTimeByDifficulty = computed(() => {
    const result: Record<string, number> = {}
    for (const [key, times] of Object.entries(userData.value.avgTimes)) {
      if (times.length > 0) {
        result[key] = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      }
    }
    return result
  })

  // 计算属性：总游戏次数
  const totalGames = computed(() => userData.value.totalGames)

  // 计算属性：已解锁勋章数量
  const unlockedMedalsCount = computed(() => userData.value.medals.length)

  /**
   * 从本地存储加载用户数据
   */
  function loadUserData(): UserData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // 合并默认值，确保新字段存在
        // Bug 修复: deep clone 默认值,避免被后续 unlockMedal 污染常量
        return {
          ...JSON.parse(JSON.stringify(defaultUserData)),
          ...parsed,
          settings: { ...defaultSettings, ...(parsed.settings || {}) }
        }
      }
    } catch (e) {
      console.error('Failed to load user data:', e)
    }
    // Bug 修复: deep clone,避免污染模块常量
    return JSON.parse(JSON.stringify(defaultUserData))
  }

  /**
   * 保存用户数据到本地存储
   */
  function saveUserData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData.value))
    } catch (e) {
      console.error('Failed to save user data:', e)
    }
  }

  /**
   * 添加游戏记录
   */
  function addGameRecord(record: GameRecord) {
    userData.value.records.push(record)
    userData.value.totalGames++
    userData.value.totalTime += record.time

    // 更新最佳时间
    const difficultyKey = `${record.difficulty.size}x${record.difficulty.size}_${record.difficulty.level}`
    if (!userData.value.bestTimes[difficultyKey] || record.time < userData.value.bestTimes[difficultyKey]) {
      userData.value.bestTimes[difficultyKey] = record.time
    }

    // 更新平均用时历史
    if (!userData.value.avgTimes[difficultyKey]) {
      userData.value.avgTimes[difficultyKey] = []
    }
    userData.value.avgTimes[difficultyKey].push(record.time)

    // 更新连胜
    if (record.completed) {
      userData.value.streak++
      if (userData.value.streak > userData.value.maxStreak) {
        userData.value.maxStreak = userData.value.streak
      }
    } else {
      userData.value.streak = 0
    }

    // 更新最后游戏日期
    userData.value.lastPlayDate = new Date().toISOString().split('T')[0]

    saveUserData()
  }

  /**
   * 解锁勋章
   * Bug 修复:
   *  - #9 写入 unlockedAt 时间戳 (ISO string),供 Medals.vue 显示
   */
  function unlockMedal(medalId: string): boolean {
    if (!userData.value.medals.includes(medalId)) {
      userData.value.medals.push(medalId)
      saveUserData()
      // 单独维护一个解锁时间 map,避免污染 medals 数组结构
      userData.value.medalUnlockedAt = userData.value.medalUnlockedAt || {}
      userData.value.medalUnlockedAt[medalId] = new Date().toISOString()
      saveUserData()
      return true
    }
    return false
  }

  /**
   * 检查并解锁所有符合条件的勋章
   * 返回本次新解锁的勋章名称列表
   *
   * 实现说明:走 medalEngine 的条件评估引擎,覆盖全部 1000 个勋章。
   * 每局只做一次 buildStats + 一次 O(n) 扫描。
   */
  function checkAndUnlockMedals(record: GameRecord): string[] {
    const unlocked: string[] = []
    const recordBefore = userData.value.records?.length ?? 0

    // 调用方应已通过 addGameRecord 写入本局;若未写入则临时补上统计
    if (userData.value.records.length <= recordBefore && record) {
      // addGameRecord 未包含本局(理论上不会发生),仍纳入统计避免漏判
      userData.value.records.push(record)
    }

    const stats = buildStats(userData.value)

    // === 关卡勋章 (99) ===
    if (record.completed) {
      const levelId = levelMedalId(record.puzzleId)
      if (levelId && unlockMedal(levelId)) {
        const medal = getMedalById(levelId)
        if (medal) unlocked.push(medal.name)
      }
    }

    // === 终极勋章「数独之神」(集齐 99 个关卡勋章) ===
    const levelIds = userData.value.medals.filter(id => /^medal_(\d+)$/.test(id) && id !== ULTIMATE_MEDAL_ID)
    if (levelIds.length >= 99 && unlockMedal(ULTIMATE_MEDAL_ID)) {
      unlocked.push(ULTIMATE_MEDAL_NAME)
    }

    // === 九大类勋章 (条件评估) ===
    for (const medalId of findUnlockableMedals(stats, record)) {
      if (unlockMedal(medalId)) {
        const medal = getMedalById(medalId)
        if (medal) unlocked.push(medal.name)
      }
    }

    // === 隐藏勋章「全能选手」(集齐所有非隐藏勋章) ===
    // 放在最后统计,此时刚解锁的勋章已计入
    const finalStats = buildStats(userData.value)
    if (finalStats.unlockedTotal >= finalStats.visibleTotal) {
      const hidden = allMedals.find(m => m.condition?.type === 'all_medals')
      if (hidden && unlockMedal(hidden.id)) {
        unlocked.push(hidden.name)
      }
    }

    return unlocked
  }

  /**
   * 更新每日连胜天数
   */
  function updateDailyStreak() {
    const today = new Date().toISOString().split('T')[0]
    const lastDate = userData.value.lastPlayDate
    
    if (!lastDate) {
      userData.value.dailyStreak = 1
    } else {
      const last = new Date(lastDate)
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) {
        // 今天已经玩过了，不变
      } else if (diffDays === 1) {
        userData.value.dailyStreak++
      } else {
        // 中断了，重置
        userData.value.dailyStreak = 1
      }
    }
    
    if (userData.value.dailyStreak > (userData.value.maxDailyStreak || 0)) {
      userData.value.maxDailyStreak = userData.value.dailyStreak
    }
    
    saveUserData()
  }

  /**
   * 更新设置
   * Bug 修复:
   *  - #7 如果传入 theme,要立即 applyTheme (导入数据走这条路径会生效主题)
   */
  function updateSettings(newSettings: Partial<Settings>) {
    userData.value.settings = { ...userData.value.settings, ...newSettings }
    if (newSettings.theme) {
      applyTheme(newSettings.theme)
    }
    // 音效开关立即生效(需求 §7)
    if (newSettings.sound !== undefined || newSettings.errorHint !== undefined) {
      syncSoundSettings(userData.value.settings)
    }
    saveUserData()
  }

  /**
   * 切换主题
   */
  function setTheme(theme: ThemeType) {
    userData.value.settings.theme = theme
    applyTheme(theme)
    saveUserData()
  }

  /**
   * 应用主题
   *
   * 对未知主题名做白名单校验并降级为 light。
   * 原因:themes.css 里变量只在 [data-theme="..."] 块内定义,
   * 传入一个不存在的名字(如手改 localStorage 造成的 "rainbow")
   * 会让所有 var(--x) 取不到值,页面变成无样式、几乎不可读。
   */
  function applyTheme(theme: ThemeType) {
    const safe = isValidTheme(theme) ? theme : 'light'
    document.documentElement.setAttribute('data-theme', safe)
    // 同步修正存储里的非法值,避免每次启动都走降级分支
    if (userData.value.settings.theme !== safe) {
      userData.value.settings.theme = safe
    }
  }

  /**
   * 获取某难度的最佳时间
   */
  function getBestTime(config: DifficultyConfig): number | null {
    const key = `${config.size}x${config.size}_${config.level}`
    return userData.value.bestTimes[key] || null
  }

  /**
   * 获取某难度的平均时间
   */
  function getAvgTime(config: DifficultyConfig): number | null {
    const key = `${config.size}x${config.size}_${config.level}`
    return avgTimeByDifficulty.value[key] || null
  }

  /**
   * 导出数据
   */
  function exportData(): string {
    return JSON.stringify(userData.value, null, 2)
  }

  /**
   * 导入数据
   * Bug 修复:
   *  - #7 改用 Object.assign 保留 reactive 引用,让 computed 自动重新计算
   *  - 导入成功后应用主题
   */
  function importData(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData)
      // Bug 修复 #10: deep clone 默认值,否则缺字段时数组/对象会与
      // defaultUserData 共享引用,后续 unlockMedal 会污染模块常量
      const merged: UserData = {
        ...JSON.parse(JSON.stringify(defaultUserData)),
        ...imported,
        // 嵌套对象必须单独 deep clone,浅 spread 会共享引用
        bestTimes: { ...(imported.bestTimes || {}) },
        avgTimes: { ...(imported.avgTimes || {}) },
        medals: Array.isArray(imported.medals) ? [...imported.medals] : [],
        medalUnlockedAt: { ...(imported.medalUnlockedAt || {}) },
        records: Array.isArray(imported.records) ? [...imported.records] : [],
        settings: { ...defaultSettings, ...(imported.settings || {}) }
      }
      // 用 Object.assign 逐字段写入,避免整个对象引用替换
      Object.assign(userData.value, merged)
      // 先自愈非法主题名,再落盘,避免非法值留在 localStorage 与导出文件里
      applyTheme(userData.value.settings.theme)
      saveUserData()
      syncSoundSettings(userData.value.settings)
      return true
    } catch (e) {
      console.error('Failed to import data:', e)
      return false
    }
  }

  /**
   * 清除所有数据
   * Bug 修复: 必须 deep clone 默认值,否则后续 unlockMedal 会污染 defaultUserData.medals
   */
  function clearData() {
    userData.value = JSON.parse(JSON.stringify(defaultUserData))
    saveUserData()
    applyTheme('light')
    syncSoundSettings(userData.value.settings)
  }

  /**
   * 获取挑战记录（分页）
   */
  function getRecords(page: number = 1, pageSize: number = 20): GameRecord[] {
    const allRecords = [...userData.value.records].reverse() // 最新的排在前面
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return allRecords.slice(start, end)
  }

  /**
   * 初始化时应用主题
   */
  function init() {
    applyTheme(userData.value.settings.theme)
    syncSoundSettings(userData.value.settings)
  }

  return {
    userData,
    avgTimeByDifficulty,
    totalGames,
    unlockedMedalsCount,
    addGameRecord,
    unlockMedal,
    checkAndUnlockMedals,
    updateDailyStreak,
    updateSettings,
    setTheme,
    applyTheme,
    getBestTime,
    getAvgTime,
    exportData,
    importData,
    clearData,
    getRecords,
    init,
    saveUserData
  }
})