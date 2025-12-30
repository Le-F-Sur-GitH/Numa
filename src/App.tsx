import { useState, useEffect, useRef } from "react";
import { 
  Heart, Book, MessageCircle, Activity, 
  BarChart2, Sun, Send, ShieldAlert, X, Wind, Mic, Volume2, VolumeX, Loader2
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";

// --- HOOK VOCAL (Microphone) ---
const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Navigateur non compatible vocal."); return; }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  return { isListening, transcript, startListening, resetTranscript: () => setTranscript("") };
};

// --- COMPOSANT MEDICAL : PROTOCOLE D'URGENCE ---
const CrisisOverlay = ({ onDismiss }: { onDismiss: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999] bg-red-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center">
    <ShieldAlert size={80} className="text-red-500 mb-6 animate-pulse" />
    <h2 className="text-3xl font-bold text-white mb-4">Urgence Détectée</h2>
    <p className="text-red-200 mb-8 max-w-md">Contenu à haut risque identifié.</p>
    <div className="space-y-4 w-full max-w-sm">
      <button className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl shadow-lg">Appeler le 112</button>
      <button onClick={onDismiss} className="w-full border border-red-500/30 text-red-300 py-3 rounded-xl mt-8">Désactiver l'alerte</button>
    </div>
  </motion.div>
);

const BreathWork = ({ onClose }: { onClose: () => void }) => { /* ... Code BreathWork identique à avant ... */ 
  const [step, setStep] = useState("Inspirer");
  useEffect(() => {
    const run = () => {
      setStep("Inspirer"); setTimeout(() => setStep("Bloquer"), 4000); setTimeout(() => setStep("Expirer"), 6000); setTimeout(() => setStep("Attendre"), 10000);
    };
    run(); const i = setInterval(run, 10000); return () => clearInterval(i);
  }, []);
  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="fixed inset-0 z-50 bg-numa-bg flex flex-col items-center justify-center">
      <button onClick={onClose} className="absolute top-8 right-8 text-white/50"><X size={32}/></button>
      <h2 className="text-2xl font-light mb-12 tracking-widest text-indigo-200">COHÉRENCE</h2>
      <motion.div animate={{ scale: [1, 1.5, 1.5, 1] }} transition={{ duration: 10, repeat: Infinity, times: [0, 0.4, 0.6, 1] }} className="w-48 h-48 bg-teal-500/20 rounded-full flex items-center justify-center border border-teal-500/50">
        <span className="text-2xl font-bold text-white">{step}</span>
      </motion.div>
    </motion.div>
  );
};

// --- CHAT CLINIQUE (AUDIO + DATA) ---
const ClinicalChat = ({ setTool }: any) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  
  const { isListening, transcript, startListening, resetTranscript } = useSpeechRecognition();

  // Synchro Vocal -> Input
  useEffect(() => { if(transcript) { setInput(transcript); resetTranscript(); } }, [transcript]);

  const load = async () => {
    const data: any = await invoke('load_profile');
    setMessages(data.messages);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isThinking]);

  // Fonction pour parler (TTS)
  const speak = (text: string) => {
    if (!voiceEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1.1; // Un peu plus dynamique
    window.speechSynthesis.speak(utterance);
  };

  const send = async () => {
    if (!input.trim() || isThinking) return;
    const txt = input; setInput("");
    
    // 1. Save User (sans mood)
    const dataUser: any = await invoke('save_message_local', { content: txt, role: 'user', mood: null });
    setMessages(dataUser.messages);
    if (dataUser.crisis_mode) return;

    setIsThinking(true);
    try {
      // 2. Appel IA
      const rawResponse: string = await invoke('ask_ai_brain', { userInput: txt });
      
      // 3. Extraction de la Data [MOOD:X]
      let cleanResponse = rawResponse;
      let detectedMood = null;
      const moodMatch = rawResponse.match(/\[MOOD:(\d+)\]/);
      
      if (moodMatch) {
        detectedMood = parseInt(moodMatch[1]);
        cleanResponse = rawResponse.replace(/\[MOOD:\d+\]/, "").trim(); // On nettoie le tag pour l'affichage
      }

      // 4. Save AI (avec le mood détecté !)
      const dataAi: any = await invoke('save_message_local', { content: cleanResponse, role: 'ai', mood: detectedMood });
      setMessages(dataAi.messages);
      
      // 5. Vocalisation
      speak(cleanResponse);

      // Suggestions
      if (cleanResponse.toLowerCase().includes("respiration")) { /* suggestion logic */ }

    } catch (e) {
      await invoke('save_message_local', { content: "Erreur connexion.", role: 'system', mood: null });
    } finally { setIsThinking(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
       {/* Toolbar */}
       <div className="bg-white/5 p-2 flex justify-between items-center px-4">
         <span className="text-[10px] uppercase text-indigo-400 font-bold tracking-widest">Session Sécurisée</span>
         <button onClick={() => setVoiceEnabled(!voiceEnabled)} className="text-indigo-300 hover:text-white">
           {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
         </button>
       </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
              m.role === 'user' ? 'bg-numa-primary text-white rounded-tr-none' : 'bg-numa-surface text-numa-text rounded-tl-none border border-white/5'
            }`}>
              {m.content}
            </div>
            {/* Debug Mood affiché discrètement pour prouver que ça marche */}
            {m.mood_score && <span className="text-[9px] text-white/20 mt-1">Analyse Humeur: {m.mood_score}/10</span>}
          </div>
        ))}
        {isThinking && <div className="flex items-center gap-2 text-xs text-indigo-300 p-2"><Loader2 size={14} className="animate-spin"/> Analyse...</div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 bg-numa-surface/80 border-t border-white/5 flex gap-2 items-center">
        <button onClick={startListening} className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-white/10 text-indigo-300 hover:bg-white/20'}`}>
          <Mic size={20} />
        </button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} className="flex-1 bg-numa-bg border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:border-numa-primary outline-none" placeholder="Parlez ou écrivez..." />
        <button onClick={send} disabled={isThinking} className="p-2 bg-numa-secondary rounded-full text-white disabled:opacity-50"><Send size={18} /></button>
      </div>
    </div>
  );
};

// --- APP ROOT ---
export default function App() {
  const [page, setPage] = useState('home');
  const [crisisMode, setCrisisMode] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [moodHistory, setMoodHistory] = useState<number[]>([]);

  // Polling : Récupère les données médicales réelles
  useEffect(() => {
    const i = setInterval(async () => {
      try {
        const data: any = await invoke('load_profile');
        if (data.crisis_mode && !crisisMode) setCrisisMode(true);
        
        // Extraction des scores d'humeur pour le graphique
        const moods = data.messages
          .filter((m: any) => m.mood_score !== null)
          .map((m: any) => m.mood_score)
          .slice(-7); // Les 7 derniers points
        setMoodHistory(moods.length > 0 ? moods : [5, 5, 5]); // Valeurs par défaut si vide
        
      } catch(e) {}
    }, 2000);
    return () => clearInterval(i);
  }, [crisisMode]);

  return (
    <div className="h-screen w-screen bg-numa-bg text-numa-text flex flex-col font-sans overflow-hidden select-none">
      <AnimatePresence>
        {crisisMode && <CrisisOverlay onDismiss={async () => { await invoke('disable_crisis_mode'); setCrisisMode(false); }} />}
        {activeTool === 'breath' && <BreathWork onClose={() => setActiveTool(null)} />}
      </AnimatePresence>

      <header className="h-16 px-6 flex items-center justify-between bg-numa-bg/90 backdrop-blur-md border-b border-white/5 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg shadow-lg"></div>
          <span className="font-bold text-lg tracking-tight">NUMA <span className="text-[10px] text-indigo-400 font-normal ml-1">CLINICAL</span></span>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {page === 'home' && (
          <div className="p-6 space-y-6 overflow-y-auto h-full">
            <h1 className="text-2xl font-light text-white">Espace Thérapeutique</h1>
            
            <div onClick={() => setPage('chat')} className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden cursor-pointer">
               <div className="relative z-10 flex justify-between items-start">
                 <div>
                   <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-4"><MessageCircle /></div>
                   <h3 className="text-xl font-bold">Séance Vocale</h3>
                   <p className="text-white/70 text-sm mt-1">L'IA vous écoute et vous répond.</p>
                 </div>
                 <Mic className="text-white/20 w-16 h-16 absolute right-0 top-0" />
               </div>
            </div>

            <div className="bg-white/5 rounded-3xl p-5 border border-white/5">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-bold text-indigo-200 flex items-center gap-2"><Activity size={16}/> Analyse Humeur (Réel)</h3>
                 <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">Basé sur vos mots</span>
               </div>
               {/* GRAPHIQUE DYNAMIQUE */}
               <div className="flex gap-2 h-32 items-end justify-between px-2 bg-black/20 rounded-xl p-2">
                 {moodHistory.map((score, i) => (
                   <div key={i} className="flex-1 flex flex-col justify-end gap-1 group relative">
                     <div 
                        style={{height: `${score * 10}%`}} 
                        className={`w-full rounded-t-sm transition-all duration-500 ${score < 4 ? 'bg-red-400' : score < 7 ? 'bg-indigo-400' : 'bg-teal-400'}`}
                     ></div>
                     <span className="text-[9px] text-center text-white/30">{score}</span>
                   </div>
                 ))}
                 {moodHistory.length === 0 && <span className="text-xs text-white/20 w-full text-center self-center">En attente de données...</span>}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setActiveTool('breath')} className="bg-teal-900/20 border border-teal-500/20 p-4 rounded-2xl hover:bg-teal-900/40 text-left">
                <Wind className="text-teal-400 mb-3" /><div className="font-bold text-teal-100">Respiration</div>
              </button>
              <button onClick={() => setPage('journal')} className="bg-numa-surface/50 border border-white/5 p-4 rounded-2xl hover:bg-numa-surface text-left">
                <Book className="text-indigo-400 mb-3" /><div className="font-bold">Journal</div>
              </button>
            </div>
          </div>
        )}
        {page === 'chat' && <ClinicalChat setTool={setActiveTool} />}
        {page === 'journal' && <div className="h-full p-4 flex flex-col"><h2 className="text-xl font-bold mb-4">Journal</h2><textarea className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 resize-none outline-none focus:border-indigo-500" placeholder="Notes..." /></div>}
      </main>

      <nav className="h-20 bg-numa-bg/95 border-t border-white/5 grid grid-cols-4 items-center px-4 shrink-0 pb-2">
        <button onClick={() => setPage('home')} className={`flex flex-col items-center gap-1 ${page === 'home' ? 'text-indigo-400' : 'text-slate-500'}`}><Sun size={24}/><span className="text-[10px]">Accueil</span></button>
        <button onClick={() => setPage('chat')} className={`flex flex-col items-center gap-1 ${page === 'chat' ? 'text-indigo-400' : 'text-slate-500'}`}><MessageCircle size={24}/><span className="text-[10px]">Séance</span></button>
        <button onClick={() => setPage('stats')} className={`flex flex-col items-center gap-1 ${page === 'stats' ? 'text-indigo-400' : 'text-slate-500'}`}><BarChart2 size={24}/><span className="text-[10px]">Progrès</span></button>
        <button onClick={() => setPage('settings')} className={`flex flex-col items-center gap-1 ${page === 'settings' ? 'text-indigo-400' : 'text-slate-500'}`}><Heart size={24}/><span className="text-[10px]">Santé</span></button>
      </nav>
    </div>
  );
}