import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import "./style.css";
import App from "./App.vue";
import { injectCssVariables } from "./utils/cssVariables.js";

// 导入Tauri API
import { listen } from "@tauri-apps/api/event";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { relaunch } from "@tauri-apps/api/process";
import { notification } from "@tauri-apps/api";

// 导入视图组件
import UpdateView from "./views/UpdateView.vue";
import ChangelogView from "./views/ChangelogView.vue";

// 创建路由实例
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: "/",
            name: "home",
        },
        {
            path: "/update",
            name: "update",
            component: UpdateView,
        },
        {
            path: "/changelog",
            name: "changelog",
            component: ChangelogView,
        },
    ],
});

// 注入CSS变量
injectCssVariables();

// 创建应用实例
const app = createApp(App);

// 使用路由
app.use(router);

// 挂载应用
app.mount("#app");

// 用于跟踪更新状态的标志
let isCheckingForUpdates = false;
let hasShownUpdateNotification = false;

// 检查更新函数
async function checkForUpdates() {
    // 防止重复检查
    if (isCheckingForUpdates) {
        console.log("已经在检查更新，跳过...");
        return;
    }

    // 防止重复显示通知
    if (hasShownUpdateNotification) {
        console.log("已经显示过更新通知，跳过...");
        return;
    }

    try {
        isCheckingForUpdates = true;
        console.log("开始检查更新...");
        const { shouldUpdate, manifest } = await checkUpdate();

        console.log("更新检查结果:", { shouldUpdate, manifest });

        // 增强版本比较逻辑，确保只有真正的新版本才提示更新
        if (shouldUpdate && manifest && manifest.version && manifest.currentVersion) {
            // 解析版本号，去除前缀'v'，并分割为数字数组
            const parseVersion = (version) => {
                const versionStr = version.toString().replace(/^v/i, '');
                return versionStr.split('.').map(Number);
            };

            const newVersion = parseVersion(manifest.version);
            const currentVersion = parseVersion(manifest.currentVersion);

            // 比较版本号
            let isNewer = false;
            for (let i = 0; i < Math.max(newVersion.length, currentVersion.length); i++) {
                const newPart = newVersion[i] || 0;
                const currentPart = currentVersion[i] || 0;
                if (newPart > currentPart) {
                    isNewer = true;
                    break;
                } else if (newPart < currentPart) {
                    break;
                }
            }

            if (!isNewer) {
                console.log("检测到的版本不比当前版本更新，跳过更新流程");
                return;
            }

            // 如果有更新可用
            console.log(
                `发现新版本: ${manifest.version}, 当前版本: ${manifest.currentVersion}`
            );
            console.log("更新说明:", manifest.notes);

            // 标记已显示通知
            hasShownUpdateNotification = true;

            // 从更新说明中提取简短的描述
            let shortNotes = "新版本已可用";
            if (manifest.notes) {
                // 尝试从markdown格式的更新说明中提取简短描述
                const notesLines = manifest.notes
                    .split("\n")
                    .filter((line) => line.trim() && !line.startsWith("#"));
                if (notesLines.length > 0) {
                    // 获取前3行作为简短描述
                    shortNotes = notesLines.slice(0, 3).join("\n");
                    if (notesLines.length > 3) {
                        shortNotes += "\n...（更多更新内容）";
                    }
                }
            }

            // 显示带有更新说明的系统通知
            await notification.sendNotification({
                title: `发现新版本 ${manifest.version}`,
                body: `当前版本: ${manifest.currentVersion}\n${shortNotes}\n\n点击确认开始下载更新...`,
            });

            // 安装更新
            await installUpdate();

            // 重启应用以应用更新
            await notification.sendNotification({
                title: "更新完成",
                body: "更新已下载完成，应用将重启以应用更新。",
            });

            // 延迟重启，让用户看到通知
            setTimeout(async () => {
                await relaunch();
            }, 2000);
        } else {
            console.log("没有可用的更新");
        }
    } catch (error) {
        console.error("检查更新时发生错误:", error);

        // 不要在开发环境中显示更新错误通知
        if (process.env.NODE_ENV === "production") {
            try {
                await notification.sendNotification({
                    title: "更新检查失败",
                    body: "检查更新时出现错误，将在下次启动时重试。",
                });
            } catch (notificationError) {
                console.error("发送通知失败:", notificationError);
            }
        }
    } finally {
        // 完成后释放标志
        isCheckingForUpdates = false;
    }
}

// 监听后端发送的更新可用事件
listen("update-available", (event) => {
    console.log("收到更新可用事件:", event);
    // 这是唯一的更新检查入口点
    checkForUpdates();
});

// 在开发环境中记录日志
if (process.env.NODE_ENV !== "production") {
    console.log("当前为开发环境，更新检查功能已禁用");
}
