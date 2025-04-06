import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * @param {string} privateKeyPath 私钥路径
 * @param {string} password 私钥密码
 * @returns {Promise<string>} 签名结果
 */
async function signFile(filePath, privateKeyPath, password) {
    try {
        // 先尝试使用Node.js crypto签名
        try {
            return await signFileWithCrypto(filePath, privateKeyPath, password);
        } catch (error) {
            console.log(`使用Node.js crypto签名失败，尝试Tauri CLI...`);
            // 如果Node.js crypto签名失败，尝试使用Tauri CLI
            return await signFileWithTauri(filePath, privateKeyPath, password);
        }
    } catch (error) {
        console.error(`所有签名方法都失败: ${error.message}`);
        throw error;
    }
}

// 主函数
async function main() {
    try {
        const msiFilePath = process.argv[2];
        const privateKeyPath = process.argv[3];
        const password = process.argv[4];

        if (!msiFilePath) {
            console.error('错误: 请提供MSI文件路径');
            process.exit(1);
        }

        console.log(`MSI文件: ${msiFilePath}`);
        console.log('准备对MSI文件进行签名...');

        let signature;
        if (privateKeyPath) {
            signature = await signFile(msiFilePath, privateKeyPath, password);
            console.log(`签名完成: ${signature.substring(0, 30)}...`);
        } else {
            // 如果没有提供私钥，只计算哈希值
            const fileContent = fs.readFileSync(msiFilePath);
            const hash = crypto.createHash('sha256');
            hash.update(fileContent);
            const fileHash = hash.digest('hex');
            console.log(`文件哈希值: ${fileHash}`);
            signature = fileHash;
        }

        // 如果提供了更新文件路径，可以将签名添加到更新文件中
        const updaterFilePath = process.argv[5];
        if (updaterFilePath && fs.existsSync(updaterFilePath)) {
            const updaterContent = fs.readFileSync(updaterFilePath, 'utf8');
            const updaterData = JSON.parse(updaterContent);

            // 更新签名字段
            const fileName = path.basename(msiFilePath);

            for (const platform in updaterData.platforms) {
                const platformData = updaterData.platforms[platform];
                if (platformData.url && platformData.url.includes(fileName)) {
                    platformData.signature = signature;
                    console.log(`已更新 ${platform} 的签名`);
                }
            }

            // 保存更新文件
            fs.writeFileSync(updaterFilePath, JSON.stringify(updaterData, null, 2));
            console.log(`已更新签名到文件: ${updaterFilePath}`);
        }

        console.log('签名过程完成');

    } catch (error) {
        console.error(`签名过程出错: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    console.error(`签名过程出错: ${error.message}`);
    process.exit(1);
}); 