/**
 * 更新包签名脚本
 * 
 * 该脚本用于签名updater.json文件，以实现安全的自动更新机制
 * 也可以在本地手动运行，为已发布的版本添加签名
 * 
 * 用法:
 * node scripts/sign-update.js <updater文件路径> <私钥路径> <私钥密码>
 * 
 * 例如:
 * node scripts/sign-update.js font-viewer-updater.json tauri.key 你的密码
 */

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import { createWriteStream } from 'fs';
import crypto from 'crypto';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 解析命令行参数
const updaterFilePath = process.argv[2];
const keyPath = process.argv[3];
const keyPassword = process.argv[4];

if (!updaterFilePath || !keyPath) {
    console.error('用法: node sign-update.js <updater文件路径> <私钥路径> <私钥密码>');
    process.exit(1);
}

// 检查文件是否存在
if (!fs.existsSync(updaterFilePath)) {
    console.error(`未找到更新文件: ${updaterFilePath}`);
    process.exit(1);
}

if (!fs.existsSync(keyPath)) {
    console.error(`未找到私钥文件: ${keyPath}`);
    process.exit(1);
}

// 创建临时目录
const tempDir = path.join(rootDir, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * 下载文件到临时目录
 * @param {string} url 要下载的文件URL
 * @returns {Promise<string>} 下载后的本地文件路径
 */
async function downloadFile(url) {
    return new Promise((resolve, reject) => {
        // 确定使用http还是https
        const protocol = url.startsWith('https') ? https : http;
        const fileName = path.basename(url);
        const filePath = path.join(tempDir, fileName);
        const file = createWriteStream(filePath);

        console.log(`下载文件: ${url}`);
        console.log(`保存到: ${filePath}`);

        protocol.get(url, (response) => {
            // 处理重定向
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location).then(resolve).catch(reject);
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`下载完成: ${filePath}`);
                resolve(filePath);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => { }); // 删除不完整的文件
            reject(err);
        });
    });
}

/**
 * 使用Node.js crypto签名文件
 * @param {string} filePath 要签名的文件路径
 * @param {string} privateKeyPath 私钥路径
 * @param {string} password 私钥密码
 * @returns {Promise<string>} 签名结果(base64格式)
 */
async function signFileWithCrypto(filePath, privateKeyPath, password) {
    try {
        console.log(`使用Node.js crypto签名文件: ${filePath}`);

        // 读取私钥和文件内容
        const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
        const fileBuffer = fs.readFileSync(filePath);

        // 创建签名
        const sign = crypto.createSign('SHA256');
        sign.update(fileBuffer);
        sign.end();

        // 使用私钥和密码签名
        const signature = sign.sign({
            key: privateKey,
            passphrase: password || ''
        }, 'base64');

        console.log(`签名成功: ${signature.substring(0, 30)}...`);
        return signature;
    } catch (error) {
        console.error(`签名失败: ${error.message}`);
        throw error;
    }
}

/**
 * 使用Tauri CLI签名文件
 * @param {string} filePath 要签名的文件路径
 * @param {string} privateKeyPath 私钥路径
 * @param {string} password 私钥密码
 * @returns {Promise<string>} 签名结果
 */
async function signFileWithTauri(filePath, privateKeyPath, password) {
    try {
        console.log(`使用Tauri CLI签名文件: ${filePath}`);
        const passwordParam = password ? `--password "${password}"` : '';

        // 尝试新版Tauri CLI格式
        try {
            const command = `npx --yes @tauri-apps/cli signer sign --key "${privateKeyPath}" ${passwordParam} "${filePath}"`;
            const signature = execSync(command).toString().trim();
            console.log(`签名成功: ${signature.substring(0, 30)}...`);
            return signature;
        } catch (error) {
            console.log(`新版格式失败，尝试旧版格式...`);
            // 尝试旧版格式
            const command = `npx --yes tauri signer sign --key "${privateKeyPath}" ${passwordParam} "${filePath}"`;
            const signature = execSync(command).toString().trim();
            console.log(`签名成功: ${signature.substring(0, 30)}...`);
            return signature;
        }
    } catch (error) {
        console.error(`使用Tauri CLI签名失败: ${error.message}`);
        throw error;
    }
}

/**
 * 签名文件（尝试多种方法）
 * @param {string} filePath 要签名的文件路径
 * @returns {Promise<string>} 签名结果
 */
async function signFile(filePath) {
    try {
        // 先尝试使用Node.js crypto签名
        try {
            return await signFileWithCrypto(filePath, keyPath, keyPassword);
        } catch (error) {
            console.log(`使用Node.js crypto签名失败，尝试Tauri CLI...`);
            // 如果Node.js crypto签名失败，尝试使用Tauri CLI
            return await signFileWithTauri(filePath, keyPath, keyPassword);
        }
    } catch (error) {
        console.error(`所有签名方法都失败: ${error.message}`);
        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        console.log('开始处理更新文件...');

        // 读取更新文件
        const updaterContent = fs.readFileSync(updaterFilePath, 'utf8');
        const updaterData = JSON.parse(updaterContent);

        console.log(`版本: ${updaterData.version}`);
        console.log('平台:');

        // 确保platforms字段存在
        if (!updaterData.platforms) {
            console.error('错误: 更新文件中没有platforms字段');
            process.exit(1);
        }

        // 遍历所有平台
        for (const platform in updaterData.platforms) {
            const platformData = updaterData.platforms[platform];
            console.log(`- ${platform}`);

            // 跳过没有URL的平台
            if (!platformData.url) {
                console.warn(`  警告: 平台 ${platform} 没有URL，跳过`);
                continue;
            }

            console.log(`  URL: ${platformData.url}`);

            try {
                // 1. 本地文件优先
                let filePath = null;
                const urlFileName = path.basename(platformData.url);

                // 检查本地是否存在此文件
                const possiblePaths = [
                    path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'msi', urlFileName),
                    path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis', urlFileName),
                    path.join(rootDir, urlFileName)
                ];

                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        filePath = p;
                        console.log(`  找到本地文件: ${filePath}`);
                        break;
                    }
                }

                // 如果本地没有，则下载
                if (!filePath) {
                    console.log(`  本地未找到文件，尝试下载...`);
                    filePath = await downloadFile(platformData.url);
                }

                // 2. 签名文件
                const signature = await signFile(filePath);

                // 3. 更新signature字段
                platformData.signature = signature;
                console.log(`  已更新签名`);
            } catch (error) {
                console.error(`  处理平台 ${platform} 时出错: ${error.message}`);
            }
        }

        // 保存更新后的文件
        fs.writeFileSync(updaterFilePath, JSON.stringify(updaterData, null, 2));
        console.log(`更新文件已保存: ${updaterFilePath}`);

        // 如果是latest-version.json，也更新它
        const latestVersionPath = path.join(path.dirname(updaterFilePath), 'latest-version.json');
        if (updaterFilePath !== latestVersionPath && fs.existsSync(latestVersionPath)) {
            fs.writeFileSync(latestVersionPath, JSON.stringify(updaterData, null, 2));
            console.log(`最新版本文件已更新: ${latestVersionPath}`);
        }

        console.log('处理完成!');
    } catch (error) {
        console.error(`错误: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
main(); 