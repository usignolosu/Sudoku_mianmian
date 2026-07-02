// 用户数据管理 Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserData, Settings, GameRecord, ThemeType, DifficultyConfig } from '../types'
import { allMedals } from '../data/medals'

const STORAGE_KEY = 'sudoku_user_data'

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
        return { ...defaultUserData, ...parsed, settings: { ...defaultSettings, ...parsed.settings } }
      }
    } catch (e) {
      console.error('Failed to load user data:', e)
    }
    return defaultUserData
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
   */
  function unlockMedal(medalId: string) {
    if (!userData.value.medals.includes(medalId)) {
      userData.value.medals.push(medalId)
      saveUserData()
      return true  // 新解锁
    }
    return false  // 已解锁
  }

  /**
   * 检查并解锁所有符合条件的勋章
   * 返回本次新解锁的勋章名称列表
   */
  function checkAndUnlockMedals(record: GameRecord): string[] {
    const unlocked: string[] = []

    // === 关卡勋章 ===
    if (record.completed && record.puzzleId.includes('level')) {
      const levelMatch = record.puzzleId.match(/level-(\d+)/)
      if (levelMatch) {
        const levelNum = parseInt(levelMatch[1])
        if (levelNum >= 1 && levelNum <= 99) {
          const medalId = `medal_${levelNum}`
          if (unlockMedal(medalId)) {
            const medal = allMedals.find(m => m.id === medalId)
            if (medal) unlocked.push(medal.name)
          }
        }
      }
    }

    // === 终极勋章 ===
    const levelMedals = allMedals.filter(m => m.category === 'level')
    const unlockedLevelCount = userData.value.medals.filter(id => 
      levelMedals.some(m => m.id === id)
    ).length
    if (unlockedLevelCount >= 99) {
      if (unlockMedal('medal_100')) {
        unlocked.push('数独之神')
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
   */
  function updateSettings(newSettings: Partial<Settings>) {
    userData.value.settings = { ...userData.value.settings, ...newSettings }
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
   */
  function applyTheme(theme: ThemeType) {
    document.documentElement.setAttribute('data-theme', theme)
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
   */
  function importData(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData)
      userData.value = { ...defaultUserData, ...imported }
      saveUserData()
      applyTheme(userData.value.settings.theme)
      return true
    } catch (e) {
      console.error('Failed to import data:', e)
      return false
    }
  }

  /**
   * 清除所有数据
   */
  function clearData() {
    userData.value = defaultUserData
    saveUserData()
    applyTheme('light')
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