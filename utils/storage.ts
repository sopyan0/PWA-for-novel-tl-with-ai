
import { SavedTranslation } from '../types';

const DB_NAME = 'NovTL_DB';
const STORE_NAME = 'saved_translations';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Buat index projectId untuk pencarian cepat
        objectStore.createIndex("projectId", "projectId", { unique: false });
      }
    };
  });
};

export const saveTranslationToDB = async (translation: SavedTranslation): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(translation);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteTranslationFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllTranslationsFromDB = async (): Promise<SavedTranslation[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// FUNGSI BARU: Ambil hanya project tertentu (Jauh lebih cepat)
export const getTranslationsByProjectId = async (projectId: string): Promise<SavedTranslation[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("projectId");
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const clearProjectTranslationsFromDB = async (projectId: string): Promise<void> => {
    // Optimasi: Gunakan cursor atau index delete jika memungkinkan, 
    // tapi untuk sekarang logic delete satu per satu via index query sudah cukup aman.
    const db = await initDB();
    const items = await getTranslationsByProjectId(projectId);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        items.forEach(item => {
            store.delete(item.id);
        });

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
