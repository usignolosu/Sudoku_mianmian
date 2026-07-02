<template>
  <div class="splash-page">
    <img class="bg-image" src="/splash-bg.jpg" alt="数独女孩">

    <!-- 对话框 -->
    <div class="speech-bubble">
      <span>你好，一起来玩数独吧</span>
    </div>

    <!-- 装饰数字 -->
    <div class="floating-number num1">5</div>
    <div class="floating-number num2">9</div>
    <div class="floating-number num3">3</div>
    <div class="floating-number num4">7</div>

    <!-- 游戏标题和按钮 -->
    <div class="content-bottom">
      <h1 class="game-title">表姐的数独</h1>
      
      <div class="btn-row">
        <button class="start-btn" @click="startGame">
          开始游戏
        </button>

        <div class="exclusive-badge">
          <span>💕 表姐专属游戏 💕</span>
        </div>
      </div>

      <p class="version-info">v1.0.0</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function startGame() {
  router.push('/home')
}
</script>

<style scoped>
.splash-page {
  width: 100%;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000;
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  position: absolute;
  top: 0;
  left: 0;
}

/* 对话框 */
.speech-bubble {
  position: absolute;
  top: 8%;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #fff0f5, #ffe4e1);
  border: 3px solid #e94560;
  border-radius: 25px;
  padding: 14px 28px;
  font-size: 18px;
  font-weight: 700;
  color: #c0392b;
  text-align: center;
  box-shadow: 0 8px 25px rgba(233, 69, 96, 0.3);
  animation: popIn 1s ease forwards, float 3s ease-in-out infinite 1s;
  z-index: 10;
  white-space: nowrap;
}

.speech-bubble::after {
  content: '';
  position: absolute;
  bottom: -15px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 15px solid transparent;
  border-right: 15px solid transparent;
  border-top: 18px solid #e94560;
}

.speech-bubble::before {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 15px solid #fff0f5;
  z-index: 1;
}

/* 装饰性数独数字漂浮 */
.floating-number {
  position: absolute;
  font-size: 28px;
  font-weight: 700;
  color: rgba(233, 69, 96, 0.3);
  animation: floatNum 4s ease-in-out infinite;
  pointer-events: none;
  z-index: 5;
}

.num1 { top: 20%; left: 8%; animation-delay: 0s; }
.num2 { top: 35%; right: 10%; animation-delay: 1s; }
.num3 { top: 60%; left: 5%; animation-delay: 2s; }
.num4 { top: 75%; right: 8%; animation-delay: 0.5s; }

/* 底部内容区域 */
.content-bottom {
  position: absolute;
  bottom: 8%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  z-index: 10;
  width: 100%;
  max-width: 400px;
  padding: 0 20px;
  animation: slideUp 1s ease forwards 0.3s;
  opacity: 0;
}

.game-title {
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 20px;
  letter-spacing: 2px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(233, 69, 96, 0.3);
}

.btn-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.start-btn {
  padding: 14px 35px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #ff6b8a, #e94560);
  border: none;
  border-radius: 30px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.5);
  transition: all 0.3s ease;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 25px rgba(233, 69, 96, 0.6);
}

.start-btn:active {
  transform: scale(0.98);
}

.exclusive-badge {
  padding: 10px 20px;
  background: rgba(233, 69, 96, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 30px;
}

.exclusive-badge span {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.version-info {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  margin: 0;
}

/* 动画 */
@keyframes popIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.5);
  }
  60% {
    transform: translateX(-50%) scale(1.1);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-8px);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes floatNum {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(10deg);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@media (max-width: 480px) {
  .speech-bubble {
    font-size: 16px;
    padding: 12px 22px;
    top: 6%;
  }

  .game-title {
    font-size: 28px;
  }

  .btn-row {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px;
  }

  .start-btn {
    padding: 12px 28px;
    font-size: 16px;
  }

  .exclusive-badge span {
    font-size: 12px;
  }

  .floating-number {
    font-size: 22px;
  }
}
</style>