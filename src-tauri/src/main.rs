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
        .invoke_handler(tauri::generate_handler![get_system_fonts])
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
                // 有更新可用，发送事件给前端
                // 前端会处理更新的显示和安装
                // 注意: 我们不在这里直接显示更新UI，让JS端来统一处理
                println!("发现更新: {}", update.latest_version());
                window
                    .emit("update-available", Some(update.latest_version()))
                    .expect("failed to emit update-available event");
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