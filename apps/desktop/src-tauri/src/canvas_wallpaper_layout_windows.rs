//! Opt-in Windows DesktopWallpaper metadata. No screen capture; no window pixels.
use std::path::PathBuf;
use windows::{
    core::PCWSTR,
    Win32::{
        System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED},
        UI::Shell::{DesktopWallpaper, IDesktopWallpaper, DWPOS_FILL, DWPOS_FIT, DWPOS_STRETCH, DWPOS_CENTER, DWPOS_TILE, DWPOS_SPAN},
    },
};

/// (wallpaper positioning, [(virtual desktop physical RECT, data URL)])
pub type WallpaperSnapshot = (String, String, Vec<(i32, i32, i32, i32, String)>);
const MAX_MONITORS: u32 = 6;
const MAX_TOTAL_ENCODED: usize = 32 * 1024 * 1024;

struct ComLifetime;
impl Drop for ComLifetime {
    fn drop(&mut self) { unsafe { CoUninitialize(); } }
}

fn from_shell_string(raw: windows::core::PWSTR) -> Option<String> {
    if raw.is_null() { return None; }
    let text = unsafe { raw.to_string().ok() };
    unsafe { CoTaskMemFree(Some(raw.0 as *const std::ffi::c_void)); }
    text.filter(|text| !text.is_empty())
}

fn get_wallpaper_for_monitor(desktop: &IDesktopWallpaper, monitor_id: &str) -> Option<String> {
    let utf16: Vec<u16> = monitor_id.encode_utf16().chain(Some(0)).collect();
    let wide = PCWSTR::from_raw(utf16.as_ptr());
    let path = from_shell_string(unsafe { desktop.GetWallpaper(wide).ok()? })?;
    let data = super::canvas_wallpaper_windows::wallpaper_path_data_url(&PathBuf::from(path)).ok()??;
    Some(data)
}

/// Computes no bitmap in Rust. The caller rasterizes wallpaper on a shared
/// offscreen WebGL-bound atlas, using these exact physical monitor RECTs.
pub fn desktop_wallpapers(active: &[(i32, i32, i32, i32)]) -> Result<Option<WallpaperSnapshot>, String> {
    if active.is_empty() || active.len() > MAX_MONITORS as usize { return Ok(None); }
    let initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    if initialized.is_err() { return Ok(None); }
    let _apartment = ComLifetime;
    let desktop: IDesktopWallpaper = match unsafe { CoCreateInstance(&DesktopWallpaper, None, CLSCTX_ALL) } {
        Ok(desktop) => desktop,
        Err(_) => return Ok(None),
    };
    let count = match unsafe { desktop.GetMonitorDevicePathCount() } {
        Ok(count) if (1..=MAX_MONITORS).contains(&count) => count,
        _ => return Ok(None),
    };
    let position = match unsafe { desktop.GetPosition() } {
        Ok(position) if position == DWPOS_FILL => "fill",
        Ok(position) if position == DWPOS_FIT => "fit",
        Ok(position) if position == DWPOS_STRETCH => "stretch",
        Ok(position) if position == DWPOS_CENTER => "center",
        Ok(position) if position == DWPOS_TILE => "tile",
        Ok(position) if position == DWPOS_SPAN => "span",
        _ => return Ok(None),
    };
    let background = unsafe { desktop.GetBackgroundColor() }
        .ok().map(|color| color.0).unwrap_or(0x202020);
    let background_hex = format!("#{:02x}{:02x}{:02x}",
        background & 0xff, (background >> 8) & 0xff, (background >> 16) & 0xff);
    let mut monitors = Vec::with_capacity(count as usize);
    let mut encoded_total = 0usize;
    for index in 0..count {
        // Windows remembers disconnected monitors. An inactive wallpaper ID
        // must never block current displays, nor be sampled unnecessarily.
        let Some(id) = unsafe { desktop.GetMonitorDevicePathAt(index).ok() }.and_then(from_shell_string) else {
            continue;
        };
        let id_utf16: Vec<u16> = id.encode_utf16().chain(Some(0)).collect();
        let rect = match unsafe { desktop.GetMonitorRECT(PCWSTR::from_raw(id_utf16.as_ptr())) } {
            Ok(rect) if rect.right > rect.left && rect.bottom > rect.top => rect,
            _ => continue,
        };
        let pixel_rect = (rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);
        if !active.contains(&pixel_rect) { continue; }
        let Some(data_url) = get_wallpaper_for_monitor(&desktop, &id) else {
            return Ok(None);
        };
        encoded_total += data_url.len();
        if encoded_total > MAX_TOTAL_ENCODED { return Ok(None); }
        monitors.push((pixel_rect.0, pixel_rect.1, pixel_rect.2, pixel_rect.3, data_url));
    }
    // Input for Tauri frontend is ONLY the image and monitor rectangle.
    // Device path IDs and actual filesystem paths never cross the IPC boundary.
    if monitors.len() != active.len()
        || active.iter().any(|rect| !monitors.iter().any(|image|
            image.0 == rect.0 && image.1 == rect.1 && image.2 == rect.2 && image.3 == rect.3)) {
        return Ok(None);
    }
    Ok(Some((position.to_string(), background_hex, monitors)))
}
