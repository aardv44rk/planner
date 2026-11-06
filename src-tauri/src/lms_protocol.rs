use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    ops::RangeInclusive,
    path::{Path, PathBuf},
};
use tauri::{http, AppHandle};

/// Evaluates MIME content-type based on file extension.
pub fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/mp4",
        "wav" => "audio/wav",
        "txt" => "text/plain; charset=utf-8",
        "md" => "text/markdown; charset=utf-8",
        "html" | "htm" => "text/html; charset=utf-8",
        "json" => "application/json",
        "csv" => "text/csv; charset=utf-8",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

/// Parses an HTTP `Range: bytes=start-end` header.
fn parse_range(
    value: Option<&http::HeaderValue>,
    size: u64,
) -> Result<Option<RangeInclusive<u64>>, ()> {
    let Some(value) = value.and_then(|v| v.to_str().ok()) else {
        return Ok(None);
    };
    let raw = value.strip_prefix("bytes=").ok_or(())?;
    if raw.contains(',') || size == 0 {
        return Err(());
    }
    let (start_str, end_str) = raw.split_once('-').ok_or(())?;
    let range = if start_str.is_empty() {
        let suffix = end_str.parse::<u64>().map_err(|_| ())?;
        if suffix == 0 {
            return Err(());
        }
        size.saturating_sub(suffix)..=size - 1
    } else {
        let start = start_str.parse::<u64>().map_err(|_| ())?;
        let end = if end_str.is_empty() {
            size - 1
        } else {
            end_str.parse::<u64>().map_err(|_| ())?.min(size - 1)
        };
        if start > end || start >= size {
            return Err(());
        }
        start..=end
    };
    Ok(Some(range))
}

fn build_cors_response(status: http::StatusCode, content_type: &str) -> http::response::Builder {
    http::Response::builder()
        .status(status)
        .header(http::header::CONTENT_TYPE, content_type)
        .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(http::header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
        .header(http::header::ACCESS_CONTROL_ALLOW_HEADERS, "Range, Content-Type")
        .header(http::header::CACHE_CONTROL, "private, max-age=3600")
}

/// Serves a local disk file with byte-range streaming for PDF/video/audio assets.
pub fn serve_file(path: &Path, range_hdr: Option<&http::HeaderValue>) -> http::Response<Vec<u8>> {
    let mut file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => {
            return build_cors_response(http::StatusCode::NOT_FOUND, "text/plain")
                .body(b"File not found".to_vec())
                .unwrap_or_else(|_| http::Response::new(Vec::new()));
        }
    };

    let metadata = match file.metadata() {
        Ok(m) => m,
        Err(_) => {
            return build_cors_response(http::StatusCode::INTERNAL_SERVER_ERROR, "text/plain")
                .body(b"Failed to read file metadata".to_vec())
                .unwrap_or_else(|_| http::Response::new(Vec::new()));
        }
    };

    let size = metadata.len();
    let requested_range = match parse_range(range_hdr, size) {
        Ok(r) => r,
        Err(_) => {
            return http::Response::builder()
                .status(http::StatusCode::RANGE_NOT_SATISFIABLE)
                .header(http::header::CONTENT_RANGE, format!("bytes */{size}"))
                .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(Vec::new())
                .unwrap_or_else(|_| http::Response::new(Vec::new()));
        }
    };

    let (offset, length) = requested_range.as_ref().map_or((0, size), |range| {
        (*range.start(), range.end() - range.start() + 1)
    });

    let alloc_len = match usize::try_from(length) {
        Ok(l) => l,
        Err(_) => {
            return build_cors_response(http::StatusCode::PAYLOAD_TOO_LARGE, "text/plain")
                .body(b"Requested range exceeds platform memory capacity".to_vec())
                .unwrap_or_else(|_| http::Response::new(Vec::new()));
        }
    };

    let mut buffer = vec![0u8; alloc_len];
    if file.seek(SeekFrom::Start(offset)).is_err() || file.read_exact(&mut buffer).is_err() {
        return build_cors_response(http::StatusCode::INTERNAL_SERVER_ERROR, "text/plain")
            .body(b"Failed to stream byte range from storage".to_vec())
            .unwrap_or_else(|_| http::Response::new(Vec::new()));
    }

    let (status, content_range) = match requested_range {
        Some(range) => (
            http::StatusCode::PARTIAL_CONTENT,
            Some(format!("bytes {}-{}/{}", range.start(), range.end(), size)),
        ),
        None => (http::StatusCode::OK, None),
    };

    let mut builder = build_cors_response(status, mime_type_for_path(path))
        .header(http::header::CONTENT_LENGTH, buffer.len().to_string())
        .header(http::header::ACCEPT_RANGES, "bytes");

    if let Some(range_val) = content_range {
        builder = builder.header(http::header::CONTENT_RANGE, range_val);
    }

    builder
        .body(buffer)
        .unwrap_or_else(|_| http::Response::new(Vec::new()))
}

/// Asynchronous protocol handler for `lms://` custom URI scheme.
/// Handles `OPTIONS` preflight, resolves `?path=...` parameters, and streams content.
pub async fn handle(
    _app: AppHandle,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    // Respond immediately to CORS preflight requests
    if request.method() == http::Method::OPTIONS {
        return build_cors_response(http::StatusCode::NO_CONTENT, "text/plain")
            .body(Vec::new())
            .unwrap_or_else(|_| http::Response::new(Vec::new()));
    }

    let query = request.uri().query().unwrap_or("");
    let parsed_query = url::form_urlencoded::parse(query.as_bytes())
        .collect::<std::collections::HashMap<_, _>>();

    let target_path_str = match parsed_query.get("path") {
        Some(p) => p.to_string(),
        None => {
            return build_cors_response(http::StatusCode::BAD_REQUEST, "text/plain")
                .body(b"Missing required ?path= parameter".to_vec())
                .unwrap_or_else(|_| http::Response::new(Vec::new()));
        }
    };

    let file_path = PathBuf::from(&target_path_str);
    if !file_path.exists() || !file_path.is_file() {
        return build_cors_response(http::StatusCode::NOT_FOUND, "text/plain")
            .body(format!("File does not exist: {}", target_path_str).into_bytes())
            .unwrap_or_else(|_| http::Response::new(Vec::new()));
    }

    let range_header = request.headers().get(http::header::RANGE).cloned();

    // Perform disk I/O in a blocking thread to avoid blocking Tokio async runtime
    tauri::async_runtime::spawn_blocking(move || {
        serve_file(&file_path, range_header.as_ref())
    })
    .await
    .unwrap_or_else(|_| {
        build_cors_response(http::StatusCode::INTERNAL_SERVER_ERROR, "text/plain")
            .body(b"Asynchronous disk read thread failure".to_vec())
            .unwrap_or_else(|_| http::Response::new(Vec::new()))
    })
}
