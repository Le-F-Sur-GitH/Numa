use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use reqwest::Client;

// --- NOUVELLES STRUCTURES ---
#[derive(Serialize, Deserialize, Clone, Debug)]
struct Message {
    role: String,
    content: String,
    timestamp: u64,
    is_alert: bool,
    mood_score: Option<i32>, // NOUVEAU: La note du psy sur ce message (1-10)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct PatientData {
    last_login: u64,
    messages: Vec<Message>,
    crisis_mode: bool,
}

// OLLAMA
#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
struct OllamaMessage { role: String, content: String }
#[derive(Deserialize, Debug)]
struct OllamaResponse { message: OllamaMessage }

// --- PROMPT CLINIQUE AVANCÉ ---
// L'astuce : On force l'IA à commencer sa réponse par un tag technique [MOOD:X]
const SYSTEM_PROMPT: &str = "
Tu es Numa, psychologue expert.
Règles strictes :
1. Analyse l'humeur de l'utilisateur sur une échelle de 1 (Détresse extrême) à 10 (Bonheur total).
2. COMMENCE TA RÉPONSE par ce tag : [MOOD:note] (exemple: [MOOD:4] si l'utilisateur est triste).
3. Ensuite, écris ta réponse empathique et courte.
4. Si suicide/danger : Mets [MOOD:1] et dis 'Urgence détectée'.
";

// --- UTILITAIRES ---
fn get_data_path(app: &tauri::AppHandle) -> PathBuf {
    let path = app.path().app_data_dir().unwrap();
    if !path.exists() { let _ = fs::create_dir_all(&path); }
    path
}
fn get_current_time() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() }

fn analyze_risk(content: &str) -> bool {
    ["suicide", "mourir", "tuer", "pendre", "overdose"].iter().any(|&t| content.to_lowercase().contains(t))
}

// --- COMMANDES ---

#[tauri::command]
fn load_profile(app: tauri::AppHandle) -> PatientData {
    let file_path = get_data_path(&app).join("numa_medical_v2.json"); // Nouveau fichier v2
    if file_path.exists() {
        let content = fs::read_to_string(file_path).unwrap_or_default();
        return serde_json::from_str(&content).unwrap_or(PatientData {
            last_login: get_current_time(), messages: vec![], crisis_mode: false,
        });
    }
    PatientData { last_login: get_current_time(), messages: vec![], crisis_mode: false }
}

#[tauri::command]
fn save_message_local(app: tauri::AppHandle, content: String, role: String, mood: Option<i32>) -> PatientData {
    let mut data = load_profile(app.clone());
    let is_risk = if role == "user" { analyze_risk(&content) } else { false };
    if is_risk { data.crisis_mode = true; }
    
    data.messages.push(Message { role, content, timestamp: get_current_time(), is_alert: is_risk, mood_score: mood });
    
    let json = serde_json::to_string_pretty(&data).unwrap();
    let _ = fs::write(get_data_path(&app).join("numa_medical_v2.json"), json);
    data
}

#[tauri::command]
async fn ask_ai_brain(app: tauri::AppHandle, user_input: String) -> Result<String, String> {
    let data = load_profile(app.clone());
    let mut messages_for_ai = Vec::new();
    
    messages_for_ai.push(OllamaMessage { role: "system".to_string(), content: SYSTEM_PROMPT.to_string() });
    
    // Contexte (6 derniers messages)
    let start = if data.messages.len() > 6 { data.messages.len() - 6 } else { 0 };
    for msg in &data.messages[start..] {
        let role = if msg.role == "ai" { "assistant" } else { "user" };
        messages_for_ai.push(OllamaMessage { role: role.to_string(), content: msg.content.clone() });
    }
    // Ajout input actuel si pas présent
    if data.messages.last().map(|m| m.content != user_input).unwrap_or(true) {
        messages_for_ai.push(OllamaMessage { role: "user".to_string(), content: user_input });
    }

    let client = Client::new();
    let res = client.post("http://localhost:11434/api/chat")
        .json(&OllamaRequest { model: "mistral".to_string(), messages: messages_for_ai, stream: false })
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let response_json: OllamaResponse = res.json().await.map_err(|e| e.to_string())?;
        Ok(response_json.message.content)
    } else {
        Ok("[MOOD:5] Je réfléchis...".to_string())
    }
}

// (Garder les autres fonctions disable_crisis_mode, save_secret, read_secret ici...)
#[tauri::command]
fn disable_crisis_mode(app: tauri::AppHandle) -> PatientData {
    let mut data = load_profile(app.clone());
    data.crisis_mode = false;
    let _ = fs::write(get_data_path(&app).join("numa_medical_v2.json"), serde_json::to_string_pretty(&data).unwrap());
    data
}
#[tauri::command]
fn save_secret(app: tauri::AppHandle, content: String) -> Result<String, String> {
    fs::write(get_data_path(&app).join("numa_journal.enc"), content).map_err(|e| e.to_string())?;
    Ok("Sauvegardé".to_string())
}
#[tauri::command]
fn read_secret(app: tauri::AppHandle) -> Result<String, String> {
    let p = get_data_path(&app).join("numa_journal.enc");
    if !p.exists() { return Ok("".to_string()); }
    fs::read_to_string(p).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_profile, save_message_local, ask_ai_brain, disable_crisis_mode, save_secret, read_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}