
import { Track, Report } from '../types';

const DB_NAME = 'RCM_Music_DB';
const TRACKS_STORE = 'tracks';
const REPORTS_STORE = 'reports';
const DB_VERSION = 2; // Increment version to add new store

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
            
            if (!db.objectStoreNames.contains(TRACKS_STORE)) {
                db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(REPORTS_STORE)) {
                db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
            }
        };
    });
};

// --- TRACKS OPERATIONS ---

export const saveTracksToDB = async (tracks: Track[]): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(TRACKS_STORE, 'readwrite');
            const store = tx.objectStore(TRACKS_STORE);
            
            const clearReq = store.clear();
            
            clearReq.onsuccess = () => {
                if (tracks.length === 0) {
                    resolve();
                    return;
                }
                tracks.forEach(track => store.put(track));
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
            const tx = db.transaction(TRACKS_STORE, 'readonly');
            const store = tx.objectStore(TRACKS_STORE);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error cargando DB:", error);
        return [];
    }
};

// --- REPORTS OPERATIONS ---

export const saveReportToDB = async (report: Report): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(REPORTS_STORE, 'readwrite');
            const store = tx.objectStore(REPORTS_STORE);
            const request = store.put(report);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("Error guardando reporte:", error);
    }
};

export const updateReportStatus = async (id: string, statusPartial: { downloaded?: boolean; sent?: boolean }): Promise<void> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(REPORTS_STORE, 'readwrite');
            const store = tx.objectStore(REPORTS_STORE);
            const getReq = store.get(id);

            getReq.onsuccess = () => {
                const report = getReq.result as Report;
                if (report) {
                    report.status = { 
                        downloaded: statusPartial.downloaded ?? report.status?.downloaded ?? false,
                        sent: statusPartial.sent ?? report.status?.sent ?? false
                    };
                    store.put(report);
                }
                resolve();
            };
            getReq.onerror = () => reject();
        });
    } catch (e) { console.error(e); }
};

export const loadReportsFromDB = async (): Promise<Report[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(REPORTS_STORE, 'readonly');
            const store = tx.objectStore(REPORTS_STORE);
            const request = store.getAll();
            
            request.onsuccess = () => {
                // Sort by date desc
                const results = request.result || [];
                results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        return [];
    }
};

export const deleteReportFromDB = async (id: string): Promise<void> => {
     const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(REPORTS_STORE, 'readwrite');
        const store = tx.objectStore(REPORTS_STORE);
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
};

export const clearTracksDB = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(TRACKS_STORE, 'readwrite');
        const store = tx.objectStore(TRACKS_STORE);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};
