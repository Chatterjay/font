<script setup>
import { ref, onMounted, onUnmounted, inject } from "vue";

// 右键菜单状态
const showContextMenu = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const isClosing = ref(false);
const showScrollToTop = ref(false);

// 注入布局状态和方法
const isSideBySide = inject("isSideBySide");
const toggleLayout = inject("toggleLayout");

// 加载布局状态
const loadLayout = () => {
  const savedLayout = localStorage.getItem("layout");
  isSideBySide.value = savedLayout === "horizontal";
};

// 检查是否需要显示回到顶部
const checkScrollPosition = () => {
  const fontList = document.querySelector(".font-list-container");
  const targetElement = document.elementFromPoint(contextMenuX.value, contextMenuY.value);

  if (fontList && fontList.contains(targetElement)) {
    // 在字体列表中，检查字体列表的滚动位置
    showScrollToTop.value = fontList.scrollTop > 100;
  } else {
    // 在其他区域，检查页面的滚动位置
    showScrollToTop.value = window.scrollY > 100;
  }
};

// 阻止默认右键菜单
const handleContextMenu = (e) => {
  e.preventDefault();
  isClosing.value = false;
  showContextMenu.value = true;

  // 获取菜单尺寸
  const menuWidth = 200; // 菜单最小宽度
  const menuHeight = 300; // 预估菜单高度

  // 计算菜单位置
  let x = e.clientX;
  let y = e.clientY;

  // 检查右边界
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth;
  }

  // 检查下边界
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight;
  }

  contextMenuX.value = x;
  contextMenuY.value = y;

  // 检查是否需要显示回到顶部
  checkScrollPosition();
};

// 点击其他地方关闭右键菜单
const handleClickOutside = () => {
  closeMenu();
};

// 关闭菜单
const closeMenu = () => {
  isClosing.value = true;
  setTimeout(() => {
    showContextMenu.value = false;
  }, 200);
};

// 生命周期钩子
onMounted(() => {
  document.addEventListener("contextmenu", handleContextMenu);
  document.addEventListener("click", handleClickOutside);
  loadLayout();
});

onUnmounted(() => {
  document.removeEventListener("contextmenu", handleContextMenu);
  document.removeEventListener("click", handleClickOutside);
});

// 检查是否在系统字体列表
const isInFontList = () => {
  const fontList = document.querySelector(".font-list-container");
  const targetElement = document.elementFromPoint(contextMenuX.value, contextMenuY.value);
  return fontList && fontList.contains(targetElement);
};

// 回到顶部
const scrollToTop = () => {
  const fontList = document.querySelector(".font-list-container");
  const targetElement = document.elementFromPoint(contextMenuX.value, contextMenuY.value);

  // 如果点击位置在字体列表内，滚动字体列表
  if (fontList && fontList.contains(targetElement)) {
    fontList.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    // 否则滚动整个页面
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  closeMenu();
};

// 导出配置
const exportConfig = () => {
  const config = {
    favorites: JSON.parse(localStorage.getItem("favoriteFonts") || "[]"),
    commercialFonts: JSON.parse(localStorage.getItem("commercialFonts") || "[]"),
    theme: localStorage.getItem("theme") || "system",
    layout: localStorage.getItem("layout") || "vertical",
    version: "1.0.0",
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "font-viewer-config.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showContextMenu.value = false;
};

// 导入配置
const importConfig = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const config = JSON.parse(event.target.result);
          if (config.version === "1.0.0") {
            localStorage.setItem("favoriteFonts", JSON.stringify(config.favorites));
            localStorage.setItem(
              "commercialFonts",
              JSON.stringify(config.commercialFonts)
            );
            if (config.theme) {
              localStorage.setItem("theme", config.theme);
            }
            if (config.layout) {
              localStorage.setItem("layout", config.layout);
            }
            window.location.reload();
          }
        } catch (error) {
          console.error("导入配置失败:", error);
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
  showContextMenu.value = false;
};

// 刷新页面
const refreshPage = () => {
  window.location.reload();
};

// 复制当前页面链接
const copyPageLink = () => {
  navigator.clipboard.writeText(window.location.href);
  showContextMenu.value = false;
};

// 清理缓存
const clearCache = () => {
  if (confirm("确定要清理所有缓存数据吗？这将清除所有收藏、商用标记和主题设置。")) {
    localStorage.clear();
    window.location.reload();
  }
};
</script>

<template>
  <div class="app-actions">
    <button
      class="action-btn"
      @click="exportConfig"
      title="导出所有配置（主题、收藏字体、商用标记）"
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
      </svg>
    </button>
    <button
      class="action-btn"
      @click="importConfig"
      title="导入配置（主题、收藏字体、商用标记）"
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
      </svg>
    </button>
    <button
      class="action-btn"
      @click="clearCache"
      title="这将清除所有收藏、商用标记和主题设置。"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 6h18"></path>
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      </svg>
    </button>
    <a
      href="https://github.com/Chatterjay/font-viewer"
      target="_blank"
      rel="noopener noreferrer"
      class="action-btn"
      title="访问  仓库"
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        <path
          fill="currentColor"
          d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"
        />
      </svg>
    </a>

    <!-- 自定义右键菜单 -->
    <div
      v-if="showContextMenu"
      class="context-menu"
      :class="{ closing: isClosing }"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
    >
      <div class="menu-item" @click="toggleLayout">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
          />
        </svg>
        {{ isSideBySide ? "切换为上下布局" : "切换为左右布局" }}
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="exportConfig">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
        导出配置
      </div>
      <div class="menu-item" @click="importConfig">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
        导入配置
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" @click="refreshPage">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
          />
        </svg>
        刷新页面
      </div>
      <div class="menu-item" @click="copyPageLink">
        <svg viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
          />
        </svg>
        复制页面链接
      </div>
      <div v-if="showScrollToTop" class="menu-item" @click="scrollToTop">
        <svg viewBox="0 0 24 24">
          <path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
        回到顶部
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-right: var(--spacing-md);
}

.action-btn {
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-fast);
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  width: 48px;
  height: 48px;
}

.action-btn:hover {
  color: var(--text-primary);
  background-color: var(--background-tertiary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-btn svg {
  width: 24px;
  height: 24px;
}

/* 右键菜单样式 */
.context-menu {
  position: fixed;
  background-color: var(--background-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-xs) 0;
  min-width: 200px;
  z-index: 1000;
  animation: menuAppear 0.2s ease-out;
  transform-origin: top left;
}

.context-menu.closing {
  animation: menuDisappear 0.2s ease-out forwards;
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

@keyframes menuDisappear {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--text-primary);
  cursor: pointer;
  transition: var(--transition-fast);
  animation: itemAppear 0.2s ease-out forwards;
  opacity: 0;
}

.menu-item:nth-child(1) {
  animation-delay: 0.05s;
}
.menu-item:nth-child(2) {
  animation-delay: 0.1s;
}
.menu-item:nth-child(3) {
  animation-delay: 0.15s;
}
.menu-item:nth-child(4) {
  animation-delay: 0.2s;
}
.menu-item:nth-child(6) {
  animation-delay: 0.25s;
}
.menu-item:nth-child(7) {
  animation-delay: 0.3s;
}

@keyframes itemAppear {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.menu-item:hover {
  background-color: var(--background-tertiary);
  color: var(--primary-color);
}

.menu-item:hover svg {
  color: var(--primary-color);
}

.menu-item svg {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  transition: var(--transition-fast);
}

.menu-divider {
  height: 1px;
  background-color: var(--border-color);
  margin: var(--spacing-xs) 0;
}

@media (max-width: 870px) {
  .context-menu {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
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
}
</style>
