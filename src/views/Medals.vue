<template>
  <div class="medals-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">勋章系统</h1>
      <div></div>
    </header>

    <div class="medals-content">
      <!-- 进度概览 -->
      <section class="progress-section">
        <div class="card progress-card">
          <div class="progress-header">
            <span class="progress-label">解锁进度</span>
            <span class="progress-value">{{ unlockedSet.size }}/{{ TOTAL_MEDAL_COUNT }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
        </div>
      </section>

      <!-- 分类筛选 -->
      <section class="filter-section">
        <div class="filter-scroll">
          <button
            class="filter-btn"
            :class="{ 'active': activeCategory === null }"
            @click="activeCategory = null"
          >
            <span class="filter-icon">🏅</span>
            <span class="filter-name">全部</span>
            <span class="filter-count">{{ unlockedSet.size }}/{{ TOTAL_MEDAL_COUNT }}</span>
          </button>
          <button
            v-for="cat in medalCategories"
            :key="cat.id"
            class="filter-btn"
            :class="{ 'active': activeCategory === cat.id }"
            @click="selectCategory(cat.id)"
          >
            <span class="filter-icon">{{ cat.icon }}</span>
            <span class="filter-name">{{ cat.name }}</span>
            <span class="filter-count">
              {{ categoryStats[cat.id]?.unlocked ?? 0 }}/{{ categoryStats[cat.id]?.total ?? 0 }}
            </span>
          </button>
        </div>
      </section>

      <!-- 已拥有/未拥有 Tab -->
      <section class="tab-section">
        <div class="tab-container">
          <button
            class="tab-btn"
            :class="{ 'active': activeTab === 'owned' }"
            @click="activeTab = 'owned'"
          >
            <span class="tab-icon">✅</span>
            <span class="tab-name">已拥有徽章</span>
            <span class="tab-count">({{ ownedMedals.length }})</span>
          </button>
          <button
            class="tab-btn"
            :class="{ 'active': activeTab === 'unowned' }"
            @click="activeTab = 'unowned'"
          >
            <span class="tab-icon">🔒</span>
            <span class="tab-name">未拥有徽章</span>
            <span class="tab-count">({{ unownedMedals.length }})</span>
          </button>
        </div>
      </section>

      <!-- 勋章列表(分页渲染,避免 1000 个 DOM 节点) -->
      <section class="medals-list-section">
        <div v-if="displayedMedals.length === 0" class="empty-state">
          <div class="empty-icon">🏆</div>
          <p>{{ activeTab === 'owned' ? '还没有获得该分类的勋章' : '该分类的勋章已全部收集!' }}</p>
        </div>
        <div v-else class="medals-grid">
          <div
            v-for="medal in pagedMedals"
            :key="medal.id"
            class="medal-item"
            :class="{ 'unlocked': isUnlocked(medal.id) }"
          >
            <div class="medal-icon">{{ isUnlocked(medal.id) ? medal.icon : '❓' }}</div>
            <div class="medal-info">
              <span class="medal-name">{{ isUnlocked(medal.id) ? medal.name : '???' }}</span>
              <span class="medal-desc">{{ isUnlocked(medal.id) ? medal.description : '未解锁' }}</span>
            </div>
            <div v-if="isUnlocked(medal.id)" class="medal-status">
              <span class="unlock-badge">已解锁</span>
              <span v-if="unlockedDate(medal.id)" class="unlock-date">{{ unlockedDate(medal.id) }}</span>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div v-if="displayedMedals.length > pageSize" class="load-more">
          <button class="btn btn-secondary" @click="showMore">
            加载更多(剩余 {{ displayedMedals.length - pageSize }} 个)
          </button>
        </div>
      </section>
    </div>

    <nav class="bottom-nav">
      <button class="nav-item" @click="goHome">
        <span class="nav-icon">🏠</span>
        <span class="nav-label">首页</span>
      </button>
      <button class="nav-item" @click="goToRecords">
        <span class="nav-icon">📊</span>
        <span class="nav-label">记录</span>
      </button>
      <button class="nav-item active" @click="goToMedals">
        <span class="nav-icon">🏆</span>
        <span class="nav-label">勋章</span>
      </button>
      <button class="nav-item" @click="goToSettings">
        <span class="nav-icon">⚙️</span>
        <span class="nav-label">设置</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { allMedals, medalCategories, TOTAL_MEDAL_COUNT } from '../data/medals'
import type { MedalCategory } from '../types'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref<'owned' | 'unowned'>('owned')
/** null 表示「全部」 */
const activeCategory = ref<MedalCategory | null>(null)

/** 用 Set 做 O(1) 查询 —— 1000 个勋章用 includes 会明显卡顿 */
const unlockedSet = computed(() => new Set(userStore.userData.medals))

/** 各分类的总数与已解锁数 */
const categoryStats = computed(() => {
  const map: Record<string, { total: number; unlocked: number }> = {}
  for (const c of medalCategories) map[c.id] = { total: 0, unlocked: 0 }
  for (const m of allMedals) {
    const s = map[m.category]
    if (!s) continue
    s.total++
    if (unlockedSet.value.has(m.id)) s.unlocked++
  }
  return map
})

const progressPercent = computed(() => {
  return Math.round((unlockedSet.value.size / TOTAL_MEDAL_COUNT) * 100)
})

/** 经分类过滤后的勋章 */
const categoryFiltered = computed(() => {
  if (activeCategory.value === null) return allMedals
  return allMedals.filter(m => m.category === activeCategory.value)
})

const ownedMedals = computed(() => {
  return categoryFiltered.value.filter(m => unlockedSet.value.has(m.id))
})

const unownedMedals = computed(() => {
  return categoryFiltered.value.filter(m => !unlockedSet.value.has(m.id))
})

const displayedMedals = computed(() => {
  return activeTab.value === 'owned' ? ownedMedals.value : unownedMedals.value
})

/** 分页渲染:1000 个勋章一次性进 DOM 会拖慢移动端,改为分批展示 */
const pageSize = 60
const visibleCount = ref(pageSize)

const pagedMedals = computed(() => {
  return displayedMedals.value.slice(0, visibleCount.value)
})

function showMore(): void {
  visibleCount.value += pageSize
}

// 切换分类 / Tab 时重置分页
watch([activeCategory, activeTab], () => {
  visibleCount.value = pageSize
})

function isUnlocked(medalId: string): boolean {
  return unlockedSet.value.has(medalId)
}

// Bug 修复 #9: 展示解锁日期
function unlockedDate(medalId: string): string {
  const iso = userStore.userData.medalUnlockedAt?.[medalId]
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 切换分类(null 再次点击已选分类可返回全部) */
function selectCategory(id: MedalCategory | null): void {
  activeCategory.value = activeCategory.value === id ? null : id
}

function goBack() {
  router.push('/home')
}

function goHome() {
  router.push('/home')
}

function goToRecords() {
  router.push('/records')
}

function goToMedals() {
  router.push('/medals')
}

function goToSettings() {
  router.push('/settings')
}
</script>

<style scoped>
.medals-page {
  min-height: 100vh;
  padding-bottom: 70px;
}

.header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top, 0px));
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.header .title {
  font-size: 18px;
}

.medals-content {
  padding: 16px 20px;
  /* 底部固定导航的高度,避免最后一项被遮住 */
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.progress-section {
  margin-bottom: 20px;
}

.progress-card {
  padding: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 14px;
}

.progress-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-primary);
}

.progress-bar {
  height: 8px;
  background-color: var(--bg-tertiary);
  border-radius: var(--radius-small);
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-primary);
  border-radius: var(--radius-small);
  transition: width 0.3s;
}

.tab-section {
  margin-bottom: 16px;
}

/* 分类筛选 */
.filter-section {
  margin-bottom: 16px;
}

.filter-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px 8px;
  -webkit-overflow-scrolling: touch;
}

.filter-btn {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 72px;
  padding: 8px 10px;
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-medium);
  background-color: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: var(--accent-primary);
}

.filter-btn.active {
  border-color: var(--accent-primary);
  background-color: var(--accent-light);
  color: var(--accent-primary);
}

.filter-icon {
  font-size: 18px;
}

.filter-name {
  font-size: 12px;
  white-space: nowrap;
}

.filter-count {
  font-size: 10px;
  opacity: 0.8;
  white-space: nowrap;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.load-more {
  text-align: center;
  padding: 16px 0;
}

.tab-container {
  display: flex;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-medium);
  padding: 4px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-medium);
  background-color: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.tab-btn.active {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
}

.tab-icon {
  font-size: 14px;
}

.tab-name {
  font-weight: 500;
}

.tab-count {
  font-size: 12px;
  opacity: 0.8;
}

.medals-list-section {
  margin-bottom: 20px;
}

.medals-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.medal-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: var(--bg-card);
  border-radius: var(--radius-medium);
  border: 1px solid var(--border-secondary);
  opacity: 0.5;
  transition: all 0.2s;
}

.medal-item.unlocked {
  opacity: 1;
  border-color: var(--accent-primary);
}

.medal-icon {
  font-size: 24px;
  margin-right: 12px;
}

.medal-info {
  flex: 1;
}

.medal-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.medal-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.medal-status {
  margin-left: 8px;
  text-align: right;
}

.unlock-badge {
  font-size: 10px;
  padding: 2px 6px;
  background-color: var(--accent-primary);
  color: var(--text-inverse);
  border-radius: var(--radius-small);
}

.unlock-date {
  display: block;
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 4px;
  text-align: right;
}

.bottom-nav {
  flex-shrink: 0;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-nav, 0 -2px 14px rgba(233, 69, 96, 0.12));
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.nav-item.active {
  color: var(--accent-primary);
}

.nav-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.nav-label {
  font-size: 12px;
}

@media (max-width: 480px) {
  .medals-grid {
    grid-template-columns: 1fr;
  }
}
</style>
