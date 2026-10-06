// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

mod diagnostics;

#[cfg(target_os = "windows")]
mod desktop_canvas_windows;

#[cfg(target_os = "windows")]
mod desktop_system_windows;

#[cfg(target_os = "windows")]
mod global_search_windows;

#[cfg(target_os = "windows")]
mod installed_apps_windows;

#[cfg(target_os = "windows")]
mod auth_vault_windows;

#[cfg(target_os = "windows")]
mod ai_provider_vault_windows;

#[cfg(target_os = "windows")]
mod assistant_file_context_windows;

#[cfg(target_os = "windows")]
mod system_monitor_windows;

#[derive(Clone, Copy)]
enum HorizontalPlacement {
    Left,
    Right,
}

#[derive(Clone, Copy)]
enum VerticalPlacement {
    Top,
    Bottom,
}

#[derive(Clone, Copy)]
struct PetPlacement {
    horizontal: HorizontalPlacement,
    vertical: VerticalPlacement,
}

impl PetPlacement {
    fn label(self) -> &'static str {
        match (self.vertical, self.horizontal) {
            (VerticalPlacement::Top, HorizontalPlacement::Left) => "top-left",
            (VerticalPlacement::Top, HorizontalPlacement::Right) => "top-right",
            (VerticalPlacement::Bottom, HorizontalPlacement::Left) => "bottom-left",
            (VerticalPlacement::Bottom, HorizontalPlacement::Right) => "bottom-right",
        }
    }
}

struct PetLayoutState {
    placement: PetPlacement,
    anchor: Option<PhysicalPosition<i32>>,
}

static PET_LAYOUT: Mutex<PetLayoutState> = Mutex::new(PetLayoutState {
    placement: PetPlacement {
        horizontal: HorizontalPlacement::Right,
        vertical: VerticalPlacement::Bottom,
    },
    anchor: None,
});
static CANVAS_WINDOW_GENERATION: AtomicUsize = AtomicUsize::new(0);

fn detect_pet_placement(
    pet: &tauri::WebviewWindow,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> PetPlacement {
    let Ok(Some(monitor)) = pet.current_monitor() else {
        return PetPlacement {
            horizontal: HorizontalPlacement::Right,
            vertical: VerticalPlacement::Bottom,
        };
    };
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let center_x = position.x + size.width as i32 / 2;
    let center_y = position.y + size.height as i32 / 2;
    let monitor_center_x = monitor_position.x + monitor_size.width as i32 / 2;
    let monitor_center_y = monitor_position.y + monitor_size.height as i32 / 2;

    PetPlacement {
        horizontal: if center_x < monitor_center_x {
            HorizontalPlacement::Left
        } else {
            HorizontalPlacement::Right
        },
        vertical: if center_y < monitor_center_y {
            VerticalPlacement::Top
        } else {
            VerticalPlacement::Bottom
        },
    }
}

fn apply_pet_size(
    pet: &tauri::WebviewWindow,
    expanded: bool,
    results: bool,
) -> Result<PetPlacement, String> {
    let old_size = pet.outer_size().map_err(|error| error.to_string())?;
    let old_position = pet.outer_position().map_err(|error| error.to_string())?;
    let was_expanded = old_size.width > 220 || old_size.height > 220;
    let (width, height) = match (expanded, results) {
        (false, _) => (160, 120),
        (true, false) => (560, 180),
        (true, true) => (560, 520),
    };

    let (placement, anchor) = {
        let mut layout = PET_LAYOUT.lock().map_err(|error| error.to_string())?;
        if !was_expanded {
            layout.placement = detect_pet_placement(pet, old_position, old_size);
            layout.anchor = Some(old_position);
        }
        (layout.placement, layout.anchor.unwrap_or(old_position))
    };

    let x = match placement.horizontal {
        HorizontalPlacement::Left => anchor.x,
        HorizontalPlacement::Right => anchor.x + 160 - width as i32,
    };
    let y = match placement.vertical {
        VerticalPlacement::Top => anchor.y,
        VerticalPlacement::Bottom => anchor.y + 120 - height as i32,
    };

    pet.set_size(PhysicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    pet.set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())?;
    let _ = pet.eval(&format!(
        "window.dispatchEvent(new CustomEvent('flexikit-pet-placement', {{ detail: '{}' }}))",
        placement.label()
    ));
    Ok(placement)
}

#[cfg(target_os = "windows")]
mod native_pet_pointer {
    use super::{apply_pet_size, HorizontalPlacement, VerticalPlacement, PET_LAYOUT};
    use std::{
        thread,
        time::{Duration, Instant},
    };
    use tauri::{AppHandle, Manager};

    #[derive(Clone, Copy)]
    #[repr(C)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetCursorPos(point: *mut Point) -> i32;
        fn GetAsyncKeyState(key: i32) -> i16;
    }

    const VK_LBUTTON: i32 = 0x01;
    const VK_RBUTTON: i32 = 0x02;

    fn key_down(key: i32) -> bool {
        unsafe { (GetAsyncKeyState(key) as u16 & 0x8000) != 0 }
    }

    pub fn spawn(app: AppHandle) {
        thread::spawn(move || {
            let mut outside_since: Option<Instant> = None;
            let mut left_was_down = false;
            let mut right_was_down = false;
            let mut was_inside = false;
            let mut last_click_at: Option<Instant> = None;
            let mut drag_origin: Option<(
                Point,
                tauri::PhysicalPosition<i32>,
                Option<tauri::PhysicalPosition<i32>>,
            )> = None;
            let mut dragging = false;

            loop {
                let Some(pet) = app.get_webview_window("pet") else {
                    break;
                };
                let Ok(position) = pet.outer_position() else {
                    thread::sleep(Duration::from_millis(80));
                    continue;
                };
                let Ok(size) = pet.outer_size() else {
                    thread::sleep(Duration::from_millis(80));
                    continue;
                };
                let expanded = size.width > 220;

                let mut cursor = Point { x: 0, y: 0 };
                let cursor_ok = unsafe { GetCursorPos(&mut cursor) } != 0;
                let inside = cursor_ok
                    && cursor.x >= position.x
                    && cursor.x < position.x + size.width as i32
                    && cursor.y >= position.y
                    && cursor.y < position.y + size.height as i32;
                let left_down = key_down(VK_LBUTTON);
                let right_down = key_down(VK_RBUTTON);

                if left_down && !left_was_down && inside {
                    let placement = PET_LAYOUT.lock().ok().map(|layout| layout.placement);
                    let pet_hit = !expanded
                        || placement
                            .map(
                                |placement| match (placement.vertical, placement.horizontal) {
                                    (VerticalPlacement::Top, HorizontalPlacement::Left) => {
                                        cursor.x < position.x + 90 && cursor.y < position.y + 90
                                    }
                                    (VerticalPlacement::Top, HorizontalPlacement::Right) => {
                                        cursor.x >= position.x + size.width as i32 - 90
                                            && cursor.y < position.y + 90
                                    }
                                    (VerticalPlacement::Bottom, HorizontalPlacement::Left) => {
                                        cursor.x < position.x + 90
                                            && cursor.y >= position.y + size.height as i32 - 90
                                    }
                                    (VerticalPlacement::Bottom, HorizontalPlacement::Right) => {
                                        cursor.x >= position.x + size.width as i32 - 90
                                            && cursor.y >= position.y + size.height as i32 - 90
                                    }
                                },
                            )
                            .unwrap_or(cursor.x < position.x + 90);
                    if pet_hit {
                        let anchor = PET_LAYOUT.lock().ok().and_then(|layout| layout.anchor);
                        drag_origin = Some((cursor, position, anchor));
                    }
                }

                if left_down {
                    if let Some((start_cursor, start_position, start_anchor)) = drag_origin {
                        let delta_x = cursor.x - start_cursor.x;
                        let delta_y = cursor.y - start_cursor.y;
                        if !dragging && delta_x * delta_x + delta_y * delta_y >= 36 {
                            dragging = true;
                            last_click_at = None;
                            let _ = pet.eval(
                                "window.dispatchEvent(new CustomEvent('flexikit-pet-drag-start'))",
                            );
                        }
                        if dragging {
                            let _ = pet.set_position(tauri::PhysicalPosition::new(
                                start_position.x + delta_x,
                                start_position.y + delta_y,
                            ));
                            if let Some(anchor) = start_anchor {
                                if let Ok(mut layout) = PET_LAYOUT.lock() {
                                    layout.anchor = Some(tauri::PhysicalPosition::new(
                                        anchor.x + delta_x,
                                        anchor.y + delta_y,
                                    ));
                                }
                            }
                        }
                    }
                }

                if !left_down && left_was_down {
                    if drag_origin.take().is_some() {
                        if dragging {
                            let _ = pet.eval(
                                "window.dispatchEvent(new CustomEvent('flexikit-pet-drag-end'))",
                            );
                        } else if inside {
                            let now = Instant::now();
                            let is_double_click = last_click_at
                                .map(|last| now.duration_since(last) <= Duration::from_millis(360))
                                .unwrap_or(false);
                            let event_name = if is_double_click {
                                last_click_at = None;
                                "flexikit-pet-native-double-click"
                            } else {
                                last_click_at = Some(now);
                                "flexikit-pet-native-click"
                            };
                            let _ = pet.eval(&format!(
                                "window.dispatchEvent(new CustomEvent('{event_name}'))"
                            ));
                        }
                    }
                    dragging = false;
                }

                if inside {
                    outside_since = None;
                    if !was_inside {
                        let _ = pet.eval(
                            "window.dispatchEvent(new CustomEvent('flexikit-pet-hover-enter'))",
                        );
                    }

                    if right_down && !right_was_down {
                        if !expanded {
                            let _ = apply_pet_size(&pet, true, true);
                        }
                        let _ = pet.set_focus();
                        let _ = pet.eval(
                            "window.dispatchEvent(new CustomEvent('flexikit-pet-native-menu'))",
                        );
                    }
                } else {
                    if left_down && !left_was_down && expanded && !dragging {
                        if apply_pet_size(&pet, false, false).is_ok() {
                            outside_since = None;
                            let _ = pet.eval("window.dispatchEvent(new CustomEvent('flexikit-pet-native-collapse'))");
                        }
                    }
                    if was_inside {
                        let _ = pet.eval(
                            "window.dispatchEvent(new CustomEvent('flexikit-pet-hover-leave'))",
                        );
                    }
                    let focused = pet.is_focused().unwrap_or(false);
                    if expanded && !focused && !dragging {
                        let left_at = outside_since.get_or_insert_with(Instant::now);
                        if left_at.elapsed() >= Duration::from_millis(900) {
                            if apply_pet_size(&pet, false, false).is_ok() {
                                outside_since = None;
                                let _ = pet.eval("window.dispatchEvent(new CustomEvent('flexikit-pet-native-collapse'))");
                            }
                        }
                    }
                }

                left_was_down = left_down;
                right_was_down = right_down;
                was_inside = inside;
                thread::sleep(Duration::from_millis(60));
            }
        });
    }
}

fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "main window is unavailable".to_string())
}

fn canvas_label_for_generation(generation: usize) -> String {
    if generation == 0 {
        "canvas".to_string()
    } else {
        format!("canvas-recovery-{generation}")
    }
}

fn current_canvas_label() -> String {
    canvas_label_for_generation(CANVAS_WINDOW_GENERATION.load(Ordering::Acquire))
}

fn canvas_window(app: &AppHandle) -> Result<tauri::WebviewWindow, String> {
    let label = current_canvas_label();
    app.get_webview_window(&label)
        .ok_or_else(|| format!("desktop canvas window `{label}` is unavailable"))
}

fn install_canvas_window_events(canvas: &tauri::WebviewWindow) {
    let canvas_for_event = canvas.clone();
    canvas.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            #[cfg(target_os = "windows")]
            {
                desktop_canvas_windows::set_expected_visible(false);
                let _ = desktop_system_windows::set_desktop_icons_visible(true);
            }
            let _ = canvas_for_event.hide();
        }
        WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
            let _ = canvas_for_event
                .eval("window.dispatchEvent(new CustomEvent('flexikit:canvas-topology-changed'));");
        }
        _ => {}
    });
}

#[cfg(target_os = "windows")]
pub(crate) fn rebuild_canvas_after_explorer_restart(
    app: &AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    desktop_canvas_windows::ensure_desktop_parent_ready()?;
    let current_generation = CANVAS_WINDOW_GENERATION.load(Ordering::Acquire);
    let current_label = canvas_label_for_generation(current_generation);
    if let Some(existing) = app.get_webview_window(&current_label) {
        let _ = existing.destroy();
    }

    let next_generation = current_generation.saturating_add(1);
    let next_label = canvas_label_for_generation(next_generation);
    let canvas = WebviewWindowBuilder::new(
        app,
        next_label.clone(),
        WebviewUrl::App("index.html#/canvas".into()),
    )
    .title("FlexiKit Desktop Canvas")
    .inner_size(1080.0, 720.0)
    .min_inner_size(520.0, 360.0)
    .decorations(false)
    .transparent(true)
    .shadow(false)
    .skip_taskbar(true)
    .resizable(true)
    .visible(false)
    .center()
    .build()
    .map_err(|error| error.to_string())?;

    install_canvas_window_events(&canvas);
    if let Err(error) = desktop_canvas_windows::attach(&canvas) {
        let _ = canvas.destroy();
        return Err(error);
    }

    if desktop_canvas_windows::expected_visible() {
        let _ = desktop_system_windows::set_desktop_icons_visible(false);
        canvas.show().map_err(|error| error.to_string())?;
    } else {
        let _ = desktop_system_windows::set_desktop_icons_visible(true);
        canvas.hide().map_err(|error| error.to_string())?;
    }

    CANVAS_WINDOW_GENERATION.store(next_generation, Ordering::Release);

    Ok(canvas)
}
#[cfg(target_os = "windows")]
fn open_path_with_system(path: &Path) -> Result<(), String> {
    use std::ffi::{c_void, OsStr};
    use std::os::windows::ffi::OsStrExt;
    use std::ptr;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: *mut c_void,
            operation: *const u16,
            file: *const u16,
            parameters: *const u16,
            directory: *const u16,
            show_command: i32,
        ) -> isize;
    }

    let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
    let file: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            ptr::null(),
            ptr::null(),
            1,
        )
    };

    if result <= 32 {
        Err(format!("system open failed with code {result}"))
    } else {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn open_path_with_system(path: &Path) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_path_with_system(path: &Path) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_local_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("local path is empty".to_string());
    }

    let canonical = std::path::PathBuf::from(trimmed)
        .canonicalize()
        .map_err(|_| "local file does not exist".to_string())?;
    if !canonical.is_file() {
        return Err("local path must point to a file".to_string());
    }

    let extension = canonical
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "local file type is unsupported".to_string())?;

    if !matches!(extension.as_str(), "exe" | "lnk" | "url" | "msi") {
        return Err("local file type is unsupported".to_string());
    }

    open_path_with_system(&canonical)
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err("external url is empty".to_string());
    }

    let lower = trimmed.to_ascii_lowercase();
    if !lower.starts_with("https://") && !lower.starts_with("http://") {
        return Err("external url protocol is unsupported".to_string());
    }
    if trimmed.chars().any(|character| character.is_control()) {
        return Err("external url contains invalid characters".to_string());
    }

    open_path_with_system(Path::new(trimmed))
}

#[cfg(target_os = "windows")]
fn system_disk_info() -> Result<(String, u64, u64), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            directory_name: *const u16,
            free_bytes_available: *mut u64,
            total_number_of_bytes: *mut u64,
            total_number_of_free_bytes: *mut u64,
        ) -> i32;
    }

    let drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let root = format!("{drive}\\");
    let root_wide: Vec<u16> = OsStr::new(&root).encode_wide().chain(Some(0)).collect();
    let mut free_available = 0_u64;
    let mut total = 0_u64;
    let mut total_free = 0_u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            root_wide.as_ptr(),
            &mut free_available,
            &mut total,
            &mut total_free,
        )
    };
    if ok == 0 {
        return Err("failed to read system disk information".to_string());
    }

    Ok((drive, total, free_available))
}

#[cfg(not(target_os = "windows"))]
fn system_disk_info() -> Result<(String, u64, u64), String> {
    Err("system disk information is not implemented on this platform".to_string())
}

#[tauri::command]
fn get_system_disk_info() -> Result<(String, u64, u64), String> {
    system_disk_info()
}

#[tauri::command]
fn get_system_monitor_snapshot() -> Result<(u64, u64, u64, u64, u64, String, u64, u64), String> {
    #[cfg(target_os = "windows")]
    {
        let (idle_ms, total_ms, total_memory, available_memory, uptime_ms) =
            system_monitor_windows::snapshot()?;
        let (drive, total_disk, free_disk) = system_disk_info()?;
        return Ok((
            idle_ms,
            total_ms,
            total_memory,
            available_memory,
            uptime_ms,
            drive,
            total_disk,
            free_disk,
        ));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("system monitor is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn search_system_items(
    query: String,
    limit: Option<usize>,
) -> Result<Vec<(String, String, String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        return global_search_windows::search(&query, limit.unwrap_or(20));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (query, limit);
        Ok(Vec::new())
    }
}

#[tauri::command]
fn open_search_result(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let canonical = global_search_windows::resolve_allowed_item(&path)?;
        return open_path_with_system(&canonical);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("system search is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_installed_apps(
    force_refresh: Option<bool>,
) -> Result<
    Vec<(
        String,
        String,
        String,
        String,
        String,
        String,
        String,
        String,
    )>,
    String,
> {
    #[cfg(target_os = "windows")]
    {
        return installed_apps_windows::discover(force_refresh.unwrap_or(false));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = force_refresh;
        Ok(Vec::new())
    }
}

#[tauri::command]
fn get_installed_app_icon(name: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        return installed_apps_windows::icon_for(&name);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = name;
        Ok(None)
    }
}

#[tauri::command]
fn launch_installed_app(name: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return installed_apps_windows::launch(&name);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = name;
        Err("installed app launching is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_clipboard_text() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::read_clipboard_text();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("clipboard bridge is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn set_clipboard_text(text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::write_clipboard_text(&text);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = text;
        Err("clipboard bridge is not implemented on this platform".to_string())
    }
}

type DesktopItemSnapshot = (String, String, String, bool, u64);

#[tauri::command]
fn get_desktop_items() -> Result<Vec<DesktopItemSnapshot>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::desktop_items();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("desktop item collection is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn search_desktop_items(query: String) -> Result<Vec<DesktopItemSnapshot>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::search_desktop_items(&query);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = query;
        Err("desktop search is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_desktop_item_icon(path: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let canonical = desktop_system_windows::resolve_desktop_item(&path)?;
        return Ok(installed_apps_windows::shell_icon_data_url_for_path(
            &canonical,
        ));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Ok(None)
    }
}

#[tauri::command]
fn open_desktop_item(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let canonical = desktop_system_windows::resolve_desktop_item(&path)?;
        return open_path_with_system(&canonical);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("desktop item opening is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_desktop_folder_preview(
    path: String,
) -> Result<Vec<(String, String, String, bool, u64)>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::folder_preview(&path);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("folder preview is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_system_media_snapshot(
) -> Result<Option<(String, String, String, String, bool, i64, i64)>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::current_media_session();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("system media metadata is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn get_system_media_thumbnail() -> Result<Option<(String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::current_media_thumbnail();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("system media thumbnail is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn control_system_media(action: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        return desktop_system_windows::media_control(&action);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = action;
        Err("system media controls are not implemented on this platform".to_string())
    }
}

type CanvasMonitorSnapshot = (String, String, f64, f64, f64, f64, f64, bool);

#[tauri::command]
fn get_canvas_monitor_layout(app: AppHandle) -> Result<Vec<CanvasMonitorSnapshot>, String> {
    let window = canvas_window(&app)?;
    let canvas_scale = window.scale_factor().map_err(|error| error.to_string())?;
    let mut monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let primary = window
        .primary_monitor()
        .map_err(|error| error.to_string())?;

    monitors.sort_by_key(|monitor| {
        let position = monitor.position();
        (position.x, position.y)
    });

    if monitors.is_empty() {
        return Ok(Vec::new());
    }

    let virtual_left = monitors
        .iter()
        .map(|monitor| monitor.position().x)
        .min()
        .unwrap_or(0);
    let virtual_top = monitors
        .iter()
        .map(|monitor| monitor.position().y)
        .min()
        .unwrap_or(0);
    let names: Vec<String> = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            monitor
                .name()
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("Display {}", index + 1))
        })
        .collect();

    Ok(monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let position = monitor.position();
            let size = monitor.size();
            let name = names[index].clone();
            let duplicate_count = names.iter().filter(|candidate| **candidate == name).count();
            let occurrence = names[..index]
                .iter()
                .filter(|candidate| **candidate == name)
                .count()
                + 1;
            let id = if duplicate_count > 1 {
                format!("{name}#{occurrence}")
            } else {
                name.clone()
            };
            let is_primary = primary.as_ref().is_some_and(|candidate| {
                candidate.position() == position && candidate.size() == size
            });

            (
                id,
                name,
                f64::from(position.x - virtual_left) / canvas_scale,
                f64::from(position.y - virtual_top) / canvas_scale,
                f64::from(size.width) / canvas_scale,
                f64::from(size.height) / canvas_scale,
                monitor.scale_factor(),
                is_primary,
            )
        })
        .collect())
}

#[tauri::command]
fn attach_desktop_canvas(app: AppHandle) -> Result<bool, String> {
    let window = canvas_window(&app)?;

    #[cfg(target_os = "windows")]
    {
        desktop_canvas_windows::attach(&window)?;
        return Ok(true);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = window;
        Ok(false)
    }
}

#[tauri::command]
fn set_canvas_interactive_regions(
    app: AppHandle,
    regions: Vec<[f64; 5]>,
    edit_mode: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let window = canvas_window(&app)?;
        return desktop_canvas_windows::update_interactive_regions(&window, regions, edit_mode);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, regions, edit_mode);
        Ok(())
    }
}

#[tauri::command]
fn show_desktop_canvas(app: AppHandle) -> Result<(), String> {
    let window = canvas_window(&app)?;

    #[cfg(target_os = "windows")]
    {
        desktop_canvas_windows::attach(&window)?;
        desktop_canvas_windows::set_expected_visible(true);
        let _ = desktop_system_windows::set_desktop_icons_visible(false);
    }

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn show_canvas_widget_picker(app: AppHandle) -> Result<(), String> {
    let window = canvas_window(&app)?;

    #[cfg(target_os = "windows")]
    {
        desktop_canvas_windows::attach(&window)?;
        desktop_canvas_windows::set_expected_visible(true);
        let _ = desktop_system_windows::set_desktop_icons_visible(false);
    }

    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    window
        .eval(
            "window.dispatchEvent(new CustomEvent('flexikit:open-widget-palette'));setTimeout(()=>window.dispatchEvent(new CustomEvent('flexikit:open-widget-palette')),120);",
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn hide_desktop_canvas(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        desktop_canvas_windows::set_expected_visible(false);
        let _ = desktop_system_windows::set_desktop_icons_visible(true);
    }
    canvas_window(&app)?
        .hide()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn show_main_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window.show().map_err(|error| error.to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn minimize_main_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)?
        .minimize()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_maximize_main_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn hide_main_window(app: AppHandle) -> Result<(), String> {
    main_window(&app)?.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn resize_pet_window(
    app: AppHandle,
    expanded: bool,
    results: Option<bool>,
) -> Result<String, String> {
    let pet = app
        .get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_string())?;
    apply_pet_size(&pet, expanded, results.unwrap_or(false))
        .map(|placement| placement.label().to_string())
}

#[tauri::command]
fn mark_pet_ready(app: AppHandle) -> Result<(), String> {
    app.get_webview_window("pet")
        .ok_or_else(|| "pet window is unavailable".to_string())?
        .set_title("FlexiKit Pet Ready")
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn store_secure_auth_token(
    app: AppHandle,
    slot: String,
    token: String,
    expires_at: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return auth_vault_windows::store(&base_dir, &slot, &token, &expires_at);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, slot, token, expires_at);
        Err("secure desktop token storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn load_secure_auth_token(
    app: AppHandle,
    slot: String,
) -> Result<Option<(String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return auth_vault_windows::load(&base_dir, &slot);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, slot);
        Err("secure desktop token storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn clear_secure_auth_token(app: AppHandle, slot: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return auth_vault_windows::clear(&base_dir, &slot);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, slot);
        Err("secure desktop token storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn store_ai_provider_credential(
    app: AppHandle,
    provider: String,
    credential: String,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return ai_provider_vault_windows::store(&base_dir, &provider, &credential);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, provider, credential);
        Err("secure AI Provider storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn load_ai_provider_credential(app: AppHandle, provider: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return ai_provider_vault_windows::load(&base_dir, &provider);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, provider);
        Err("secure AI Provider storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn clear_ai_provider_credential(app: AppHandle, provider: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let base_dir = app
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?;
        return ai_provider_vault_windows::clear(&base_dir, &provider);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, provider);
        Err("secure AI Provider storage is not supported on this platform".to_string())
    }
}

#[tauri::command]
fn pick_assistant_text_file() -> Result<Option<(String, String, String)>, String> {
    #[cfg(target_os = "windows")]
    {
        return assistant_file_context_windows::pick_text_file();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("assistant file context is not implemented on this platform".to_string())
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    diagnostics::log_event("quit_requested", "user requested application exit");
    #[cfg(target_os = "windows")]
    {
        let _ = desktop_system_windows::set_desktop_icons_visible(true);
    }
    app.exit(0);
}

fn main() {
    diagnostics::init();

    let result = tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            minimize_main_window,
            toggle_maximize_main_window,
            hide_main_window,
            resize_pet_window,
            mark_pet_ready,
            open_local_path,
            open_external_url,
            get_system_disk_info,
            get_system_monitor_snapshot,
            search_system_items,
            open_search_result,
            get_installed_apps,
            get_installed_app_icon,
            launch_installed_app,
            get_clipboard_text,
            set_clipboard_text,
            get_desktop_items,
            search_desktop_items,
            get_desktop_item_icon,
            open_desktop_item,
            get_desktop_folder_preview,
            get_system_media_snapshot,
            get_system_media_thumbnail,
            control_system_media,
            get_canvas_monitor_layout,
            attach_desktop_canvas,
            set_canvas_interactive_regions,
            show_desktop_canvas,
            show_canvas_widget_picker,
            hide_desktop_canvas,
            store_secure_auth_token,
            load_secure_auth_token,
            clear_secure_auth_token,
            store_ai_provider_credential,
            load_ai_provider_credential,
            clear_ai_provider_credential,
            pick_assistant_text_file,
            quit_app
        ])
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                // Recover Explorer icons first in case a previous abnormal termination
                // happened while Desktop Canvas had them hidden.
                let _ = desktop_system_windows::set_desktop_icons_visible(true);
            }
            if let Some(main) = app.get_webview_window("main") {
                let main_for_close = main.clone();
                main.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_for_close.hide();
                    }
                });
            }

            if let Some(canvas) = app.get_webview_window("canvas") {
                install_canvas_window_events(&canvas);
            }

            #[cfg(target_os = "windows")]
            if let Some(canvas) = app.get_webview_window("canvas") {
                if let Err(error) = desktop_canvas_windows::attach(&canvas) {
                    eprintln!("Desktop Canvas WorkerW attach skipped: {error}");
                }
                desktop_canvas_windows::start_recovery_monitor(app.handle().clone(), canvas);
            }

            if let Some(pet) = app.get_webview_window("pet") {
                let _ = pet.set_size(PhysicalSize::new(160, 120));
                if let Ok(Some(monitor)) = pet.primary_monitor() {
                    let monitor_size = monitor.size();
                    let monitor_position = monitor.position();
                    let x = monitor_position.x + monitor_size.width as i32 - 200;
                    let y = monitor_position.y + monitor_size.height as i32 - 200;
                    let _ = pet.set_position(PhysicalPosition::new(x, y));
                }
            }

            #[cfg(target_os = "windows")]
            native_pet_pointer::spawn(app.handle().clone());

            #[cfg(target_os = "windows")]
            global_search_windows::spawn_shortcut(app.handle().clone());

            #[cfg(target_os = "windows")]
            global_search_windows::spawn_index_warmup();

            #[cfg(target_os = "windows")]
            installed_apps_windows::spawn_warmup();

            diagnostics::log_event("setup_complete", "Tauri setup completed");
            Ok(())
        })
        .run(tauri::generate_context!());

    match result {
        Ok(()) => diagnostics::log_event("shutdown", "Tauri event loop exited normally"),
        Err(error) => {
            diagnostics::log_event("runtime_error", &error.to_string());
            panic!("error while running FlexiKit desktop: {error}");
        }
    }
}
