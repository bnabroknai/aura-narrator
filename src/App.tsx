import React, { useState } from 'react';
import { extractStoryText, generateNarration, generateAmbientMusic } from './lib/gemini';
import { mixAudio } from './lib/audio';
import { Play, FileText, Music, Sparkles, CheckCircle2, AlertCircle, UploadCloud, Download, Mic2, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Warm & Clear)' },
  { id: 'Puck', name: 'Puck (Playful & High)' },
  { id: 'Charon', name: 'Charon (Deep & Gritty)' },
  { id: 'Kore', name: 'Kore (Clear & Neutral)' },
  { id: 'Fenrir', name: 'Fenrir (Gruff & Intense)' },
];

const PERSONALITIES = [
  { id: 'Classic', name: 'Classic Storyteller (Original Text)' },
  { id: 'Calm and Soothing Whisperer', name: 'Bedtime Whisperer (Calm & Soothing)' },
  { id: 'Highly Animated and Enthusiastic Childrens Entertainer', name: 'Enthusiastic Entertainer (Excited)' },
  { id: 'Grumpy but endearing Pirate from the high seas', name: 'Grumpy Pirate (Ocean Slang)' },
  { id: 'Spooky, mysterious Ghost in a haunted mansion', name: 'Spooky Ghost (Suspenseful)' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [voice, setVoice] = useState('Zephyr');
  const [personality, setPersonality] = useState('Classic');
  
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasLyriaKey, setHasLyriaKey] = useState(false);

  // Poll for Lyria Key selection
  useState(() => {
    async function checkKey() {
      if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
        setHasLyriaKey(true);
      }
    }
    checkKey();
  });

  const handleSelectLyriaKey = async () => {
    try {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        setHasLyriaKey(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setDownloadUrl(null);
    }
  };

  const handleRun = async () => {
    if (!file) return;
    
    setError(null);
    setDownloadUrl(null);
    setIsProcessing(true);
    
    try {
      setStatus(`Reading ${file.name}...`);
      const arrayBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(arrayBuffer);

      setStatus(`Extracting story & rewriting to ${PERSONALITIES.find(p => p.id === personality)?.name}...`);
      const storyText = await extractStoryText(fileBytes, file.type, personality);
      
      if (!storyText || storyText.length < 50) {
        throw new Error("Could not extract a meaningful story from the document.");
      }

      setStatus(`Generating narration with ${voice}...`);
      const voiceChunks = await generateNarration(storyText, voice);
      if (voiceChunks.length === 0) throw new Error("Failed to generate voice audio.");

      setStatus('Composing ambient background music (Lyria)...');
      // If Lyria is available and selected, it generates music, otherwise returns null safely
      const ambientMusic = hasLyriaKey ? await generateAmbientMusic(storyText) : null;

      setStatus('Mixing 3D spatial audio layers...');
      const finalAudioBlob = await mixAudio(voiceChunks, ambientMusic);

      setStatus('Preparing final audio file...');
      const url = URL.createObjectURL(finalAudioBlob);
      setDownloadUrl(url);
      setStatus('Complete!');

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during extraction or audio generation.');
      setStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans selection:bg-purple-500/30 overflow-x-hidden">
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16 flex flex-col justify-center">
        
        <div className="flex items-center gap-3 mb-12">
          <div className="p-3 bg-purple-500/20 rounded-2xl">
            <Sparkles className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              Aura Narrate
            </h1>
            <p className="text-slate-400 font-medium tracking-wide text-sm mt-1 uppercase">Immersive Spatial Storybooks</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
          
          <div className="flex flex-col gap-8 relative z-10">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Upload Storybook (PDF or Text)</label>
              <div className="relative group">
                <input 
                  type="file" 
                  accept="application/pdf, text/plain"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center justify-center transition-all ${file ? 'border-purple-500/50 bg-purple-500/10' : 'border-slate-700 bg-slate-950 group-hover:border-slate-500'}`}>
                  {file ? (
                    <>
                      <FileText className="w-8 h-8 text-purple-400 mb-2" />
                      <span className="text-purple-200 font-medium">{file.name}</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 text-slate-500 mb-2 group-hover:text-slate-400 transition-colors" />
                      <span className="text-slate-400 font-medium">Click or drag file to upload</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Voice Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-purple-400" /> Target Voice
                </label>
                <select 
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm appearance-none cursor-pointer"
                >
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              {/* Personality Selector */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-400" /> Narrator Personality
                </label>
                <select 
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm appearance-none cursor-pointer"
                >
                  {PERSONALITIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            {!hasLyriaKey && (
              <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-xl flex items-start gap-3">
                <Music className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-200">Ambient Music (Lyria)</h3>
                  <p className="text-xs text-blue-300/80 mt-1 mb-3 leading-relaxed">
                    Google restricts DeepMind's Lyria to developers with a 'pay-as-you-go' developer key (this is separate from a consumer Gemini Advanced subscription). If you don't select one, the app will still generate the spatial narration voice perfectly using the built-in free AI Studio connection!
                  </p>
                  <button onClick={handleSelectLyriaKey} className="text-xs font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5">
                    Select Developer Billing Key
                  </button>
                </div>
              </div>
            )}

            <button 
              onClick={handleRun} 
              disabled={isProcessing || !file}
              className="mt-2 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 group"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Crafting Experience...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Narrate Storybook</span>
                </>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {status && !error && !downloadUrl && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
               className="mt-8 flex items-center gap-4 text-purple-300 bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl"
             >
               <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin shrink-0"></div>
               <span className="font-medium animate-pulse">{status}</span>
             </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-8 flex items-start gap-4 text-red-300 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed font-medium">{error}</p>
            </motion.div>
          )}

          {downloadUrl && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
               className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex flex-col items-center text-center gap-4 shadow-2xl relative overflow-hidden"
             >
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] rounded-full mix-blend-screen pointer-events-none"></div>
               
               <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
               <h2 className="text-2xl font-bold text-emerald-300">Narration Complete!</h2>
               <p className="text-emerald-200/80 max-w-sm mb-2">Your spatial audio narration is ready.</p>
               
               <a 
                 href={downloadUrl} 
                 download={file ? `${file.name.replace(/\.[^/.]+$/, "")} - (${PERSONALITIES.find(p => p.id === personality)?.name.split(' ')[0]}).wav` : 'Audio Narration.wav'}
                 className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25"
               >
                 <Download className="w-5 h-5" />
                 Download Audio (.wav)
               </a>
             </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
