// 发布新版本的脚本
import fs from 'fs';
import { execSync } from 'child_process';

// 读取package.json获取版本号
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const version = pkg.version;

console.log(`准备发布版本 v${version}...`);

try {
    // 运行版本更新脚本
    console.log('1. 运行版本更新脚本...');
    execSync('node update-version.js', { stdio: 'inherit' });

    // 清理构建目录，确保完整重建
    console.log('2. 清理构建目录...');
    try {
        execSync('rm -rf dist', { stdio: 'inherit' });
    } catch (e) {
        // Windows系统上可能需要使用不同命令
        try {
            execSync('rmdir /s /q dist', { stdio: 'inherit' });
        } catch (e2) {
            console.log('清理目录失败，可能目录不存在，继续执行...');
        }
    }

    // 添加所有更改到Git
    console.log('3. 添加所有更改到Git...');
    execSync('git add .', { stdio: 'inherit' });

    // 提交更改
    console.log(`4. 提交更改 (chore: update version to ${version})...`);
    execSync(`git commit -m "chore: update version to ${version}"`, { stdio: 'inherit' });

    // 创建标签
    console.log(`5. 创建标签 v${version}...`);
    execSync(`git tag -a v${version} -m "Release v${version}"`, { stdio: 'inherit' });

    // 推送标签
    console.log(`6. 推送标签 v${version} 到远程仓库...`);
    execSync(`git push origin v${version}`, { stdio: 'inherit' });

    console.log(`版本 v${version} 发布成功!`);
} catch (error) {
    console.error('发布过程中出错:', error.message);
    process.exit(1);
} 