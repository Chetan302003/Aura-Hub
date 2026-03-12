#[cfg_attr(mobile, tauri::mobile_entry_point)]
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::LazyLock; // Standard library alternative to once_cell
use std::sync::Mutex;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// This prevents the app from spamming the game while it's trying to close
static GAME_CLOSING: LazyLock<AtomicBool> = LazyLock::new(|| AtomicBool::new(false));

// Use a raw pointer or manual mapping approach if possible, but for now we 
// ensure that the struct `data` is mapped and subsequently unmapped on closure
#[tauri::command]
fn get_telemetry_data() -> Result<String, String> {
    if GAME_CLOSING.load(Ordering::Relaxed) {
        return Ok("{\"sdk_active\": false, \"closing\": true}".to_string());
    }

    // Rather than maintaining a lock that might hold the game indefinitely,
    // we connect, read quickly, and drop cleanly.
    // Given that 2 times a second was slowing it down *because* of open handles,
    // dropping them properly within the Mutex might be necessary.
    
    // Instead of holding it globally, let's go back to single-use BUT 
    // we drop the shared memory handle explicitly before the JSON conversion holds it open.
    let mut shared_mem = match scs_sdk_telemetry::shared_memory::SharedMemory::connect() {
        Ok(mem) => mem,
        Err(_) => return Ok("{\"sdk_active\": false}".to_string()),
    };

    let mut data = shared_mem.read();
    
    // Check if the game is shutting down
    if !data.sdk_active {
        GAME_CLOSING.store(true, Ordering::Relaxed);
        drop(data);
        drop(shared_mem); // Force close handle on Windows
        return Ok("{\"sdk_active\": false}".to_string());
    }

    // Crucial fix: Clone/convert the data out of the memory block, then immediately drop 
    // the Windows Handle *before* taking time to run the heavy JSON serialization logic!
    // This gives the game breathing room to close the memory map between our 500ms polls.
    let json_output = {
        let serialized = data.to_json().map_err(|e| e.to_string())?.to_string();
        serialized
    };

    // Close memory handle quickly
    drop(data);
    drop(shared_mem);

    Ok(json_output)
}

#[tauri::command]
fn reset_telemetry_lock() {
    GAME_CLOSING.store(false, Ordering::Relaxed);
}
#[tauri::command]
fn install_telemetry_plugin(app: AppHandle, custom_path: Option<String>) -> Result<String, String> {
    // Note: The dll must be bundled in `src-tauri/resources/scs-telemetry.dll`
    let resource_path = app.path().resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {}", e))?
        .join("scs-telemetry.dll");

    if !resource_path.exists() {
        return Err("Telemetry DLL not found in app resources. Contact developer.".to_string());
    }

    // Use custom path if provided, otherwise use default Steam path
    let game_root = match custom_path {
        Some(p) => PathBuf::from(p),
        None => PathBuf::from("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Euro Truck Simulator 2"),
    };

    // Check if game exists
    if !game_root.exists() {
        return Err("GAME_NOT_FOUND".to_string());
    }

    let ets2_target = game_root.join("bin").join("win_x64").join("plugins");
    
    if !ets2_target.exists() {
        std::fs::create_dir_all(&ets2_target).map_err(|e| format!("Failed to create plugins folder: {}", e))?;
    }

    let final_dest = ets2_target.join("scs-telemetry.dll");
    
    // Copy the file
    match std::fs::copy(&resource_path, &final_dest) {
        Ok(_) => Ok("Telemetry SDK successfully installed to ETS2!".to_string()),
        Err(e) => Err(format!("Failed to copy DLL: {}", e))
    }
}

pub fn run() {
    tauri::Builder::default()
        // Initialize all plugins here at the top level
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_telemetry_data, 
            reset_telemetry_lock,
            install_telemetry_plugin
        ])
    .setup(|_app|{
    Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
