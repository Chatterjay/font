/**
 * 版本更新脚本
 * 
 * 该脚本会读取src/constants/version.js文件中的CURRENT_VERSION，
 * 然后更新package.json和src-tauri/tauri.conf.json中的版本号
 * 同时检查VERSION_HISTORY是否包含最新版本
 * 
 * 用法: node update-version.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const versionFilePath = path.join(__dirname, 'src', 'constants', 'version.js');
const packageJsonPath = path.join(__dirname, 'package.json');
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');

// 从version.js文件中提取数据
function extractFromVersionJs() {
    try {
        const content = fs.readFileSync(versionFilePath, 'utf8');

        // 提取当前版本号
        const versionMatch = content.match(/CURRENT_VERSION\s*=\s*['"](.+?)['"]/);
        if (!versionMatch || !versionMatch[1]) {
            throw new Error('无法从version.js中提取版本号');
        }

        const fullVersion = versionMatch[1];
        // 去除'v'前缀用于配置文件
        const version = fullVersion.replace(/^v/, '');
        console.log(`从version.js中提取的版本号: ${fullVersion} (配置文件使用: ${version})`);

        // 检查版本历史是否包含当前版本
        const historyCheck = content.includes(`version: '${fullVersion}'`) ||
            content.includes(`version: "${fullVersion}"`);

        return { version, fullVersion, historyCheck };
    } catch (error) {
        console.error(`读取version.js文件出错: ${error.message}`);
        process.exit(1);
    }
}

// 更新package.json文件
function updatePackageJson(version) {
    try {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(content);

        console.log(`package.json当前版本: ${packageJson.version}`);
        packageJson.version = version;

        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`package.json已更新为版本: ${version}`);
    } catch (error) {
        console.error(`更新package.json文件出错: ${error.message}`);
    }
}

// 更新tauri.conf.json文件
function updateTauriConf(version) {
    try {
        const content = fs.readFileSync(tauriConfPath, 'utf8');
        const tauriConf = JSON.parse(content);

        console.log(`tauri.conf.json当前版本: ${tauriConf.package.version}`);
        tauriConf.package.version = version;

        fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
        console.log(`tauri.conf.json已更新为版本: ${version}`);
    } catch (error) {
        console.error(`更新tauri.conf.json文件出错: ${error.message}`);
    }
}

// 更新Cargo.toml文件
function updateCargoToml(version) {
    try {
        let content = fs.readFileSync(cargoTomlPath, 'utf8');

        // 查找当前版本
        const versionMatch = content.match(/version\s*=\s*["'](.+?)["']/);
        if (versionMatch && versionMatch[1]) {
            console.log(`Cargo.toml当前版本: ${versionMatch[1]}`);

            // 替换版本号
            content = content.replace(
                /version\s*=\s*["'].+?["']/,
                `version = "${version}"`
            );

            fs.writeFileSync(cargoTomlPath, content);
            console.log(`Cargo.toml已更新为版本: ${version}`);
        } else {
            console.error('无法在Cargo.toml中找到版本信息');
        }
    } catch (error) {
        console.error(`更新Cargo.toml文件出错: ${error.message}`);
    }
}

// 主函数
function main() {
    console.log('开始更新版本号...');

    // 获取version.js中的版本号和验证信息
    const { version, fullVersion, historyCheck } = extractFromVersionJs();

    // 检查VERSION_HISTORY是否包含当前版本
    if (!historyCheck) {
        console.warn('\n⚠️ 警告: VERSION_HISTORY中似乎没有包含当前版本的记录!');
        console.warn(`请确保在src/constants/version.js文件中的VERSION_HISTORY数组中添加版本 '${fullVersion}' 的信息。`);
        console.warn('版本历史记录应包含版本号、日期和变更内容。\n');

        const proceed = process.argv.includes('--force');
        if (!proceed) {
            const readline = createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('是否继续更新版本? (y/N): ', (answer) => {
                if (answer.toLowerCase() === 'y') {
                    proceedWithUpdates(version);
                } else {
                    console.log('版本更新已取消。请先更新VERSION_HISTORY。');
                    process.exit(0);
                }
                readline.close();
            });
            return;
        }
    }

    proceedWithUpdates(version);
}

// 执行文件更新
function proceedWithUpdates(version) {
    // 更新所有文件
    updatePackageJson(version);
    updateTauriConf(version);
    updateCargoToml(version);

    console.log('版本更新完成!');
    console.log(`所有文件已更新为版本: ${version}`);
    console.log('\n提示: 请记得提交这些更改并推送到远程仓库');
}

// 执行主函数
main(); 