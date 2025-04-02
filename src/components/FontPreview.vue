<script setup>
import { ref, watch } from "vue";

const props = defineProps({
  selectedFont: {
    type: String,
    default: "",
  },
  isFavorite: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["toggle-favorite"]);

// 预览文本
const previewText = ref("请输入要预览的文字");
// 字体大小
const fontSize = ref(24);
// 是否加粗
const isBold = ref(false);
// 是否斜体
const isItalic = ref(false);
// 用于防抖的定时器ID
const debounceTimer = ref(null);

// 处理文本输入的防抖函数
const handleTextInput = (event) => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value);
  }

  debounceTimer.value = setTimeout(() => {
    previewText.value = event.target.value;
  }, 500); // 500ms的防抖延迟
};

// 预览样式
const previewStyle = () => {
  return {
    fontFamily: props.selectedFont || "Arial",
    fontSize: `${fontSize.value}px`,
    fontWeight: isBold.value ? "bold" : "normal",
    fontStyle: isItalic.value ? "italic" : "normal",
  };
};

const toggleFavorite = () => {
  emit("toggle-favorite", props.selectedFont);
};
</script>

<template>
  <div class="font-preview-container">
    <div class="preview-header">
      <div>
        <h2>字体预览</h2>
        <div class="selected-font" :style="{ fontFamily: selectedFont || 'inherit' }">
          {{ selectedFont || "请选择字体" }}
        </div>
        <div v-if="selectedFont" class="font-tip">
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
          如果字体切换后无变化，说明该字体不支持当前使用的文字，请尝试切换英文、日文等
        </div>
      </div>
      <div class="preview-actions">
        <button
          v-if="selectedFont"
          class="action-btn favorite-btn"
          :class="{ active: isFavorite }"
          @click="toggleFavorite"
          :title="isFavorite ? '取消收藏' : '收藏字体'"
        >
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              :d="isFavorite
                ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
                : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="preview-controls">
      <div class="control-group">
        <label for="preview-text">预览文本</label>
        <textarea
          id="preview-text"
          :value="previewText"
          @input="handleTextInput"
          placeholder="输入要预览的文字"
          rows="3"
        ></textarea>
      </div>

      <div class="control-group">
        <label for="font-size">字体大小</label>
        <div class="range-control">
          <input 
            type="range" 
            id="font-size" 
            v-model="fontSize" 
            min="8" 
            max="72"
            class="range-input"
          />
          <span class="range-value">{{ fontSize }}px</span>
        </div>
      </div>

      <div class="control-group style-controls">
        <label class="checkbox-label">
          <input type="checkbox" v-model="isBold" />
          <span>加粗</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="isItalic" />
          <span>斜体</span>
        </label>
      </div>
    </div>

    <div class="preview-area" :style="previewStyle()">
      {{ previewText }}
    </div>
  </div>
</template>

<style scoped>
.font-preview-container {
  width: 100%;
  padding: var(--spacing-lg);
  border-radius: var(--radius-xl);
  background-color: var(--background-primary);
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
}

.font-preview-container:hover {
  box-shadow: var(--shadow-lg);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
}

.preview-header h2 {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.selected-font {
  color: var(--primary-color);
  font-size: 1.1rem;
  font-weight: 500;
}

.font-tip {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.font-tip svg {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
}

.preview-controls {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  background-color: var(--background-secondary);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.control-group label {
  color: var(--text-secondary);
  font-weight: 500;
  font-size: 0.875rem;
}

.range-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.range-input {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: var(--border-color);
  border-radius: 3px;
  outline: none;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: var(--primary-color);
  border-radius: 50%;
  cursor: pointer;
  transition: var(--transition-fast);
}

.range-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.range-value {
  min-width: 45px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: right;
}

.style-controls {
  flex-direction: row;
  gap: var(--spacing-xl);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary-color);
}

.checkbox-label span {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

textarea {
  width: 100%;
  padding: var(--spacing-md);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background-color: var(--background-primary);
  color: var(--text-primary);
  font-size: 1rem;
  resize: vertical;
  min-height: 80px;
  transition: var(--transition-fast);
}

textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  outline: none;
}

.preview-area {
  width: 100%;
  min-height: 200px;
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  background-color: var(--background-secondary);
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  overflow: auto;
  border: 1px solid var(--border-color);
  transition: var(--transition-normal);
}

.preview-area:hover {
  border-color: var(--primary-color);
  box-shadow: inset 0 1px 5px rgba(0, 0, 0, 0.05);
}

@media (max-width: 870px) {
  .font-preview-container {
    padding: var(--spacing-md);
  }
  
  .preview-controls {
    padding: var(--spacing-md);
  }
  
  .style-controls {
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .preview-area {
    min-height: 150px;
    padding: var(--spacing-md);
  }
}
</style>
