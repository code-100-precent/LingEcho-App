// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, State, WindowBuilder, WindowUrl};
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
struct AppState {
    theme: String,
    window_title: String,
}

// Learn more about Tauri commands at https://tauri.app/v2/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "声驭智核",
        "version": "0.0.0",
        "description": "智能语音助手，提供语音交互、桌面宠物、知识管理等功能"
    })
}

#[tauri::command]
fn set_theme(theme: &str, _state: State<AppState>) -> Result<(), String> {
    println!("Setting theme to: {}", theme);
    // Here you could implement theme switching logic
    Ok(())
}

#[tauri::command]
fn get_theme(state: State<AppState>) -> String {
    state.theme.clone()
}

#[tauri::command]
async fn export_data() -> Result<String, String> {
    // Implement data export logic here
    Ok("Data exported successfully".to_string())
}

#[tauri::command]
async fn import_data() -> Result<String, String> {
    // Implement data import logic here
    Ok("Data imported successfully".to_string())
}

#[tauri::command]
async fn check_backend_status() -> Result<bool, String> {
    // 检查后端服务是否运行
    match reqwest::get("http://localhost:7072").await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    // 获取主窗口
    if let Some(main_window) = app.get_window("main") {
        // 显示窗口
        main_window.show().map_err(|e| e.to_string())?;
        // 聚焦窗口
        main_window.set_focus().map_err(|e| e.to_string())?;
        println!("主窗口已唤起");
    } else {
        return Err("主窗口不存在".to_string());
    }
    Ok(())
}

#[tauri::command]
async fn create_desktop_pet_window(app: tauri::AppHandle) -> Result<(), String> {
    // 检查窗口是否已存在
    if app.get_window("desktop-pet").is_some() {
        println!("Desktop pet window already exists");
        return Ok(());
    }

    // 创建透明的桌宠窗口
    let window = WindowBuilder::new(
        &app,
        "desktop-pet",
        WindowUrl::App("desktop-pet-window".into())
    )
    .title("")  // 空标题
    .inner_size(250.0, 280.0)
    .fullscreen(false)
    .transparent(true)  // 关键：启用操作系统级别的透明窗口
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)  // 无边框，配合透明效果
    .resizable(false)
    .visible(true)
    .focused(false)
    .min_inner_size(250.0, 280.0)
    .max_inner_size(250.0, 280.0)
    .build()
    .map_err(|e| e.to_string())?;

    // 定位到右下角
    if let Ok(monitor) = window.primary_monitor() {
        if let Some(monitor) = monitor {
            let screen_size = monitor.size();
            let x = screen_size.width as i32 - 250 - 20; // 窗口宽度250px + 边距20px
            let y = screen_size.height as i32 - 280 - 20; // 窗口高度280px + 边距20px
            
            window.set_position(tauri::LogicalPosition::new(x, y)).map_err(|e| e.to_string())?;
            println!("Desktop pet window created and positioned at bottom right: ({}, {})", x, y);
        }
    }

    Ok(())
}



fn start_backend_server() {
    // 检查 Go 是否安装
    let go_available = Command::new("go")
        .arg("version")
        .output()
        .is_ok();

    if !go_available {
        println!("Warning: Go is not installed or not in PATH. Backend server will not start.");
        return;
    }

    // 检查 server 目录是否存在
    let server_path = Path::new("../server");
    if !server_path.exists() {
        println!("Warning: Server directory not found. Backend server will not start.");
        return;
    }

    // 启动 Go 后端服务
    let mut child = match Command::new("go")
        .arg("run")
        .arg("cmd/server/main.go")
        .arg("-mode=test")
        .arg("-addr=:7072")
        .current_dir("../server")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => {
            println!("Go backend server started on port 7072");
            child
        }
        Err(e) => {
            println!("Failed to start Go backend server: {}", e);
            return;
        }
    };

    // 在后台运行，不等待进程结束
    std::thread::spawn(move || {
        let _ = child.wait();
    });
}

fn main() {
        let app_state = AppState {
            theme: "dark".to_string(),
            window_title: "声驭智核".to_string(),
        };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            set_theme,
            get_theme,
            export_data,
            import_data,
            check_backend_status,
            create_desktop_pet_window,
            show_main_window
        ])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            
            // Set window properties
            window.set_title("声驭智核").unwrap();
            
            // 启动 Go 后端服务
            start_backend_server();
            
            // 创建透明的桌宠窗口
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = create_desktop_pet_window(app_handle).await {
                    println!("Failed to create desktop pet window: {}", e);
                }
            });
            
            println!("声驭智核 application started!");
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
