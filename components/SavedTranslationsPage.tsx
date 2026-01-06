
import React, { useState, Dispatch, SetStateAction, useMemo, useEffect, useCallback } from 'react';
import { AppSettings, SavedTranslation } from '../types';
import ConfirmDialog from './ConfirmDialog'; 
import { getTranslationsByProjectId, saveTranslationToDB, deleteTranslationFromDB, clearProjectTranslationsFromDB } from '../utils/storage';

interface SavedTranslationsPageProps {
  settings: AppSettings;
  onUpdateSettings: Dispatch<SetStateAction<AppSettings>>;
}

const ITEMS_PER_PAGE = 8;

const SavedTranslationsPage: React.FC<SavedTranslationsPageProps> = ({ settings, onUpdateSettings }) => {
  // Local State untuk menyimpan data hasil fetch dari DB
  const [localTranslations, setLocalTranslations] = useState<SavedTranslation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'a-z' | 'z-a'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const [isReadingFullScreen, setIsReadingFullScreen] = useState<boolean>(false); 
  const [currentReadingTranslation, setCurrentReadingTranslation] = useState<SavedTranslation | null>(null); 
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [tempContent, setTempContent] = useState('');

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [confirmDeleteTargetId, setConfirmDeleteTargetId] = useState<string | null>(null);
  const [isConfirmClearAllOpen, setIsConfirmClearAllOpen] = useState(false);

  const activeProjectId = settings.activeProjectId;
  const activeProject = settings.projects.find(p => p.id === activeProjectId);
  const projectName = activeProject ? activeProject.name : 'Unknown Project';

  // --- FETCH DATA FROM INDEXED DB ---
  const fetchData = useCallback(async () => {
      setIsLoading(true);
      try {
          // Hanya ambil data milik project yang sedang aktif
          const data = await getTranslationsByProjectId(activeProjectId);
          setLocalTranslations(data);
      } catch (e) {
          console.error("Gagal mengambil data dari DB", e);
      } finally {
          setIsLoading(false);
      }
  }, [activeProjectId]);

  useEffect(() => {
      fetchData();
  }, [fetchData]);

  // --- FILTERING ---
  const filteredAndSortedData = useMemo(() => {
    let data = [...localTranslations]; // Buat shallow copy agar tidak mutasi state

    if (searchTerm) {
        data = data.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            item.translatedText.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    data.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (sortOrder === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (sortOrder === 'a-z') return a.name.localeCompare(b.name);
        if (sortOrder === 'z-a') return b.name.localeCompare(a.name);
        return 0;
    });

    return data;
  }, [localTranslations, searchTerm, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  
  const currentDisplayData = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredAndSortedData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedData, currentPage]);

  useEffect(() => {
      setCurrentPage(1);
  }, [searchTerm, sortOrder, activeProjectId]);

  // --- ACTIONS ---
  const handleRename = async (id: string, newName: string) => {
    const safeName = newName.trim() || `Terjemahan ${id.slice(0, 4)}`;
    
    // Update Local State
    setLocalTranslations(prev => prev.map(item => 
        item.id === id ? { ...item, name: safeName } : item
    ));

    // Update DB
    const itemToUpdate = localTranslations.find(item => item.id === id);
    if (itemToUpdate) {
        await saveTranslationToDB({ ...itemToUpdate, name: safeName });
    }

    setEditingId(null);
    setEditingName('');
  };

  const openDeleteConfirmation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setConfirmDeleteTargetId(id);
    setIsConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!confirmDeleteTargetId) return; 
    const idToDelete = confirmDeleteTargetId;

    // Update Local
    setLocalTranslations(prev => prev.filter(item => item.id !== idToDelete));
    
    // Update DB
    await deleteTranslationFromDB(idToDelete);

    setConfirmDeleteTargetId(null);
    setIsConfirmDeleteOpen(false); 
  };

  const performClearAll = async () => {
    // Update Local
    setLocalTranslations([]);
    // Update DB
    await clearProjectTranslationsFromDB(activeProjectId);
    setIsConfirmClearAllOpen(false); 
  };

  const handleDownloadAll = () => {
    if (filteredAndSortedData.length === 0) return;
    const fileContent = filteredAndSortedData.map(item => {
      const formattedDate = new Date(item.timestamp).toLocaleString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `[${item.name}] - Disimpan: ${formattedDate}\n${item.translatedText}\n-------------------\n`;
    }).join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Koleksi_${projectName.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenReadingFullScreen = (translation: SavedTranslation) => {
    setCurrentReadingTranslation(translation);
    setTempContent(translation.translatedText);
    setIsEditingContent(false);
    setIsReadingFullScreen(true);
  };

  const handleCloseReadingFullScreen = () => {
    if (isEditingContent) {
        setIsEditingContent(false);
    }
    setIsReadingFullScreen(false);
    setCurrentReadingTranslation(null);
  };

  const handleDownloadReading = () => {
    if (currentReadingTranslation) {
      const blob = new Blob([currentReadingTranslation.translatedText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentReadingTranslation.name}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveContentEdit = async () => {
      if (!currentReadingTranslation) return;
      const updatedText = tempContent;

      const updatedItem = { ...currentReadingTranslation, translatedText: updatedText };

      // Update Local
      setLocalTranslations(prev => prev.map(item => 
        item.id === currentReadingTranslation.id ? updatedItem : item
      ));
      setCurrentReadingTranslation(updatedItem);
      
      // Update DB
      await saveTranslationToDB(updatedItem);

      setIsEditingContent(false);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-100">
        <div className="w-full md:w-auto">
           <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent bg-white px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                    Rak Buku
                </span>
           </div>
           <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal flex items-center gap-3">
            {projectName}
          </h2>
          <p className="text-subtle mt-2 font-sans text-sm">
            {isLoading ? 'Memuat data...' : `${filteredAndSortedData.length} Bab tersimpan`}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDownloadAll}
            disabled={filteredAndSortedData.length === 0 || isLoading}
            className="px-5 py-3 bg-white text-charcoal border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition disabled:opacity-50 text-xs md:text-sm flex items-center gap-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Backup Proyek</span>
             <span className="sm:hidden">Backup</span>
          </button>
          
          <button
            onClick={() => setIsConfirmClearAllOpen(true)}
            disabled={filteredAndSortedData.length === 0 || isLoading}
            className="px-5 py-3 bg-white text-red-400 border border-red-100 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 transition disabled:opacity-30 disabled:border-gray-100 disabled:text-gray-300 text-xs md:text-sm"
          >
            Hapus Semua
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      {filteredAndSortedData.length > 0 && (
        <div className="glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-30 transition-all shadow-soft">
            <div className="relative w-full md:w-1/2 lg:w-1/3">
                <input 
                    type="text" 
                    placeholder="Cari bab..." 
                    aria-label="Cari Bab"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/50 border border-transparent rounded-xl focus:outline-none focus:bg-white focus:shadow-glow text-sm transition-all text-charcoal placeholder-gray-400"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-4 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            <div className="flex w-full md:w-auto gap-3 items-center justify-between md:justify-end">
                <select 
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    aria-label="Urutkan Bab"
                    className="px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-charcoal focus:outline-none cursor-pointer flex-grow md:flex-grow-0 hover:bg-white/80"
                >
                    <option value="newest">📅 Terbaru</option>
                    <option value="oldest">📅 Terlama</option>
                    <option value="a-z">🔤 A - Z</option>
                    <option value="z-a">🔤 Z - A</option>
                </select>
            </div>
        </div>
      )}

      {/* LIBRARY GRID (BOOK COVER STYLE) */}
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
             <div className="w-10 h-10 border-4 border-gray-200 border-t-accent rounded-full animate-spin"></div>
        </div>
      ) : filteredAndSortedData.length === 0 ? (
        <div className="text-center py-24 bg-white/30 rounded-[3rem] border-2 border-dashed border-gray-200">
          <p className="text-6xl mb-6 opacity-30 grayscale">📚</p>
          <p className="text-subtle font-serif text-xl italic">
            Rak buku ini masih kosong.
          </p>
          <p className="text-gray-400 text-sm mt-2 tracking-wide">
            Mulailah menerjemahkan untuk mengisi koleksi.
          </p>
        </div>
      ) : (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-10 perspective-1000">
                {currentDisplayData.map(item => (
                    <div 
                    key={item.id} 
                    className="group relative cursor-pointer transform transition-all duration-500 hover:-translate-y-4 hover:rotate-1"
                    onClick={() => handleOpenReadingFullScreen(item)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buka ${item.name}`}
                    >
                        {/* Book Spine Effect (Left Side) */}
                        <div className="absolute left-0 top-1 bottom-1 w-3 bg-gray-900/10 z-0 rounded-l-md blur-[1px]"></div>
                        
                        {/* Book Cover */}
                        <div className="bg-white aspect-[2/3] rounded-r-2xl rounded-l-md shadow-lg group-hover:shadow-2xl border-l-4 border-gray-100 overflow-hidden relative transition-all duration-500 flex flex-col">
                            {/* Inner Spine Gradient */}
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-200/50 to-transparent z-10 pointer-events-none"></div>
                            
                            {/* Content */}
                            <div className="p-6 flex-grow flex flex-col relative z-20">
                                <div className="text-[10px] font-bold text-accent tracking-widest uppercase mb-4 opacity-80">
                                    {new Date(item.timestamp).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                </div>
                                
                                {editingId === item.id ? (
                                    <form 
                                        onClick={e => e.stopPropagation()}
                                        onSubmit={(e) => { e.preventDefault(); handleRename(item.id, editingName); }}
                                        className="mb-auto"
                                    >
                                        <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => handleRename(item.id, editingName)}
                                        className="w-full p-2 text-lg font-serif font-bold rounded bg-yellow-50 focus:outline-none"
                                        autoFocus
                                        />
                                    </form>
                                ) : (
                                    <h3 className="font-serif font-bold text-xl md:text-2xl text-charcoal leading-tight line-clamp-3 mb-auto group-hover:text-accent transition-colors">
                                        {item.name}
                                    </h3>
                                )}

                                <div className="mt-4 pt-4 border-t border-gray-100 text-[10px] text-gray-500 font-sans line-clamp-4 leading-relaxed italic">
                                    {item.translatedText.substring(0, 150)}...
                                </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 z-30">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditingName(item.name); }}
                                    className="p-2 bg-white text-gray-400 hover:text-accent rounded-full shadow-md hover:scale-110 transition-all"
                                    aria-label={`Edit Judul ${item.name}`}
                                >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => openDeleteConfirmation(item.id, e)}
                                    className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-full shadow-md hover:scale-110 transition-all"
                                    aria-label={`Hapus ${item.name}`}
                                >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                </button>
                            </div>

                            {/* Bottom Page Effect */}
                            <div className="absolute bottom-0 left-0 right-0 h-2 bg-white border-t border-gray-100 rounded-b-sm"></div>
                            <div className="absolute bottom-1 left-1 right-1 h-1 bg-gray-50 border-t border-gray-200 rounded-b-sm z-0"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 pt-12">
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        aria-label="Halaman Sebelumnya"
                        className="p-4 bg-white border border-gray-100 rounded-full hover:bg-paper disabled:opacity-30 transition shadow-soft hover:shadow-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <span className="text-base font-bold font-serif text-charcoal tracking-widest">
                        HALAMAN {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        aria-label="Halaman Berikutnya"
                        className="p-4 bg-white border border-gray-100 rounded-full hover:bg-paper disabled:opacity-30 transition shadow-soft hover:shadow-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            )}
        </>
      )}

      {/* FULL SCREEN READER */}
      {isReadingFullScreen && currentReadingTranslation && (
        <div className="fixed inset-0 z-[100] bg-paper animate-in slide-in-from-bottom duration-500 overflow-y-auto">
          <div className="max-w-3xl mx-auto min-h-screen bg-[#FDFCF8] shadow-2xl my-0 md:my-12 p-8 md:p-20 border-x border-gray-100 relative">
            
            {/* Toolbar */}
            <div className="fixed top-0 right-0 p-6 flex gap-4 bg-gradient-to-b from-paper to-transparent w-full justify-end z-10 pointer-events-none mix-blend-multiply">
              <div className="pointer-events-auto flex gap-3">
                
                {/* Mode Buttons */}
                {!isEditingContent ? (
                    <>
                        <button 
                            onClick={() => { setIsEditingContent(true); setTempContent(currentReadingTranslation.translatedText); }} 
                            className="p-4 bg-charcoal text-white rounded-full hover:bg-black shadow-lg transition-transform hover:scale-110" 
                            title="Edit Teks"
                            aria-label="Edit Teks"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                        <button onClick={handleDownloadReading} aria-label="Download" className="p-4 bg-paper border border-gray-100 text-charcoal rounded-full hover:bg-white shadow-lg transition-transform hover:scale-110" title="Download">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>
                        <button onClick={handleCloseReadingFullScreen} aria-label="Tutup Reader" className="p-4 bg-white border border-gray-100 text-charcoal rounded-full hover:bg-red-50 hover:text-red-500 shadow-lg transition-transform hover:scale-110" title="Tutup">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </>
                ) : (
                    <>
                         <button 
                            onClick={handleSaveContentEdit}
                            className="px-6 py-3 bg-accent text-white rounded-full hover:bg-accentHover shadow-glow font-bold text-sm transition-transform hover:scale-105"
                        >
                            Simpan Perubahan
                        </button>
                        <button 
                            onClick={() => { setIsEditingContent(false); setTempContent(currentReadingTranslation.translatedText); }}
                            className="px-6 py-3 bg-white border border-gray-200 text-charcoal rounded-full hover:bg-gray-50 shadow-sm font-bold text-sm transition-transform hover:scale-105"
                        >
                            Batal
                        </button>
                    </>
                )}
              </div>
            </div>

            <div className="mt-12 mb-16 border-b-2 border-charcoal pb-8">
                <span className="text-xs font-bold tracking-[0.3em] text-accent uppercase mb-2 block">Bab Tersimpan</span>
                <h1 className="text-3xl md:text-5xl font-serif font-bold text-charcoal leading-tight">
                    {currentReadingTranslation.name}
                </h1>
                <p className="text-subtle font-serif italic mt-4 text-sm tracking-wide">
                    {isEditingContent ? 'Mode Edit' : `Disimpan pada: ${new Date(currentReadingTranslation.timestamp).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`}
                </p>
            </div>

            {isEditingContent ? (
                 <textarea
                    value={tempContent}
                    onChange={(e) => setTempContent(e.target.value)}
                    aria-label="Edit Konten Terjemahan"
                    className="w-full h-[70vh] p-8 bg-white rounded-2xl border-none shadow-soft focus:shadow-glow outline-none font-serif text-lg leading-loose text-charcoal resize-none"
                    placeholder="Edit teks terjemahan di sini..."
                 />
            ) : (
                <article className="prose prose-stone prose-xl max-w-none font-serif leading-loose text-charcoal text-justify">
                {currentReadingTranslation.translatedText.split('\n').map((para, i) => (
                        para.trim() ? <p key={i} className="mb-8 indent-12">{para}</p> : null
                    ))}
                </article>
            )}

            {!isEditingContent && (
                <div className="mt-32 text-center border-t border-gray-100 pt-12 text-gray-300 font-serif italic text-sm">
                    ***
                </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={performDelete}
        title="Hapus Novel Ini?"
        message="Novel ini akan dihapus dari koleksi proyek ini."
        confirmText="Hapus"
        isDestructive={true}
      />
      <ConfirmDialog
        isOpen={isConfirmClearAllOpen}
        onClose={() => setIsConfirmClearAllOpen(false)}
        onConfirm={performClearAll}
        title="Bersihkan Proyek?"
        message={`Anda yakin ingin menghapus SEMUA novel yang disimpan dalam proyek "${projectName}"?`}
        confirmText="Hapus Semua"
        isDestructive={true}
      />
    </div>
  );
};

export default SavedTranslationsPage;
