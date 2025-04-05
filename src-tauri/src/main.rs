#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::fs;
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use serde_json;
use std::path::Path;
use std::fs::File;
use std::io::Read;
use chrono;

// 字体信息结构
#[derive(Debug, Serialize, Deserialize, Clone)]
struct FontInfo {
    name: String,
    path: String,
    family: String,
    style: String,
}

// 字体缓存管理
struct FontCache {
    fonts: Vec<FontInfo>,
    loaded: bool,
}

impl FontCache {
    fn new() -> Self {
        FontCache {
            fonts: Vec::new(),
            loaded: false,
        }
    }
    
    fn load_fonts(&mut self) -> Result<(), String> {
        if self.loaded {
            return Ok(());
        }
        
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

                            self.fonts.push(FontInfo {
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
        
        self.loaded = true;
        Ok(())
    }
    
    fn get_all_fonts(&mut self) -> Result<Vec<FontInfo>, String> {
        self.load_fonts()?;
        Ok(self.fonts.clone())
    }
    
    fn get_paginated_fonts(&mut self, page: usize, page_size: usize) -> Result<Vec<FontInfo>, String> {
        self.load_fonts()?;
        
        let start = page * page_size;
        let end = (start + page_size).min(self.fonts.len());
        
        if start >= self.fonts.len() {
            return Ok(Vec::new());
        }
        
        Ok(self.fonts[start..end].to_vec())
    }
    
    fn get_font_count(&mut self) -> Result<usize, String> {
        self.load_fonts()?;
        Ok(self.fonts.len())
    }
}

// 获取所有系统字体（仍然保留以向后兼容）
#[tauri::command]
fn get_system_fonts(font_cache: tauri::State<Arc<Mutex<FontCache>>>) -> Result<Vec<FontInfo>, String> {
    let mut cache = font_cache.lock().unwrap();
    cache.get_all_fonts()
}

// 分页获取系统字体
#[tauri::command]
fn get_paginated_fonts(page: usize, page_size: usize, font_cache: tauri::State<Arc<Mutex<FontCache>>>) -> Result<Vec<FontInfo>, String> {
    let mut cache = font_cache.lock().unwrap();
    cache.get_paginated_fonts(page, page_size)
}

// 获取字体总数
#[tauri::command]
fn get_font_count(font_cache: tauri::State<Arc<Mutex<FontCache>>>) -> Result<usize, String> {
    let mut cache = font_cache.lock().unwrap();
    cache.get_font_count()
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
    // 创建字体缓存
    let font_cache = Arc::new(Mutex::new(FontCache::new()));

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
        .manage(font_cache)
        .invoke_handler(tauri::generate_handler![
            get_system_fonts, 
            get_paginated_fonts,
            get_font_count,
            get_changelog_text
        ])
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
            // 获取当前版本
            let current_version = app_handle.package_info().version.clone();
            let current_version_str = current_version.to_string();
            
            if update.is_update_available() {
                // 获取可用版本
                let available_version = update.latest_version();
                let available_version_str = available_version;
                
                // 比较版本号，确保只有更高版本才触发更新
                if compare_versions(&available_version_str, &current_version_str) > 0 {
                    // 有更新可用，发送事件给前端
                    println!("发现更新: {} (当前版本: {})", available_version, current_version);
                    
                    // 获取更新日志和详情
                    let notes = update.body().map(|s| s.to_string()).unwrap_or_else(String::new);
                    
                    // 构建更详细的更新信息
                    let update_info = serde_json::json!({
                        "version": available_version_str,
                        "currentVersion": current_version_str,
                        "notes": notes,
                        "date": chrono::Local::now().format("%Y-%m-%d").to_string(),
                        "hasUpdate": true
                    });
                    
                    // 发送更新事件
                    window
                        .emit("update-available", Some(update_info))
                        .expect("failed to emit update-available event");
                } else {
                    println!("检测到的版本 {} 不比当前版本 {} 更新，跳过更新", available_version, current_version);
                    
                    // 即使没有更新，也发送事件给前端，通知当前已是最新版本
                    let update_info = serde_json::json!({
                        "version": current_version_str,
                        "currentVersion": current_version_str,
                        "notes": "",
                        "hasUpdate": false
                    });
                    
                    window
                        .emit("update-available", Some(update_info))
                        .expect("failed to emit update-available event");
                }
            } else {
                println!("没有发现更新");
                
                // 发送没有更新的事件
                let update_info = serde_json::json!({
                    "version": current_version_str,
                    "currentVersion": current_version_str, 
                    "notes": "",
                    "hasUpdate": false
                });
                
                window
                    .emit("update-available", Some(update_info))
                    .expect("failed to emit update-available event");
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("检查更新时出错: {}", e);
            
            // 发送错误事件
            let error_info = serde_json::json!({
                "error": e.to_string(),
                "hasUpdate": false
            });
            
            window
                .emit("update-error", Some(error_info))
                .expect("failed to emit update-error event");
                
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