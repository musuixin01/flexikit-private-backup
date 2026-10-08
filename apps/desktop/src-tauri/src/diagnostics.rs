use std::{
    collections::BTreeMap,
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::Once,
    time::{SystemTime, UNIX_EPOCH},
};

const LOG_DIR_NAME: &str = "com.flexikit.desktop";
const LOG_FILE_NAME: &str = "flexikit.log";
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;
const MAX_BACKUPS: usize = 3;

static INIT: Once = Once::new();

pub fn init() {
    INIT.call_once(|| {
        rotate_if_needed();
        std::panic::set_hook(Box::new(|info| {
            let location = info
                .location()
                .map(|value| {
                    let file_name = std::path::Path::new(value.file())
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("unknown");
                    format!("{file_name}:{}:{}", value.line(), value.column())
                })
                .unwrap_or_else(|| "unknown".to_string());
            // Panic payloads may include credentials and private user content.
            log_event("panic", &format!("location={location}"));
        }));

        log_event(
            "startup",
            &format!(
                "version={} os={} arch={} pid={}",
                env!("CARGO_PKG_VERSION"),
                std::env::consts::OS,
                std::env::consts::ARCH,
                std::process::id()
            ),
        );
    });
}

pub fn log_event(event: &str, detail: &str) {
    let Some(path) = log_file_path() else {
        return;
    };
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default();
    let Some(event_id) = safe_event_id(event) else {
        return;
    };
    let safe = safe_detail(event_id, detail);

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{timestamp}\t{event_id}\t{safe}");
    }
}

const SUMMARY_EVENTS: &[&str] = &[
    "startup",
    "setup_complete",
    "shutdown",
    "panic",
    "runtime_error",
    "frontend_script_error",
    "frontend_promise_rejection",
    "frontend_vue_error",
    "global_search_shortcut_failed",
    "installed_apps_discovery_failed",
];

fn safe_event_id(event: &str) -> Option<&str> {
    if event.is_empty()
        || event.len() > 64
        || !event
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
    {
        return None;
    }
    Some(event)
}

fn safe_panic_location(detail: &str) -> String {
    let mut parts = detail.strip_prefix("location=").unwrap_or("").split(':');
    let (Some(file), Some(line), Some(column), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return "location=unknown".to_string();
    };

    if file.len() > 48
        || !file.ends_with(".rs")
        || !file
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
        || line.is_empty()
        || column.is_empty()
        || line.len() > 9
        || column.len() > 9
        || !line.bytes().all(|byte| byte.is_ascii_digit())
        || !column.bytes().all(|byte| byte.is_ascii_digit())
    {
        return "location=unknown".to_string();
    }
    format!("location={file}:{line}:{column}")
}

fn safe_detail(event: &str, detail: &str) -> String {
    match event {
        // Fixed metadata created by our own init() routine.
        "startup" => detail
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '_' | '=' | '-' | '.'))
            .take(128)
            .collect(),
        "panic" => safe_panic_location(detail),
        "installed_apps_discovered" => detail
            .strip_prefix("count=")
            .and_then(|number| number.parse::<u32>().ok())
            .map(|number| format!("count={number}"))
            .unwrap_or_else(|| "count=unknown".to_string()),
        "installed_app_launched" => match detail {
            "kind=exe" | "kind=lnk" | "kind=msi" | "kind=store" | "kind=url" => detail.to_string(),
            _ => "kind=other".to_string(),
        },
        // Never write arbitrary exception or OS failure text to disk.
        _ => "details_omitted".to_string(),
    }
}

fn event_counts(raw: &str) -> BTreeMap<&'static str, usize> {
    let mut counts = BTreeMap::new();
    for line in raw.lines().rev().take(1024) {
        let mut fields = line.splitn(3, '\t');
        let _timestamp = fields.next();
        let event = fields.next().unwrap_or("");
        if let Some(&known) = SUMMARY_EVENTS.iter().find(|&&name| name == event) {
            *counts.entry(known).or_default() += 1;
        }
    }
    counts
}

/// Returns fixed metadata and event counts only, never original log details,
/// timestamps, paths, panic payloads, or AI content. No automatic upload.
pub fn diagnostic_summary() -> String {
    let counts = log_file_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|content| event_counts(&content))
        .unwrap_or_default();

    let mut report = format!(
        "FlexiKit local diagnostic summary\nversion={}\nos={}\narch={}\nmanual_copy_only=true\n",
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
        std::env::consts::ARCH,
    );
    for (event, count) in counts {
        report.push_str(&format!("{event}={count}\n"));
    }
    report
}

#[cfg(test)]
mod privacy_tests {
    use super::*;

    #[test]
    fn panic_and_os_errors_never_write_raw_messages() {
        assert_eq!(
            safe_panic_location("location=main.rs:42:7"),
            "location=main.rs:42:7"
        );
        assert_eq!(
            safe_panic_location("location=main.rs:42:7 message=token-secret"),
            "location=unknown"
        );
        assert_eq!(
            safe_panic_location("location=C:\\Users\\secret\\main.rs:42:7"),
            "location=unknown"
        );
        assert_eq!(
            safe_detail("installed_apps_discovery_failed", "C:\\Users\\secret"),
            "details_omitted"
        );
        assert_eq!(
            safe_detail("runtime_error", "token-secret"),
            "details_omitted"
        );
    }

    #[test]
    fn summary_counts_only_allowlisted_event_names() {
        let old_raw = "1\tpanic\tmessage=token-secret\n2\tcustom\tprivate-path\n3\tfrontend_vue_error\tdetails_omitted\n";
        let counts = event_counts(old_raw);
        assert_eq!(counts.get("panic"), Some(&1));
        assert_eq!(counts.get("frontend_vue_error"), Some(&1));
        assert_eq!(counts.len(), 2);
        assert!(safe_event_id("private\ttoken-secret").is_none());
    }
}

pub fn log_file_path() -> Option<PathBuf> {
    log_root().map(|root| root.join("logs").join(LOG_FILE_NAME))
}

fn log_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        return std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .map(|path| path.join(LOG_DIR_NAME));
    }

    #[cfg(target_os = "macos")]
    {
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join("Library").join("Logs").join(LOG_DIR_NAME));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if let Some(path) = std::env::var_os("XDG_STATE_HOME") {
            return Some(PathBuf::from(path).join(LOG_DIR_NAME));
        }
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join(".local").join("state").join(LOG_DIR_NAME));
    }

    #[allow(unreachable_code)]
    Some(std::env::temp_dir().join("flexikit"))
}

fn rotate_if_needed() {
    let Some(path) = log_file_path() else {
        return;
    };
    let Ok(metadata) = fs::metadata(&path) else {
        return;
    };
    if metadata.len() < MAX_LOG_BYTES {
        return;
    }

    for index in (1..=MAX_BACKUPS).rev() {
        let destination = path.with_file_name(format!("{LOG_FILE_NAME}.{index}"));
        if index == MAX_BACKUPS {
            let _ = fs::remove_file(&destination);
        }
        let source = if index == 1 {
            path.clone()
        } else {
            path.with_file_name(format!("{LOG_FILE_NAME}.{}", index - 1))
        };
        if source.exists() {
            let _ = fs::rename(source, destination);
        }
    }
}
