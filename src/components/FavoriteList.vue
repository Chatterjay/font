<script setup>
import { inject, onMounted, ref } from "vue";

const emit = defineEmits(["select-font"]);

// 从父组件注入收藏相关的数据和方法
const favorites = inject("favorites");
const removeFavorite = inject("removeFavorite");

// 存储元素引用和已加载字体
const itemRefs = ref([]);
const loadedFonts = new Set();

// 选择字体
const selectFont = (fontName) => {
  emit("select-font", fontName);
};

// 加载字体资源
const loadFont = (fontName) => {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);

  // 这里使用 Google Fonts 的示例，根据实际情况修改
  const fontId = fontName.replace(/\s+/g, "+");
  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${fontId}&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
};

// 初始化 Intersection Observer
onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const fontName = entry.target.dataset.font;
          loadFont(fontName);
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px 100px 0px" }
  );

  itemRefs.value.forEach((el) => {
    if (el) observer.observe(el);
  });
});
</script>

<template>
  <div class="favorites-container">
    <div class="favorites-header">
      <h2>收藏的字体</h2>
      <span class="favorites-count" v-if="favorites.length > 0">{{
        favorites.length
      }}</span>
    </div>

    <div v-if="favorites.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path
            fill="currentColor"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      </div>
      <p>暂无收藏的字体</p>
      <span class="empty-hint">点击字体列表中的星标添加收藏</span>
    </div>

    <div v-else class="favorites-grid">
      <div
        v-for="(font, index) in favorites"
        :key="font"
        class="favorite-card"
        @click="selectFont(font)"
        :data-font="font"
        :ref="(el) => (itemRefs[index] = el)"
      >
        <div class="card-content">
          <div class="font-name" :style="{ fontFamily: `'${font}'` }">
            {{ font }}
          </div>
          <div class="font-preview" :style="{ fontFamily: `'${font}'` }">
            AaBbCc 123 你好世界
          </div>
        </div>
        <button
          class="remove-btn"
          @click.stop="removeFavorite(font)"
          title="移除收藏"
          aria-label="移除收藏"
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
</template>

<style scoped>
.favorites-container {
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  background-color: var(--background-primary);
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
}

.favorites-container:hover {
  box-shadow: var(--shadow-lg);
}

.favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

.favorites-header h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0;
}

.favorites-count {
  color: var(--text-secondary);
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) var(--spacing-lg);
  text-align: center;
  background-color: var(--background-secondary);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: var(--spacing-md);
}

.empty-state p {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
  color: var(--text-primary);
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}

.favorite-card {
  position: relative;
  background-color: var(--background-secondary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: var(--transition-normal);
  border: 1px solid var(--border-color);
}

.favorite-card:hover {
  transform: translateY(-2px);
  background-color: var(--background-primary);
  border-color: var(--primary-color);
  box-shadow: var(--shadow-md);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.font-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.font-preview {
  font-size: 0.9rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  opacity: 0;
  transition: var(--transition-fast);
}

.favorite-card:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background-color: var(--background-tertiary);
  color: var(--danger-color);
}

@media (max-width: 870px) {
  .favorites-container {
    padding: var(--spacing-md);
  }

  .favorites-grid {
    grid-template-columns: 1fr;
  }

  .font-name {
    font-size: 1rem;
  }

  .font-preview {
    font-size: 0.875rem;
  }

  .empty-state {
    padding: var(--spacing-lg) var(--spacing-md);
  }
}
</style>
