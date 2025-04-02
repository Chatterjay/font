<script setup>
import { ref, onMounted, watch, onUnmounted } from "vue";
import { saveToStorage, getFromStorage } from "../utils/storage";
import { STORAGE_KEYS, THEME_MODES } from "../constants";

const theme = ref(THEME_MODES.LIGHT);
const isSystemTheme = ref(false);
const showThemeMenu = ref(false);

// 主题选项
const themes = [
  { id: THEME_MODES.LIGHT, name: "浅色", icon: "☀️" },
  { id: THEME_MODES.DARK, name: "深色", icon: "🌙" },
  { id: "high-contrast", name: "高对比度", icon: "⚡" },
  { id: "warm", name: "暖色", icon: "🔥" },
  { id: "cool", name: "冷色", icon: "❄️" },
];

// 从localStorage加载主题设置
const loadTheme = () => {
  const savedTheme = getFromStorage(STORAGE_KEYS.THEME);
  const savedIsSystemTheme = getFromStorage("isSystemTheme");

  if (savedIsSystemTheme === true) {
    isSystemTheme.value = true;
    theme.value = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  } else if (savedTheme) {
    theme.value = savedTheme;
    isSystemTheme.value = false;
  } else {
    // 默认跟随系统
    isSystemTheme.value = true;
    theme.value = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  }
};

// 保存主题设置到localStorage
const saveTheme = () => {
  saveToStorage(STORAGE_KEYS.THEME, theme.value);
  saveToStorage("isSystemTheme", isSystemTheme.value);
};

// 切换主题
const setTheme = (newTheme) => {
  theme.value = newTheme;
  isSystemTheme.value = false;
  saveTheme();
  showThemeMenu.value = false;
};

// 切换是否跟随系统
const toggleSystemTheme = () => {
  isSystemTheme.value = !isSystemTheme.value;
  if (isSystemTheme.value) {
    theme.value = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? THEME_MODES.DARK
      : THEME_MODES.LIGHT;
  }
  saveTheme();
};

// 监听系统主题变化
const systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
const handleSystemThemeChange = (e) => {
  if (isSystemTheme.value) {
    theme.value = e.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT;
  }
};

// 点击外部关闭主题菜单
const handleClickOutside = (event) => {
  if (!event.target.closest(".theme-toggle")) {
    showThemeMenu.value = false;
  }
};

// 监听主题变化
watch(theme, (newTheme) => {
  document.documentElement.setAttribute("data-theme", newTheme);
});

onMounted(() => {
  loadTheme();
  systemThemeMediaQuery.addEventListener("change", handleSystemThemeChange);
  document.addEventListener("click", handleClickOutside);
});

// 组件卸载时移除事件监听
onUnmounted(() => {
  systemThemeMediaQuery.removeEventListener("change", handleSystemThemeChange);
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="theme-toggle">
    <button
      class="theme-btn"
      @click="showThemeMenu = !showThemeMenu"
      :title="'当前主题：' + themes.find((t) => t.id === theme)?.name"
      aria-label="切换主题"
    >
      <span class="theme-icon">{{ themes.find((t) => t.id === theme)?.icon }}</span>
    </button>

    <Transition name="slide-fade">
      <div v-if="showThemeMenu" class="theme-menu">
        <div class="theme-menu-header">
          <span>选择主题</span>
          <button
            class="system-btn"
            @click="toggleSystemTheme"
            :title="isSystemTheme ? '取消跟随系统' : '跟随系统'"
            :class="{ active: isSystemTheme }"
            aria-label="切换系统主题"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"
              />
            </svg>
          </button>
        </div>

        <div class="theme-options">
          <button
            v-for="t in themes"
            :key="t.id"
            class="theme-option"
            :class="{ active: theme === t.id }"
            @click="setTheme(t.id)"
          >
            <span class="theme-icon">{{ t.icon }}</span>
            <span class="theme-name">{{ t.name }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-toggle {
  position: relative;
}

.theme-btn {
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
}

.theme-btn:hover {
  color: var(--text-primary);
  background-color: var(--background-tertiary);
  transform: translateY(-1px);
}

.theme-icon {
  font-size: 1.25rem;
}

.theme-menu {
  position: absolute;
  top: calc(100% + var(--spacing-sm));
  right: 0;
  background-color: var(--background-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm);
  min-width: 200px;
  z-index: 1000;
  transform-origin: top right;
  animation: menuAppear 0.2s ease-out;
}

@keyframes menuAppear {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.theme-menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--spacing-sm);
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.theme-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  width: 100%;
  text-align: left;
  transition: var(--transition-fast);
  border: 1px solid transparent;
}

.theme-option:hover {
  background-color: var(--background-tertiary);
  transform: translateX(4px);
}

.theme-option.active {
  background-color: var(--background-tertiary);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.theme-name {
  font-size: 0.875rem;
}

.system-btn {
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: var(--transition-fast);
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
}

.system-btn:hover {
  color: var(--text-primary);
  background-color: var(--background-tertiary);
  transform: translateY(-1px);
}

.system-btn.active {
  color: var(--primary-color);
  background-color: var(--background-tertiary);
  border-color: var(--primary-color);
}

/* 过渡动画 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

@media (max-width: 870px) {
  .theme-menu {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    margin: var(--spacing-md);
    max-height: 80vh;
    overflow-y: auto;
    transform-origin: bottom;
    animation: mobileMenuAppear 0.3s ease-out;
  }

  @keyframes mobileMenuAppear {
    from {
      opacity: 0;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    transform: translateY(100%);
  }
}
</style>
