
import React, { useState, useRef, useEffect, Dispatch, SetStateAction } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppSettings, ChatMessage, EditorContext } from '../types';
import { chatWithAssistant } from '../services/llmService';
import ConfirmDialog from './ConfirmDialog';
import { getTranslationsByProjectId } from '../utils/storage';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: Dispatch<SetStateAction<AppSettings>>;
  activeEditorContext: EditorContext; 
}

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ isOpen, onClose, settings, onUpdateSettings, activeEditorContext }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [readingStatus, setReadingStatus] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [settings.assistantChat, isOpen, isTyping, readingStatus]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'; 
    }
  }, [input]);

  const processAIRequest = async (userText: string, isSystemMemoryInjection: boolean = false) => {
    if (!userText.trim()) return;
    setIsTyping(true);

    const activeProject = settings.projects.find(p => p.id === settings.activeProjectId) || settings.projects[0];
    const runTimeSettings: AppSettings = {
        ...settings,
        sourceLanguage: activeProject.sourceLanguage,
        targetLanguage: activeProject.targetLanguage,
        translationInstruction: activeProject.translationInstruction,
        glossary: activeProject.glossary
    };

    try {
      let currentChatHistory = [...settings.assistantChat];
      if (isSystemMemoryInjection) {
          const memoryMsg: ChatMessage = { role: 'user', text: userText, isHidden: true };
          currentChatHistory = [...currentChatHistory, memoryMsg];
          onUpdateSettings(prev => ({ ...prev, assistantChat: currentChatHistory }));
      } else {
          const userMsg: ChatMessage = { role: 'user', text: userText, isHidden: false };
          currentChatHistory = [...currentChatHistory, userMsg];
          onUpdateSettings(prev => ({ ...prev, assistantChat: currentChatHistory }));
      }

      const updatedSettingsForRequest = { ...runTimeSettings, assistantChat: currentChatHistory };
      const result = await chatWithAssistant(userText, updatedSettingsForRequest, activeEditorContext);
      
      if (result.type === 'CLEAR_CHAT') {
          onUpdateSettings(prev => ({
              ...prev,
              assistantChat: [{ role: 'model', text: result.message }]
          }));
          setIsTyping(false);
          return;
      }

      onUpdateSettings(prev => {
        let newSettings = { ...prev };
        newSettings.assistantChat = [...prev.assistantChat, { role: 'model', text: result.message }];
        
        // --- LOGIC TAMBAH GLOSARIUM ---
        if (result.type === 'ADD_GLOSSARY' && result.payload) {
          let rawItems: any[] = [];
          if (Array.isArray(result.payload)) {
              rawItems = result.payload;
          } else if (typeof result.payload === 'object') {
              // @ts-ignore
              rawItems = result.payload.items || [result.payload];
          }

          const targetProjectId = prev.activeProjectId;
          const projectIndex = prev.projects.findIndex(p => p.id === targetProjectId);
          
          if (projectIndex !== -1) {
              const currentProject = prev.projects[projectIndex];
              const sourceLang = currentProject.sourceLanguage || 'Auto';
              const existingOrigins = new Set(currentProject.glossary.map(g => g.original.toLowerCase().trim()));

              // Item yang lolos seleksi (belum ada)
              const newItems = rawItems
                .map((item: any) => ({
                    id: crypto.randomUUID(), 
                    original: (item.original || item.Original || item.term || item.source || item.OriginalTerm || "").trim(),
                    translated: (item.translated || item.Translated || item.translation || item.target || item.TargetTerm || "").trim(),
                    sourceLanguage: sourceLang
                }))
                .filter((item: any) => {
                    const isValid = item.original && item.translated;
                    const isNew = !existingOrigins.has(item.original.toLowerCase());
                    return isValid && isNew;
                });

              // Item yang ditolak (duplikat)
              const duplicates = rawItems.filter((item: any) => {
                  const original = (item.original || item.Original || item.term || "").trim();
                  return existingOrigins.has(original.toLowerCase());
              });

              let msgAppend = "";
              if (newItems.length > 0) {
                  const updatedProjects = [...prev.projects];
                  updatedProjects[projectIndex] = {
                      ...currentProject,
                      glossary: [...(currentProject.glossary || []), ...newItems]
                  };
                  newSettings.projects = updatedProjects;
                  msgAppend += `\n\n*(Sistem: Sukses menyimpan ${newItems.length} item baru.)*`;
              } 
              
              if (duplicates.length > 0) {
                  msgAppend += `\n\n⚠️ **Peringatan:** Item berikut GAGAL ditambahkan karena **sudah ada** di glosarium:\n` +
                               duplicates.map((d: any) => `- ${d.original || d.term}`).join('\n') +
                               `\n\n*Hapus dulu item tersebut dari Settings jika ingin mengubah artinya, atau minta saya menghapusnya.*`;
              }

              if (newItems.length === 0 && duplicates.length === 0) {
                  msgAppend += `\n\n*(Sistem: Tidak ada data valid yang diterima.)*`;
              }

              newSettings.assistantChat[newSettings.assistantChat.length - 1].text += msgAppend;
          }
        }
        
        // --- LOGIC HAPUS GLOSARIUM ---
        if (result.type === 'REMOVE_GLOSSARY' && result.payload) {
             const targetProjectId = prev.activeProjectId;
             const projectIndex = prev.projects.findIndex(p => p.id === targetProjectId);
             
             if (projectIndex !== -1) {
                 const currentProject = prev.projects[projectIndex];
                 const toRemove = new Set((result.payload as string[]).map(s => s.toLowerCase().trim()));
                 
                 const initialCount = currentProject.glossary.length;
                 const newGlossary = currentProject.glossary.filter(g => !toRemove.has(g.original.toLowerCase().trim()));
                 const deletedCount = initialCount - newGlossary.length;

                 const updatedProjects = [...prev.projects];
                 updatedProjects[projectIndex] = { ...currentProject, glossary: newGlossary };
                 newSettings.projects = updatedProjects;

                 newSettings.assistantChat[newSettings.assistantChat.length - 1].text += `\n\n*(Sistem: Berhasil menghapus ${deletedCount} item dari glosarium.)*`;
             }
        }

        return newSettings;
      });

      if (result.type === 'READ_SAVED_TRANSLATION') {
          const chapterName = result.payload;
          setReadingStatus(`Membaca isi "${chapterName}"...`);
          
          // FETCH FROM DB HERE
          const savedTranslations = await getTranslationsByProjectId(settings.activeProjectId);

          const savedItem = savedTranslations.find(t => 
              t.name.toLowerCase().includes(chapterName.toLowerCase()) || 
              chapterName.toLowerCase().includes(t.name.toLowerCase())
          );

          if (savedItem) {
              const memoryInjection = `(Sistem: Ini adalah data file "${savedItem.name}". Simpan isinya di ingatanmu.
              === ISI FILE: ${savedItem.name} ===
              ${savedItem.translatedText}
              ===================================`;
              setTimeout(() => { setReadingStatus(null); processAIRequest(memoryInjection, true); }, 500);
          } else {
              setReadingStatus(null);
              onUpdateSettings(prev => ({
                  ...prev,
                  assistantChat: [...prev.assistantChat, { role: 'model', text: `Waduh, Danggo cari "${chapterName}" di koleksi nggak ketemu nih. Coba cek lagi namanya ya, Kak.` }]
              }));
              setIsTyping(false);
          }
      } else {
        setIsTyping(false);
        setReadingStatus(null);
      }

    } catch (error: any) {
      onUpdateSettings(prev => ({
        ...prev,
        assistantChat: [...prev.assistantChat, { role: 'model', text: `Maaf error sistem: ${error.message}` }]
      }));
      setIsTyping(false);
      setReadingStatus(null);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;
    const text = input;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; 
    processAIRequest(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const performClearChat = () => {
    onUpdateSettings(prev => ({ ...prev, assistantChat: [] }));
    setIsConfirmClearOpen(false);
  };

  return (
    <>
      {/* Overlay: Rendered but hidden via opacity/pointer-events when closed to allow transition */}
      <div 
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
        aria-hidden="true"
      />
      
      <aside 
        aria-label="Danggo Assistant"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-full md:w-[450px] bg-paper shadow-2xl z-[70] transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full invisible'}`}
      >
        
        {/* Header */}
        <div className="p-5 bg-white/80 backdrop-blur-md border-b border-gray-100 flex justify-between items-center shadow-sm z-10 sticky top-0">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-charcoal rounded-2xl flex items-center justify-center text-white font-serif font-bold shadow-lg text-2xl">🍡</div>
                <div>
                    <h3 className="font-bold text-charcoal font-serif text-lg">Danggo Asisten</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <p className="text-[10px] text-subtle uppercase tracking-widest font-bold">Online</p>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setIsConfirmClearOpen(true)} className="p-3 text-subtle hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Hapus Chat" aria-label="Hapus Riwayat Chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
                <button onClick={onClose} className="p-3 text-subtle hover:text-charcoal hover:bg-gray-100 rounded-xl transition-all" title="Tutup" aria-label="Tutup Chat">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[#FDFCF8] scroll-smooth">
            {settings.assistantChat.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                    <span className="text-7xl mb-6 grayscale">🍡</span>
                    <p className="font-serif italic text-lg text-gray-400">Halo! Ada yang bisa Danggo bantu?</p>
                </div>
            )}
            
            {settings.assistantChat
                .filter(msg => !msg.isHidden)
                .map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[88%] md:max-w-[85%] rounded-3xl p-4 shadow-sm text-sm md:text-base leading-loose ${
                        msg.role === 'user' 
                        ? 'bg-charcoal text-white rounded-br-sm shadow-xl' 
                        : 'bg-white border border-gray-100 text-charcoal rounded-bl-sm shadow-soft'
                    }`}>
                        {msg.role === 'user' 
                            ? <p className="whitespace-pre-wrap font-sans tracking-wide">{msg.text}</p> 
                            : <div className="prose prose-sm md:prose-base prose-stone max-w-none break-words font-serif"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                        }
                    </div>
                </div>
            ))}
            
            {isTyping && (
                <div className="flex justify-start items-center gap-3 animate-in fade-in">
                    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none p-4 shadow-sm flex gap-1.5 items-center">
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce delay-150"></div>
                        <span className="text-xs text-subtle ml-2 font-medium tracking-wide">Mengetik...</span>
                    </div>
                </div>
            )}
             {readingStatus && (
                 <div className="flex justify-center my-4">
                     <span className="text-xs font-bold text-accent bg-indigo-50 px-4 py-1.5 rounded-full animate-pulse border border-accent/20 tracking-widest uppercase">
                        📖 {readingStatus}
                     </span>
                 </div>
            )}
            <div ref={chatEndRef} className="h-4" />
        </div>
        
        {/* Input Area */}
        <div className="p-4 bg-white/50 border-t border-gray-100 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
            <div className="flex items-end gap-3 bg-white p-2 rounded-[2rem] border-none shadow-soft focus-within:shadow-glow transition-all">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ketik pesan..."
                    aria-label="Pesan Chat"
                    disabled={isTyping}
                    rows={1}
                    className="flex-grow bg-transparent border-none focus:ring-0 text-charcoal text-sm md:text-base placeholder:text-gray-400 resize-none max-h-[150px] overflow-y-auto py-3 px-4 custom-scrollbar"
                />
                <button 
                    onClick={() => handleSubmit()} 
                    disabled={!input.trim() || isTyping} 
                    aria-label="Kirim Pesan"
                    className="p-3 bg-accent text-white rounded-full shadow-lg hover:bg-accentHover disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none transition-all active:scale-95 flex-shrink-0 mb-1 mr-1"
                >
                    {isTyping ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    )}
                </button>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-3 font-serif italic">
                Powered by <span className="font-bold">{settings.activeProvider}</span>
            </p>
        </div>
      </aside>
      <ConfirmDialog isOpen={isConfirmClearOpen} onClose={() => setIsConfirmClearOpen(false)} onConfirm={performClearChat} title="Hapus Chat?" message="Hapus histori chat ini?" isDestructive={true} />
    </>
  );
};

export default AIChatDrawer;
