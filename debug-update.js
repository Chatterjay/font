/**
 * 更新调试脚本
 * 用于检查版本信息和更新日志是否正确
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const versionFilePath = path.join(__dirname, 'src', 'constants', 'version.js');
const packageJsonPath = path.join(__dirname, 'package.json');
const tauriConfPath = path.join(__dirname, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');

console.log('============ 版本调试工具 ============');

// 检查文件是否存在
const checkFileExists = (filePath) => {
    return fs.existsSync(filePath);
};

// 读取并解析版本文件
const checkVersionFile = () => {
    if (!checkFileExists(versionFilePath)) {
        console.error(`❌ 版本文件不存在: ${versionFilePath}`);
        return null;
    }

    try {
        const content = fs.readFileSync(versionFilePath, 'utf8');
        console.log(`✅ 版本文件存在: ${versionFilePath}`);

        // 提取当前版本
        const versionMatch = content.match(/CURRENT_VERSION\s*=\s*['"](.+?)['"]/);
        if (!versionMatch) {
            console.error('❌ 无法从版本文件中提取版本号');
            return null;
        }

        const version = versionMatch[1];
        console.log(`📝 当前版本: ${version}`);

        // 检查版本历史
        const historyMatch = content.match(/VERSION_HISTORY\s*=\s*\[([\s\S]*?)\];/);
        if (!historyMatch) {
            console.error('❌ 无法从版本文件中提取版本历史');
            return null;
        }

        // 查找当前版本是否在历史记录中
        const historyContent = historyMatch[1];
        const hasCurrentVersion = historyContent.includes(`version: '${version}'`) ||
            historyContent.includes(`version: "${version}"`);

        if (hasCurrentVersion) {
            console.log(`✅ 版本 ${version} 存在于版本历史中`);
        } else {
            console.error(`❌ 版本 ${version} 不存在于版本历史中`);
        }

        // 提取历史版本信息
        const historyEntries = historyContent.match(/\{[\s\S]*?version:[\s\S]*?\}/g);
        if (historyEntries) {
            console.log(`📊 发现 ${historyEntries.length} 个版本历史记录`);

            // 分析版本日期
            const dateRegex = /date:\s*['"](.+?)['"]/;
            const futureDate = [];

            historyEntries.forEach(entry => {
                const dateMatch = entry.match(dateRegex);
                if (dateMatch) {
                    const date = dateMatch[1];
                    const vMatch = entry.match(/version:\s*['"](.+?)['"]/);
                    const v = vMatch ? vMatch[1] : '未知';

                    // 检查是否是未来日期
                    const entryDate = new Date(date);
                    const today = new Date();

                    if (entryDate > today) {
                        futureDate.push({ version: v, date });
                        console.warn(`⚠️ 版本 ${v} 使用了未来日期: ${date}`);
                    }
                }
            });

            if (futureDate.length > 0) {
                console.warn('⚠️ 发现使用未来日期的版本，这可能会导致更新问题');
            }
        }

        return { version };
    } catch (error) {
        console.error(`❌ 读取版本文件出错: ${error.message}`);
        return null;
    }
};

// 检查配置文件版本一致性
const checkConfigVersions = (currentVersion) => {
    if (!currentVersion) return;

    const versionWithoutPrefix = currentVersion.replace(/^v/, '');

    // 检查package.json
    if (checkFileExists(packageJsonPath)) {
        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            console.log(`📝 package.json 版本: ${packageJson.version}`);

            if (packageJson.version !== versionWithoutPrefix) {
                console.error(`❌ package.json 版本不匹配: ${packageJson.version} != ${versionWithoutPrefix}`);
            } else {
                console.log('✅ package.json 版本匹配');
            }
        } catch (error) {
            console.error(`❌ 读取package.json出错: ${error.message}`);
        }
    }

    // 检查tauri.conf.json
    if (checkFileExists(tauriConfPath)) {
        try {
            const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
            console.log(`📝 tauri.conf.json 版本: ${tauriConf.package.version}`);

            if (tauriConf.package.version !== versionWithoutPrefix) {
                console.error(`❌ tauri.conf.json 版本不匹配: ${tauriConf.package.version} != ${versionWithoutPrefix}`);
            } else {
                console.log('✅ tauri.conf.json 版本匹配');
            }

            // 检查窗口标题
            const windowTitle = tauriConf.tauri.windows[0].title;
            if (windowTitle.includes('__VERSION__')) {
                console.log(`✅ 窗口标题包含版本占位符: ${windowTitle}`);
            } else if (!windowTitle.includes(versionWithoutPrefix)) {
                console.warn(`⚠️ 窗口标题可能不包含版本信息: ${windowTitle}`);
            }
        } catch (error) {
            console.error(`❌ 读取tauri.conf.json出错: ${error.message}`);
        }
    }

    // 检查Cargo.toml
    if (checkFileExists(cargoTomlPath)) {
        try {
            const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
            const versionMatch = cargoToml.match(/version\s*=\s*["'](.+?)["']/);

            if (versionMatch) {
                const cargoVersion = versionMatch[1];
                console.log(`📝 Cargo.toml 版本: ${cargoVersion}`);

                if (cargoVersion !== versionWithoutPrefix) {
                    console.error(`❌ Cargo.toml 版本不匹配: ${cargoVersion} != ${versionWithoutPrefix}`);
                } else {
                    console.log('✅ Cargo.toml 版本匹配');
                }
            } else {
                console.error('❌ 无法从Cargo.toml中提取版本号');
            }
        } catch (error) {
            console.error(`❌ 读取Cargo.toml出错: ${error.message}`);
        }
    }
};

console.log('\n===== 版本文件检查 =====');
const versionInfo = checkVersionFile();

console.log('\n===== 配置文件版本一致性检查 =====');
checkConfigVersions(versionInfo?.version);

console.log('\n============ 调试完成 ============'); 