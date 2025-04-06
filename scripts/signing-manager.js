/**
 * Font Viewer 签名管理脚本
 * 
 * 用于在打包过程中处理应用程序和更新文件的签名
 * 支持多种签名方式：Node.js crypto和Tauri CLI
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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
        return '';  // 返回空字符串表示签名失败
    }
}

/**
 * 查找安装程序文件
 * @returns {Promise<Array<string>>} 找到的安装程序文件列表
 */
async function findInstallerFiles() {
    const installerDirs = [
        path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'msi'),
        path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
    ];

    const installerFiles = [];

    for (const dir of installerDirs) {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.endsWith('.msi') || file.endsWith('.exe')) {
                    installerFiles.push(path.join(dir, file));
                }
            }
        }
    }

    return installerFiles;
}

/**
 * 更新updater.json文件中的签名
 * @param {string} updaterFilePath updater.json文件路径
 * @param {string} installerFile 安装程序文件路径
 * @param {string} signature 签名结果
 * @returns {Promise<boolean>} 更新是否成功
 */
async function updateSignatureInUpdaterFile(updaterFilePath, installerFile, signature) {
    try {
        if (!fs.existsSync(updaterFilePath)) {
            console.error(`更新文件不存在: ${updaterFilePath}`);
            return false;
        }

        // 读取updater.json文件
        const updaterContent = fs.readFileSync(updaterFilePath, 'utf8');
        const updaterData = JSON.parse(updaterContent);

        // 获取文件名
        const fileName = path.basename(installerFile);
        let updated = false;

        // 遍历所有平台
        for (const platform in updaterData.platforms) {
            const platformData = updaterData.platforms[platform];
            if (platformData.url && platformData.url.includes(fileName)) {
                platformData.signature = signature;
                console.log(`已更新 ${platform} 的签名`);
                updated = true;
            }
        }

        if (updated) {
            // 保存更新后的文件
            fs.writeFileSync(updaterFilePath, JSON.stringify(updaterData, null, 2));
            console.log(`已更新签名到文件: ${updaterFilePath}`);
            return true;
        } else {
            console.warn(`在${updaterFilePath}中未找到匹配的平台条目: ${fileName}`);
            return false;
        }
    } catch (error) {
        console.error(`更新签名时出错: ${error.message}`);
        return false;
    }
}

/**
 * 主函数
 */
async function main() {
    try {
        // 解析命令行参数
        const updaterFilePath = process.argv[2];
        const privateKeyPath = process.argv[3];
        const password = process.argv[4];

        // 验证参数
        if (!updaterFilePath) {
            console.error('错误: 请提供updater.json文件路径');
            console.log('用法: node scripts/signing-manager.js <updater文件路径> [私钥路径] [私钥密码]');
            process.exit(1);
        }

        console.log(`# 获取版本信息和构建时间`);

        // 查找安装程序文件
        const installerFiles = await findInstallerFiles();
        console.log(`构建产物: ${JSON.stringify(installerFiles)}`);

        if (installerFiles.length === 0) {
            console.error('错误: 未找到安装程序文件');
            process.exit(1);
        }

        // 签名所有安装程序文件
        for (const installerFile of installerFiles) {
            const fileType = installerFile.endsWith('.msi') ? 'MSI' : 'EXE';
            console.log(`找到${fileType}文件: ${path.basename(installerFile)}`);

            let signature = '';

            if (privateKeyPath) {
                console.log(`准备对${fileType}文件进行签名...`);
                signature = await signFile(installerFile, privateKeyPath, password);
                if (!signature) {
                    console.error(`签名过程出错: 签名失败，返回为空`);
                    console.log('继续但不使用签名...');
                }
            } else {
                console.warn('未提供私钥，跳过签名过程');
            }

            // 更新updater.json文件
            if (signature) {
                await updateSignatureInUpdaterFile(updaterFilePath, installerFile, signature);
            } else {
                console.warn('没有添加签名到更新元数据中');
            }
        }

        console.log('更新元数据文件已生成');

    } catch (error) {
        console.error(`签名管理器出错: ${error.message}`);
        process.exit(1);
    }
}

// 执行主函数
main().catch(error => {
    console.error(`签名管理器出错: ${error.message}`);
    process.exit(1);
}); 