#[cfg(target_os = "windows")]
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    ffi::{c_void, OsStr},
    fs,
    os::windows::{ffi::OsStrExt, fs::MetadataExt},
    path::{Path, PathBuf},
    ptr,
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

#[cfg(target_os = "windows")]
use crate::diagnostics;

#[cfg(target_os = "windows")]
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};

#[cfg(target_os = "windows")]
use windows::{
    core::{Interface, PCWSTR},
    ApplicationModel::Package,
    Management::Deployment::PackageManager,
    Win32::{
        System::Com::{
            CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
            COINIT_MULTITHREADED, STGM_READ,
        },
        UI::Shell::{IShellLinkW, ShellLink},
    },
};

#[cfg(target_os = "windows")]
pub type InstalledAppSnapshot = (
    String,
    String,
    String,
    String,
    String,
    String,
    String,
    String,
);

#[cfg(target_os = "windows")]
const FILE_ATTRIBUTE_HIDDEN: u32 = 0x0002;
#[cfg(target_os = "windows")]
const FILE_ATTRIBUTE_SYSTEM: u32 = 0x0004;
#[cfg(target_os = "windows")]
const KEY_READ: u32 = 0x20019;
#[cfg(target_os = "windows")]
const KEY_WOW64_64KEY: u32 = 0x0100;
#[cfg(target_os = "windows")]
const KEY_WOW64_32KEY: u32 = 0x0200;
#[cfg(target_os = "windows")]
const ERROR_SUCCESS: i32 = 0;
#[cfg(target_os = "windows")]
const ERROR_NO_MORE_ITEMS: i32 = 259;
#[cfg(target_os = "windows")]
const REG_SZ: u32 = 1;
#[cfg(target_os = "windows")]
const REG_EXPAND_SZ: u32 = 2;
#[cfg(target_os = "windows")]
const REG_DWORD: u32 = 4;
#[cfg(target_os = "windows")]
const HKEY_CURRENT_USER: isize = 0x80000001_u32 as i32 as isize;
#[cfg(target_os = "windows")]
const HKEY_LOCAL_MACHINE: isize = 0x80000002_u32 as i32 as isize;
#[cfg(target_os = "windows")]
const UNINSTALL_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
#[cfg(target_os = "windows")]
const CACHE_TTL: Duration = Duration::from_secs(300);

#[cfg(target_os = "windows")]
const ICON_SIZE: u32 = 64;
#[cfg(target_os = "windows")]
const SHGFI_ICON: u32 = 0x0000_0100;
#[cfg(target_os = "windows")]
const SHGFI_USEFILEATTRIBUTES: u32 = 0x0000_0010;
#[cfg(target_os = "windows")]
const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x0000_0010;
#[cfg(target_os = "windows")]
const FILE_ATTRIBUTE_NORMAL: u32 = 0x0000_0080;
#[cfg(target_os = "windows")]
const DI_NORMAL: u32 = 0x0003;
#[cfg(target_os = "windows")]
const DIB_RGB_COLORS: u32 = 0;
#[cfg(target_os = "windows")]
const BI_RGB: u32 = 0;

#[cfg(target_os = "windows")]
#[link(name = "advapi32")]
extern "system" {
    fn RegOpenKeyExW(
        key: isize,
        sub_key: *const u16,
        options: u32,
        desired: u32,
        result: *mut isize,
    ) -> i32;
    fn RegEnumKeyExW(
        key: isize,
        index: u32,
        name: *mut u16,
        name_len: *mut u32,
        reserved: *mut u32,
        class: *mut u16,
        class_len: *mut u32,
        last_write_time: *mut c_void,
    ) -> i32;
    fn RegQueryValueExW(
        key: isize,
        value_name: *const u16,
        reserved: *mut u32,
        value_type: *mut u32,
        data: *mut u8,
        data_len: *mut u32,
    ) -> i32;
    fn RegCloseKey(key: isize) -> i32;
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct ShFileInfoW {
    h_icon: isize,
    i_icon: i32,
    dw_attributes: u32,
    sz_display_name: [u16; 260],
    sz_type_name: [u16; 80],
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct BitmapInfoHeader {
    bi_size: u32,
    bi_width: i32,
    bi_height: i32,
    bi_planes: u16,
    bi_bit_count: u16,
    bi_compression: u32,
    bi_size_image: u32,
    bi_x_pels_per_meter: i32,
    bi_y_pels_per_meter: i32,
    bi_clr_used: u32,
    bi_clr_important: u32,
}

#[cfg(target_os = "windows")]
#[repr(C)]
#[derive(Clone, Copy)]
struct RgbQuad {
    rgb_blue: u8,
    rgb_green: u8,
    rgb_red: u8,
    rgb_reserved: u8,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct BitmapInfo {
    bmi_header: BitmapInfoHeader,
    bmi_colors: [RgbQuad; 1],
}

#[cfg(target_os = "windows")]
#[link(name = "shell32")]
extern "system" {
    fn SHGetFileInfoW(
        path: *const u16,
        file_attributes: u32,
        file_info: *mut ShFileInfoW,
        file_info_size: u32,
        flags: u32,
    ) -> usize;
    fn ExtractIconExW(
        file: *const u16,
        icon_index: i32,
        large_icon: *mut isize,
        small_icon: *mut isize,
        icon_count: u32,
    ) -> u32;
    fn ShellExecuteW(
        hwnd: *mut c_void,
        operation: *const u16,
        file: *const u16,
        parameters: *const u16,
        directory: *const u16,
        show_command: i32,
    ) -> isize;
}

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetDC(window: isize) -> isize;
    fn ReleaseDC(window: isize, dc: isize) -> i32;
    fn DrawIconEx(
        dc: isize,
        x: i32,
        y: i32,
        icon: isize,
        width: i32,
        height: i32,
        step: u32,
        flicker_free_brush: isize,
        flags: u32,
    ) -> i32;
    fn DestroyIcon(icon: isize) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "gdi32")]
extern "system" {
    fn CreateCompatibleDC(dc: isize) -> isize;
    fn DeleteDC(dc: isize) -> i32;
    fn CreateDIBSection(
        dc: isize,
        info: *const BitmapInfo,
        usage: u32,
        bits: *mut *mut c_void,
        section: isize,
        offset: u32,
    ) -> isize;
    fn SelectObject(dc: isize, object: isize) -> isize;
    fn DeleteObject(object: *mut c_void) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn ExpandEnvironmentStringsW(source: *const u16, destination: *mut u16, size: u32) -> u32;
}

#[cfg(target_os = "windows")]
#[derive(Clone, Default)]
struct InstalledApp {
    name: String,
    publisher: String,
    version: String,
    source: String,
    entry_path: String,
    icon_hint: String,
    launch_kind: String,
    launch_target: String,
    launch_args: String,
    launch_priority: u8,
}

#[cfg(target_os = "windows")]
struct InstalledAppsCache {
    built_at: Instant,
    apps: Vec<InstalledApp>,
}

#[cfg(target_os = "windows")]
static INSTALLED_APPS_CACHE: OnceLock<Mutex<Option<InstalledAppsCache>>> = OnceLock::new();

#[cfg(target_os = "windows")]
static INSTALLED_ICON_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

#[cfg(target_os = "windows")]
fn cache() -> &'static Mutex<Option<InstalledAppsCache>> {
    INSTALLED_APPS_CACHE.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "windows")]
fn icon_cache() -> &'static Mutex<HashMap<String, Option<String>>> {
    INSTALLED_ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[cfg(target_os = "windows")]
fn wide(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(Some(0)).collect()
}

#[cfg(target_os = "windows")]
fn string_from_wide_buffer(buffer: &[u16]) -> String {
    let len = buffer
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..len]).trim().to_string()
}

#[cfg(target_os = "windows")]
fn executable_from_icon_hint(icon_hint: &str) -> String {
    let (path, _) = parse_icon_location(icon_hint);
    if path.is_empty() {
        return String::new();
    }
    let candidate = PathBuf::from(path);
    let is_executable = candidate
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("exe"))
        .unwrap_or(false);
    if !is_executable || !candidate.is_file() {
        return String::new();
    }
    candidate
        .canonicalize()
        .unwrap_or(candidate)
        .to_string_lossy()
        .to_string()
}

#[cfg(target_os = "windows")]
fn resolve_shortcut(path: &Path) -> Option<(String, String)> {
    let shell_link: IShellLinkW =
        unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.ok()?;
    let persist: IPersistFile = shell_link.cast().ok()?;
    let path_wide = wide(&path.to_string_lossy());
    unsafe { persist.Load(PCWSTR(path_wide.as_ptr()), STGM_READ) }.ok()?;

    let mut target = vec![0_u16; 32_768];
    unsafe { shell_link.GetPath(&mut target, ptr::null_mut(), 0) }.ok()?;
    let target = string_from_wide_buffer(&target);

    let mut arguments = vec![0_u16; 32_768];
    let arguments = if unsafe { shell_link.GetArguments(&mut arguments) }.is_ok() {
        string_from_wide_buffer(&arguments)
    } else {
        String::new()
    };

    if target.is_empty() {
        None
    } else {
        Some((expand_environment(&target), arguments))
    }
}

#[cfg(target_os = "windows")]
fn parse_url_shortcut(path: &Path) -> String {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| {
            content
                .lines()
                .find_map(|line| line.trim().strip_prefix("URL=").map(str::trim))
                .map(str::to_string)
        })
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn resolve_start_menu_launch(path: &Path) -> (String, String, String, u8) {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "exe" => {
            let target = path
                .canonicalize()
                .unwrap_or_else(|_| path.to_path_buf())
                .to_string_lossy()
                .to_string();
            ("executable".to_string(), target, String::new(), 100)
        }
        "url" => {
            let target = parse_url_shortcut(path);
            if target.is_empty() {
                (String::new(), String::new(), String::new(), 0)
            } else {
                ("url".to_string(), target, String::new(), 100)
            }
        }
        "lnk" => {
            let Some((target, arguments)) = resolve_shortcut(path) else {
                return (String::new(), String::new(), String::new(), 0);
            };
            if let Some(aumid) = arguments
                .trim()
                .strip_prefix("shell:AppsFolder\\")
                .or_else(|| arguments.trim().strip_prefix("shell:AppsFolder/"))
            {
                return (
                    "aumid".to_string(),
                    aumid.trim().to_string(),
                    String::new(),
                    100,
                );
            }
            if !Path::new(&target).is_file() {
                return (String::new(), String::new(), String::new(), 0);
            }
            ("executable".to_string(), target, arguments, 100)
        }
        _ => (String::new(), String::new(), String::new(), 0),
    }
}

#[cfg(target_os = "windows")]
fn package_aumid(package: &Package, package_name: &str) -> String {
    let Ok(entries) = package.GetAppListEntries() else {
        return String::new();
    };
    let Ok(size) = entries.Size() else {
        return String::new();
    };
    if size == 0 {
        return String::new();
    }

    let normalized_package_name = normalize_name(package_name);
    let mut first = String::new();
    for index in 0..size {
        let Ok(entry) = entries.GetAt(index) else {
            continue;
        };
        let Ok(aumid) = entry.AppUserModelId() else {
            continue;
        };
        let aumid = aumid.to_string();
        if first.is_empty() {
            first = aumid.clone();
        }
        let display_name = entry
            .DisplayInfo()
            .ok()
            .and_then(|info| info.DisplayName().ok())
            .map(|value| value.to_string())
            .unwrap_or_default();
        if !display_name.is_empty() && normalize_name(&display_name) == normalized_package_name {
            return aumid;
        }
    }

    if size == 1 {
        first
    } else {
        String::new()
    }
}

#[cfg(target_os = "windows")]
fn expand_environment(value: &str) -> String {
    let source = wide(value);
    let required = unsafe { ExpandEnvironmentStringsW(source.as_ptr(), ptr::null_mut(), 0) };
    if required == 0 {
        return value.to_string();
    }
    let mut buffer = vec![0_u16; required as usize];
    let written =
        unsafe { ExpandEnvironmentStringsW(source.as_ptr(), buffer.as_mut_ptr(), required) };
    if written == 0 {
        return value.to_string();
    }
    let len = buffer
        .iter()
        .position(|item| *item == 0)
        .unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..len])
}

#[cfg(target_os = "windows")]
fn parse_icon_location(value: &str) -> (String, i32) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return (String::new(), 0);
    }

    if let Some(rest) = trimmed.strip_prefix('"') {
        if let Some(end) = rest.find('"') {
            let path = expand_environment(&rest[..end]);
            let suffix = rest[end + 1..].trim().trim_start_matches(',').trim();
            let index = suffix.parse::<i32>().unwrap_or(0);
            return (path, index);
        }
    }

    if let Some((path, suffix)) = trimmed.rsplit_once(',') {
        if let Ok(index) = suffix.trim().parse::<i32>() {
            return (expand_environment(path.trim().trim_matches('"')), index);
        }
    }

    (expand_environment(trimmed.trim_matches('"')), 0)
}

#[cfg(target_os = "windows")]
fn data_url_from_file(path: &Path) -> Option<String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "bmp" => "image/bmp",
        _ => return None,
    };
    let bytes = fs::read(path).ok()?;
    if bytes.is_empty() || bytes.len() > 8 * 1024 * 1024 {
        return None;
    }
    Some(format!(
        "data:{mime};base64,{}",
        BASE64_STANDARD.encode(bytes)
    ))
}

#[cfg(target_os = "windows")]
fn resolve_packaged_image_variant(path: &Path) -> Option<PathBuf> {
    if path.is_file() {
        return Some(path.to_path_buf());
    }
    let parent = path.parent()?;
    let stem = path.file_stem()?.to_string_lossy().to_lowercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut candidates = fs::read_dir(parent)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|candidate| {
            let candidate_extension = candidate
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if candidate_extension != extension {
                return false;
            }
            let candidate_stem = candidate
                .file_stem()
                .map(|value| value.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            candidate_stem == stem
                || candidate_stem.starts_with(&format!("{stem}.scale-"))
                || candidate_stem.starts_with(&format!("{stem}.targetsize-"))
        })
        .collect::<Vec<_>>();
    candidates.sort_by_key(|candidate| {
        let name = candidate
            .file_name()
            .map(|value| value.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if name.contains("targetsize-64") || name.contains("scale-200") {
            0
        } else if name.contains("targetsize-48") || name.contains("scale-150") {
            1
        } else {
            2
        }
    });
    candidates.into_iter().next()
}

#[cfg(target_os = "windows")]
fn shell_compatible_path(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    path.strip_prefix(r"\\?\").unwrap_or(path).to_string()
}

#[cfg(target_os = "windows")]
fn shell_icon(path: &str, icon_index: i32) -> Option<isize> {
    let path = shell_compatible_path(path);
    let extension = Path::new(&path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if matches!(extension.as_str(), "exe" | "dll" | "ico") {
        let file = wide(&path);
        let mut large_icon = 0_isize;
        let count = unsafe {
            ExtractIconExW(
                file.as_ptr(),
                icon_index,
                &mut large_icon,
                ptr::null_mut(),
                1,
            )
        };
        if count > 0 && large_icon != 0 {
            return Some(large_icon);
        }
    }

    let path_buf = PathBuf::from(&path);
    let path_wide = wide(&path);
    let mut info: ShFileInfoW = unsafe { std::mem::zeroed() };
    let result = unsafe {
        SHGetFileInfoW(
            path_wide.as_ptr(),
            0,
            &mut info,
            std::mem::size_of::<ShFileInfoW>() as u32,
            SHGFI_ICON,
        )
    };
    if result != 0 && info.h_icon != 0 {
        return Some(info.h_icon);
    }

    let attributes = if path_buf.is_dir() {
        FILE_ATTRIBUTE_DIRECTORY
    } else {
        FILE_ATTRIBUTE_NORMAL
    };
    let mut fallback_info: ShFileInfoW = unsafe { std::mem::zeroed() };
    let fallback = unsafe {
        SHGetFileInfoW(
            path_wide.as_ptr(),
            attributes,
            &mut fallback_info,
            std::mem::size_of::<ShFileInfoW>() as u32,
            SHGFI_ICON | SHGFI_USEFILEATTRIBUTES,
        )
    };
    if fallback == 0 || fallback_info.h_icon == 0 {
        None
    } else {
        Some(fallback_info.h_icon)
    }
}

#[cfg(target_os = "windows")]
fn icon_to_png_data_url(icon: isize) -> Option<String> {
    let screen_dc = unsafe { GetDC(0) };
    if screen_dc == 0 {
        unsafe {
            DestroyIcon(icon);
        }
        return None;
    }
    let memory_dc = unsafe { CreateCompatibleDC(screen_dc) };
    if memory_dc == 0 {
        unsafe {
            ReleaseDC(0, screen_dc);
            DestroyIcon(icon);
        }
        return None;
    }

    let info = BitmapInfo {
        bmi_header: BitmapInfoHeader {
            bi_size: std::mem::size_of::<BitmapInfoHeader>() as u32,
            bi_width: ICON_SIZE as i32,
            bi_height: -(ICON_SIZE as i32),
            bi_planes: 1,
            bi_bit_count: 32,
            bi_compression: BI_RGB,
            bi_size_image: ICON_SIZE * ICON_SIZE * 4,
            bi_x_pels_per_meter: 0,
            bi_y_pels_per_meter: 0,
            bi_clr_used: 0,
            bi_clr_important: 0,
        },
        bmi_colors: [RgbQuad {
            rgb_blue: 0,
            rgb_green: 0,
            rgb_red: 0,
            rgb_reserved: 0,
        }],
    };
    let mut bits: *mut c_void = ptr::null_mut();
    let bitmap = unsafe { CreateDIBSection(screen_dc, &info, DIB_RGB_COLORS, &mut bits, 0, 0) };
    if bitmap == 0 || bits.is_null() {
        unsafe {
            DeleteDC(memory_dc);
            ReleaseDC(0, screen_dc);
            DestroyIcon(icon);
        }
        return None;
    }

    let old_object = unsafe { SelectObject(memory_dc, bitmap) };
    let draw_ok = unsafe {
        DrawIconEx(
            memory_dc,
            0,
            0,
            icon,
            ICON_SIZE as i32,
            ICON_SIZE as i32,
            0,
            0,
            DI_NORMAL,
        )
    };

    let pixel_count = (ICON_SIZE * ICON_SIZE) as usize;
    let bgra = if draw_ok != 0 {
        Some(unsafe { std::slice::from_raw_parts(bits as *const u8, pixel_count * 4) }.to_vec())
    } else {
        None
    };

    unsafe {
        if old_object != 0 {
            SelectObject(memory_dc, old_object);
        }
        DeleteObject(bitmap as *mut c_void);
        DeleteDC(memory_dc);
        ReleaseDC(0, screen_dc);
        DestroyIcon(icon);
    }

    let bgra = bgra?;
    let has_alpha = bgra.chunks_exact(4).any(|pixel| pixel[3] != 0);
    let mut rgba = Vec::with_capacity(bgra.len());
    for pixel in bgra.chunks_exact(4) {
        let mut alpha = pixel[3];
        if !has_alpha && (pixel[0] != 0 || pixel[1] != 0 || pixel[2] != 0) {
            alpha = 255;
        }
        let (mut red, mut green, mut blue) = (pixel[2], pixel[1], pixel[0]);
        if alpha > 0 && alpha < 255 {
            red = ((red as u32 * 255 / alpha as u32).min(255)) as u8;
            green = ((green as u32 * 255 / alpha as u32).min(255)) as u8;
            blue = ((blue as u32 * 255 / alpha as u32).min(255)) as u8;
        }
        rgba.extend_from_slice(&[red, green, blue, alpha]);
    }

    let mut encoded = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut encoded, ICON_SIZE, ICON_SIZE);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(&rgba).ok()?;
    }
    Some(format!(
        "data:image/png;base64,{}",
        BASE64_STANDARD.encode(encoded)
    ))
}

#[cfg(target_os = "windows")]
pub(crate) fn shell_icon_data_url_for_path(path: &Path) -> Option<String> {
    if !path.exists() {
        return None;
    }
    shell_icon(&path.to_string_lossy(), 0).and_then(icon_to_png_data_url)
}

#[cfg(target_os = "windows")]
fn icon_data_url_from_hint(hint: &str) -> Option<String> {
    let (path, icon_index) = parse_icon_location(hint);
    if path.is_empty() {
        return None;
    }
    let resolved =
        resolve_packaged_image_variant(Path::new(&path)).unwrap_or_else(|| PathBuf::from(&path));
    if let Some(data_url) = data_url_from_file(&resolved) {
        return Some(data_url);
    }
    shell_icon(&resolved.to_string_lossy(), icon_index).and_then(icon_to_png_data_url)
}

#[cfg(target_os = "windows")]
struct RegistryKey(isize);

#[cfg(target_os = "windows")]
impl Drop for RegistryKey {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                RegCloseKey(self.0);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn open_registry_key(root: isize, path: &str, view: u32) -> Option<RegistryKey> {
    let mut key = 0_isize;
    let path = wide(path);
    let status = unsafe { RegOpenKeyExW(root, path.as_ptr(), 0, KEY_READ | view, &mut key) };
    (status == ERROR_SUCCESS).then_some(RegistryKey(key))
}

#[cfg(target_os = "windows")]
fn query_registry_string(key: isize, name: &str) -> String {
    let name = wide(name);
    let mut value_type = 0_u32;
    let mut bytes = 0_u32;
    let status = unsafe {
        RegQueryValueExW(
            key,
            name.as_ptr(),
            ptr::null_mut(),
            &mut value_type,
            ptr::null_mut(),
            &mut bytes,
        )
    };
    if status != ERROR_SUCCESS || bytes == 0 || !matches!(value_type, REG_SZ | REG_EXPAND_SZ) {
        return String::new();
    }

    let mut buffer = vec![0_u8; bytes as usize];
    let status = unsafe {
        RegQueryValueExW(
            key,
            name.as_ptr(),
            ptr::null_mut(),
            &mut value_type,
            buffer.as_mut_ptr(),
            &mut bytes,
        )
    };
    if status != ERROR_SUCCESS {
        return String::new();
    }

    let words =
        unsafe { std::slice::from_raw_parts(buffer.as_ptr() as *const u16, buffer.len() / 2) };
    let len = words
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(words.len());
    String::from_utf16_lossy(&words[..len]).trim().to_string()
}

#[cfg(target_os = "windows")]
fn query_registry_dword(key: isize, name: &str) -> Option<u32> {
    let name = wide(name);
    let mut value_type = 0_u32;
    let mut value = 0_u32;
    let mut bytes = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        RegQueryValueExW(
            key,
            name.as_ptr(),
            ptr::null_mut(),
            &mut value_type,
            &mut value as *mut u32 as *mut u8,
            &mut bytes,
        )
    };
    (status == ERROR_SUCCESS && value_type == REG_DWORD).then_some(value)
}

#[cfg(target_os = "windows")]
fn enumerate_subkeys(key: isize) -> Vec<String> {
    let mut names = Vec::new();
    for index in 0..20_000_u32 {
        let mut buffer = vec![0_u16; 512];
        let mut len = (buffer.len() - 1) as u32;
        let status = unsafe {
            RegEnumKeyExW(
                key,
                index,
                buffer.as_mut_ptr(),
                &mut len,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
            )
        };
        if status == ERROR_NO_MORE_ITEMS {
            break;
        }
        if status == ERROR_SUCCESS && len > 0 {
            names.push(String::from_utf16_lossy(&buffer[..len as usize]));
        }
    }
    names
}

#[cfg(target_os = "windows")]
fn normalize_name(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(|ch: char| matches!(ch, '™' | '®'))
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(target_os = "windows")]
fn is_noise_entry(
    name: &str,
    release_type: &str,
    parent_key: &str,
    system_component: Option<u32>,
) -> bool {
    if name.trim().is_empty() || system_component == Some(1) || !parent_key.trim().is_empty() {
        return true;
    }
    let release = release_type.to_lowercase();
    if release.contains("update") || release.contains("hotfix") || release.contains("security") {
        return true;
    }
    let lower = name.to_lowercase();
    lower.starts_with("update for ")
        || lower.starts_with("security update for ")
        || (lower.starts_with("kb") && lower[2..].chars().all(|ch| ch.is_ascii_digit()))
}

#[cfg(target_os = "windows")]
fn merge_app(apps: &mut BTreeMap<String, InstalledApp>, incoming: InstalledApp) {
    let key = normalize_name(&incoming.name);
    if key.is_empty() {
        return;
    }

    let current = apps.entry(key).or_insert_with(|| incoming.clone());
    if current.publisher.is_empty() && !incoming.publisher.is_empty() {
        current.publisher = incoming.publisher.clone();
    }
    if current.version.is_empty() && !incoming.version.is_empty() {
        current.version = incoming.version.clone();
    }
    if current.entry_path.is_empty() && !incoming.entry_path.is_empty() {
        current.entry_path = incoming.entry_path.clone();
    }
    if current.icon_hint.is_empty() && !incoming.icon_hint.is_empty() {
        current.icon_hint = incoming.icon_hint.clone();
    }
    if incoming.launch_priority > current.launch_priority && !incoming.launch_target.is_empty() {
        current.launch_kind = incoming.launch_kind.clone();
        current.launch_target = incoming.launch_target.clone();
        current.launch_args = incoming.launch_args.clone();
        current.launch_priority = incoming.launch_priority;
    }
    if !current
        .source
        .split('+')
        .any(|value| value == incoming.source.as_str())
    {
        current.source = format!("{}+{}", current.source, incoming.source);
    }
}

#[cfg(target_os = "windows")]
fn scan_registry_view(
    apps: &mut BTreeMap<String, InstalledApp>,
    root: isize,
    view: u32,
    source: &str,
) {
    let Some(uninstall) = open_registry_key(root, UNINSTALL_KEY, view) else {
        return;
    };

    for subkey in enumerate_subkeys(uninstall.0) {
        let path = format!("{UNINSTALL_KEY}\\{subkey}");
        let Some(key) = open_registry_key(root, &path, view) else {
            continue;
        };
        let name = query_registry_string(key.0, "DisplayName");
        let release_type = query_registry_string(key.0, "ReleaseType");
        let parent_key = query_registry_string(key.0, "ParentKeyName");
        if is_noise_entry(
            &name,
            &release_type,
            &parent_key,
            query_registry_dword(key.0, "SystemComponent"),
        ) {
            continue;
        }
        let icon_hint = query_registry_string(key.0, "DisplayIcon");
        let launch_target = executable_from_icon_hint(&icon_hint);
        let launch_priority = if launch_target.is_empty() { 0 } else { 20 };
        merge_app(
            apps,
            InstalledApp {
                name,
                publisher: query_registry_string(key.0, "Publisher"),
                version: query_registry_string(key.0, "DisplayVersion"),
                source: source.to_string(),
                entry_path: String::new(),
                icon_hint,
                launch_kind: if launch_target.is_empty() {
                    String::new()
                } else {
                    "executable".to_string()
                },
                launch_target,
                launch_args: String::new(),
                launch_priority,
            },
        );
    }
}

#[cfg(target_os = "windows")]
fn start_menu_roots() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(app_data) = std::env::var("APPDATA") {
        candidates.push(PathBuf::from(app_data).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    if let Ok(program_data) = std::env::var("PROGRAMDATA") {
        candidates
            .push(PathBuf::from(program_data).join("Microsoft\\Windows\\Start Menu\\Programs"));
    }
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter_map(|path| path.canonicalize().ok())
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

#[cfg(target_os = "windows")]
fn shortcut_display_name(path: &Path) -> String {
    path.file_stem()
        .map(|value| value.to_string_lossy().trim().to_string())
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn scan_start_menu(apps: &mut BTreeMap<String, InstalledApp>) {
    let mut queue: Vec<PathBuf> = start_menu_roots();
    while let Some(root) = queue.pop() {
        let Ok(entries) = fs::read_dir(root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(metadata) = entry.metadata() else {
                continue;
            };
            if metadata.file_attributes() & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM) != 0 {
                continue;
            }
            if metadata.is_dir() {
                queue.push(path);
                continue;
            }
            let extension = path
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase();
            if !matches!(extension.as_str(), "lnk" | "url" | "exe") {
                continue;
            }

            let name = shortcut_display_name(&path);
            if name.is_empty() || name.to_lowercase().contains("uninstall") {
                continue;
            }
            let (launch_kind, launch_target, launch_args, launch_priority) =
                resolve_start_menu_launch(&path);
            merge_app(
                apps,
                InstalledApp {
                    name,
                    publisher: String::new(),
                    version: String::new(),
                    source: "start-menu".to_string(),
                    entry_path: path
                        .canonicalize()
                        .unwrap_or_else(|_| path.clone())
                        .to_string_lossy()
                        .to_string(),
                    icon_hint: path.to_string_lossy().to_string(),
                    launch_kind,
                    launch_target,
                    launch_args,
                    launch_priority,
                },
            );
        }
    }
}

#[cfg(target_os = "windows")]
fn packaged_icon_hint(package: &windows::ApplicationModel::Package) -> String {
    let Ok(location) = package.InstalledLocation() else {
        return String::new();
    };
    let Ok(base) = location.Path() else {
        return String::new();
    };
    let Ok(logo) = package.Logo() else {
        return String::new();
    };
    let Ok(relative) = logo.Path() else {
        return String::new();
    };
    let relative = relative
        .to_string()
        .trim_start_matches('/')
        .replace('/', "\\");
    PathBuf::from(base.to_string())
        .join(relative)
        .to_string_lossy()
        .to_string()
}

#[cfg(target_os = "windows")]
fn scan_packaged_apps(apps: &mut BTreeMap<String, InstalledApp>) {
    let Ok(manager) = PackageManager::new() else {
        return;
    };
    let Ok(packages) = manager.FindPackages() else {
        return;
    };
    let Ok(iterator) = packages.First() else {
        return;
    };

    loop {
        if !iterator.HasCurrent().unwrap_or(false) {
            break;
        }
        if let Ok(package) = iterator.Current() {
            let is_framework = package.IsFramework().unwrap_or(true);
            let is_resource = package.IsResourcePackage().unwrap_or(true);
            let is_bundle = package.IsBundle().unwrap_or(false);
            if !is_framework && !is_resource && !is_bundle {
                let name = package
                    .DisplayName()
                    .map(|value| value.to_string())
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if !name.is_empty() && !name.to_lowercase().starts_with("ms-resource:") {
                    let publisher = package
                        .PublisherDisplayName()
                        .map(|value| value.to_string())
                        .unwrap_or_default();
                    let launch_target = package_aumid(&package, &name);
                    let launch_priority = if launch_target.is_empty() { 0 } else { 80 };
                    merge_app(
                        apps,
                        InstalledApp {
                            name,
                            publisher,
                            version: String::new(),
                            source: "package".to_string(),
                            entry_path: String::new(),
                            icon_hint: packaged_icon_hint(&package),
                            launch_kind: if launch_target.is_empty() {
                                String::new()
                            } else {
                                "aumid".to_string()
                            },
                            launch_target,
                            launch_args: String::new(),
                            launch_priority,
                        },
                    );
                }
            }
        }
        if !iterator.MoveNext().unwrap_or(false) {
            break;
        }
    }
}

#[cfg(target_os = "windows")]
fn build_catalog() -> Vec<InstalledApp> {
    let mut apps = BTreeMap::new();
    let com_initialized = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }.is_ok();
    scan_registry_view(
        &mut apps,
        HKEY_CURRENT_USER,
        KEY_WOW64_64KEY,
        "registry-user-64",
    );
    scan_registry_view(
        &mut apps,
        HKEY_CURRENT_USER,
        KEY_WOW64_32KEY,
        "registry-user-32",
    );
    scan_registry_view(
        &mut apps,
        HKEY_LOCAL_MACHINE,
        KEY_WOW64_64KEY,
        "registry-machine-64",
    );
    scan_registry_view(
        &mut apps,
        HKEY_LOCAL_MACHINE,
        KEY_WOW64_32KEY,
        "registry-machine-32",
    );
    scan_start_menu(&mut apps);
    scan_packaged_apps(&mut apps);

    if com_initialized {
        unsafe {
            CoUninitialize();
        }
    }
    let mut catalog: Vec<_> = apps.into_values().collect();
    catalog.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    catalog
}

#[cfg(target_os = "windows")]
fn refresh_cache(cache: &mut Option<InstalledAppsCache>) {
    let stale = cache
        .as_ref()
        .map(|value| value.built_at.elapsed() >= CACHE_TTL)
        .unwrap_or(true);
    if stale {
        *cache = Some(InstalledAppsCache {
            built_at: Instant::now(),
            apps: build_catalog(),
        });
    }
}

#[cfg(target_os = "windows")]
pub fn discover(force_refresh: bool) -> Result<Vec<InstalledAppSnapshot>, String> {
    let mut guard = cache().lock().map_err(|error| error.to_string())?;
    if force_refresh {
        *guard = None;
    }
    refresh_cache(&mut guard);
    Ok(guard
        .as_ref()
        .map(|value| {
            value
                .apps
                .iter()
                .map(|app| {
                    (
                        app.name.clone(),
                        app.publisher.clone(),
                        app.version.clone(),
                        app.source.clone(),
                        app.entry_path.clone(),
                        app.launch_kind.clone(),
                        app.launch_target.clone(),
                        app.launch_args.clone(),
                    )
                })
                .collect()
        })
        .unwrap_or_default())
}

#[cfg(target_os = "windows")]
pub fn icon_for(name: &str) -> Result<Option<String>, String> {
    let normalized = normalize_name(name);
    if normalized.is_empty() {
        return Ok(None);
    }

    if let Some(cached) = icon_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .get(&normalized)
        .cloned()
    {
        return Ok(cached);
    }

    let icon_hint = {
        let mut guard = cache().lock().map_err(|error| error.to_string())?;
        refresh_cache(&mut guard);
        guard
            .as_ref()
            .and_then(|value| {
                value
                    .apps
                    .iter()
                    .find(|app| normalize_name(&app.name) == normalized)
            })
            .map(|app| app.icon_hint.clone())
            .unwrap_or_default()
    };

    let icon = icon_data_url_from_hint(&icon_hint);
    icon_cache()
        .lock()
        .map_err(|error| error.to_string())?
        .insert(normalized, icon.clone());
    Ok(icon)
}

#[cfg(target_os = "windows")]
fn shell_execute_target(target: &str, arguments: &str) -> Result<(), String> {
    if target.trim().is_empty() || target.contains('\0') || arguments.contains('\0') {
        return Err("installed app launch target is invalid".to_string());
    }

    let operation = wide("open");
    let file = wide(target);
    let parameters = if arguments.trim().is_empty() {
        None
    } else {
        Some(wide(arguments))
    };
    let result = unsafe {
        ShellExecuteW(
            ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            parameters
                .as_ref()
                .map(|value| value.as_ptr())
                .unwrap_or(ptr::null()),
            ptr::null(),
            1,
        )
    };
    if result <= 32 {
        Err(format!("installed app launch failed with code {result}"))
    } else {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn launch_descriptor(name: &str) -> Result<(String, String, String), String> {
    let normalized = normalize_name(name);
    if normalized.is_empty() {
        return Err("installed app name is empty".to_string());
    }

    let mut guard = cache().lock().map_err(|error| error.to_string())?;
    refresh_cache(&mut guard);
    guard
        .as_ref()
        .and_then(|value| {
            value
                .apps
                .iter()
                .find(|app| normalize_name(&app.name) == normalized)
        })
        .map(|app| {
            (
                app.launch_kind.clone(),
                app.launch_target.clone(),
                app.launch_args.clone(),
            )
        })
        .filter(|(_, target, _)| !target.is_empty())
        .ok_or_else(|| "installed app launch target is unavailable".to_string())
}

#[cfg(target_os = "windows")]
pub fn launch(name: &str) -> Result<(), String> {
    let (kind, target, arguments) = launch_descriptor(name)?;
    let result = match kind.as_str() {
        "executable" => {
            if !Path::new(&target).is_file() {
                return Err("installed app executable no longer exists".to_string());
            }
            shell_execute_target(&target, &arguments)
        }
        "aumid" => {
            if !target.contains('!') {
                return Err("installed app AUMID is invalid".to_string());
            }
            shell_execute_target(&format!("shell:AppsFolder\\{target}"), "")
        }
        "url" => shell_execute_target(&target, ""),
        _ => Err("installed app launch kind is unsupported".to_string()),
    };

    if result.is_ok() {
        diagnostics::log_event("installed_app_launched", &format!("kind={kind}"));
    }
    result
}

#[cfg(target_os = "windows")]
pub fn spawn_warmup() {
    thread::spawn(|| {
        thread::sleep(Duration::from_secs(3));
        match discover(false) {
            Ok(apps) => diagnostics::log_event(
                "installed_apps_discovered",
                &format!("count={}", apps.len()),
            ),
            Err(_error) => {
                diagnostics::log_event("installed_apps_discovery_failed", "details_omitted")
            }
        }
    });
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn parses_display_icon_locations() {
        let (path, index) = parse_icon_location(r#""C:\Program Files\Demo\demo.exe",-12"#);
        assert_eq!(path, r"C:\Program Files\Demo\demo.exe");
        assert_eq!(index, -12);
    }

    #[test]
    fn reads_icons_from_real_installed_apps() {
        let catalog = build_catalog();
        let candidates = catalog
            .iter()
            .filter(|app| !app.icon_hint.trim().is_empty())
            .take(100);

        let mut attempted = 0_usize;
        let mut extracted = 0_usize;
        for app in candidates {
            attempted += 1;
            if let Some(data_url) = icon_data_url_from_hint(&app.icon_hint) {
                assert!(
                    data_url.starts_with("data:image/"),
                    "unexpected icon data URL for {}",
                    app.name
                );
                extracted += 1;
                if extracted >= 3 {
                    break;
                }
            }
        }

        assert!(
            attempted > 0,
            "installed app catalog did not expose icon hints"
        );
        assert!(
            extracted >= 3,
            "expected at least 3 real installed app icons, extracted {extracted} from {attempted} candidates"
        );
    }

    #[test]
    fn rejects_unknown_installed_app_launch_descriptor() {
        let result = launch_descriptor("__flexikit_missing_app_for_test__");
        assert!(result.is_err());
    }

    #[test]
    fn resolves_real_installed_app_launch_targets() {
        let catalog = build_catalog();
        let resolved = catalog
            .iter()
            .filter(|app| !app.launch_target.is_empty())
            .collect::<Vec<_>>();

        assert!(
            resolved.len() >= 3,
            "expected at least 3 resolved launch targets, got {}",
            resolved.len()
        );

        let mut executable_count = 0_usize;
        for app in &resolved {
            match app.launch_kind.as_str() {
                "executable" => {
                    assert!(
                        Path::new(&app.launch_target).is_file(),
                        "resolved executable does not exist for {}: {}",
                        app.name,
                        app.launch_target
                    );
                    executable_count += 1;
                }
                "aumid" => {
                    assert!(
                        app.launch_target.contains('!'),
                        "unexpected AUMID for {}: {}",
                        app.name,
                        app.launch_target
                    );
                }
                "url" => {
                    assert!(
                        app.launch_target.contains("://"),
                        "unexpected URL target for {}: {}",
                        app.name,
                        app.launch_target
                    );
                }
                other => panic!("unexpected launch kind {other} for {}", app.name),
            }
        }

        assert!(
            executable_count >= 1,
            "expected at least one real executable launch target"
        );
    }
}
