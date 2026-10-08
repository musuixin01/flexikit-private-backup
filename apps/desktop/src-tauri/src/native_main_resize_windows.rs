//! Let Windows own the main window's resize geometry.
//!
//! Tauri undecorated windows create another child HWND and update its GDI region
//! on each WM_SIZE. Configure the main window decorated to prevent that helper,
//! then strip only the caption; the OS retains the native thick resize frame.
use std::ffi::c_void;
use tauri::WebviewWindow;

type Hwnd = *mut c_void;

const GWL_STYLE: i32 = -16;
const WS_CAPTION: isize = 0x00c0_0000;
const WS_THICKFRAME: isize = 0x0004_0000;
const WS_SYSMENU: isize = 0x0008_0000;
const WS_MINIMIZEBOX: isize = 0x0002_0000;
const WS_MAXIMIZEBOX: isize = 0x0001_0000;
const SWP_NOSIZE: u32 = 0x0001;
const SWP_NOMOVE: u32 = 0x0002;
const SWP_NOZORDER: u32 = 0x0004;
const SWP_NOACTIVATE: u32 = 0x0010;
const SWP_FRAMECHANGED: u32 = 0x0020;

#[link(name = "user32")]
unsafe extern "system" {
    fn GetWindowLongPtrW(hwnd: Hwnd, index: i32) -> isize;
    fn SetWindowLongPtrW(hwnd: Hwnd, index: i32, new_value: isize) -> isize;
    fn SetWindowPos(hwnd: Hwnd, after: Hwnd, x: i32, y: i32, cx: i32, cy: i32, flags: u32) -> i32;
}

fn shell_style(style: isize) -> isize {
    (style & !WS_CAPTION) | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
}

pub fn install(main: &WebviewWindow) -> Result<(), String> {
    let hwnd = main.hwnd().map_err(|error| error.to_string())?.0;
    if hwnd.is_null() {
        return Err("Main window handle unavailable".to_string());
    }
    unsafe {
        let original = GetWindowLongPtrW(hwnd, GWL_STYLE);
        if original & WS_CAPTION == 0 {
            return Err("Main window is not natively decorated".to_string());
        }
        let target = shell_style(original);
        SetWindowLongPtrW(hwnd, GWL_STYLE, target);
        if GetWindowLongPtrW(hwnd, GWL_STYLE) != target {
            return Err("Unable to set main resize frame".to_string());
        }
        // One-time frame recalculation, never a geometry write in WM_SIZE.
        if SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED,
        ) == 0
        {
            return Err("Unable to apply main resize frame".to_string());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn captionless_style_preserves_native_resize() {
        let style = shell_style(WS_CAPTION | WS_THICKFRAME | WS_SYSMENU);
        assert_eq!(style & WS_CAPTION, 0);
        assert_ne!(style & WS_THICKFRAME, 0);
        assert_ne!(style & WS_SYSMENU, 0);
        assert_ne!(style & WS_MINIMIZEBOX, 0);
        assert_ne!(style & WS_MAXIMIZEBOX, 0);
    }
}
