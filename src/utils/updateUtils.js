/**
 * 更新相关工具函数
 */

import { CHANGELOG } from '../constants/index.js';

/**
 * 检查是否为生产环境
 * @returns {boolean} 是否为生产环境
 */
export const isProduction = () => {
    return import.meta.env.PROD;
};

/**
 * 获取当前环境名称
 * @returns {string} 环境名称
 */
export const getEnvironment = () => {
    return isProduction() ? '生产环境' : '开发环境';
};

/**
 * 解析版本号为可比较的数字
 * @param {string} version 版本号字符串，如 'v1.0.1'
 * @returns {number} 处理后的版本号数字
 */
export const parseVersionToNumber = (version) => {
    if (!version) return 0;
    return parseInt(version.replace('v', '').replace(/\./g, ''));
};

/**
 * 比较两个版本号
 * @param {string} versionA 第一个版本号
 * @param {string} versionB 第二个版本号
 * @returns {number} 1表示versionA大，-1表示versionB大，0表示相等
 */
export const compareVersions = (versionA, versionB) => {
    const versionANum = parseVersionToNumber(versionA);
    const versionBNum = parseVersionToNumber(versionB);

    if (versionANum > versionBNum) return 1;
    if (versionANum < versionBNum) return -1;
    return 0;
};

/**
 * 模拟从服务器获取最新版本
 * 实际项目中应替换为真实的API调用
 * @param {string} currentVersion 当前版本
 * @returns {Promise<{version: string, hasUpdate: boolean}>} 版本信息
 */
export const fetchLatestVersion = async (currentVersion) => {
    // 模拟网络请求延迟
    await new Promise(resolve => setTimeout(resolve, 800));

    // 模拟服务器返回的版本号
    const serverVersion = 'v1.0.1';

    // 比较版本并返回结果
    const comparisonResult = compareVersions(serverVersion, currentVersion);

    // 只有当服务器版本大于当前版本时才有更新
    const hasUpdate = comparisonResult > 0;

    console.log(`版本比较: 当前版本=${currentVersion}, 服务器版本=${serverVersion}, 有更新=${hasUpdate}`);

    return {
        version: serverVersion,
        hasUpdate,
        currentVersion
    };
};

/**
 * 从Markdown格式的更新日志文本中解析出结构化数据
 * @param {string} markdownText Markdown格式的更新日志
 * @returns {Array} 结构化的更新日志数据
 */
export const parseChangelogFromMarkdown = (markdownText) => {
    if (!markdownText) return [];

    const changelog = [];
    let currentVersion = null;
    let currentDate = '';
    let currentChanges = [];

    // 按行分割Markdown文本
    const lines = markdownText.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 跳过空行
        if (!line) continue;

        // 检查是否是版本标题行 (## v1.0.1 (2023-11-15))
        const versionMatch = line.match(/^##\s+([vV]?\d+\.\d+\.\d+)(?:\s+\((\d{4}-\d{2}-\d{2})\))?/);
        if (versionMatch) {
            // 如果已经有一个版本在处理中，将其添加到changelog中
            if (currentVersion) {
                changelog.push({
                    version: currentVersion,
                    date: currentDate,
                    changes: [...currentChanges]
                });
            }

            // 开始新版本
            currentVersion = versionMatch[1];
            currentDate = versionMatch[2] || new Date().toISOString().split('T')[0];
            currentChanges = [];
            continue;
        }

        // 如果没有当前处理的版本，跳过这一行
        if (!currentVersion) continue;

        // 检查是否是变更项 (- [新功能] 添加了xxx功能)
        const changeMatch = line.match(/^-\s+\[(.+?)\]\s+(.+)$/);
        if (changeMatch && currentVersion) {
            const type = mapChangeType(changeMatch[1]);
            const text = changeMatch[2].trim();
            currentChanges.push({ type, text });
        }
    }

    // 添加最后一个处理的版本
    if (currentVersion) {
        changelog.push({
            version: currentVersion,
            date: currentDate,
            changes: [...currentChanges]
        });
    }

    return changelog;
};

/**
 * 将更新日志中的变更类型文本映射为标准类型
 * @param {string} typeText 变更类型文本
 * @returns {string} 标准化的变更类型
 */
const mapChangeType = (typeText) => {
    const text = typeText.toLowerCase();
    if (text.includes('新功能') || text.includes('feature')) return 'feature';
    if (text.includes('优化') || text.includes('improvement')) return 'improvement';
    if (text.includes('修复') || text.includes('fix')) return 'fix';
    return 'other';
};

/**
 * 更新全局CHANGELOG常量
 * @param {Array} changelog 更新日志数据
 */
export const updateChangelogData = (changelog) => {
    // 清空现有数据
    CHANGELOG.length = 0;

    // 添加新数据
    if (Array.isArray(changelog) && changelog.length > 0) {
        changelog.forEach(item => CHANGELOG.push(item));
    }

    console.log('更新日志数据已更新:', CHANGELOG);
};

/**
 * 从更新包中获取并解析更新日志
 * 在实际项目中，此函数应该从Tauri更新API获取更新日志
 */
export const fetchChangelogFromUpdatePackage = async () => {
    try {
        // 这是一个模拟的Markdown更新日志
        // 在实际项目中，应该从更新包或服务器获取
        const markdownChangelog = `
## v1.0.1 (2023-11-15)

- [新功能] 添加自动更新功能
- [新功能] 添加更新日志查看功能
- [优化] 优化右键菜单显示位置计算
- [修复] 修复主题菜单在设置侧边栏中的显示问题
- [修复] 修复在某些情况下无法正确显示字体的问题

## v1.0.0 (2023-10-01)

- [新功能] 首次发布
- [新功能] 支持系统字体浏览和预览
- [新功能] 支持收藏字体功能
- [新功能] 支持字体搜索功能
- [新功能] 支持字体列表和预览的上下/左右布局切换
- [新功能] 支持多种主题切换
`;

        // 解析Markdown并更新数据
        const parsedChangelog = parseChangelogFromMarkdown(markdownChangelog);
        updateChangelogData(parsedChangelog);

        return parsedChangelog;
    } catch (error) {
        console.error('获取更新日志失败:', error);
        return [];
    }
}; 