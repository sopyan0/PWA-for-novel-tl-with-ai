
import React, { useState, useEffect, Dispatch, SetStateAction } from 'react'; 
import { AppSettings, SavedTranslation, EditorContext } from '../types'; 
import { translateTextStream } from '../services/llmService';
import { LANGUAGES } from '../constants';
import { saveTranslationToDB, getTranslationsByProjectId } from '../utils/storage';

interface TranslationInterfaceProps {
  settings: AppSettings;
  onUpdateSettings: Dispatch<SetStateAction<AppSettings>>;
  onContextUpdate: Dispatch<SetStateAction<EditorContext>>; 
}

const TranslationInterface: React.FC<TranslationInterfaceProps> = ({ settings, onUpdateSettings, onContextUpdate }) => {
  const activeProject = settings.projects.find(p => p.id === settings.activeProjectId) || settings.projects[0];

  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [tempInstruction, setTempInstruction] = useState(activeProject.translationInstruction);
  
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const hasApiKey = !!(settings.apiKeys[settings.activeProvider] && settings.apiKeys[settings.activeProvider].length > 5);

  useEffect(() => {
    setTempInstruction(activeProject.translationInstruction);
  }, [activeProject.id, activeProject.translationInstruction]);

  useEffect(() => {
    const handler = setTimeout(() => {
        onContextUpdate({
            sourceText: inputText,
            translatedText: outputText
        });
    }, 1000); 

    return () => {
        clearTimeout(handler);
    };
  }, [inputText, outputText, onContextUpdate]);

  const updateProjectLanguage = (type: 'source' | 'target', value: string) => {
    onUpdateSettings(prev => ({
        ...prev,
        projects: prev.projects.map(p => 
            p.id === activeProject.id 
            ? { ...p, [type === 'source' ? 'sourceLanguage' : 'targetLanguage']: value } 
            : p
        )
    }));
  };

  const handleSwapLanguages = () => {
    const currentSource = activeProject.sourceLanguage;
    const currentTarget = activeProject.targetLanguage;
    if (currentSource.includes('Deteksi')) return;

    onUpdateSettings(prev => ({
        ...prev,
        projects: prev.projects.map(p => 
            p.id === activeProject.id 
            ? { ...p, sourceLanguage: currentTarget, targetLanguage: currentSource } 
            : p
        )
    }));
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setOutputText(''); 
    
    const runTimeProject = { ...activeProject, translationInstruction: tempInstruction };
    
    const runTimeSettings: AppSettings = {
        ...settings,
        sourceLanguage: runTimeProject.sourceLanguage,
        targetLanguage: runTimeProject.targetLanguage,
        translationInstruction: runTimeProject.translationInstruction,
        glossary: runTimeProject.glossary
    };

    try {
      const { result, detectedLanguage } = await translateTextStream(
          inputText, 
          runTimeSettings, 
          (chunk) => {
              setOutputText(prev => prev + chunk);
          }
      );

      if (activeProject.sourceLanguage.includes('Deteksi') && detectedLanguage) {
          const matchedLang = LANGUAGES.find(l => l.toLowerCase() === detectedLanguage.toLowerCase());
          if (matchedLang) {
             updateProjectLanguage('source', matchedLang);
          }
      }
      
      setOutputText(result);

    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTranslation = async () => {
    if (!outputText.trim()) return;
    setIsSaving(true);
    
    let count = 1;
    try {
        const existing = await getTranslationsByProjectId(activeProject.id);
        count = existing.length + 1;
    } catch (e) {}

    const newTranslation: SavedTranslation = {
      id: crypto.randomUUID(),
      projectId: activeProject.id,
      name: `Bab ${count}`,
      translatedText: outputText,
      timestamp: new Date().toISOString(),
    };
    
    try {
        await saveTranslationToDB(newTranslation);
        setTimeout(() => setIsSaving(false), 1000);
    } catch (e) {
        setError("Gagal menyimpan ke database.");
        setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NovTL_${activeProject.name.replace(/\s+/g, '_')}.txt`;
    link.click();
  };

  const saveQuickApiKey = () => {
      onUpdateSettings(prev => ({
          ...prev,
          apiKeys: { ...prev.apiKeys, [settings.activeProvider]: tempApiKey }
      }));
      setShowApiKeyInput(false);
      setTempApiKey('');
  };

  const getCharCount = () => inputText.length;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* --- PREMIUM TOOLBAR --- */}
      <div className="glass-card p-3 md:p-4 rounded-3xl z-30 flex flex-col md:flex-row gap-4 items-center justify-between transition-all duration-300">
        
        {/* Language Pill */}
        <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-2xl border border-white/40 shadow-inner-light w-full md:w-auto overflow-x-auto">
           <div className="relative group flex-grow md:flex-grow-0 min-w-[120px]">
              <select 
                value={activeProject.sourceLanguage}
                onChange={(e) => updateProjectLanguage('source', e.target.value)}
                aria-label="Bahasa Sumber"
                className="w-full md:w-40 appearance-none bg-transparent hover:bg-white pl-4 pr-8 py-2.5 rounded-xl text-sm font-semibold text-charcoal outline-none cursor-pointer transition-colors focus:bg-white"
              >
                {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
           </div>
           
           <button 
             onClick={handleSwapLanguages}
             aria-label="Tukar Bahasa"
             className="p-2 rounded-xl text-subtle hover:text-accent hover:bg-white shadow-sm transition-all flex-shrink-0"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
           </button>

           <div className="relative group flex-grow md:flex-grow-0 min-w-[120px]">
              <select 
                value={activeProject.targetLanguage}
                onChange={(e) => updateProjectLanguage('target', e.target.value)}
                aria-label="Bahasa Target"
                className="w-full md:w-40 appearance-none bg-white pl-4 pr-8 py-2.5 rounded-xl text-sm font-bold text-accent shadow-sm outline-none cursor-pointer transition-transform hover:scale-105"
              >
                {LANGUAGES.filter(l => !l.includes('Deteksi')).map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
           </div>
        </div>

        {/* Action Pills */}
        <div className="flex gap-2 w-full md:w-auto justify-end">
            <button 
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                className={`text-xs font-bold tracking-wide transition flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-2xl border shadow-sm ${
                    !hasApiKey 
                    ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' 
                    : showApiKeyInput 
                        ? 'bg-charcoal text-paper border-charcoal' 
                        : 'bg-white text-subtle border-white hover:border-gray-200 hover:text-charcoal'
                }`}
            >
                {!hasApiKey ? '⚠️ API' : '🔑 API'}
            </button>
            
            <button 
                onClick={() => setShowPromptInput(!showPromptInput)}
                className={`text-xs font-bold tracking-wide transition flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-2xl border shadow-sm ${showPromptInput ? 'bg-accent text-white border-accent' : 'bg-white text-accent border-white hover:border-accent/20'}`}
            >
                ✨ <span className="hidden sm:inline">Instruksi</span>
            </button>
        </div>
      </div>

      {/* --- DROPDOWN PANELS --- */}
      {showApiKeyInput && (
        <div className="glass p-6 rounded-3xl animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-bold text-subtle uppercase tracking-widest">Kunci API ({settings.activeProvider})</label>
            </div>
            <div className="flex gap-3">
                 <input 
                    type="password" 
                    placeholder="Tempel API Key di sini..." 
                    aria-label="Input API Key"
                    className="flex-grow p-4 rounded-2xl bg-white/80 border border-transparent focus:border-accent/30 focus:bg-white focus:shadow-glow outline-none text-sm transition-all w-full"
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                />
                <button 
                    onClick={saveQuickApiKey}
                    className="bg-charcoal text-white px-6 md:px-8 py-3 rounded-2xl text-sm font-bold hover:bg-black shadow-lg hover:shadow-xl transition-all"
                >
                    Simpan
                </button>
            </div>
        </div>
      )}

      {(showPromptInput || (!activeProject.translationInstruction && showPromptInput)) && (
        <div className="bg-gradient-to-r from-[#FFFBF0] to-[#FFF5E6] p-6 rounded-3xl border border-orange-100/50 animate-in slide-in-from-top-2 shadow-soft">
            <label className="text-[10px] font-bold text-orange-800/80 uppercase tracking-widest block mb-3">Instruksi / Gaya Bahasa</label>
            <textarea
                value={tempInstruction}
                onChange={(e) => setTempInstruction(e.target.value)}
                className="w-full bg-white/60 p-4 rounded-2xl border border-orange-100 text-charcoal text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange-200/50 font-serif leading-relaxed shadow-inner-light"
                rows={2}
                aria-label="Instruksi Terjemahan"
                placeholder="Contoh: Gunakan gaya bahasa novel fantasi klasik, istilah kultivasi harus akurat..."
            />
        </div>
      )}

      {/* --- EDITOR CANVAS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* INPUT */}
        <div className="flex flex-col h-full relative group">
          <div className="absolute -top-3 left-6 z-10 pointer-events-none">
               <span className="text-[10px] font-bold text-gray-600 bg-paper px-3 py-1 uppercase tracking-widest border border-gray-100 rounded-md shadow-sm">
                  Sumber
               </span>
          </div>
          <textarea
            className="w-full h-[400px] md:h-[500px] lg:h-[600px] p-6 md:p-8 rounded-[2rem] border-none bg-white shadow-soft focus:shadow-glow outline-none transition-all resize-none text-base md:text-lg font-serif leading-loose placeholder:text-gray-300 custom-scrollbar text-charcoal"
            placeholder="Tempel bab novel di sini..."
            aria-label="Editor Teks Sumber"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="absolute bottom-6 right-6 text-[10px] font-bold text-gray-400 pointer-events-none bg-white/80 px-2 py-1 rounded-lg backdrop-blur">
             {getCharCount().toLocaleString()} chars
          </div>
          
          {inputText && (
              <button onClick={() => { setInputText(''); setOutputText(''); }} className="absolute top-6 right-6 text-gray-300 hover:text-red-400 transition-colors z-10" aria-label="Bersihkan teks">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          )}
        </div>

        {/* OUTPUT */}
        <div className="flex flex-col h-full relative">
            <div className="absolute -top-3 left-6 z-10 pointer-events-none">
               <span className="text-[10px] font-bold text-accent bg-paper px-3 py-1 uppercase tracking-widest border border-gray-100 rounded-md shadow-sm">
                  Terjemahan
               </span>
            </div>

            <div 
              className={`w-full h-[400px] md:h-[500px] lg:h-[600px] p-6 md:p-8 rounded-[2rem] border-none bg-white shadow-soft overflow-y-auto custom-scrollbar relative transition-all duration-500
                ${isLoading && !outputText ? 'opacity-90' : 'opacity-100'} 
                ${outputText && !isLoading ? 'cursor-pointer hover:shadow-glow' : ''}`}
              onClick={() => { if (outputText && !isLoading) setIsFullScreen(true); }}
              role="region"
              aria-label="Hasil Terjemahan"
              tabIndex={0}
            >
              {isLoading && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-gray-50 overflow-hidden rounded-t-[2rem]">
                      <div className="h-full bg-accent animate-progress origin-left"></div>
                  </div>
              )}

              {outputText ? (
                <article className="prose prose-stone prose-lg max-w-none font-serif leading-loose text-charcoal text-justify select-none md:pointer-events-auto">
                  {outputText.split('\n').map((para, i) => (
                    para.trim() ? <p key={i} className="mb-4">{para}</p> : <br key={i}/>
                  ))}
                  {isLoading && <span className="inline-block w-2 h-5 bg-accent ml-1 animate-pulse align-middle"></span>}
                </article>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="text-5xl animate-bounce filter drop-shadow-lg">🍡</div>
                  <p className="text-sm font-serif italic text-subtle animate-pulse tracking-wide">Sedang meracik kata-kata...</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 font-serif italic text-center p-4">
                  <span className="text-6xl mb-6 opacity-20">📖</span>
                  <span className="text-lg">Hasil terjemahan akan muncul di sini.</span>
                </div>
              )}
            </div>
            
            {outputText && !isLoading && (
              <button 
                onClick={() => setIsFullScreen(true)}
                aria-label="Baca Mode Fokus"
                className="absolute bottom-8 right-8 p-4 bg-charcoal text-white rounded-2xl shadow-xl hover:bg-black hover:scale-105 transition-all flex items-center gap-2 z-10 group"
              >
                <span className="text-xs font-bold hidden sm:inline tracking-widest group-hover:pr-2 transition-all">BACA MODE FOKUS</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-800 px-6 md:px-8 py-5 rounded-2xl border border-red-100 font-medium text-sm flex items-center gap-3 animate-in slide-in-from-bottom-2 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {/* --- INTEGRATED ACTION BAR (STICKY FOOTER) --- */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 transition-all">
         <div className="max-w-4xl mx-auto flex items-center gap-4">
             <div className="hidden md:flex flex-col text-xs text-subtle font-serif">
                <span>Mode: {settings.activeProvider}</span>
                <span>{isLoading ? 'Sedang mengetik...' : 'Siap menerjemahkan'}</span>
             </div>

             <div className="flex-grow flex gap-3">
                <button
                disabled={isLoading || !inputText.trim()}
                onClick={handleTranslate}
                className="flex-grow py-3.5 md:py-4 bg-charcoal text-white font-serif font-bold tracking-widest text-sm rounded-xl shadow-lg hover:bg-black hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                >
                {isLoading ? 'BERHENTI' : 'TERJEMAHKAN'}
                </button>
                <button
                disabled={isLoading || !outputText.trim()}
                onClick={handleSaveTranslation}
                className={`px-6 md:px-8 py-3.5 md:py-4 bg-paper text-charcoal font-bold text-sm rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 shadow-soft border border-gray-200 ${isSaving ? 'bg-green-100 text-green-700' : ''}`}
                >
                {isSaving ? 'TERSIMPAN!' : 'SIMPAN'}
                </button>
            </div>
         </div>
      </div>

      {/* READER MODE FULLSCREEN */}
      {isFullScreen && (
        <div className="fixed inset-0 z-[100] bg-paper animate-in slide-in-from-bottom duration-500 overflow-y-auto">
          <div className="max-w-3xl mx-auto min-h-screen bg-[#FDFCF8] shadow-2xl my-0 md:my-12 p-8 md:p-20 border-x border-gray-100 relative">
            
            {/* Toolbar */}
            <div className="fixed top-0 right-0 p-6 flex gap-4 w-full justify-end z-10 pointer-events-none mix-blend-multiply">
              <div className="pointer-events-auto flex gap-3">
                <button onClick={handleDownload} aria-label="Download File" className="p-4 bg-paper text-charcoal rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
                <button onClick={() => setIsFullScreen(false)} aria-label="Tutup Mode Fokus" className="p-4 bg-charcoal text-white rounded-full hover:bg-black shadow-lg transition-transform hover:scale-110" title="Tutup">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
              </div>
            </div>

            <div className="mt-12 mb-20 text-center">
                <span className="text-xs font-bold tracking-[0.3em] text-accent uppercase mb-4 block">Bab Baru</span>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-charcoal mb-6 leading-tight">
                    {activeProject.name}
                </h1>
                <div className="w-16 h-1 bg-accent mx-auto rounded-full"></div>
            </div>

            <article className="prose prose-stone prose-xl max-w-none font-serif leading-loose text-charcoal text-justify">
               {outputText.split('\n').map((para, i) => (
                    para.trim() ? <p key={i} className="mb-6 indent-8">{para}</p> : null
                  ))}
            </article>

            <div className="mt-32 text-center border-t border-gray-100 pt-12 text-gray-400 font-serif italic text-sm">
                ***
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.5); }
          100% { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default TranslationInterface;
