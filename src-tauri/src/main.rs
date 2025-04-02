#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::fs;
use std::path::Path;
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
            #[cfg(debug_assertions)]
            app.get_window("main").unwrap().open_devtools();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_system_fonts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 