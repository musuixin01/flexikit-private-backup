//! Full-client Windows main window with an OS-owned native resize frame.
//!
//! The styled WS_THICKFRAME without a caption leaves an 8px non-client strip
//! at the right/bottom (and other edges). During interactive resizing the OS
//! paints that strip independently of WebView2, making it appear to flicker.
//! Keep the native thick frame and let the client cover the entire restored
//! HWND through WM_NCCALCSIZE; provide a small DPI-aware resize hit zone.
//! Never forward resize geometry back into SetWindowPos in WM_SIZE/WM_SIZING.
use std::ffi::c_void;
use tauri::WebviewWindow;
use tauri_runtime::ResizeDirection;

type Hwnd = *mut c_void;
type SubclassProc = unsafe extern "system" fn(Hwnd, u32, usize, isize, usize, usize) -> isize;

#[repr(C)]
struct Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

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

const WM_NCDESTROY: u32 = 0x0082;
const WM_NCCALCSIZE: u32 = 0x0083;
const WM_NCHITTEST: u32 = 0x0084;
#[cfg(debug_assertions)]
const WM_ENTERSIZEMOVE: u32 = 0x0231;
#[cfg(debug_assertions)]
const WM_EXITSIZEMOVE: u32 = 0x0232;
const HTLEFT: isize = 10;
const HTRIGHT: isize = 11;
const HTTOP: isize = 12;
const HTTOPLEFT: isize = 13;
const HTTOPRIGHT: isize = 14;
const HTBOTTOM: isize = 15;
const HTBOTTOMLEFT: isize = 16;
const HTBOTTOMRIGHT: isize = 17;
const SM_CXFRAME: i32 = 32;
const SM_CYFRAME: i32 = 33;
const SM_CXPADDEDBORDER: i32 = 92;
const MAIN_SUBCLASS_ID: usize = 0xF1E1_0101;

#[link(name = "user32")]
unsafe extern "system" {
    fn GetWindowLongPtrW(hwnd: Hwnd, index: i32) -> isize;
    fn SetWindowLongPtrW(hwnd: Hwnd, index: i32, new_value: isize) -> isize;
    fn SetWindowPos(hwnd: Hwnd, after: Hwnd, x: i32, y: i32, cx: i32, cy: i32, flags: u32) -> i32;
    fn GetWindowRect(hwnd: Hwnd, rect: *mut Rect) -> i32;
    fn GetDpiForWindow(hwnd: Hwnd) -> u32;
    fn GetSystemMetricsForDpi(index: i32, dpi: u32) -> i32;
    fn IsZoomed(hwnd: Hwnd) -> i32;
}

#[link(name = "comctl32")]
unsafe extern "system" {
    fn SetWindowSubclass(hwnd: Hwnd, proc: Option<SubclassProc>, id: usize, data: usize) -> i32;
    fn RemoveWindowSubclass(hwnd: Hwnd, proc: Option<SubclassProc>, id: usize) -> i32;
    fn DefSubclassProc(hwnd: Hwnd, message: u32, wparam: usize, lparam: isize) -> isize;
}

fn shell_style(style: isize) -> isize {
    (style & !WS_CAPTION) | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
}

/// Extract signed physical screen pixels. LOWORD/HIWORD must not be treated
/// as unsigned: the main window can be dragged to a negative-X monitor.
fn screen_point(lparam: isize) -> (i32, i32) {
    let packed = lparam as u32;
    (
        (packed as u16 as i16) as i32,
        ((packed >> 16) as u16 as i16) as i32,
    )
}

fn edge_hit(rect: &Rect, x: i32, y: i32, border_x: i32, border_y: i32) -> Option<isize> {
    if x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom {
        return None;
    }
    let left = x < rect.left + border_x;
    let right = x >= rect.right - border_x;
    let top = y < rect.top + border_y;
    let bottom = y >= rect.bottom - border_y;

    match (left, right, top, bottom) {
        (true, _, true, _) => Some(HTTOPLEFT),
        (_, true, true, _) => Some(HTTOPRIGHT),
        (true, _, _, true) => Some(HTBOTTOMLEFT),
        (_, true, _, true) => Some(HTBOTTOMRIGHT),
        (true, _, _, _) => Some(HTLEFT),
        (_, true, _, _) => Some(HTRIGHT),
        (_, _, true, _) => Some(HTTOP),
        (_, _, _, true) => Some(HTBOTTOM),
        _ => None,
    }
}

/// Installed on the UI thread using Comctl32's subclass chaining so Tauri/Wry
/// keeps its own WndProc and owns the lifetime of the main HWND.
unsafe extern "system" fn main_frame_proc(
    hwnd: Hwnd,
    message: u32,
    wparam: usize,
    lparam: isize,
    _subclass_id: usize,
    _data: usize,
) -> isize {
    match message {
        WM_NCCALCSIZE if unsafe { IsZoomed(hwnd) } == 0 => {
            // With a restored window, make the entire outer rect client area.
            // Otherwise WebView2 ends ~8px short on the right and bottom.
            return 0;
        }
        WM_NCHITTEST if unsafe { IsZoomed(hwnd) } == 0 => {
            let mut rect = Rect {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
            };
            if unsafe { GetWindowRect(hwnd, &mut rect) } != 0 {
                let dpi = unsafe { GetDpiForWindow(hwnd) }.max(96);
                let padding = unsafe { GetSystemMetricsForDpi(SM_CXPADDEDBORDER, dpi) };
                let border_x =
                    (unsafe { GetSystemMetricsForDpi(SM_CXFRAME, dpi) } + padding).max(1);
                let border_y =
                    (unsafe { GetSystemMetricsForDpi(SM_CYFRAME, dpi) } + padding).max(1);
                let (x, y) = screen_point(lparam);
                if let Some(hit) = edge_hit(&rect, x, y, border_x, border_y) {
                    return hit;
                }
            }
        }

        #[cfg(debug_assertions)]
        WM_ENTERSIZEMOVE => {
            crate::diagnostics::log_event("main_window_resize_entered", "details_omitted");
        }
        #[cfg(debug_assertions)]
        WM_EXITSIZEMOVE => {
            crate::diagnostics::log_event("main_window_resize_exited", "details_omitted");
        }
        WM_NCDESTROY => {
            unsafe { RemoveWindowSubclass(hwnd, Some(main_frame_proc), MAIN_SUBCLASS_ID) };
        }
        _ => {}
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn resize_hit_for_direction(direction: &str) -> Option<ResizeDirection> {
    match direction {
        "north" => Some(ResizeDirection::North),
        "south" => Some(ResizeDirection::South),
        "east" => Some(ResizeDirection::East),
        "west" => Some(ResizeDirection::West),
        "northeast" => Some(ResizeDirection::NorthEast),
        "northwest" => Some(ResizeDirection::NorthWest),
        "southeast" => Some(ResizeDirection::SouthEast),
        "southwest" => Some(ResizeDirection::SouthWest),
        _ => None,
    }
}

/// Chromium consumes mouse hit testing at the HWND edge. The Vue handles
/// dispatch into Tauri/Tao's event-loop-driven native resize state instead
/// of synchronously sending a WM_NCLBUTTONDOWN from the IPC thread.
pub fn begin_edge_drag(main: &WebviewWindow, direction: &str) -> Result<(), String> {
    let edge = resize_hit_for_direction(direction).ok_or("Invalid resize direction")?;
    let hwnd = main.hwnd().map_err(|error| error.to_string())?.0;
    if hwnd.is_null() || unsafe { IsZoomed(hwnd) } != 0 {
        return Err("Resize unavailable for this main window state".into());
    }
    main.as_ref()
        .window()
        .start_resize_dragging(edge)
        .map_err(|error| error.to_string())
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

        // Install before SWP_FRAMECHANGED so WM_NCCALCSIZE is applied at once.
        if SetWindowSubclass(hwnd, Some(main_frame_proc), MAIN_SUBCLASS_ID, 0) == 0 {
            return Err("Unable to install main window border subclass".to_string());
        }
        let target = shell_style(original);
        SetWindowLongPtrW(hwnd, GWL_STYLE, target);
        if GetWindowLongPtrW(hwnd, GWL_STYLE) != target {
            RemoveWindowSubclass(hwnd, Some(main_frame_proc), MAIN_SUBCLASS_ID);
            return Err("Unable to set main resize frame".to_string());
        }
        // One-time non-client recalculation; keep all future geometry OS-owned.
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
            SetWindowLongPtrW(hwnd, GWL_STYLE, original);
            RemoveWindowSubclass(hwnd, Some(main_frame_proc), MAIN_SUBCLASS_ID);
            return Err("Unable to apply full-client native resize frame".to_string());
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

    #[test]
    fn border_hit_zones_cover_right_bottom_and_corners_without_content() {
        let rect = Rect {
            left: -120,
            top: 80,
            right: 1080,
            bottom: 800,
        };
        assert_eq!(edge_hit(&rect, 1077, 450, 8, 8), Some(HTRIGHT));
        assert_eq!(edge_hit(&rect, 400, 797, 8, 8), Some(HTBOTTOM));
        assert_eq!(edge_hit(&rect, 1077, 797, 8, 8), Some(HTBOTTOMRIGHT));
        assert_eq!(edge_hit(&rect, -118, 82, 8, 8), Some(HTTOPLEFT));
        assert_eq!(edge_hit(&rect, 300, 200, 8, 8), None);
        assert_eq!(edge_hit(&rect, 1080, 400, 8, 8), None);
    }

    #[test]
    fn resize_directions_are_restricted_to_native_edges() {
        assert_eq!(
            resize_hit_for_direction("east"),
            Some(ResizeDirection::East)
        );
        assert_eq!(
            resize_hit_for_direction("south"),
            Some(ResizeDirection::South)
        );
        assert_eq!(
            resize_hit_for_direction("southeast"),
            Some(ResizeDirection::SouthEast)
        );
        assert_eq!(resize_hit_for_direction("center"), None);
        assert_eq!(resize_hit_for_direction("caption"), None);
        assert_eq!(resize_hit_for_direction(""), None);
    }

    #[test]
    fn screen_point_preserves_negative_monitor_coordinates() {
        let original = (-320_i16, 900_i16);
        let packed = ((original.1 as u16 as u32) << 16) | original.0 as u16 as u32;
        assert_eq!(screen_point(packed as isize), (-320, 900));
    }
}
