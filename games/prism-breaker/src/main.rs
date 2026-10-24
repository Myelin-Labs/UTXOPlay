mod game;
mod session;
use serde_json::{json, Value};
use session::{AnyResult, App};
use std::io::Read;
use std::{collections::HashMap, fs, path::PathBuf, time::Instant};
use tiny_http::{Header, Method, Response, Server};

fn main() -> AnyResult<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("verify") {
        let path = args.get(2).ok_or("Usage: game verify evidence.json")?;
        if fs::metadata(path)?.len() > 32 * 1024 * 1024 {
            return Err("Export exceeds 32 MiB".into());
        }
        println!("{}", serde_json::to_string_pretty(&session::verify_export(&serde_json::from_slice(&fs::read(path)?)?)?)?);
        return Ok(());
    }
    if args.get(1).map(String::as_str) == Some("simulate") {
        let input: Value = serde_json::from_reader(std::io::stdin())?;
        let kind: game::Kind = serde_json::from_value(input["kind"].clone())?;
        let mut g = game::Game::new(kind);
        if let Some(actions) = input["actions"].as_array() {
            for action in actions {
                g.apply(action)?;
            }
        } else {
            for v in input["inputs"].as_array().ok_or("Missing inputs")? {
                let i = v.as_u64().filter(|i| *i <= 31).ok_or("Invalid input")?;
                g.step(i as u8);
            }
        }
        println!("{}", g.view());
        return Ok(());
    }
    let port = std::env::var("PORT").ok().map(|s| s.parse::<u16>()).transpose()?.unwrap_or(game::PORT);
    let bind = std::env::var("BIND").unwrap_or_else(|_| "127.0.0.1".into());
    let dir = PathBuf::from(std::env::var("DATA_DIR").unwrap_or_else(|_| "data".into()));
    let token = std::env::var("RUNTIME_TOKEN").map_err(|_| "RUNTIME_TOKEN is required")?;
    if token.len() < 32 {
        return Err("RUNTIME_TOKEN is too short".into());
    }
    let mut sessions: HashMap<String, (App, Instant)> = HashMap::new();
    let server = Server::http((bind.as_str(), port))?;
    println!("{} ready on {bind}:{port}", game::ID);
    for mut req in server.incoming_requests() {
        let authorized = req.headers().iter().any(|h| h.field.equiv("X-Runtime-Token") && h.value.as_str() == token);
        if !authorized {
            let _ = req.respond(Response::from_string("Forbidden").with_status_code(403));
            continue;
        }
        let account = req
            .headers()
            .iter()
            .find(|h| h.field.equiv("X-UTXOPlay-Account"))
            .map(|h| h.value.as_str().to_owned())
            .unwrap_or_default();
        if account.len() != 64 || !account.bytes().all(|c| c.is_ascii_hexdigit()) {
            let _ = req.respond(Response::from_string("Invalid account").with_status_code(400));
            continue;
        }
        let full_path = req.url().split('?').next().unwrap_or("/").to_owned();
        let mut parts = full_path.trim_start_matches('/').splitn(2, '/');
        let kind = match game::Kind::parse(parts.next().unwrap_or("")) {
            Ok(k) => k,
            Err(_) => {
                let _ = req.respond(Response::from_string("Unknown arcade game").with_status_code(404));
                continue;
            }
        };
        let path = format!("/{}", parts.next().unwrap_or(""));
        let account = format!("{}-{}", account.to_ascii_lowercase(), kind.id());
        let result: AnyResult<Value> = (|| {
            sessions.retain(|_, (_, last)| last.elapsed().as_secs() < 120);
            if !sessions.contains_key(&account) {
                if sessions.len() >= 6 {
                    if let Some(oldest) = sessions.iter().min_by_key(|(_, (_, t))| *t).map(|(k, _)| k.clone()) {
                        sessions.remove(&oldest);
                    }
                }
                sessions.insert(account.clone(), (App::open(&dir.join(&account), kind)?, Instant::now()));
            }
            let (app, last) = sessions.get_mut(&account).ok_or("Session unavailable")?;
            *last = Instant::now();
            match (req.method(), path.as_str()) {
                (&Method::Get, "/api/state") => app.view(),
                (&Method::Get, "/api/export") => app.export(),
                (&Method::Post, "/api/new") => app.new_game(),
                (&Method::Post, "/api/replay") => app.replay(),
                (&Method::Post, "/api/action") => {
                    let mut bytes = vec![];
                    std::io::Read::take(req.as_reader(), 4097).read_to_end(&mut bytes)?;
                    if bytes.len() > 4096 {
                        return Err("Request too large".into());
                    }
                    app.action(serde_json::from_slice(&bytes)?)
                }
                _ => Err("Unknown endpoint".into()),
            }
        })();
        let (value, status) = match result {
            Ok(v) => (v, 200),
            Err(e) => (json!({"error":e.to_string()}), 400),
        };
        let mut response = Response::from_data(serde_json::to_vec(&value)?).with_status_code(status);
        response.add_header(Header::from_bytes("Content-Type", "application/json").unwrap());
        response.add_header(Header::from_bytes("Cache-Control", "no-store").unwrap());
        let _ = req.respond(response);
    }
    Ok(())
}
