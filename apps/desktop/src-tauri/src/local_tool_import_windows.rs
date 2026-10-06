use std::{ffi::c_void, path::PathBuf};

use windows::Win32::{
    System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    },
    UI::Shell::{
        FileOpenDialog, IFileOpenDialog, FOS_FILEMUSTEXIST, FOS_FORCEFILESYSTEM, FOS_PATHMUSTEXIST,
        SIGDN_FILESYSPATH,
    },
};

const CANCELLED_HRESULT: i32 = 0x8007_04C7u32 as i32;
const MAX_IMPORT_ITEMS: usize = 32;

pub type LocalToolInspection = (String, String, String, Option<String>, Option<String>);

struct ComApartment;

impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe {
            CoUninitialize();
        }
    }
}

fn initialize_sta() -> Result<ComApartment, String> {
    let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };
    if result.is_err() {
        return Err("failed to initialize the Windows file picker".to_string());
    }
    Ok(ComApartment)
}

fn supported_extension(extension: &str) -> bool {
    matches!(extension, "exe" | "lnk" | "url" | "msi")
}

fn inspect_path(path: &str) -> LocalToolInspection {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return (
            String::new(),
            String::new(),
            String::new(),
            None,
            Some("文件路径为空".to_string()),
        );
    }

    let canonical = match PathBuf::from(trimmed).canonicalize() {
        Ok(value) => value,
        Err(_) => {
            return (
                trimmed.to_string(),
                String::new(),
                String::new(),
                None,
                Some("文件不存在或无法访问".to_string()),
            )
        }
    };
    if !canonical.is_file() {
        return (
            canonical.to_string_lossy().to_string(),
            String::new(),
            String::new(),
            None,
            Some("请选择启动程序文件，不支持文件夹".to_string()),
        );
    }

    let extension = canonical
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    if !supported_extension(&extension) {
        return (
            canonical.to_string_lossy().to_string(),
            String::new(),
            extension,
            None,
            Some("仅支持 .exe、.lnk、.url、.msi".to_string()),
        );
    }

    let name = canonical
        .file_stem()
        .and_then(|value| value.to_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("本地工具")
        .to_string();
    let icon = crate::installed_apps_windows::shell_icon_data_url_for_path(&canonical);

    (
        canonical.to_string_lossy().to_string(),
        name,
        extension,
        icon,
        None,
    )
}

pub fn inspect_paths(paths: Vec<String>) -> Vec<LocalToolInspection> {
    paths
        .into_iter()
        .take(MAX_IMPORT_ITEMS)
        .map(|path| inspect_path(&path))
        .collect()
}

fn pick_local_tool_file_sta() -> Result<Option<String>, String> {
    let _apartment = initialize_sta()?;
    let dialog: IFileOpenDialog =
        unsafe { CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER) }
            .map_err(|_| "failed to create the Windows file picker".to_string())?;

    let options = unsafe { dialog.GetOptions() }
        .map_err(|_| "failed to configure the Windows file picker".to_string())?;
    unsafe {
        dialog
            .SetOptions(options | FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST)
            .map_err(|_| "failed to configure the Windows file picker".to_string())?;
    }

    if let Err(error) = unsafe { dialog.Show(None) } {
        if error.code().0 == CANCELLED_HRESULT {
            return Ok(None);
        }
        return Err("Windows file picker failed".to_string());
    }

    let item = unsafe { dialog.GetResult() }
        .map_err(|_| "failed to read the selected file".to_string())?;
    let raw_path = unsafe { item.GetDisplayName(SIGDN_FILESYSPATH) }
        .map_err(|_| "failed to resolve the selected file".to_string())?;
    let path_result = unsafe { raw_path.to_string() }
        .map_err(|_| "selected file path is not valid Unicode".to_string());
    unsafe {
        CoTaskMemFree(Some(raw_path.0.cast::<c_void>()));
    }

    Ok(Some(path_result?))
}

pub fn pick_local_tool_file() -> Result<Option<String>, String> {
    std::thread::spawn(pick_local_tool_file_sta)
        .join()
        .map_err(|_| "Windows file picker thread failed".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_tool_extension_allowlist_is_narrow() {
        assert!(supported_extension("exe"));
        assert!(supported_extension("lnk"));
        assert!(supported_extension("url"));
        assert!(supported_extension("msi"));
        assert!(!supported_extension("bat"));
        assert!(!supported_extension("cmd"));
        assert!(!supported_extension("ps1"));
        assert!(!supported_extension("dll"));
    }

    #[test]
    fn local_tool_import_caps_batch_size() {
        let paths = (0..64)
            .map(|index| format!("missing-{index}.exe"))
            .collect();
        assert_eq!(inspect_paths(paths).len(), MAX_IMPORT_ITEMS);
    }
}
