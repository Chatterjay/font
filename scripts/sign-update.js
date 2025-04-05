/**
 * 更新包签名脚本
 * 
 * 该脚本用于手动签名updater.json文件，解决signature为空的问题
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

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const tempDir = path.join(__dirname, '..', 'temp');
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
 * 签名文件
 * @param {string} filePath 要签名的文件路径
 * @returns {Promise<string>} 签名结果
 */
async function signFile(filePath) {
    try {
        console.log(`签名文件: ${filePath}`);
        const passwordParam = keyPassword ? `-p "${keyPassword}"` : '';
        const command = `npx tauri signer sign -f "${keyPath}" ${passwordParam} "${filePath}"`;

        const signature = execSync(command).toString().trim();
        console.log(`签名成功: ${signature.substring(0, 30)}...`);
        return signature;
    } catch (error) {
        console.error(`签名失败: ${error.message}`);
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
                // 1. 下载文件
                const downloadedFilePath = await downloadFile(platformData.url);

                // 2. 签名文件
                const signature = await signFile(downloadedFilePath);

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

        console.log('处理完成!');
    } catch (error) {
        console.error(`错误: ${error.message}`);
        process.exit(1);
    }
}

// 运行主函数
main(); 