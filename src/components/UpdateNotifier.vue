<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { isProduction, fetchLatestVersion } from '../utils/updateUtils.js';
import { APP_INITIAL_VERSION } from '../constants/index.js';

// 是否有新版本
const hasNewVersion = ref(false);
// 当前版本
const currentVersion = ref(APP_INITIAL_VERSION);
// 最新版本
const latestVersion = ref('');
// 是否显示提示
const showNotification = ref(false);

// 检查更新
const checkUpdate = async (event) => {
  try {
    console.log('[UpdateNotifier] 开始检查更新');
    
    // 如果是自定义事件调用并且包含详细信息
    if (event && event.detail) {
      console.log('[UpdateNotifier] 收到带详情的更新事件:', event.detail);
      
      // 使用事件中的版本信息
      currentVersion.value = event.detail.currentVersion;
      latestVersion.value = event.detail.newVersion;
      
      // 确定是否有新版本
      hasNewVersion.value = true;
      
      // 显示更新通知
      showNotification.value = true;
      
      console.log(`[UpdateNotifier] 从事件中发现新版本: ${latestVersion.value}`);
      
      // 不自动隐藏通知，让用户主动选择更新或关闭
      return;
    }
    
    // 从本地存储中获取保存的版本号
    const savedVersion = localStorage.getItem('appVersion') || APP_INITIAL_VERSION;
    currentVersion.value = savedVersion;
    
    console.log(`[UpdateNotifier] 开始检查更新，当前版本: ${currentVersion.value}`);
    
    // 获取最新版本信息
    const updateInfo = await fetchLatestVersion(currentVersion.value);
    
    // 设置最新版本
    latestVersion.value = updateInfo.version;
    
    console.log(`[UpdateNotifier] 获取到版本信息: `, updateInfo);
    
    // 根据比较结果设置是否有新版本
    hasNewVersion.value = updateInfo.hasUpdate;
    
    // 只在以下情况显示提示:
    // 1. 有新版本需要更新
    // 2. 在生产环境下且用户手动触发了检查
    const manualCheck = localStorage.getItem('manualUpdateCheck') === 'true';
    
    console.log(`[UpdateNotifier] 检查结果: 有新版本=${hasNewVersion.value}, 手动检查=${manualCheck}`);
    
    if (hasNewVersion.value || (isProduction() && manualCheck)) {
      showNotification.value = true;
      
      // 手动检查时保持显示直到用户关闭
      if (!hasNewVersion.value && manualCheck) {
        // 不自动隐藏
        console.log(`[UpdateNotifier] 手动检查没有发现更新，保持显示`);
      } else if (hasNewVersion.value) {
        // 有更新时不自动隐藏，让用户做选择
        console.log(`[UpdateNotifier] 发现新版本，等待用户操作`);
      } else {
        // 其他情况5秒后自动隐藏
        setTimeout(() => {
          showNotification.value = false;
        }, 5000);
      }
      
      // 清除手动检查标记
      localStorage.removeItem('manualUpdateCheck');
    }
  } catch (error) {
    console.error('[UpdateNotifier] 更新检查失败:', error);
  }
};

// 关闭提示
const closeNotification = () => {
  showNotification.value = false;
};

// 应用更新
const applyUpdate = async () => {
  try {
    // 显示正在更新的提示
    showMessage('正在准备更新...', 'info');
    
    // 在生产环境中，这里应该调用Tauri的update API
    if (isProduction()) {
      try {
        console.log('[UpdateNotifier] 开始安装更新');
        
        // 导入Tauri更新API
        const { installUpdate } = await import('@tauri-apps/api/updater');
        const { relaunch } = await import('@tauri-apps/api/process');
        
        // 显示开始下载的提示
        showMessage('正在下载更新，请稍候...', 'info');
        
        // 尝试安装更新
        await installUpdate();
        
        // 安装成功，显示成功消息
        showMessage('更新下载完成，即将重启应用', 'success');
        
        // 延迟一下再重启，让用户看到消息
        console.log('[UpdateNotifier] 更新安装成功，准备重启应用');
        setTimeout(async () => {
          try {
            await relaunch();
          } catch (relaunchError) {
            console.error('[UpdateNotifier] 重启应用失败:', relaunchError);
            showMessage('应用重启失败，请手动重启应用', 'error');
          }
        }, 2000);
      } catch (e) {
        console.error("[UpdateNotifier] 安装更新失败:", e);
        showMessage(`更新失败: ${e.message || '未知错误'}`, 'error');
        
        // 隐藏通知
        setTimeout(() => {
          showNotification.value = false;
        }, 3000);
      }
    } else {
      console.log('[UpdateNotifier] 开发环境模拟更新安装');
      showMessage('开发环境：模拟更新安装成功', 'success');
      
      // 在开发环境中模拟安装完成后关闭通知
      setTimeout(() => {
        showNotification.value = false;
      }, 2000);
    }
  } catch (error) {
    console.error('[UpdateNotifier] 更新过程中发生错误:', error);
    showMessage(`更新过程发生错误: ${error.message || '未知错误'}`, 'error');
    
    // 出错后关闭通知
    setTimeout(() => {
      showNotification.value = false;
    }, 3000);
  }
};

// 显示提示消息
const showMessage = (message, type = 'info') => {
  // 检查是否已有toast，避免创建多个
  let toast = document.querySelector('.app-copy-toast');
  
  // 确定toast的样式类
  const typeClass = type === 'error' ? 'toast-error' : 
                   type === 'success' ? 'toast-success' : 'toast-info';
  
  if (toast) {
    // 重置所有类型类
    toast.classList.remove('toast-error', 'toast-success', 'toast-info');
    // 更新已有toast的内容、类型和显示状态
    toast.textContent = message;
    toast.classList.add(typeClass);
    toast.classList.add('show');
  } else {
    // 创建新的toast
    toast = document.createElement('div');
    toast.className = `app-copy-toast ${typeClass}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 使用requestAnimationFrame确保DOM更新后添加show类
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  }
  
  // 清除可能已存在的定时器
  if (toast._hideTimeout) {
    clearTimeout(toast._hideTimeout);
  }
  
  // 设置自动隐藏
  toast._hideTimeout = setTimeout(() => {
    toast.classList.remove('show');
    
    // 移除DOM元素以避免内存泄漏
    setTimeout(() => {
      if (toast && toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 2000);
};

// 处理更新错误
const handleUpdateError = (event) => {
  if (event && event.detail) {
    console.error('[UpdateNotifier] 收到更新错误事件:', event.detail);
    const errorMessage = event.detail.error || '未知错误';
    showMessage(`更新检查失败: ${errorMessage}`, 'error');
  }
};

// 在组件挂载后检查更新
onMounted(() => {
  // 是否启用了自动更新
  const autoUpdateEnabled = JSON.parse(localStorage.getItem('autoUpdate') || 'false');
  
  // 手动检查标记
  const manualCheckRequested = localStorage.getItem('manualUpdateCheck') === 'true';
  
  // 只在以下情况执行更新检查:
  // 1. 启用了自动更新
  // 2. 处于生产环境且有手动检查请求
  // 3. 处于任何环境且明确要求手动检查
  if (autoUpdateEnabled || (isProduction() && !manualCheckRequested) || manualCheckRequested) {
    setTimeout(() => {
      checkUpdate();
    }, 1000); // 延迟1秒执行，避免与应用启动冲突
  }
  
  // 添加自定义事件监听器
  window.addEventListener('check-for-updates', checkUpdate);
  window.addEventListener('update-error', handleUpdateError);
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener('check-for-updates', checkUpdate);
  window.removeEventListener('update-error', handleUpdateError);
});
</script>

<template>
  <div 
    class="update-notification" 
    :class="{ 'show': showNotification, 'has-update': hasNewVersion }"
  >
    <div class="notification-content">
      <div class="notification-icon">
        <svg v-if="hasNewVersion" viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
      </div>
      <div class="notification-message">
        <span v-if="hasNewVersion">
          发现新版本 {{ latestVersion }}，当前版本 {{ currentVersion }}
        </span>
        <span v-else>
          当前已是最新版本 {{ currentVersion }}
        </span>
      </div>
      <div class="notification-actions">
        <button v-if="hasNewVersion" class="update-btn" @click="applyUpdate">
          更新
        </button>
        <button class="close-btn" @click="closeNotification">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.update-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: var(--background-secondary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 300px;
  max-width: calc(100vw - 40px);
  padding: 12px 16px;
  transform: translateY(120%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
  z-index: 1000;
  border-left: 4px solid var(--primary-color);
}

.update-notification.show {
  transform: translateY(0);
  opacity: 1;
}

.update-notification.has-update {
  border-left-color: var(--accent-color);
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.notification-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.has-update .notification-icon {
  color: var(--accent-color);
}

.notification-message {
  flex: 1;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.notification-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 4px 10px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.update-btn:hover {
  background-color: var(--accent-color-hover);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: var(--background-tertiary);
  color: var(--text-primary);
}
</style> 