/**
 * 发布新版本脚本
 * 
 * 该脚本用于自动更新版本号、生成更新日志并推送到Git仓库
 * 
 * 使用方法:
 * node scripts/release.js [major|minor|patch]
 * 
 * 参数说明:
 * major - 主版本更新，如 1.0.0 -> 2.0.0
 * minor - 次版本更新，如 1.0.0 -> 1.1.0
 * patch - 补丁版本更新，如 1.0.0 -> 1.0.1 (默认)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 更新日志文件路径
const UPDATE_LOG = path.join(rootDir, 'UPDATE_LOG.md');

/**
 * 更新版本号
 * @param {string} type 更新类型：major, minor, patch
 * @returns {string} 新的版本号
 */
function updateVersion(type = 'patch') {
    // 读取package.json
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // 解析当前版本号
    let [major, minor, patch] = packageJson.version.split('.').map(Number);

    // 根据类型更新版本号
    if (type === 'major') {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (type === 'minor') {
        minor += 1;
        patch = 0;
    } else {
        patch += 1;
    }

    // 生成新版本号
    const newVersion = `${major}.${minor}.${patch}`;
    packageJson.version = newVersion;

    // 更新package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log(`版本已更新: ${packageJson.version} -> ${newVersion}`);
    return newVersion;
}

/**
 * 更新日志处理
 * @param {string} version 新版本号
 */
function updateChangelog(version) {
    // 获取最近的提交记录
    const commits = execSync('git log -10 --pretty=format:"- %s (%h)" --abbrev-commit')
        .toString()
        .split('\n')
        .slice(0, 5) // 只使用最近5条提交
        .join('\n');

    // 检查日志文件是否存在
    if (!fs.existsSync(UPDATE_LOG)) {
        // 如果不存在，创建新的日志文件
        const initialContent = `# 更新日志\n\n## v${version}\n\n${commits}\n`;
        fs.writeFileSync(UPDATE_LOG, initialContent);
        console.log(`已创建更新日志: ${UPDATE_LOG}`);
    } else {
        // 如果存在，在文件头部添加新的版本信息
        const content = fs.readFileSync(UPDATE_LOG, 'utf8');
        const newContent = `# 更新日志\n\n## v${version}\n\n${commits}\n\n${content.replace('# 更新日志\n\n', '')}`;
        fs.writeFileSync(UPDATE_LOG, newContent);
        console.log(`已更新日志: ${UPDATE_LOG}`);
    }

    return commits;
}

/**
 * 主函数
 */
async function main() {
    try {
        // 获取参数
        const type = process.argv[2] || 'patch';

        if (!['major', 'minor', 'patch'].includes(type)) {
            console.error(`无效的版本类型: ${type}`);
            console.error('有效类型: major, minor, patch');
            process.exit(1);
        }

        // 确保工作目录干净
        try {
            execSync('git diff --quiet && git diff --staged --quiet');
        } catch (error) {
            console.error('工作目录不干净，请先提交或暂存所有更改');
            process.exit(1);
        }

        // 更新版本号
        const newVersion = updateVersion(type);

        // 更新日志
        updateChangelog(newVersion);

        // Git操作：提交、打标签并推送
        const tagName = `v${newVersion}`;

        execSync('git add package.json UPDATE_LOG.md');
        execSync(`git commit -m "chore: release ${tagName}"`);
        execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);

        console.log('执行git push...');
        execSync('git push');

        console.log(`推送标签 ${tagName}...`);
        execSync(`git push origin ${tagName}`);

        console.log(`\n✅ 版本 ${newVersion} 发布成功!`);
        console.log(`GitHub Action 工作流将自动构建并发布此版本`);
    } catch (error) {
        console.error(`错误: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
main(); 