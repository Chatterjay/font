#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::fs;
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct FontInfo {
    name: String,
    path: String,
    family: String,
    style: String,
}

#[tauri::command]
fn get_system_fonts() -> Result<Vec<FontInfo>, String> {
    let mut fonts = Vec::new();
    
    // Windows 系统字体目录
    let font_dirs = vec![
        "C:\\Windows\\Fonts",
        "C:\\Users\\Public\\AppData\\Local\\Microsoft\\Windows\\Fonts",
    ];

    for dir in font_dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.extension().map_or(false, |ext| {
                        ext == "ttf" || ext == "otf" || ext == "ttc" || ext == "woff" || ext == "woff2"
                    }) {
                        let file_name = path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        
                        // 从文件名中提取字体名称和样式
                        let name = file_name.split('.').next().unwrap_or(&file_name).to_string();
                        let family = name.split('-').next().unwrap_or(&name).to_string();
                        let style = if name.contains('-') {
                            name.split('-').nth(1).unwrap_or("Regular").to_string()
                        } else {
                            "Regular".to_string()
                        };

                        fonts.push(FontInfo {
                            name,
                            path: path.to_string_lossy().to_string(),
                            family,
                            style,
                        });
                    }
                }
            }
        }
    }

    Ok(fonts)
}

/// 从资源或本地文件获取更新日志内容
#[tauri::command]
fn get_changelog_text() -> Result<String, String> {
    // 在生产环境中尝试从应用资源目录读取CHANGELOG.md
    let changelog_path = std::path::PathBuf::from("CHANGELOG.md");
    
    if changelog_path.exists() {
        match fs::read_to_string(&changelog_path) {
            Ok(content) => {
                println!("成功从本地文件读取更新日志");
                return Ok(content);
            }
            Err(e) => {
                eprintln!("读取更新日志文件失败: {}", e);
            }
        }
    }
    
    // 如果本地文件不存在或读取失败，返回一个基本的更新日志
    let basic_changelog = format!(r#"
## v1.0.2 ({})

- [新功能] 改进自动更新机制
- [优化] 优化版本比较算法
- [修复] 修复版本检查相关问题

## v1.0.1 (2023-11-15)

- [新功能] 添加自动更新功能
- [新功能] 添加更新日志查看功能
- [优化] 优化右键菜单显示位置计算
- [修复] 修复主题菜单在设置侧边栏中的显示问题

## v1.0.0 (2023-10-01)

- [新功能] 首次发布
- [新功能] 支持系统字体浏览和预览
- [新功能] 支持收藏字体功能
- [新功能] 支持字体搜索功能
"#, chrono::Local::now().format("%Y-%m-%d"));

    println!("使用默认更新日志");
    Ok(basic_changelog)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 配置自动更新检查
            #[cfg(not(debug_assertions))]
            {
                let app_handle = app.handle();
                let window = app.get_window("main").unwrap();
                
                // 启动时检查更新
                tauri::async_runtime::spawn(async move {
                    let _ = check_update(&app_handle, &window).await;
                });
            }
            
            #[cfg(debug_assertions)]
            {
                // 在调试模式下，打开开发者工具
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_system_fonts, get_changelog_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 检查更新的函数
#[cfg(not(debug_assertions))]
async fn check_update(app_handle: &tauri::AppHandle, window: &tauri::Window) -> Result<(), Box<dyn std::error::Error>> {
    // 添加短暂延迟，确保前端JS已准备好接收事件
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    match app_handle.updater().check().await {
        Ok(update) => {
            if update.is_update_available() {
                // 获取当前版本和可用版本
                let current_version = app_handle.package_info().version.clone();
                let available_version = update.latest_version();
                
                // 将Version类型转换为字符串
                let current_version_str = current_version.to_string();
                let available_version_str = available_version.clone();
                
                // 比较版本号，确保只有更高版本才触发更新
                if compare_versions(&available_version_str, &current_version_str) > 0 {
                    // 有更新可用，发送事件给前端
                    println!("发现更新: {} (当前版本: {})", available_version, current_version);
                    window
                        .emit("update-available", Some(available_version))
                        .expect("failed to emit update-available event");
                } else {
                    println!("检测到的版本 {} 不比当前版本 {} 更新，跳过更新", available_version, current_version);
                }
            } else {
                println!("没有发现更新");
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("检查更新时出错: {}", e);
            Err(Box::new(e))
        }
    }
}

// 版本比较辅助函数
#[cfg(not(debug_assertions))]
fn compare_versions(version_a: &str, version_b: &str) -> i32 {
    let parse_version = |version: &str| -> Vec<u32> {
        let version = version.trim_start_matches('v');
        version.split('.')
            .filter_map(|part| part.parse::<u32>().ok())
            .collect()
    };
    
    let version_a_parts = parse_version(version_a);
    let version_b_parts = parse_version(version_b);
    
    let max_len = std::cmp::max(version_a_parts.len(), version_b_parts.len());
    
    for i in 0..max_len {
        let a_part = version_a_parts.get(i).copied().unwrap_or(0);
        let b_part = version_b_parts.get(i).copied().unwrap_or(0);
        
        if a_part > b_part {
            return 1;
        } else if a_part < b_part {
            return -1;
        }
    }
    
    0 // 版本相同
} 