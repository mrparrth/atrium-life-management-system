use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::Emitter;

fn send_http_response(stream: &mut std::net::TcpStream, body: &str) {
  let response = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{}",
    body.as_bytes().len(),
    body
  );
  let _ = stream.write_all(response.as_bytes());
  let _ = stream.flush();
}

#[tauri::command]
fn start_native_oauth(app: tauri::AppHandle, client_id: String, scope: String) -> Result<(), String> {
  let listener = TcpListener::bind("127.0.0.1:3000")
    .or_else(|_| TcpListener::bind("127.0.0.1:0"))
    .map_err(|e| e.to_string())?;

  let port = listener.local_addr().map_err(|e| e.to_string())?.port();

  let redirect_uri = if port == 3000 {
    "http://localhost:3000".to_string()
  } else {
    format!("http://127.0.0.1:{}", port)
  };

  let auth_url = format!(
    "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=token&scope={}",
    urlencoding::encode(&client_id),
    urlencoding::encode(&redirect_uri),
    urlencoding::encode(&scope)
  );

  tauri_plugin_opener::open_url(&auth_url, None::<&str>)
    .map_err(|e| format!("Failed to open default browser: {}", e))?;

  std::thread::spawn(move || {
    for stream in listener.incoming() {
      let Ok(mut stream) = stream else { continue };
      let mut buffer = [0; 4096];
      let Ok(bytes_read) = stream.read(&mut buffer) else { continue };
      let request = String::from_utf8_lossy(&buffer[..bytes_read]);

      if request.contains("GET /token?") || request.contains("access_token=") {
        if let Some(token_val) = extract_param(&request, "access_token") {
          let _ = app.emit("oauth-token-received", token_val);

          let success_html = "<!DOCTYPE html><html style='width:100%;height:100%;margin:0;padding:0;background:#090d16;'><head><meta charset='UTF-8'><title>Atrium - Connected</title></head><body style='width:100%;height:100%;margin:0;padding:0;font-family:-apple-system,sans-serif;background:#090d16;color:#fff;display:flex;align-items:center;justify-content:center;'><div style='background:#131b2e;border:1px solid #1e293b;padding:2.5rem 3rem;border-radius:1.25rem;text-align:center;max-width:440px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);'><h1 style='color:#34d399;font-size:1.75rem;margin:0 0 0.5rem 0;'>&#10004; Connected to Atrium</h1><p style='color:#94a3b8;font-size:1rem;margin:0;'>Google Drive is successfully linked.<br>You can now close this browser tab.</p></div></body></html>";
          send_http_response(&mut stream, success_html);
          break;
        }
      }

      let landing_html = "<!DOCTYPE html><html><head><script>if(window.location.hash){window.location.href='/token?'+window.location.hash.substring(1);}</script></head><body style='background:#090d16;'></body></html>";
      send_http_response(&mut stream, landing_html);
    }
  });

  Ok(())
}

fn extract_param(req: &str, param: &str) -> Option<String> {
  let target = format!("{}=", param);
  if let Some(start) = req.find(&target) {
    let rest = &req[start + target.len()..];
    let end = rest.find('&').or_else(|| rest.find(' ')).or_else(|| rest.find('\r')).unwrap_or(rest.len());
    let val = &rest[..end];
    return Some(urlencoding::decode(val).unwrap_or_else(|_| val.into()).to_string());
  }
  None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![start_native_oauth])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
