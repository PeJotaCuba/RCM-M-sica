
import { Track } from '../types';

const DB_NAME = 'RCM_Music_DB';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject("IndexedDB no es soportado en este navegador.");
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                // Creamos el store usando 'id' como clave única
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveTracksToDB = async (tracks: Track[]): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            // Estrategia: Limpiar y reescribir para mantener sincronía total con el estado de la App.
            // Esto es seguro porque el estado de React es la "verdad" actual.
            const clearReq = store.clear();
            
            clearReq.onsuccess = () => {
                if (tracks.length === 0) {
                    resolve();
                    return;
                }
                
                // Insertar registros
                tracks.forEach(track => {
                    store.put(track);
                });
            };

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {
        console.error("Error guardando en DB:", error);
        throw error;
    }
};

export const loadTracksFromDB = async (): Promise<Track[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error cargando DB:", error);
        return [];
    }
};

export const clearTracksDB = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
