<template>
  <div class="random-page">
    <header class="header">
      <button class="btn btn-icon btn-secondary" @click="goBack">←</button>
      <h1 class="title">随机挑战</h1>
      <div></div>
    </header>

    <div class="random-content">
      <div class="card random-card">
        <div class="random-icon">🎲</div>
        <h2 class="random-title">随机挑战</h2>
        <p class="random-desc">
          从标准版 99 个关卡中随机抽取一关，考验你的真实力！
        </p>
        <div class="random-info">
          <div class="info-item">
            <span class="info-label">关卡范围</span>
            <span class="info-value">1 - 99</span>
          </div>
          <div class="info-item">
            <span class="info-label">默认难度</span>
            <span class="info-value">高级</span>
          </div>
        </div>
        <button class="btn btn-large btn-primary" @click="startRandom">
          🎲 开始随机挑战
        </button>
      </div>

      <div class="card tips-card">
        <h3>挑战说明</h3>
        <ul class="tips-list">
          <li>每次随机从标准版中抽取一关</li>
          <li>默认高级难度，可在游戏中切换</li>
          <li>完成随机挑战同样计入总记录</li>
          <li>随时可以退出，进度不会保存</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function startRandom() {
  const randomLevel = Math.floor(Math.random() * 99) + 1
  router.push(`/game/9/hard?level=${randomLevel}&random=true`)
}

function goBack() {
  router.push('/home')
}
</script>

<style scoped>
.random-page {
  min-height: 100vh;
  background-color: var(--bg-primary);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-light);
}

.header .title {
  font-size: 18px;
  color: var(--text-primary);
}

.random-content {
  padding: 20px;
}

.random-card {
  text-align: center;
  padding: 32px 20px;
  margin-bottom: 20px;
}

.random-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.random-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.random-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  line-height: 1.6;
}

.random-info {
  display: flex;
  justify-content: space-around;
  margin-bottom: 24px;
  padding: 16px;
  background-color: var(--bg-secondary);
  border-radius: var(--radius-medium);
}

.info-item {
  text-align: center;
}

.info-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.info-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--accent-primary);
}

.btn-primary {
  background-color: var(--accent-primary);
  color: var(--text-inverse);
  width: 100%;
}

.tips-card {
  padding: 20px;
}

.tips-card h3 {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.tips-list {
  list-style: none;
  padding: 0;
}

.tips-list li {
  font-size: 14px;
  color: var(--text-secondary);
  padding-left: 20px;
  position: relative;
  margin-bottom: 8px;
}

.tips-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent-primary);
}
</style>
