
import React, { useState, Dispatch, SetStateAction } from 'react';
import { AppSettings, GlossaryItem, NovelProject } from '../types';
import { LANGUAGES, LLM_PROVIDERS } from '../constants'; 
import ConfirmDialog from './ConfirmDialog'; 

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: Dispatch<SetStateAction<AppSettings>>;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onUpdateSettings }) => {
  const [newWord, setNewWord] = useState('');
  const [newTrans, setNewTrans] = useState('');
  
  // State untuk pencarian glosarium
  const [glossarySearchTerm, setGlossarySearchTerm] = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isConfirmDeleteProjectOpen, setIsConfirmDeleteProjectOpen] = useState(false);

  const [isConfirmDeleteGlossaryOpen, setIsConfirmDeleteGlossaryOpen] = useState(false);
  const [glossaryItemToDeleteId, setGlossaryItemToDeleteId] = useState<string | null>(null);
  const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);

  const activeProject = settings.projects.find(p => p.id === settings.activeProjectId) || settings.projects[0];
  
  const updateActiveProject = (updates: Partial<NovelProject>) => {
    onUpdateSettings(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === activeProject.id ? { ...p, ...updates } : p)
    }));
  };

  const updateGlobalSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onUpdateSettings(prevSettings => ({ ...prevSettings, [key]: value }));
  };

  const updateApiKey = (provider: string, key: string) => {
    onUpdateSettings(prevSettings => ({
      ...prevSettings,
      apiKeys: { ...prevSettings.apiKeys, [provider]: key }
    }));
  };

  const handleCreateProject = () => {
    if(newProjectName) { 
        const id = crypto.randomUUID();
        const newProject: NovelProject = { 
            ...activeProject, 
            id, 
            name: newProjectName, 
            glossary: [] 
        };
        onUpdateSettings(prev => ({
            ...prev,
            activeProjectId: id,
            projects: [...prev.projects, newProject]
        }));
        setNewProjectName('');
        setIsCreatingProject(false); 
    }
  };

  const handleDeleteProject = () => {
      if (settings.projects.length <= 1) {
          alert("Minimal harus ada satu proyek!");
          setIsConfirmDeleteProjectOpen(false);
          return;
      }
      onUpdateSettings(prev => {
          const remainingProjects = prev.projects.filter(p => p.id !== activeProject.id);
          return {
              ...prev,
              projects: remainingProjects,
              activeProjectId: remainingProjects[0].id 
          };
      });
      setIsConfirmDeleteProjectOpen(false);
  };

  const addGlossaryItem = (original: string, translated: string) => {
    // Cek duplikat manual di UI
    const exists = activeProject.glossary.some(g => g.original.toLowerCase() === original.toLowerCase().trim());
    if (exists) {
        alert(`Kata "${original}" sudah ada di glosarium! Hapus dulu jika ingin mengubahnya.`);
        return;
    }

    const newItem: GlossaryItem = {
      id: crypto.randomUUID(),
      original: original.trim(),
      translated: translated.trim(),
      sourceLanguage: activeProject.sourceLanguage, 
    };
    updateActiveProject({ glossary: [...activeProject.glossary, newItem] });
  };

  const toggleSelect = (id: string) => {
      setSelectedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === activeProject.glossary.length && activeProject.glossary.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(activeProject.glossary.map(i => i.id)));
      }
  };

  const performBulkDelete = () => {
      updateActiveProject({ 
          glossary: activeProject.glossary.filter(item => !selectedIds.has(item.id)) 
      });
      setSelectedIds(new Set());
      setIsConfirmBulkDeleteOpen(false);
  };

  const handleSingleDelete = () => {
      if (glossaryItemToDeleteId) {
          updateActiveProject({ 
              glossary: activeProject.glossary.filter(item => item.id !== glossaryItemToDeleteId) 
          });
          setSelectedIds(prev => {
              const next = new Set(prev);
              next.delete(glossaryItemToDeleteId);
              return next;
          });
          setGlossaryItemToDeleteId(null);
      }
      setIsConfirmDeleteGlossaryOpen(false);
  };

  // Filter glossary based on search term
  const filteredGlossary = activeProject.glossary.filter(item => 
    item.original.toLowerCase().includes(glossarySearchTerm.toLowerCase()) || 
    item.translated.toLowerCase().includes(glossarySearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full overflow-hidden">
      
      {/* 1. PROJECT SELECTOR */}
      <section className="glass p-6 md:p-8 rounded-3xl shadow-soft relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-charcoal"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10 mb-6">
            <div className="w-full">
                <h2 className="text-xl md:text-2xl font-serif font-bold flex items-center gap-2 text-charcoal">
                   📂 Manajemen Proyek
                </h2>
                <p className="text-subtle text-xs mt-1 tracking-wide">Pilih atau buat novel baru untuk memisahkan glosarium.</p>
            </div>
            {!isCreatingProject ? (
                <button onClick={() => setIsCreatingProject(true)} className="bg-charcoal hover:bg-black text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all w-full md:w-auto whitespace-nowrap">
                    + Buat Proyek
                </button>
            ) : (
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="Nama Novel..." 
                        aria-label="Nama Proyek Baru"
                        className="p-3 rounded-xl text-charcoal text-sm border-2 border-accent focus:outline-none w-full shadow-sm" 
                        value={newProjectName} 
                        onChange={e => setNewProjectName(e.target.value)} 
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={handleCreateProject} className="bg-accent px-5 py-3 rounded-xl text-white text-sm font-bold flex-1 shadow-glow hover:bg-accentHover">Simpan</button>
                        <button onClick={() => setIsCreatingProject(false)} className="bg-gray-200 text-charcoal px-5 py-3 rounded-xl text-sm font-bold flex-1 hover:bg-gray-300">Batal</button>
                    </div>
                </div>
            )}
        </div>

        <div className="relative z-10">
            <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative flex-grow w-full">
                    <select 
                        value={activeProject.id} 
                        onChange={(e) => updateGlobalSetting('activeProjectId', e.target.value)} 
                        aria-label="Pilih Proyek Aktif"
                        className="w-full p-4 pl-5 rounded-2xl bg-white/60 border border-gray-100 text-charcoal font-bold outline-none appearance-none cursor-pointer hover:bg-white focus:ring-2 focus:ring-accent/20 transition-all shadow-inner-light"
                    >
                        {settings.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-subtle" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </div>
                </div>
                
                {settings.projects.length > 1 && (
                    <button 
                        onClick={() => setIsConfirmDeleteProjectOpen(true)}
                        className="px-4 py-4 bg-white border border-red-100 text-red-400 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 transition-all text-sm flex-shrink-0 shadow-sm"
                        title="Hapus Proyek Ini"
                        aria-label="Hapus Proyek"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                )}
            </div>
        </div>
      </section>

      {/* 2. GLOSSARY SECTION */}
      <section className="glass-card p-6 md:p-8 rounded-3xl shadow-soft space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4">
            <div className="w-full">
                <h2 className="text-xl font-serif font-bold text-charcoal">📖 Glosarium / Kamus</h2>
                <p className="text-subtle text-xs mt-1">AI akan konsisten menggunakan istilah di bawah ini.</p>
            </div>
            {selectedIds.size > 0 && (
                <button 
                    onClick={() => setIsConfirmBulkDeleteOpen(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg animate-in fade-in slide-in-from-right-4 transition-all whitespace-nowrap"
                >
                    Hapus Terpilih ({selectedIds.size})
                </button>
            )}
        </div>
        
        {/* Add Input */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white/50 p-3 rounded-2xl border border-gray-100 shadow-inner-light">
          <input type="text" placeholder="Istilah Asli (e.g. Hyung)" aria-label="Input Istilah Asli" className="flex-grow p-3 rounded-xl bg-white border border-transparent text-sm focus:shadow-glow outline-none transition-all text-charcoal placeholder-gray-400" value={newWord} onChange={(e) => setNewWord(e.target.value)} />
          <span className="hidden sm:flex items-center text-subtle" aria-hidden="true">➜</span>
          <input type="text" placeholder="Terjemahan (e.g. Kakak)" aria-label="Input Terjemahan" className="flex-grow p-3 rounded-xl bg-white border border-transparent text-sm focus:shadow-glow outline-none transition-all text-charcoal placeholder-gray-400" value={newTrans} onChange={(e) => setNewTrans(e.target.value)} />
          <button onClick={() => { if(newWord && newTrans) { addGlossaryItem(newWord, newTrans); setNewWord(''); setNewTrans(''); }}} className="bg-charcoal text-white px-6 py-3 rounded-xl font-bold hover:bg-accent hover:shadow-glow transition-all shadow-md whitespace-nowrap">+ Tambah</button>
        </div>

        {/* Search Bar & List Controls */}
        <div className="flex items-center gap-3 pt-2">
             <div className="relative flex-grow">
                <input 
                    type="text" 
                    placeholder="Cari kata di glosarium..." 
                    value={glossarySearchTerm}
                    onChange={(e) => setGlossarySearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/70 border border-gray-100 rounded-xl text-sm text-charcoal focus:outline-none focus:bg-white transition-colors"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
        </div>

        {/* List */}
        <div className="space-y-2">
            {activeProject.glossary.length > 0 && !glossarySearchTerm && (
                <div className="flex items-center gap-3 p-2 px-3">
                    <input 
                        type="checkbox" 
                        aria-label="Pilih Semua Glosarium"
                        checked={selectedIds.size === activeProject.glossary.length && activeProject.glossary.length > 0} 
                        onChange={toggleSelectAll} 
                        className="w-4 h-4 rounded text-accent focus:ring-accent cursor-pointer" 
                    />
                    <span className="text-[10px] font-bold text-subtle uppercase tracking-widest">Pilih Semua ({activeProject.glossary.length})</span>
                </div>
            )}
            
            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[150px]">
                {activeProject.glossary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-3xl text-center">
                        <span className="text-4xl mb-3 opacity-20 grayscale">📝</span>
                        <p className="text-subtle font-serif italic text-sm">Belum ada istilah khusus.</p>
                        <p className="text-gray-400 text-xs mt-1">Tambahkan nama tokoh, jurus, atau tempat agar konsisten.</p>
                    </div>
                ) : filteredGlossary.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm italic">
                        Tidak ditemukan kata "{glossarySearchTerm}"
                    </div>
                ) : (
                    filteredGlossary.map(item => (
                        <div key={item.id} className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${selectedIds.has(item.id) ? 'bg-indigo-50/50 border-accent/20 shadow-inner' : 'bg-white/80 border-transparent hover:bg-white hover:shadow-sm'}`}>
                            <div className="pt-1">
                                <input 
                                    type="checkbox" 
                                    aria-label={`Pilih ${item.original}`}
                                    checked={selectedIds.has(item.id)} 
                                    onChange={() => toggleSelect(item.id)} 
                                    className="w-4 h-4 rounded text-accent focus:ring-accent cursor-pointer" 
                                />
                            </div>
                            <div className="flex-grow flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-serif text-charcoal text-sm md:text-base break-all">
                                <span className="font-medium text-gray-500">{item.original}</span>
                                <span className="text-subtle hidden sm:inline" aria-hidden="true">&rarr;</span>
                                <span className="font-bold text-charcoal bg-gray-100 px-2 py-0.5 rounded w-fit">{item.translated}</span>
                            </div>
                            <button 
                                onClick={() => { setGlossaryItemToDeleteId(item.id); setIsConfirmDeleteGlossaryOpen(true); }} 
                                aria-label={`Hapus ${item.original}`}
                                className="text-subtle hover:text-red-500 transition-colors pt-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
      </section>

      {/* 3. SETTINGS GLOBAL */}
      <section className="glass-card p-6 md:p-8 rounded-3xl shadow-soft space-y-6">
        <h2 className="text-lg font-serif font-bold text-gray-400 border-b border-gray-100 pb-2">⚙️ Pengaturan Sistem</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-subtle uppercase tracking-widest" htmlFor="provider-select">Provider AI</label>
                <div className="relative">
                    <select 
                      id="provider-select"
                      value={settings.activeProvider} 
                      onChange={(e) => updateGlobalSetting('activeProvider', e.target.value)} 
                      className="w-full p-4 rounded-2xl border-none bg-white/50 text-sm focus:shadow-glow outline-none appearance-none cursor-pointer text-charcoal shadow-inner-light"
                    >
                        {LLM_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-subtle uppercase tracking-widest">Global API Key</label>
                <input 
                  type="password" 
                  placeholder="Key Default (Opsional)" 
                  aria-label="Global API Key"
                  value={settings.apiKeys[settings.activeProvider] || ''} 
                  onChange={(e) => updateApiKey(settings.activeProvider, e.target.value)} 
                  className="w-full p-4 rounded-2xl border-none bg-white/50 text-sm font-mono focus:shadow-glow outline-none shadow-inner-light text-charcoal placeholder-gray-400" 
                />
            </div>
        </div>
      </section>

      {/* Confirmation Dialogs */}
      <ConfirmDialog isOpen={isConfirmDeleteGlossaryOpen} onClose={() => setIsConfirmDeleteGlossaryOpen(false)} onConfirm={handleSingleDelete} title="Hapus Istilah?" message="Hapus kata ini dari glosarium proyek Anda?" isDestructive={true} />
      <ConfirmDialog isOpen={isConfirmBulkDeleteOpen} onClose={() => setIsConfirmBulkDeleteOpen(false)} onConfirm={performBulkDelete} title={`Hapus ${selectedIds.size} Item?`} message={`Apakah Kakak yakin ingin menghapus ${selectedIds.size} istilah yang dipilih sekaligus dari glosarium?`} isDestructive={true} />
      <ConfirmDialog isOpen={isConfirmDeleteProjectOpen} onClose={() => setIsConfirmDeleteProjectOpen(false)} onConfirm={handleDeleteProject} title="Hapus Proyek Ini?" message={`PERINGATAN: Menghapus proyek "${activeProject.name}" juga akan menghapus SEMUA glosarium dan riwayat terjemahan di dalamnya.`} confirmText='Hapus Permanen' isDestructive={true} />
    </div>
  );
};

export default SettingsPage;
