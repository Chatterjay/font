<script setup>
import { ref, provide, onMounted } from "vue";
import FontList from "./components/FontList.vue";
import FontPreview from "./components/FontPreview.vue";
import FavoriteList from "./components/FavoriteList.vue";
import SearchBar from "./components/SearchBar.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import AppActions from "./components/AppActions.vue";
import { saveToStorage, getFromStorage } from "./utils/storage";
import { STORAGE_KEYS, LAYOUT_MODES } from "./constants";
import { invoke } from "@tauri-apps/api/tauri";

// 搜索查询
const searchQuery = ref("");
// 当前选中的字体
const selectedFont = ref("");
// 收藏的字体列表 - 提升到父组件以便共享
const favorites = ref([]);
// 布局模式
const isSideBySide = ref(false);
const fonts = ref([]);
const loading = ref(true);

// 从localStorage加载收藏的字体
const loadFavorites = () => {
  favorites.value = getFromStorage(STORAGE_KEYS.FAVORITES, []);
};

// 保存收藏的字体到localStorage
const saveFavorites = () => {
  saveToStorage(STORAGE_KEYS.FAVORITES, favorites.value);
};

// 切换收藏状态
const toggleFavorite = (fontName) => {
  if (favorites.value.includes(fontName)) {
    favorites.value = favorites.value.filter((name) => name !== fontName);
  } else {
    favorites.value.push(fontName);
  }
  saveFavorites();
};

// 移除收藏
const removeFavorite = (fontName) => {
  favorites.value = favorites.value.filter((name) => name !== fontName);
  saveFavorites();
};

// 处理搜索
const handleSearch = (query) => {
  searchQuery.value = query;
};

// 处理字体选择
const handleSelectFont = (fontName) => {
  selectedFont.value = fontName;
};

// 从localStorage加载布局状态
const loadLayout = () => {
  const savedLayout = getFromStorage(STORAGE_KEYS.LAYOUT);
  isSideBySide.value = savedLayout === LAYOUT_MODES.HORIZONTAL;
};

// 保存布局状态到localStorage
const saveLayout = () => {
  saveToStorage(
    STORAGE_KEYS.LAYOUT,
    isSideBySide.value ? LAYOUT_MODES.HORIZONTAL : LAYOUT_MODES.VERTICAL
  );
};

// 切换布局模式
const toggleLayout = () => {
  isSideBySide.value = !isSideBySide.value;
  saveLayout();
};

// 获取系统字体
const getSystemFonts = async () => {
  try {
    const result = await invoke("get_system_fonts");
    fonts.value = result.map((font) => ({
      name: font.name,
      family: font.family,
      style: font.style,
      path: font.path,
    }));
    loading.value = false;
  } catch (error) {
    console.error("获取系统字体失败:", error);
    loading.value = false;
  }
};

// 提供收藏相关的方法和数据给子组件
provide("favorites", favorites);
provide("toggleFavorite", toggleFavorite);
provide("removeFavorite", removeFavorite);

// 提供布局相关的状态和方法
provide("isSideBySide", isSideBySide);
provide("toggleLayout", toggleLayout);

// 初始加载
onMounted(() => {
  loadFavorites();
  loadLayout();
  getSystemFonts();
});
</script>

<template>
  <div class="app-container" :class="{ 'side-by-side': isSideBySide }">
    <header class="app-header">
      <div class="header-content">
        <h1>系统字体查看器</h1>
        <p class="app-description">预览、搜索和收藏您喜欢的字体</p>
      </div>
      <div class="header-actions">
        <button class="layout-toggle" @click="toggleLayout">
          {{ isSideBySide ? "切换为上下布局" : "切换为左右布局" }}
        </button>
        <AppActions />
        <ThemeToggle class="theme-toggle-wrapper" />
      </div>
    </header>

    <main class="app-content" :class="{ 'side-by-side': isSideBySide }">
      <div class="left-panel">
        <SearchBar @search="handleSearch" />
        <div class="font-list-container">
          <FontList
            :fonts="fonts"
            :search-query="searchQuery"
            :is-side-by-side="isSideBySide"
            @select-font="handleSelectFont"
          />
        </div>
      </div>

      <div class="right-panel">
        <div class="font-preview-container">
          <FontPreview
            :selected-font="selectedFont"
            :is-favorite="favorites.includes(selectedFont)"
            @toggle-favorite="toggleFavorite"
          />
        </div>
        <FavoriteList @select-font="handleSelectFont" />
      </div>
    </main>

    <footer class="app-footer">
      <div class="footer-content">
        <div class="footer-info">
          <p class="copyright">© {{ new Date().getFullYear() }} 系统字体查看器</p>
          <p class="description">一个简单易用的系统字体预览工具</p>
        </div>
        <div class="footer-links">
          <a
            href="https://github.com/Chatterjay/font-viewer"
            target="_blank"
            class="footer-link"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@import "./styles/variables.css";

body {
  background-color: var(--background-color);
  color: var(--text-primary);
  font-family: var(--font-family-base);
  margin: 0;
  padding: 0;
  line-height: 1.6;
  transition: background-color var(--transition-normal), color var(--transition-normal);
}

#app {
  width: 100%;
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: var(--container-padding);
}
</style>

<style scoped>
.app-container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.app-header {
  background-color: var(--background-primary);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-xl);
}

.header-content {
  flex: 1;
}

.app-header h1 {
  color: var(--text-primary);
  font-size: var(--font-size-3xl);
  font-weight: 700;
  margin-bottom: var(--spacing-sm);
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-description {
  color: var(--text-secondary);
  font-size: var(--font-size-lg);
  max-width: 600px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.theme-toggle-wrapper {
  margin-left: var(--spacing-md);
}

.layout-toggle {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: var(--transition-normal);
}

.layout-toggle:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
}

.app-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  will-change: flex-direction;
  transition: var(--transition-normal);
  flex: 1;
  min-height: 0;
}

.app-content.side-by-side {
  flex-direction: row;
  height: calc(100vh - 200px);
}

.left-panel,
.right-panel {
  flex: 1;
  min-width: 0;
  will-change: transform, width;
  transition: var(--transition-normal);
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.font-list-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.font-preview-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* 添加进入和离开的过渡效果 */
.app-content:not(.side-by-side) .left-panel,
.app-content:not(.side-by-side) .right-panel {
  width: 100%;
  transform: translateX(0);
}

.app-content.side-by-side .left-panel,
.app-content.side-by-side .right-panel {
  width: 50%;
  transform: translateX(0);
}

.app-footer {
  margin-top: auto;
  padding: var(--spacing-xl) 0;
  border-top: 1px solid var(--border-color);
  background-color: var(--background-primary);
}

.footer-content {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 var(--spacing-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.copyright {
  color: var(--text-primary);
  font-weight: 500;
  margin: 0;
}

.description {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}

.footer-links {
  display: flex;
  gap: var(--spacing-lg);
}

.footer-link {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: var(--transition-fast);
}

.footer-link:hover {
  color: var(--primary-color);
  transform: translateY(-1px);
}

.footer-link svg {
  transition: var(--transition-fast);
}

.footer-link:hover svg {
  transform: scale(1.1);
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .app-header {
    flex-direction: column;
    text-align: center;
    padding: var(--spacing-lg);
  }

  .header-actions {
    width: 100%;
    justify-content: center;
    margin-top: var(--spacing-md);
  }

  .app-description {
    margin: 0 auto;
  }

  .theme-toggle-wrapper {
    margin-left: var(--spacing-sm);
  }

  .app-content.side-by-side {
    flex-direction: column;
    height: auto;
  }

  .app-content.side-by-side .left-panel,
  .app-content.side-by-side .right-panel {
    width: 100%;
  }

  .layout-toggle {
    display: none;
  }
}

@media (max-width: 870px) {
  .app-container {
    padding: var(--spacing-md);
  }

  .app-header {
    padding: var(--spacing-md);
  }

  .app-header h1 {
    font-size: var(--font-size-2xl);
  }

  .app-description {
    font-size: var(--font-size-base);
  }

  .footer-content {
    flex-direction: column;
    gap: var(--spacing-lg);
    text-align: center;
    padding: 0 var(--spacing-md);
  }

  .footer-info {
    align-items: center;
  }
}
</style>
