<script setup>
import { ref, provide, onMounted, computed, watch, reactive, nextTick } from "vue";
import FontList from "./components/FontList.vue";
import FontPreview from "./components/FontPreview.vue";
import FavoriteList from "./components/FavoriteList.vue";
import SearchBar from "./components/SearchBar.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import SettingsSidebar from "./components/SettingsSidebar.vue";
import AppActions from "./components/AppActions.vue";
import UpdateNotifier from "./components/UpdateNotifier.vue";
import { saveToStorage, getFromStorage } from "./utils/storage";
import { STORAGE_KEYS, LAYOUT_MODES, APP_INFO } from "./constants";
import { invoke } from "@tauri-apps/api/tauri";
import BatchSelectableFontList from "./components/BatchSelectableFontList.vue";
import UpdateNotification from "./components/UpdateNotification.vue";
import { useRouter } from "vue-router";
import { fetchChangelogFromUpdatePackage, fetchLatestVersion } from "./utils/updateUtils";

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
// 页面显示模式
const currentPage = ref("horizontal"); // 默认使用左右布局模式
// 布局模式
const isSideBySide = computed(() => currentPage.value === "horizontal");
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

// 切换页面模式
const switchPageMode = (mode) => {
  currentPage.value = mode;
  savePageMode();

  // 更新HTML元素的类名，以便应用不同的滚动行为
  const htmlEl = document.documentElement;
  if (mode === "vertical") {
    htmlEl.classList.add("vertical-layout-mode");
  } else {
    htmlEl.classList.remove("vertical-layout-mode");
  }
};

// 从localStorage加载页面模式
const loadPageMode = () => {
  const savedMode = getFromStorage(STORAGE_KEYS.PAGE_MODE, "horizontal");
  currentPage.value = savedMode;
};

// 保存页面模式到localStorage
const savePageMode = () => {
  saveToStorage(STORAGE_KEYS.PAGE_MODE, currentPage.value);
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

// 批量移除收藏
const batchRemoveFavorites = (fontNames) => {
  fontNames.forEach((fontName) => {
    favorites.value = favorites.value.filter((name) => name !== fontName);
  });
  saveFavorites();
};

// 批量移除商用标记
const batchRemoveCommercial = (fontNames) => {
  fontNames.forEach((fontName) => {
    commercialFonts.value.delete(fontName);
  });
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
  // 先设置为空字符串
  searchQuery.value = "";

  // 通过触发搜索框自身的清除功能
  // 查找搜索框组件中的清除按钮并点击它
  setTimeout(() => {
    const clearButton = document.querySelector(".search-input-wrapper .clear-btn");
    if (clearButton) {
      // 直接点击清除按钮
      clearButton.click();
    } else {
      // 找不到清除按钮时，手动触发输入事件
      const searchInput = document.querySelector(".search-input");
      if (searchInput) {
        // 确保搜索框值被更新
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    // 确保FontList组件收到空查询
    const event = new CustomEvent("search-cleared");
    document.dispatchEvent(event);
  }, 0);
};

// 处理字体选择
const handleSelectFont = (fontName) => {
  selectedFont.value = fontName;

  // 如果不在预览标签页，切换到预览标签页以便查看字体
  if (activeTab.value !== "preview") {
    activeTab.value = "preview";
  }
};

// 从localStorage加载布局状态
const loadLayout = () => {
  const savedLayout = getFromStorage(STORAGE_KEYS.LAYOUT);
  // 仅用于兼容旧版本的数据，新版本不使用此设置
  if (savedLayout === LAYOUT_MODES.HORIZONTAL) {
    currentPage.value = "horizontal";
  } else if (savedLayout === LAYOUT_MODES.VERTICAL) {
    currentPage.value = "vertical";
  }
  savePageMode(); // 保存到新的存储键中
};

// 保存布局状态到localStorage
const saveLayout = () => {
  // 为了兼容性保留此方法，但将数据转存到新的PAGE_MODE中
  saveToStorage(
    STORAGE_KEYS.LAYOUT,
    isSideBySide.value ? LAYOUT_MODES.HORIZONTAL : LAYOUT_MODES.VERTICAL
  );
  savePageMode();
};

// 切换布局模式 - 兼容旧版本代码
const toggleLayout = () => {
  currentPage.value = currentPage.value === "horizontal" ? "vertical" : "horizontal";
  savePageMode();
  saveLayout(); // 同时保存旧版本数据
};

// 切换标签页
const switchTab = (tab) => {
  activeTab.value = tab;

  // 如果有选中的字体，切换标签页后触发字体定位
  if (selectedFont.value) {
    // 使用微任务确保DOM已更新后再滚动到对应字体
    setTimeout(() => {
      const event = new CustomEvent("locateFontInList", {
        detail: { fontName: selectedFont.value },
      });
      document.dispatchEvent(event);
    }, 200);
  }
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
provide("switchPageMode", switchPageMode);
provide("currentPage", currentPage);

// 提供当前选中的字体
provide("selectedFont", selectedFont);

// 在switchTab方法下方添加滚动到商用字体的函数
const scrollToCommercialFont = (fontName) => {
  if (!fontName || !commercialFonts.value.has(fontName)) return;

  // 确保DOM已更新
  setTimeout(() => {
    // 只在商用字体标签页中执行
    if (activeTab.value !== "commercial") return;

    const fontCards = document.querySelectorAll(".commercial-wrapper .font-card");
    const commercialArray = Array.from(commercialFonts.value);
    const fontIndex = commercialArray.indexOf(fontName);

    if (fontIndex >= 0 && fontCards[fontIndex]) {
      const container = document.querySelector(".fonts-grid");
      if (container) {
        const cardTop = fontCards[fontIndex].offsetTop;
        container.scrollTo({
          top: cardTop,
          behavior: "smooth",
        });
      }
    }
  }, 200);
};

// 监听Tab切换，处理字体定位
watch(
  () => activeTab.value,
  (newTab) => {
    if (
      newTab === "commercial" &&
      selectedFont.value &&
      commercialFonts.value.has(selectedFont.value)
    ) {
      scrollToCommercialFont(selectedFont.value);
    }
  }
);

// 初始加载
onMounted(() => {
  loadFavorites();
  loadCommercialFonts();
  loadLayout();
  loadPageMode(); // 加载页面模式
  getSystemFonts();
  checkFontCompatibility();

  // 根据当前布局模式设置HTML元素的类名
  const htmlEl = document.documentElement;
  if (currentPage.value === "vertical") {
    htmlEl.classList.add("vertical-layout-mode");
  } else {
    htmlEl.classList.remove("vertical-layout-mode");
  }

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

  // 延迟检查更新，让应用先加载完成
  setTimeout(() => {
    checkForUpdate();
  }, 3000);
});

const router = useRouter();
const showUpdateNotification = ref(false);
const newVersion = ref("");
const changelog = ref([]);

// 检查更新
const checkForUpdate = async () => {
  try {
    // 获取版本信息
    const versionInfo = await fetchLatestVersion(APP_INFO.VERSION);

    if (versionInfo.hasUpdate) {
      // 有更新，显示通知
      newVersion.value = versionInfo.version;

      // 获取更新日志
      const updateChangelog = await fetchChangelogFromUpdatePackage();
      changelog.value = updateChangelog;

      // 显示更新通知
      showUpdateNotification.value = true;
    }
  } catch (error) {
    console.error("检查更新失败:", error);
  }
};
</script>

<template>
  <div
    class="app-container"
    :class="{
      'horizontal-layout': currentPage === 'horizontal',
      'vertical-layout': currentPage === 'vertical',
    }"
  >
    <!-- 设置侧边栏组件 -->
    <SettingsSidebar />

    <!-- 更新提示组件 -->
    <UpdateNotification
      v-if="showUpdateNotification"
      :current-version="APP_INFO.VERSION"
      :new-version="newVersion"
      :changelog="changelog"
    />

    <!-- 使用路由视图 -->
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <!-- 主页内容 -->
    <div class="main-content" v-if="$route.path === '/'">
      <header class="app-header">
        <h1>系统字体查看器</h1>
        <div class="search-actions-container">
          <SearchBar @search="handleSearch" class="search-component" />
          <div class="layout-switcher">
            <button
              class="layout-btn"
              :class="{ active: currentPage === 'horizontal' }"
              @click="switchPageMode('horizontal')"
              title="左右布局"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M3 5v14h18V5H3zm16 6h-7V7h7v4zm-9 0H5V7h5v4zm-5 2h5v4H5v-4zm7 4v-4h7v4h-7z"
                />
              </svg>
              左右布局
            </button>
            <button
              class="layout-btn"
              :class="{ active: currentPage === 'vertical' }"
              @click="switchPageMode('vertical')"
              title="上下布局"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M3 5v14h18V5H3zm16 4H5V7h14v2zm0 4H5v-2h14v2zm0 4H5v-2h14v2z"
                />
              </svg>
              上下布局
            </button>
          </div>
          <AppActions />
        </div>
      </header>

      <!-- 使用transition组件添加过渡动画 -->
      <transition name="layout-fade" mode="out-in">
        <!-- 水平布局页面 -->
        <main
          v-if="currentPage === 'horizontal'"
          key="horizontal"
          class="app-content horizontal-layout"
        >
          <div class="panels-container horizontal">
            <div class="left-panel">
              <div class="app-font-list-wrapper">
                <FontList
                  :fonts="fonts"
                  :search-query="searchQuery"
                  :is-side-by-side="true"
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
                    <BatchSelectableFontList
                      :fonts="favorites"
                      :current-font="selectedFont"
                      type="favorites"
                      @select-font="handleSelectFont"
                      @remove-font="removeFavorite"
                      @batch-remove="batchRemoveFavorites"
                    />
                  </div>

                  <div v-if="activeTab === 'commercial'" class="tab-pane">
                    <BatchSelectableFontList
                      :fonts="Array.from(commercialFonts)"
                      :current-font="selectedFont"
                      type="commercial"
                      @select-font="handleSelectFont"
                      @remove-font="toggleCommercial"
                      @batch-remove="batchRemoveCommercial"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- 垂直布局页面 -->
        <main v-else key="vertical" class="app-content vertical-layout">
          <div class="panels-container vertical">
            <div class="top-panel">
              <div class="app-font-list-wrapper">
                <FontList
                  :fonts="fonts"
                  :search-query="searchQuery"
                  :is-side-by-side="false"
                  :current-font="selectedFont"
                  @select-font="handleSelectFont"
                  @clear-search="clearSearchQuery"
                />
              </div>
            </div>

            <div class="bottom-panel">
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
                    <BatchSelectableFontList
                      :fonts="favorites"
                      :current-font="selectedFont"
                      type="favorites"
                      @select-font="handleSelectFont"
                      @remove-font="removeFavorite"
                      @batch-remove="batchRemoveFavorites"
                    />
                  </div>

                  <div v-if="activeTab === 'commercial'" class="tab-pane">
                    <BatchSelectableFontList
                      :fonts="Array.from(commercialFonts)"
                      :current-font="selectedFont"
                      type="commercial"
                      @select-font="handleSelectFont"
                      @remove-font="toggleCommercial"
                      @batch-remove="batchRemoveCommercial"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </transition>
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
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 默认防止容器溢出 */
}

/* 垂直布局时允许滚动 */
.app-container.vertical-layout {
  overflow-y: auto; /* 垂直布局时允许滚动 */
}

.main-content {
  flex: 1;
  padding: var(--spacing-lg);
  max-width: 100%;
  width: 100%;
}

/* 垂直布局时允许内容滚动 */
.vertical-layout .main-content {
  overflow-y: visible; /* 允许垂直滚动 */
}

/* 水平布局时防止内容溢出 */
.horizontal-layout .main-content {
  overflow: hidden;
}

.app-header {
  margin-bottom: var(--spacing-md);
  padding-top: var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
}

.app-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.search-actions-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: var(--spacing-md);
}

.search-component {
  width: 500px;
  max-width: 100%;
}

/* 布局切换按钮样式 */
.layout-switcher {
  display: flex;
  gap: var(--spacing-xs);
  background-color: var(--background-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xs);
}

.layout-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  color: var(--text-secondary);
  background-color: transparent;
  transition: all 0.2s ease;
}

.layout-btn.active {
  background-color: var(--primary-color);
  color: white;
}

.layout-btn:hover:not(.active) {
  background-color: var(--background-tertiary);
  color: var(--primary-color);
}

.app-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  height: calc(100% - 150px); /* 考虑到头部的高度 */
}

/* 垂直布局内容区不限制高度 */
.vertical-layout.app-content {
  height: auto;
  min-height: calc(100% - 150px);
}

/* 水平布局样式 */
.panels-container.horizontal {
  display: flex;
  flex-direction: row;
  gap: var(--spacing-lg);
  transition: all 0.5s ease;
  overflow: hidden;
  height: calc(100vh - 200px);
  align-items: flex-start;
}

.horizontal-layout .left-panel,
.horizontal-layout .right-panel {
  flex: 1;
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all 0.5s ease;
  min-height: calc(100vh - 220px);
  max-height: calc(100vh - 220px);
}

/* 垂直布局样式 */
.panels-container.vertical {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  transition: all 0.5s ease;
  overflow: visible; /* 允许内容溢出，使用全局滚动条 */
  height: auto;
  padding-bottom: var(--spacing-xl); /* 增加底部填充，防止内容靠近底部 */
}

.vertical-layout .top-panel,
.vertical-layout .bottom-panel {
  width: 100%;
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all 0.5s ease;
}

.vertical-layout .top-panel {
  max-height: 60vh; /* 上方面板可调整高度 */
  min-height: 400px; /* 设置最小高度 */
  margin-bottom: var(--spacing-lg); /* 增加底部边距 */
}

.vertical-layout .bottom-panel {
  flex: 1;
  margin-bottom: var(--spacing-xl); /* 增加底部边距 */
}

/* 布局切换过渡动画 */
.layout-fade-enter-active,
.layout-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.layout-fade-enter-from,
.layout-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 通用面板样式 */
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

/* 水平布局的标签内容 */
.horizontal-layout .tab-content {
  padding: var(--spacing-md);
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

/* 垂直布局的标签内容 */
.vertical-layout .tab-content {
  padding: var(--spacing-md);
  max-height: calc(50vh - 100px);
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

.font-card.is-selected {
  background-color: var(--primary-color-10);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-color-20);
  transform: translateY(-2px);
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .panels-container.horizontal {
    flex-direction: column;
    height: auto;
  }

  .horizontal-layout .left-panel,
  .horizontal-layout .right-panel {
    max-height: none;
    min-height: auto;
  }

  .horizontal-layout .left-panel {
    margin-bottom: var(--spacing-lg);
  }
}

@media (max-width: 768px) {
  .main-content {
    padding-left: 0;
    padding-right: 0;
  }

  .app-header {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }

  .app-header h1 {
    font-size: 1.6rem;
  }

  .search-actions-container {
    flex-direction: column;
  }

  .search-component {
    width: 100%;
  }
}
</style>
