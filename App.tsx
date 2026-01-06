
import React, { useState, useEffect } from 'react';
import { AppSettings, Page, EditorContext } from './types';
import { STORAGE_KEY, DEFAULT_SETTINGS } from './constants'; 
import Sidebar from './components/Sidebar';
import TranslationInterface from './components/TranslationInterface';
import SettingsPage from './components/SettingsPage';
import SavedTranslationsPage from './components/SavedTranslationsPage'; 
import AIChatDrawer from './components/AIChatDrawer'; 

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('translate');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isChatOpen, setIsChatOpen] = useState(false); 
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [activeEditorContext, setActiveEditorContext] = useState<EditorContext>({ sourceText: '', translatedText: '' });

  // 1. LOAD SETTINGS ONLY (Sync from LocalStorage)
  // Kita TIDAK LAGI memuat savedTranslations di sini. Itu tugas SavedTranslationsPage.
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            // Pastikan kita tidak menimpa state dengan data lama yang mungkin punya properti savedTranslations
            const { savedTranslations, ...cleanSettings } = parsed;
            setSettings({ ...DEFAULT_SETTINGS, ...cleanSettings });
        } catch (e) {
            console.error("Error parsing settings", e);
            setSettings(DEFAULT_SETTINGS);
        }
    }
  }, []);

  // 2. SAVE SETTINGS (To LocalStorage)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return (
    <div className="flex min-h-screen bg-paper text-charcoal font-sans selection:bg-accent/20">
      
      <Sidebar 
        currentPage={currentPage} 
        onNavigate={setCurrentPage} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main 
        role="main" 
        className={`flex-grow transition-all duration-300 pt-20 pb-32 md:py-12 px-4 md:px-8 
          ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} ml-0 w-full overflow-x-hidden`}
      >
        <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          {currentPage === 'translate' ? (
            <TranslationInterface 
              settings={settings} 
              onUpdateSettings={setSettings} 
              onContextUpdate={setActiveEditorContext} 
            />
          ) : currentPage === 'settings' ? (
            <SettingsPage settings={settings} onUpdateSettings={setSettings} />
          ) : (
            <SavedTranslationsPage settings={settings} onUpdateSettings={setSettings} />
          )}
        </div>
        
        <footer className="text-center text-subtle text-xs mt-20 py-8 font-serif tracking-widest opacity-50 hidden md:block">
            NOVTL STUDIO &bull; EST. 2024
        </footer>
      </main>

      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-28 md:bottom-8 right-4 md:right-8 p-4 bg-charcoal text-paper rounded-full shadow-2xl hover:bg-accent hover:scale-110 transition-all duration-300 z-50 group border border-white/10"
        title="Chat dengan Asisten NovTL"
      >
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-accentHover"></span>
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
        </svg>
      </button>

      <AIChatDrawer 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        settings={settings}
        onUpdateSettings={setSettings}
        activeEditorContext={activeEditorContext} 
      />
    </div>
  );
};

export default App;
