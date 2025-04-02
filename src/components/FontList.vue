<script setup>
import { ref, onMounted, inject, computed } from "vue";

const props = defineProps({
  searchQuery: {
    type: String,
    default: "",
  },
  fonts: {
    type: Array,
    required: true,
  },
  favorites: {
    type: Array,
    default: () => [],
  },
  commercialFonts: {
    type: Array,
    default: () => [],
  },
  currentFont: {
    type: String,
    default: "",
  },
  isSideBySide: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select-font"]);

// 字体列表
const fonts = ref([]);
// 加载状态
const isLoading = ref(false);
// 错误状态
const error = ref(null);
// 每页加载数量
const PAGE_SIZE = 20;
// 当前页码
const currentPage = ref(1);
// 是否还有更多字体
const hasMore = ref(true);
// 从父组件注入收藏相关的数据和方法
const favorites = inject("favorites", ref([]));
const toggleFavorite = inject("toggleFavorite", () => {});
// 商用字体标记
const commercialFonts = inject("commercialFonts", ref(new Set()));
// 字体总数
const totalFonts = ref(0);
// 当前选中的字体粗细
const selectedWeight = ref("normal");
// 批量选择状态
const isBatchMode = ref(false);
const selectedFonts = ref(new Set());

// 商用字体计数
const commercialCount = computed(() => commercialFonts.value.size);

// 常用系统字体列表
const commonFonts = [
  "Arial",
  "Arial Black",
  "Calibri",
  "Cambria",
  "Comic Sans MS",
  "Courier New",
  "Georgia",
  "Helvetica",
  "Impact",
  "Microsoft YaHei",
  "MS Sans Serif",
  "MS Serif",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "宋体",
];

// 检查字体是否被收藏
const isFavorite = (fontName) => {
  return Array.isArray(favorites.value) && favorites.value.includes(fontName);
};

// 检查字体是否商用
const isCommercial = (fontName) => {
  return commercialFonts.value.has(fontName);
};

// 切换商用标记
const toggleCommercial = (fontName) => {
  if (commercialFonts.value.has(fontName)) {
    commercialFonts.value.delete(fontName);
  } else {
    commercialFonts.value.add(fontName);
  }
  // 保存到 localStorage
  localStorage.setItem(
    "commercialFonts",
    JSON.stringify(Array.from(commercialFonts.value))
  );
};

// 从 localStorage 加载商用字体列表
const loadCommercialFonts = () => {
  const savedFonts = localStorage.getItem("commercialFonts");
  if (savedFonts) {
    commercialFonts.value = new Set(JSON.parse(savedFonts));
  }
};

// 获取系统字体列表
const getSystemFonts = async (page = 1) => {
  try {
    if (page === 1) {
      isLoading.value = true;
      error.value = null;
    }

    // 检查页面是否可见
    if (document.hidden) {
      await new Promise((resolve) => {
        const handleVisibilityChange = () => {
          if (!document.hidden) {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            resolve();
          }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
      });
    }

    // 使用 queryLocalFonts API 获取系统字体列表
    const localFonts = await window.queryLocalFonts();
    totalFonts.value = localFonts.length;
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    // 获取当前页的字体
    const pageFonts = localFonts.slice(start, end).map((font) => ({
      family: font.family,
      weight: font.weight,
    }));

    // 更新字体列表
    if (page === 1) {
      fonts.value = pageFonts;
    } else {
      fonts.value = [...new Set([...fonts.value, ...pageFonts])];
    }

    // 更新是否还有更多字体
    hasMore.value = end < localFonts.length;

    // 默认选择第一个字体
    if (page === 1 && pageFonts.length > 0) {
      selectFont(pageFonts[0].family);
    }
  } catch (err) {
    error.value = "获取字体列表失败";
    console.error("获取字体列表失败:", err);
  } finally {
    if (page === 1) {
      isLoading.value = false;
    }
  }
};

// 加载更多字体
const loadMore = () => {
  if (!hasMore.value || isLoading.value) return;
  currentPage.value++;
  getSystemFonts(currentPage.value);
};

// 过滤后的字体列表
const filteredFonts = () => {
  if (!props.searchQuery) {
    return fonts.value;
  }
  const query = props.searchQuery.toLowerCase();
  return fonts.value.filter((font) => font.family.toLowerCase().includes(query));
};

// 监听滚动事件
const handleScroll = (event) => {
  const container = event.target;
  if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
    loadMore();
  }
};

// 切换字体粗细
const toggleFontWeight = (font) => {
  if (selectedWeight.value === "normal") {
    selectedWeight.value = "medium";
  } else {
    selectedWeight.value = "normal";
  }
};

// 检查字体是否支持中等粗细
const hasMediumWeight = (font) => {
  return font.weight === 500;
};

// 选择字体
const selectFont = (fontName) => {
  emit("select-font", fontName);
};

// 切换批量模式
const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedFonts.value.clear();
  }
};

// 选择/取消选择字体
const toggleFontSelection = (fontName) => {
  if (selectedFonts.value.has(fontName)) {
    selectedFonts.value.delete(fontName);
  } else {
    selectedFonts.value.add(fontName);
  }
};

// 批量收藏
const batchFavorite = () => {
  selectedFonts.value.forEach((fontName) => {
    if (!isFavorite(fontName)) {
      toggleFavorite(fontName);
    }
  });
  toggleBatchMode();
};

// 批量取消收藏
const batchUnfavorite = () => {
  selectedFonts.value.forEach((fontName) => {
    if (isFavorite(fontName)) {
      toggleFavorite(fontName);
    }
  });
  toggleBatchMode();
};

// 批量标记商用
const batchCommercial = () => {
  selectedFonts.value.forEach((fontName) => {
    if (!isCommercial(fontName)) {
      toggleCommercial(fontName);
    }
  });
  toggleBatchMode();
};

// 批量取消商用
const batchUncommercial = () => {
  selectedFonts.value.forEach((fontName) => {
    if (isCommercial(fontName)) {
      toggleCommercial(fontName);
    }
  });
  toggleBatchMode();
};

onMounted(() => {
  loadCommercialFonts();
  getSystemFonts();
});
</script>

<template>
  <div
    class="font-list-container"
    :class="{ 'side-by-side': isSideBySide }"
    @scroll="handleScroll"
  >
    <div class="font-list-header">
      <div class="header-left">
        <h2>系统字体列表</h2>
        <span class="total-fonts">共 {{ totalFonts }} 个字体</span>
      </div>
      <div class="header-actions">
        <span class="font-count" v-if="fonts.length > 0"
          >{{ filteredFonts().length }} 个字体</span
        >
        <span class="favorite-count" v-if="favorites.length > 0">
          {{ favorites.length }} 个收藏字体
        </span>
        <span class="commercial-count" v-if="commercialCount > 0">
          {{ commercialCount }} 个商用字体
        </span>
        <button
          class="batch-mode-btn"
          :class="{ 'is-active': isBatchMode }"
          @click="toggleBatchMode"
        >
          {{ isBatchMode ? "退出批量模式" : "批量操作" }}
        </button>
      </div>
    </div>

    <div v-if="isLoading && fonts.length === 0" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载系统字体...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <svg viewBox="0 0 24 24" width="24" height="24" class="error-icon">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10s10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        />
      </svg>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="getSystemFonts">重试</button>
    </div>

    <div v-else class="font-grid">
      <div
        v-for="font in filteredFonts()"
        :key="font.family"
        class="font-card"
        :class="{
          'is-commercial': isCommercial(font.family),
          'is-selected': isBatchMode && selectedFonts.has(font.family),
          favorite: isFavorite(font.family),
          'current-preview': font.family === currentFont,
        }"
      >
        <div class="commercial-badge" v-if="isCommercial(font.family)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
          <span>商用</span>
        </div>
        <div class="favorite-badge" v-if="isFavorite(font.family)">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          <span>收藏</span>
        </div>
        <div
          class="font-card-content"
          @click="
            isBatchMode ? toggleFontSelection(font.family) : selectFont(font.family)
          "
        >
          <div
            class="font-name"
            :style="{
              fontFamily: font.family,
              fontWeight: hasMediumWeight(font) ? selectedWeight : 'normal',
            }"
          >
            {{ font.family }}
            <div v-if="isBatchMode" class="selection-indicator">
              <svg
                v-if="selectedFonts.has(font.family)"
                viewBox="0 0 24 24"
                width="16"
                height="16"
              >
                <path
                  fill="currentColor"
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                />
              </svg>
            </div>
          </div>
          <div
            class="font-sample"
            :style="{
              fontFamily: font.family,
              fontWeight: hasMediumWeight(font) ? selectedWeight : 'normal',
            }"
          >
            AaBbCc 123 你好世界
          </div>
          <button
            v-if="hasMediumWeight(font)"
            class="weight-toggle"
            @click.stop="toggleFontWeight(font)"
            :title="selectedWeight === 'normal' ? '切换到中等粗细' : '切换到正常粗细'"
          >
            {{ selectedWeight === "normal" ? "M" : "N" }}
          </button>
        </div>
        <div class="font-card-actions">
          <button
            class="action-btn commercial-btn"
            @click.stop="toggleCommercial(font.family)"
            :class="{ 'is-commercial': isCommercial(font.family) }"
            :title="isCommercial(font.family) ? '取消商用标记' : '标记为商用'"
            aria-label="商用标记"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              />
            </svg>
          </button>
          <button
            class="action-btn favorite-btn"
            @click.stop="toggleFavorite(font.family)"
            :class="{ 'is-favorite': isFavorite(font.family) }"
            :title="isFavorite(font.family) ? '取消收藏' : '收藏'"
            aria-label="收藏字体"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 批量操作工具栏 -->
    <div v-if="isBatchMode && selectedFonts.size > 0" class="batch-toolbar">
      <div class="batch-info">已选择 {{ selectedFonts.size }} 个字体</div>
      <div class="batch-actions">
        <button class="batch-btn" @click="batchFavorite">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          批量收藏
        </button>
        <button class="batch-btn" @click="batchUnfavorite">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
            />
          </svg>
          取消收藏
        </button>
        <button class="batch-btn" @click="batchCommercial">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
          标记商用
        </button>
        <button class="batch-btn" @click="batchUncommercial">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
          取消商用
        </button>
      </div>
    </div>

    <div v-if="isLoading && fonts.length > 0" class="loading-more">
      <div class="loading-spinner-small"></div>
      <p>加载更多字体...</p>
    </div>

    <div v-if="!hasMore && fonts.length > 0" class="all-loaded">
      <p>已加载全部字体</p>
    </div>
  </div>
</template>

<style scoped>
.font-list-container {
  width: 100%;
  max-height: 420px;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  background-color: var(--background-primary);
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
  padding-bottom: calc(var(--spacing-lg) + 60px);
}

.font-list-container.side-by-side {
  max-height: 870px;
}

.font-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

.font-list-header h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.total-fonts {
  color: var(--text-secondary);
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.font-count {
  color: var(--text-secondary);
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
}

.favorite-count {
  color: var(--warning-color);
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.favorite-count::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: var(--warning-color);
  border-radius: 50%;
}

.commercial-count {
  color: var(--success-color);
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.commercial-count::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  background-color: var(--success-color);
  border-radius: 50%;
}

.font-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.font-card {
  position: relative;
  background-color: var(--background-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: var(--transition-normal);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 120px;
}

.font-card:hover {
  transform: translateY(-2px);
  background-color: var(--background-primary);
  border-color: var(--primary-color);
  box-shadow: var(--shadow-md);
}

.font-card.is-selected {
  border-color: var(--primary-color);
  background-color: var(--background-primary);
}

.font-card.is-selected .font-name {
  color: var(--primary-color);
}

.font-card.is-selected .font-sample {
  color: var(--text-primary);
}

.font-card.is-selected .selection-indicator {
  background-color: var(--primary-color);
  color: var(--background-primary);
}

.font-card.is-selected .weight-toggle {
  background-color: var(--background-primary);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.font-card.is-selected .weight-toggle:hover {
  background-color: var(--background-tertiary);
}

.font-card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.font-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.font-sample {
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.font-card-actions {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  display: flex;
  gap: var(--spacing-xs);
  opacity: 0;
  transition: var(--transition-fast);
}

.font-card:hover .font-card-actions {
  opacity: 1;
}

.action-btn {
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  transition: var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--background-primary);
  border: 1px solid var(--border-color);
  width: 36px;
  height: 36px;
}

.action-btn:hover {
  background-color: var(--background-tertiary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action-btn.is-commercial {
  color: var(--success-color);
  border-color: var(--success-color);
}

.action-btn.is-favorite {
  color: var(--warning-color);
  border-color: var(--warning-color);
}

.action-btn svg {
  width: 20px;
  height: 20px;
  transition: var(--transition-fast);
}

.action-btn:hover svg {
  transform: scale(1.1);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) 0;
  color: var(--primary-color);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
  margin-bottom: var(--spacing-md);
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md) 0;
  color: var(--primary-color);
  gap: var(--spacing-sm);
}

.loading-spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(59, 130, 246, 0.1);
  border-radius: 50%;
  border-top-color: var(--primary-color);
  animation: spin 1s ease-in-out infinite;
}

.all-loaded {
  text-align: center;
  padding: var(--spacing-md) 0;
  color: var(--text-tertiary);
  font-size: 0.875rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
  text-align: center;
}

.error-icon {
  margin-bottom: var(--spacing-md);
  color: var(--text-tertiary);
}

.retry-btn {
  margin-top: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background-color: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.retry-btn:hover {
  background-color: var(--primary-hover);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 870px) {
  .font-list-container {
    max-height: 400px;
    padding: var(--spacing-md);
  }

  .font-grid {
    grid-template-columns: 1fr;
  }

  .font-name {
    font-size: 1rem;
  }
}

.commercial-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: var(--success-color);
  color: white;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: var(--shadow-md);
  z-index: 1;
  animation: badgePop 0.3s ease-out;
}

.commercial-badge svg {
  width: 16px;
  height: 16px;
}

.font-card.is-commercial {
  border-color: var(--success-color);
  background-color: var(--background-primary);
}

.font-card.is-commercial:hover {
  border-color: var(--success-color);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1);
}

@keyframes badgePop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.weight-toggle {
  position: absolute;
  bottom: var(--spacing-sm);
  right: var(--spacing-sm);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background-color: var(--background-tertiary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition-fast);
}

.weight-toggle:hover {
  background-color: var(--background-primary);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.favorite-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: var(--warning-color);
  color: white;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: var(--shadow-md);
  z-index: 1;
  animation: badgePop 0.3s ease-out;
}

.favorite-badge svg {
  width: 16px;
  height: 16px;
}

.font-card.is-commercial .favorite-badge {
  right: 60px;
}

.batch-mode-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--background-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 0.875rem;
}

.batch-mode-btn:hover {
  background-color: var(--background-tertiary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.batch-mode-btn.is-active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.font-card.is-selected {
  border-color: var(--primary-color);
  background-color: var(--background-primary);
}

.selection-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 8px;
  border-radius: 50%;
  background-color: var(--background-tertiary);
  color: var(--text-secondary);
}

.font-card.is-selected .selection-indicator {
  background-color: var(--primary-color);
  color: var(--background-primary);
}

.batch-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--background-primary);
  border-top: 1px solid var(--border-color);
  padding: var(--spacing-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-lg);
  z-index: 100;
}

.batch-info {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.batch-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.batch-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  background-color: var(--background-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 0.875rem;
}

.batch-btn:hover {
  background-color: var(--background-tertiary);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.batch-btn svg {
  width: 16px;
  height: 16px;
}

.font-card.current-preview {
  border: 2px solid var(--primary-color);
  background-color: var(--background-tertiary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.font-card.current-preview::before {
  content: "当前预览";
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--primary-color);
  color: white;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  white-space: nowrap;
  z-index: 1;
}
</style>
