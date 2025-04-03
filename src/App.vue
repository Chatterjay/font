<script setup>
import { ref, provide, onMounted, computed } from "vue";
import FontList from "./components/FontList.vue";
import FontPreview from "./components/FontPreview.vue";
import FavoriteList from "./components/FavoriteList.vue";
import SearchBar from "./components/SearchBar.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import AppActions from "./components/AppActions.vue";
import { saveToStorage, getFromStorage } from "./utils/storage";
import { STORAGE_KEYS, LAYOUT_MODES } from "./constants";
import { invoke } from "@tauri-apps/api/tauri";

// 检测字体兼容性
const checkFontCompatibility = () => {
  // 检测字符是否在字体中正确显示
  const testFallbackFont = () => {
    const appLogo = document.querySelector(".app-logo");
    if (appLogo) {
      // 添加回退字体确保显示
      appLogo.style.fontFamily = "'Microsoft YaHei', 'SimHei', sans-serif";
    }
  };

  // DOM加载完成后执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", testFallbackFont);
  } else {
    testFallbackFont();
  }
};

// 搜索查询
const searchQuery = ref("");
// 当前选中的字体
const selectedFont = ref("");
// 收藏的字体列表 - 提升到父组件以便共享
const favorites = ref([]);
// 商用字体列表
const commercialFonts = ref(new Set());
// 布局模式
const isSideBySide = ref(true);
const fonts = ref([]);
const loading = ref(true);
// 当前激活的标签页
const activeTab = ref("all");

// 从localStorage加载收藏的字体
const loadFavorites = () => {
  favorites.value = getFromStorage(STORAGE_KEYS.FAVORITES, []);
};

// 从localStorage加载商用字体
const loadCommercialFonts = () => {
  const savedFonts = getFromStorage(STORAGE_KEYS.COMMERCIAL_FONTS, []);
  commercialFonts.value = new Set(savedFonts);
};

// 保存收藏的字体到localStorage
const saveFavorites = () => {
  saveToStorage(STORAGE_KEYS.FAVORITES, favorites.value);
};

// 保存商用字体到localStorage
const saveCommercialFonts = () => {
  saveToStorage(STORAGE_KEYS.COMMERCIAL_FONTS, Array.from(commercialFonts.value));
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

// 切换商用状态
const toggleCommercial = (fontName) => {
  if (commercialFonts.value.has(fontName)) {
    commercialFonts.value.delete(fontName);
  } else {
    commercialFonts.value.add(fontName);
  }
  saveCommercialFonts();
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

// 清除搜索
const clearSearchQuery = () => {
  searchQuery.value = "";

  // 通过触发搜索框自身的清除功能
  // 查找搜索框组件中的清除按钮并点击它
  setTimeout(() => {
    const searchInput = document.querySelector(".search-input");
    if (searchInput) {
      // 确保搜索框值被更新
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, 0);
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

// 切换标签页
const switchTab = (tab) => {
  activeTab.value = tab;
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

// 计算商用字体数量
const commercialCount = computed(() => commercialFonts.value.size);

// 提供收藏相关的方法和数据给子组件
provide("favorites", favorites);
provide("toggleFavorite", toggleFavorite);
provide("removeFavorite", removeFavorite);

// 提供商用字体相关的方法和数据
provide("commercialFonts", commercialFonts);
provide("toggleCommercial", toggleCommercial);

// 提供布局相关的状态和方法
provide("isSideBySide", isSideBySide);
provide("toggleLayout", toggleLayout);

// 初始加载
onMounted(() => {
  loadFavorites();
  loadCommercialFonts();
  loadLayout();
  getSystemFonts();
  checkFontCompatibility();

  // 默认选择字体预览标签页
  activeTab.value = "preview";

  // 添加延迟确保DOM已经更新
  setTimeout(() => {
    // 找到预览标签按钮并添加初始聚焦效果
    const previewTab = document.querySelector('.tab-btn[class*="active"]');
    if (previewTab) {
      previewTab.classList.add("initial-focus");
      setTimeout(() => {
        previewTab.classList.remove("initial-focus");
      }, 800);
    }

    // 确保CSS变量已经正确加载
    const rootElement = document.documentElement;
    const computedStyle = getComputedStyle(rootElement);

    // 检查必要的CSS变量是否存在，如果不存在则添加
    if (!computedStyle.getPropertyValue("--primary-rgb").trim()) {
      rootElement.style.setProperty("--primary-rgb", "79, 70, 229");
    }
    if (!computedStyle.getPropertyValue("--success-rgb").trim()) {
      rootElement.style.setProperty("--success-rgb", "16, 185, 129");
    }
    if (!computedStyle.getPropertyValue("--warning-rgb").trim()) {
      rootElement.style.setProperty("--warning-rgb", "245, 158, 11");
    }
    if (!computedStyle.getPropertyValue("--danger-rgb").trim()) {
      rootElement.style.setProperty("--danger-rgb", "239, 68, 68");
    }
    if (!computedStyle.getPropertyValue("--accent-rgb").trim()) {
      rootElement.style.setProperty("--accent-rgb", "139, 92, 246");
    }
  }, 100);
});
</script>

<template>
  <div class="app-container" :class="{ 'side-by-side': isSideBySide }">
    <div class="sidebar">
      <div class="logo-container">
        <h1 class="app-logo compatibility-fix">字体查看器</h1>
      </div>
      <div class="sidebar-actions">
        <button
          class="sidebar-btn"
          :class="{ active: isSideBySide }"
          @click="toggleLayout"
          title="切换布局"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
            />
          </svg>
          <span>{{ isSideBySide ? "上下布局" : "左右布局" }}</span>
          <div class="layout-indicator">
            <div class="indicator-dot" :class="{ active: isSideBySide }"></div>
          </div>
        </button>
        <ThemeToggle class="sidebar-item" />
        <AppActions class="sidebar-item" />
      </div>
    </div>

    <div class="main-content">
    <header class="app-header">
        <h1>系统字体查看器</h1>
        <p class="app-description">预览、搜索和收藏您喜欢的字体</p>
        <SearchBar @search="handleSearch" class="search-component" />
    </header>

    <main class="app-content" :class="{ 'side-by-side': isSideBySide }">
        <transition name="panel-transition" mode="out-in">
          <div
            :key="isSideBySide ? 'side-by-side' : 'stacked'"
            class="panels-container"
            :class="{ 'side-by-side': isSideBySide }"
          >
      <div class="left-panel">
              <div class="app-font-list-wrapper">
          <FontList
            :fonts="fonts"
            :search-query="searchQuery"
            :is-side-by-side="isSideBySide"
                  :current-font="selectedFont"
            @select-font="handleSelectFont"
                  @clear-search="clearSearchQuery"
          />
        </div>
      </div>

      <div class="right-panel">
              <div class="tabs-container">
                <div class="tabs-header">
                  <button
                    class="tab-btn"
                    :class="{ active: activeTab === 'preview' }"
                    @click="switchTab('preview')"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
                      />
                    </svg>
                    字体预览
                  </button>
                  <button
                    class="tab-btn"
                    :class="{ active: activeTab === 'favorites' }"
                    @click="switchTab('favorites')"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      />
                    </svg>
                    收藏字体
                    <span class="badge" v-if="favorites.length > 0">{{
                      favorites.length
                    }}</span>
                  </button>
                  <button
                    class="tab-btn"
                    :class="{ active: activeTab === 'commercial' }"
                    @click="switchTab('commercial')"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path
                        fill="currentColor"
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      />
                    </svg>
                    商用字体
                    <span class="badge" v-if="commercialCount > 0">{{
                      commercialCount
                    }}</span>
                  </button>
                </div>

                <div class="tab-content">
                  <div v-if="activeTab === 'preview'" class="tab-pane">
          <FontPreview
            :selected-font="selectedFont"
            :is-favorite="favorites.includes(selectedFont)"
                      :is-commercial="commercialFonts.has(selectedFont)"
            @toggle-favorite="toggleFavorite"
                      @toggle-commercial="toggleCommercial"
          />
        </div>

                  <div v-if="activeTab === 'favorites'" class="tab-pane">
                    <div class="favorite-wrapper">
                      <h3 class="section-title">收藏的字体</h3>
                      <div v-if="favorites.length === 0" class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48">
                          <path
                            fill="currentColor"
                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                          />
                        </svg>
                        <p>暂无收藏字体</p>
                        <p class="hint">点击字体卡片右上角的星标收藏字体</p>
                      </div>
                      <div v-else class="fonts-grid">
                        <div
                          v-for="font in favorites"
                          :key="font"
                          class="font-card"
                          @click="handleSelectFont(font)"
                        >
                          <div class="font-card-content">
                            <div class="font-name" :style="{ fontFamily: font }">
                              {{ font }}
                            </div>
                            <div class="font-sample" :style="{ fontFamily: font }">
                              AaBbCc 123 你好世界
                            </div>
                          </div>
                          <button
                            class="remove-btn"
                            @click.stop="removeFavorite(font)"
                            title="取消收藏"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16">
                              <path
                                fill="currentColor"
                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
      </div>

                  <div v-if="activeTab === 'commercial'" class="tab-pane">
                    <div class="commercial-wrapper">
                      <h3 class="section-title">可商用字体</h3>
                      <div v-if="commercialCount === 0" class="empty-state">
                        <svg viewBox="0 0 24 24" width="48" height="48">
                          <path
                            fill="currentColor"
                            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                          />
                        </svg>
                        <p>暂无商用字体</p>
                        <p class="hint">点击字体卡片右上角的商用标记添加商用字体</p>
                      </div>
                      <div v-else class="fonts-grid">
                        <div
                          v-for="font in Array.from(commercialFonts)"
                          :key="font"
                          class="font-card"
                          @click="handleSelectFont(font)"
                        >
                          <div class="font-card-content">
                            <div class="font-name" :style="{ fontFamily: font }">
                              {{ font }}
                            </div>
                            <div class="font-sample" :style="{ fontFamily: font }">
                              AaBbCc 123 你好世界
                            </div>
        </div>
                          <button
                            class="remove-btn commercial"
                            @click.stop="toggleCommercial(font)"
                            title="取消商用标记"
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              />
            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
        </div>
      </div>
        </transition>
      </main>
    </div>
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
  min-height: 100vh;
}

/* 标签页默认选中动画 */
.tab-btn.active {
  position: relative;
  overflow: hidden;
}

.tab-btn.active::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: linear-gradient(to right, var(--primary-color), var(--accent-color));
  animation: tabIndicatorAppear 0.5s ease forwards;
}

/* 初始聚焦效果 */
.tab-btn.initial-focus {
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.3);
  animation: tabPulse 0.8s ease;
}

@keyframes tabPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.3);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.3);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.3);
  }
}

@keyframes tabIndicatorAppear {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 标签内容切换动画 */
.tab-pane {
  animation: tabContentAppear 0.4s ease-out;
}

@keyframes tabContentAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:root {
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "Microsoft YaHei", "SimHei";

  /* 其他CSS变量 */
}

/* 确保特定字符的兼容性 */
.compatibility-fix {
  font-family: var(--font-family-base) !important;
}
</style>

<style scoped>
.app-container {
  display: grid;
  grid-template-columns: 250px 1fr;
  min-height: 100vh;
}

.sidebar {
  background-color: var(--background-primary);
  border-right: 1px solid var(--border-color);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
  box-shadow: var(--shadow-md);
  z-index: 10;
  overflow-y: auto;
}

.logo-container {
  margin-bottom: var(--spacing-xl);
}

.app-logo {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-align: center;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: auto;
}

.sidebar-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background-color: var(--background-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition-fast);
}

.sidebar-btn:hover {
  background-color: var(--background-tertiary);
  transform: translateY(-2px);
}

.sidebar-btn.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.layout-indicator {
  margin-left: auto;
  width: 40px;
  height: 18px;
  background-color: var(--background-tertiary);
  border-radius: 10px;
  position: relative;
  transition: var(--transition-fast);
}

.indicator-dot {
  position: absolute;
  width: 14px;
  height: 14px;
  background-color: var(--text-tertiary);
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: var(--transition-fast);
}

.indicator-dot.active {
  left: 24px;
  background-color: var(--primary-color);
}

.sidebar-item {
  margin-top: var(--spacing-sm);
}

.main-content {
  flex: 1;
  padding: var(--spacing-lg);
  max-width: 100%;
  overflow-x: hidden;
}

.app-header {
  margin-bottom: var(--spacing-lg);
  text-align: center;
}

.app-header h1 {
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-xs);
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-description {
  color: var(--text-secondary);
  margin-top: 0;
  margin-bottom: var(--spacing-md);
}

.search-component {
  max-width: 600px;
  margin: 0 auto;
}

.app-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.panels-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  transition: all 0.5s ease;
}

.panels-container.side-by-side {
  flex-direction: row;
  align-items: flex-start;
}

.panel-transition-enter-active,
.panel-transition-leave-active {
  transition: all 0.5s ease;
}

.panel-transition-enter-from,
.panel-transition-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.left-panel,
.right-panel {
  flex: 1;
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all 0.5s ease;
}

.panels-container.side-by-side .left-panel,
.panels-container.side-by-side .right-panel {
  min-height: calc(100vh - 200px);
  max-height: calc(100vh - 200px);
}

/* 修改为app-font-list-wrapper类，避免与FontList组件中的.font-list-container冲突 */
.app-font-list-wrapper {
  background-color: var(--background-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs-container {
  background-color: var(--background-primary);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--background-secondary);
}

.tab-btn {
  flex: 1;
  padding: var(--spacing-md);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  transition: var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.tab-btn:hover {
  color: var(--primary-color);
  background-color: var(--background-tertiary);
}

.tab-btn.active {
  color: var(--primary-color);
  font-weight: 600;
}

.tab-btn.active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

.tab-btn svg {
  width: 18px;
  height: 18px;
}

.badge {
  background-color: var(--primary-color);
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: var(--spacing-xs);
}

.tab-content {
  padding: var(--spacing-md);
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.tab-pane {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.section-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-top: 0;
  margin-bottom: var(--spacing-md);
  color: var(--text-primary);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--border-color);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) 0;
  color: var(--text-tertiary);
  text-align: center;
}

.empty-state svg {
  color: var(--text-tertiary);
  opacity: 0.5;
  margin-bottom: var(--spacing-md);
}

.empty-state p {
  margin: var(--spacing-xs) 0;
}

.empty-state .hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

.fonts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.font-card {
  position: relative;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.font-card:hover {
  transform: translateY(-4px);
  background-color: var(--background-primary);
  border-color: var(--primary-color);
  box-shadow: var(--shadow-md);
}

.font-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.font-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.font-sample {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  opacity: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: var(--background-primary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
}

.font-card:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background-color: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
  transform: scale(1.1);
}

.remove-btn.commercial:hover {
  background-color: var(--success-color);
  border-color: var(--success-color);
}

@media (max-width: 1200px) {
  .panels-container.side-by-side {
    flex-direction: column;
  }

  .panels-container.side-by-side .left-panel,
  .panels-container.side-by-side .right-panel {
    max-height: none;
  }
}

@media (max-width: 768px) {
  .app-container {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    height: auto;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    border-right: none;
    border-top: 1px solid var(--border-color);
    z-index: 100;
  }

  .logo-container {
    margin-bottom: 0;
  }

  .sidebar-actions {
    flex-direction: row;
    margin-top: 0;
  }

  .main-content {
    padding-bottom: 80px;
  }
}
</style>
