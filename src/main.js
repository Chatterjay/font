import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import "./style.css";
import App from "./App.vue";
import { injectCssVariables } from "./utils/cssVariables.js";
import { APP_INFO } from "./constants/index.js";

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
    // 环境检查
    if (process.env.NODE_ENV !== "production") {
        console.log("当前为开发环境，跳过更新检查");
        return;
    }

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

        // 获取当前应用版本用于日志
        const appVersion = APP_INFO.VERSION || "未知";
        console.log(`当前应用版本: ${appVersion}`);

        // 使用Tauri updater API检查更新
        const { shouldUpdate, manifest } = await checkUpdate();
        console.log("更新检查结果:", { shouldUpdate, manifest });

        // 增强版本比较逻辑，确保只有真正的新版本才提示更新
        if (shouldUpdate && manifest && manifest.version && manifest.currentVersion) {
            // 详细记录版本信息
            console.log(`远程版本: ${manifest.version}, 类型: ${typeof manifest.version}`);
            console.log(
                `当前版本: ${manifest.currentVersion}, 类型: ${typeof manifest.currentVersion}`
            );

            // 解析版本号，去除前缀'v'，并分割为数字数组
            const parseVersion = (version) => {
                // 确保version是字符串
                const versionStr = String(version).replace(/^v/i, "");
                return versionStr.split(".").map(Number);
            };

            const newVersion = parseVersion(manifest.version);
            const currentVersion = parseVersion(manifest.currentVersion);

            console.log("解析后的版本:", { newVersion, currentVersion });

            // 比较版本号
            let isNewer = false;
            for (let i = 0; i < Math.max(newVersion.length, currentVersion.length); i++) {
                const newPart = newVersion[i] || 0;
                const currentPart = currentVersion[i] || 0;

                console.log(`比较版本部分 [${i}]: ${newPart} vs ${currentPart}`);

                if (newPart > currentPart) {
                    isNewer = true;
                    console.log(`检测到更高版本部分: ${newPart} > ${currentPart}`);
                    break;
                } else if (newPart < currentPart) {
                    console.log(`当前版本部分更高: ${newPart} < ${currentPart}`);
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

            // 获取更新日志
            try {
                await fetchChangelogFromUpdatePackage();
                console.log("已获取更新日志");
            } catch (changelogError) {
                console.warn("获取更新日志失败:", changelogError);
            }

            // 更新说明处理
            console.log("更新说明:", manifest.notes);

            // 标记已显示通知
            hasShownUpdateNotification = true;

            // 触发全局更新检查事件，通知UpdateNotifier组件
            window.dispatchEvent(
                new CustomEvent("check-for-updates", {
                    detail: {
                        newVersion: manifest.version,
                        currentVersion: manifest.currentVersion,
                        notes: manifest.notes,
                    },
                })
            );

            // 设置手动检查标记，确保UpdateNotifier组件显示更新通知
            localStorage.setItem("manualUpdateCheck", "true");

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

            try {
                // 显示带有更新说明的系统通知
                await notification.sendNotification({
                    title: `发现新版本 ${manifest.version}`,
                    body: `当前版本: ${manifest.currentVersion}\n${shortNotes}\n\n点击确认开始下载更新...`,
                });
                console.log("已显示更新通知");

                // 安装更新
                console.log("开始下载并安装更新...");
                await installUpdate();
                console.log("更新下载安装完成");

                // 重启应用以应用更新
                await notification.sendNotification({
                    title: "更新完成",
                    body: "更新已下载完成，应用将重启以应用更新。",
                });
                console.log("准备重启应用...");

                // 延迟重启，让用户看到通知
                setTimeout(async () => {
                    console.log("重启应用...");
                    await relaunch();
                }, 2000);
            } catch (updateError) {
                console.error("更新过程中出错:", updateError);
                // 显示错误通知
                await notification.sendNotification({
                    title: "更新失败",
                    body: `安装更新时出现错误: ${updateError.message || "未知错误"}`,
                });
                // 重置通知标志，允许用户再次尝试
                hasShownUpdateNotification = false;
            }
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
                    body: `检查更新时出现错误: ${error.message || "未知错误"
                        }。将在下次启动时重试。`,
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

    if (event && event.payload) {
        const updateInfo = event.payload;
        console.log("更新信息详情:", updateInfo);

        // 如果确实有更新可用
        if (updateInfo.hasUpdate) {
            console.log(`发现新版本: ${updateInfo.version}`);

            // 触发全局更新检查事件，通知UpdateNotifier组件
            window.dispatchEvent(
                new CustomEvent("check-for-updates", {
                    detail: {
                        newVersion: updateInfo.version,
                        currentVersion: updateInfo.currentVersion,
                        notes: updateInfo.notes,
                    },
                })
            );

            // 设置手动检查标记，确保UpdateNotifier组件显示更新通知
            localStorage.setItem("manualUpdateCheck", "true");
        } else {
            console.log("当前已是最新版本");

            // 也触发事件，通知前端没有更新
            window.dispatchEvent(
                new CustomEvent("check-for-updates", {
                    detail: {
                        newVersion: updateInfo.version,
                        currentVersion: updateInfo.currentVersion,
                        notes: updateInfo.notes,
                        hasUpdate: false,
                    },
                })
            );
        }
    } else {
        // 这是唯一的更新检查入口点
        checkForUpdates();
    }
});

// 监听更新错误事件
listen("update-error", (event) => {
    console.error("收到更新错误事件:", event);

    if (event && event.payload) {
        const errorInfo = event.payload;
        console.error("更新错误详情:", errorInfo);

        // 触发全局事件通知前端发生错误
        window.dispatchEvent(
            new CustomEvent("update-error", {
                detail: {
                    error: errorInfo.error,
                },
            })
        );
    }
});

// 在开发环境中记录日志
if (process.env.NODE_ENV !== "production") {
    console.log("当前为开发环境，更新检查功能已禁用");
}
