//! Read only the *configured static wallpaper file* for the optional local
//! refraction preview. Never capture the desktop, windows, icons or user files.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{ffi::OsString, os::windows::ffi::OsStringExt, path::{Path, PathBuf}};

const SPI_GETDESKWALLPAPER: u32 = 0x0073;
const MAX_WALLPAPER_BYTES: u64 = 8 * 1024 * 1024;
const MAX_PATH_UNITS: usize = 32768;

#[link(name = "user32")]
extern "system" {
    fn SystemParametersInfoW(
        action: u32,
        param: u32,
        output: *mut u16,
        flags: u32,
    ) -> i32;
}

fn current_static_wallpaper() -> Result<Option<PathBuf>, String> {
    let mut buffer = vec![0u16; MAX_PATH_UNITS];
    // SAFETY: Windows fills at most param wchar_t units of the mutable buffer.
    let ok = unsafe {
        SystemParametersInfoW(
            SPI_GETDESKWALLPAPER,
            buffer.len() as u32,
            buffer.as_mut_ptr(),
            0,
        )
    };
    if ok == 0 {
        return Ok(None);
    }
    let length = buffer.iter().position(|unit| *unit == 0).unwrap_or(buffer.len());
    if length == 0 || length == buffer.len() {
        return Ok(None);
    }
    Ok(Some(PathBuf::from(OsString::from_wide(&buffer[..length]))))
}

/// Decode whitelist. Never trust a user-controlled filename extension alone.
fn supported_image_mime(path: &Path, bytes: &[u8]) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "jpeg" | "jpg" if bytes.starts_with(&[0xff, 0xd8, 0xff]) => Some("image/jpeg"),
        "png" if bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10]) => Some("image/png"),
        "bmp" if bytes.starts_with(b"BM") => Some("image/bmp"),
        "webp" if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" => Some("image/webp"),
        _ => None,
    }
}

/// Returns only an in-memory data URL; never reveals the path or persists bytes.
/// Reject oversized, unknown or missing formats. Not a screen capture.
pub fn wallpaper_data_url() -> Result<Option<String>, String> {
    let Some(path) = current_static_wallpaper()? else {
        return Ok(None);
    };
    wallpaper_path_data_url(&path)
}

/// Read only the local wallpaper file supplied by the OS wallpaper interface.
pub fn wallpaper_path_data_url(path: &Path) -> Result<Option<String>, String> {
    // Reject network paths. Reading a cloud or UNC wallpaper could have
    // side effects; this optional offline-only sample must not fetch remotely.
    let literal = path.to_string_lossy();
    if !path.is_absolute() || literal.starts_with("\\\\")
        || literal.starts_with("//") || literal.starts_with("\\\\?\\UNC\\") {
        return Ok(None);
    }
    let metadata = match std::fs::metadata(&path) {
        Ok(meta) if meta.is_file() && meta.len() > 0 && meta.len() <= MAX_WALLPAPER_BYTES => meta,
        _ => return Ok(None),
    };
    // TOCTOU is handled: re-check actual bytes before returning.
    let bytes = match std::fs::read(&path) {
        Ok(bytes) if !bytes.is_empty() && (bytes.len() as u64) <= metadata.len()
            && (bytes.len() as u64) <= MAX_WALLPAPER_BYTES => bytes,
        _ => return Ok(None),
    };
    let Some(mime) = supported_image_mime(&path, &bytes) else {
        return Ok(None);
    };
    Ok(Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes))))
}
