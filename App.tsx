
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode, User } from './types';
import { parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import { fetchCreditsFromGemini } from './services/geminiService';
import { loadTracksFromDB, saveTracksToDB } from './services/db'; 
import * as XLSX from 'xlsx';
import * as docx from 'docx';

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';
const ADMIN_PHONE = '54413935';

// CONFIGURACIÓN DE URLS DE GITHUB
const DB_URLS: Record<string, string> = {
    'Música 1': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos1.json',
    'Música 2': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos2.json',
    'Música 3': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos3.json',
    'Música 4': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos4.json', 
    'Música 5': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos5.json',
    'Otros': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos6.json'
};

const USERS_DB_URL = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/musuarios.json';

const DEFAULT_ADMIN: User = { 
    username: 'admin', 
    password: 'RCMM26', 
    role: 'admin',
    fullName: 'Administrador Principal',
    phone: '55555555',
    uniqueId: 'RCM-ADMIN-X9Y8Z7A6B5C4'
};

interface ExportItem {
    id: string;
    title: string;
    author: string;
    authorCountry: string;
    performer: string;
    performerCountry: string;
    genre: string;
    source: 'db' | 'manual';
    path?: string;
}

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedTracksList, setSelectedTracksList] = useState<Track[]>([]);

  const [showWishlist, setShowWishlist] = useState(false);
  const [missingQueries, setMissingQueries] = useState<string[]>([]);
  const [wishlistText, setWishlistText] = useState('');

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportItems, setExportItems] = useState<ExportItem[]>([]);
  const [programName, setProgramName] = useState('');

  const [foundCredits, setFoundCredits] = useState<CreditInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Upload State
  const [uploadStatus, setUploadStatus] = useState<{
    isUploading: boolean;
    currentFile: number;
    totalFiles: number;
    currentFileName: string;
  }>({ isUploading: false, currentFile: 0, totalFiles: 0, currentFileName: '' });

  // ID Generator (> 20 chars, RCM prefix)
  const generateUniqueId = (name: string) => {
      const cleanName = name ? name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) : 'USR';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let random = '';
      for (let i = 0; i < 16; i++) {
          random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `RCM-${cleanName}-${random}`;
  };

  useEffect(() => {
    // History handling
    if (view === ViewState.LOGIN) return;
    const handlePopState = (event: PopStateEvent) => {
        if (selectedTrack) { setSelectedTrack(null); return; }
        if (showWishlist) { setShowWishlist(false); return; }
        if (showExportModal) { setShowExportModal(false); return; }
        if (view !== ViewState.LIST) { setView(ViewState.LIST); return; }
    };
    window.history.pushState({ appLevel: true }, '');
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [selectedTrack, view, showWishlist, showExportModal]);


  // Helper to save tracks
  const updateTracks = async (newTracksInput: Track[] | ((prev: Track[]) => Track[])) => {
      let finalTracks: Track[];
      // Determine new state
      if (typeof newTracksInput === 'function') {
          finalTracks = newTracksInput(tracks);
      } else {
          finalTracks = newTracksInput;
      }
      
      // Update State immediately
      setTracks(finalTracks);
      
      setIsSaving(true);
      try {
          await saveTracksToDB(finalTracks);
      } catch (e) {
          console.error("Error guardando DB:", e);
      } finally {
          setIsSaving(false);
      }
  };

  // Helper to save users
  const updateUsers = (newUsers: User[]) => {
      setUsers(newUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
      if (currentUser) {
          const stillExists = newUsers.find(u => u.username === currentUser.username);
          if (!stillExists) {
               handleLogout();
          } else if (stillExists.password !== currentUser.password) {
               handleLogout();
               alert("Contraseña cambiada. Inicie sesión nuevamente.");
          } else {
               setCurrentUser(stillExists);
               localStorage.setItem(AUTH_KEY, JSON.stringify(stillExists));
          }
      }
  };

  // Initialize
  useEffect(() => {
    const initApp = async () => {
        try {
            const dbTracks = await loadTracksFromDB();
            if (dbTracks.length > 0) setTracks(dbTracks);
        } catch (e) { console.error(e); }

        const localUsers = localStorage.getItem(USERS_KEY);
        let currentUsersList = [DEFAULT_ADMIN];
        if (localUsers) {
            try {
                const parsed = JSON.parse(localUsers);
                if (Array.isArray(parsed) && parsed.length > 0) currentUsersList = parsed;
            } catch { }
        }
        setUsers(currentUsersList);

        const savedUserStr = localStorage.getItem(AUTH_KEY);
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                // Si es un invitado temporal, no lo buscamos en la lista, simplemente restauramos sesión
                if (savedUser.role === 'guest' && savedUser.username === 'invitado') {
                     setCurrentUser(savedUser);
                     setAuthMode('guest');
                     setView(ViewState.LIST);
                     return;
                }

                const validUser = currentUsersList.find(u => u.username === savedUser.username && u.password === savedUser.password);
                if (validUser) {
                    if (!validUser.uniqueId) {
                        validUser.uniqueId = generateUniqueId(validUser.fullName);
                        const updatedList = currentUsersList.map(u => u.username === validUser.username ? validUser : u);
                        currentUsersList = updatedList;
                        localStorage.setItem(USERS_KEY, JSON.stringify(currentUsersList));
                    }
                    setCurrentUser(validUser);
                    setAuthMode(validUser.role);
                    setView(ViewState.LIST);
                } else {
                    localStorage.removeItem(AUTH_KEY);
                }
            } catch { localStorage.removeItem(AUTH_KEY); }
        }
    };
    initApp();
  }, []);

  const handleLoginSuccess = (user: User) => {
    // Si es un usuario registrado (existe en la lista users), validamos y actualizamos su ID si falta
    const existingUser = users.find(u => u.username === user.username);
    if (existingUser) {
        if (!user.uniqueId) {
            user.uniqueId = generateUniqueId(user.fullName);
            updateUsers(users.map(u => u.username === user.username ? user : u));
        }
    }
    
    // Si es invitado o registrado, procedemos
    setCurrentUser(user);
    setAuthMode(user.role);
    setView(ViewState.LIST);
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
      localStorage.removeItem(AUTH_KEY);
      setAuthMode(null);
      setCurrentUser(null);
      setView(ViewState.LOGIN);
      setSelectedTrack(null);
      setSelectedTracksList([]);
  };

  const handleAddUser = (u: User) => updateUsers([...users, u]);
  const handleEditUser = (updatedUser: User) => updateUsers(users.map(u => u.username === updatedUser.username ? updatedUser : u));
  const handleDeleteUser = (username: string) => {
      if (users.length <= 1) return alert("No se puede eliminar el último usuario.");
      updateUsers(users.filter(u => u.username !== username));
  };

  // --- SYNC HANDLERS (Same as before) ---
  const handleSyncUsers = async () => {
      setIsUpdating(true);
      try {
          const response = await fetch(USERS_DB_URL);
          if (!response.ok) throw new Error(`HTTP: ${response.status}`);
          const jsonUsers = await response.json();
          if (Array.isArray(jsonUsers)) {
              updateUsers(jsonUsers);
              alert("Usuarios actualizados correctamente.");
              if (view === ViewState.LOGIN) window.location.reload();
          }
      } catch (e) {
          alert("Error actualizando usuarios.");
      } finally { setIsUpdating(false); }
  };

  const handleSyncMusicRoot = async (rootName: string) => {
      const url = DB_URLS[rootName];
      if (!url) return alert(`No URL para ${rootName}`);
      if (!window.confirm(`¿Reemplazar datos de "${rootName}"?`)) return;
      setIsUpdating(true);
      try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP: ${response.status}`);
          const newTracks = await response.json();
          const tracksToKeep = tracks.filter(t => !t.path.startsWith(rootName));
          await updateTracks([...tracksToKeep, ...newTracks]);
          alert(`Sincronización completada (${newTracks.length} temas).`);
      } catch (e) { alert("Error al descargar datos."); } 
      finally { setIsUpdating(false); }
  };

  const handleClearMusicRoot = async (rootName: string) => {
      if (!window.confirm(`¿ELIMINAR todos los temas de "${rootName}"?`)) return;
      const tracksToKeep = tracks.filter(t => !t.path.startsWith(rootName));
      await updateTracks(tracksToKeep);
      alert(`Datos eliminados.`);
  };

  const handleExportMusicRoot = (rootName: string) => {
      if (authMode !== 'admin') return;
      const rootTracks = tracks.filter(t => t.path.startsWith(rootName));
      if (rootTracks.length === 0) return alert(`Vacío.`);
      let filename = 'mdatos.json';
      if (rootName.includes(' ')) filename = `mdatos${rootName.split(' ')[1]}.json`;
      else if (rootName === 'Otros') filename = 'mdatos6.json';
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rootTracks, null, 2));
      const a = document.createElement('a');
      a.href = dataStr; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };

  const handleExportUsers = () => {
      if (authMode !== 'admin') return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
      const a = document.createElement('a'); a.href = dataStr; a.download = "musuarios.json"; document.body.appendChild(a); a.click(); a.remove();
  };

  // Helper para leer archivos asíncronamente
  const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const text = e.target?.result;
              if (typeof text === 'string') resolve(text);
              else reject(new Error("Falló la lectura del archivo"));
          };
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
      });
  };

  const handleUploadMultipleTxt = async (files: FileList, targetRoot: string) => {
      if (authMode !== 'admin') return alert("Solo Admin.");
      if (!files || files.length === 0) return;

      // Convertir FileList a Array para iteración segura
      const filesArray = Array.from(files);

      setUploadStatus({
          isUploading: true,
          totalFiles: filesArray.length,
          currentFile: 0,
          currentFileName: ''
      });

      let allNewTracks: Track[] = [];

      try {
          for (let i = 0; i < filesArray.length; i++) {
              const file = filesArray[i];
              setUploadStatus(prev => ({
                  ...prev,
                  currentFile: i + 1,
                  currentFileName: file.name
              }));

              // Pequeño delay para permitir que la UI se renderice
              await new Promise(r => setTimeout(r, 50));

              try {
                  const text = await readFileAsText(file);
                  // Pasamos targetRoot (ej: "Música 3") al parser para que fuerce la ruta
                  const tracks = parseTxtDatabase(text, targetRoot);
                  if (tracks.length > 0) {
                      allNewTracks = [...allNewTracks, ...tracks];
                  }
              } catch (err) {
                  console.error(`Error leyendo ${file.name}`, err);
              }
          }

          if (allNewTracks.length > 0) {
              setUploadStatus(prev => ({ ...prev, currentFileName: 'Guardando en base de datos...' }));
              
              // Actualizamos el estado. Al usar un nuevo array, React re-renderiza TrackList
              await updateTracks(prev => [...prev, ...allNewTracks]);
              
              alert(`Proceso finalizado.\n${allNewTracks.length} temas importados correctamente en "${targetRoot}".`);
          } else {
              alert("No se encontraron pistas válidas en los archivos seleccionados.");
          }

      } catch (e) {
          console.error(e);
          alert("Ocurrió un error durante la carga.");
      } finally {
          setUploadStatus(prev => ({ ...prev, isUploading: false }));
      }
  };

  // --- BULK SEARCH ---
  const normalizeFlexible = (text: string) => {
      if (!text) return "";
      let s = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      s = s.replace(/v/g, 'b').replace(/z/g, 's').replace(/ce/g, 'se').replace(/ci/g, 'si').replace(/qu/g, 'k').replace(/k/g, 'c').replace(/ll/g, 'y').replace(/i/g, 'y').replace(/h/g, '').replace(/ñ/g, 'n');
      s = s.replace(/([a-z])\1+/g, '$1');
      s = s.replace(/[^a-z0-9\s]/g, '');
      return s.trim();
  };
  const getTokens = (text: string) => normalizeFlexible(text).split(/\s+/).filter(t => t.length > 1);

  const performBulkSearch = (text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) return alert("Sin datos.");
      const queries = lines.map(line => {
          const lower = line.toLowerCase();
          if (lower.startsWith('titulo:')) return { title: line.split(':')[1].trim(), raw: line };
          if (line.includes('-')) {
              const parts = line.split('-');
              if (parts.length >= 2) return { title: parts[0].trim(), performer: parts[1].trim(), raw: line };
          }
          return { title: line, raw: line };
      });

      let foundCount = 0;
      const newSelection = [...selectedTracksList];
      const notFoundList: string[] = [];

      queries.forEach(q => {
          const qTitleTokens = getTokens(q.title || "");
          const qPerfTokens = getTokens(q.performer || "");
          if (qTitleTokens.length === 0 && qPerfTokens.length === 0) return;

          let bestMatch: Track | null = null;
          for (const t of tracks) {
              const tTitleTokens = getTokens(t.metadata.title || t.filename);
              const tPerfTokens = getTokens(t.metadata.performer || "");
              
              let titleMatch = qTitleTokens.length > 0 ? qTitleTokens.every(qt => tTitleTokens.includes(qt)) : true;
              let perfMatch = (q.performer && qPerfTokens.length > 0) ? qPerfTokens.every(qp => tPerfTokens.includes(qp)) : true;

              if (titleMatch && perfMatch) { bestMatch = t; break; }
          }
          if (bestMatch) {
              if (!newSelection.find(s => s.id === (bestMatch as Track).id)) {
                  newSelection.push(bestMatch);
                  foundCount++;
              }
          } else { notFoundList.push(q.raw); }
      });
      setSelectedTracksList(newSelection);
      setMissingQueries(notFoundList);
  };

  const handleBulkSelectTxt = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => typeof e.target?.result === 'string' && performBulkSearch(e.target.result);
      reader.readAsText(file);
  };
  const handleWishlistSubmit = () => {
      if (!wishlistText.trim()) return;
      performBulkSearch(wishlistText);
      setShowWishlist(false);
      setWishlistText('');
  };

  const handleSelectTrack = (track: Track) => { setSelectedTrack(track); };
  const handleToggleSelection = (track: Track) => {
      setSelectedTracksList(prev => prev.find(t => t.id === track.id) ? prev.filter(t => t.id !== track.id) : [...prev, track]);
  };
  const handleClearSelection = () => { if (window.confirm('¿Limpiar selección?')) { setSelectedTracksList([]); setMissingQueries([]); } };


  // --- EXPORT & SHARE LOGIC (Unified) ---
  const handleOpenExportModal = () => {
      // Prepare Items for Editing
      const items: ExportItem[] = [];
      
      // 1. Found items
      selectedTracksList.forEach(t => {
          items.push({
              id: t.id,
              title: t.metadata.title || t.filename,
              author: t.metadata.author || '',
              authorCountry: t.metadata.authorCountry || '',
              performer: t.metadata.performer || '',
              performerCountry: t.metadata.performerCountry || '',
              genre: t.metadata.genre || '',
              source: 'db',
              path: t.path
          });
      });

      // 2. Missing items
      missingQueries.forEach((q, idx) => {
          let title = q;
          let performer = '';
          if (q.includes('-')) {
              const parts = q.split('-');
              title = parts[0].trim();
              performer = parts[1].trim();
          }
          items.push({
              id: `missing-${idx}`,
              title: title,
              author: '',
              authorCountry: '',
              performer: performer,
              performerCountry: '',
              genre: '',
              source: 'manual'
          });
      });

      setExportItems(items);
      setShowExportModal(true);
  };

  const handleUpdateExportItem = (id: string, field: keyof ExportItem, value: string) => {
      setExportItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // 1. Share Credits (WhatsApp General)
  const handleShareCredits = () => {
      const today = new Date().toISOString().split('T')[0];
      let message = `*CRÉDITOS MUSICALES RCM - ${today}*\n`;
      if (programName) message += `*Programa:* ${programName}\n\n`;

      exportItems.forEach(item => {
          message += `🎵 *${item.title}*\n`;
          if (item.author) message += `✍️ Autor: ${item.author} ${item.authorCountry ? `(${item.authorCountry})` : ''}\n`;
          if (item.performer) message += `🎤 Intérprete: ${item.performer} ${item.performerCountry ? `(${item.performerCountry})` : ''}\n`;
          if (item.genre) message += `🎼 Género: ${item.genre}\n`;
          message += `\n`;
      });

      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  // 2. Send Report Step 1: Download
  const handleDownloadReport = () => {
      if (!currentUser) return;
      const today = new Date().toISOString().split('T')[0];
      
      // Build TXT Content
      let content = `REPORTE OFICIAL DE CRÉDITOS RCM\n`;
      content += `===================================\n`;
      content += `Usuario: ${currentUser.fullName}\n`; 
      content += `Fecha: ${today}\n`;
      content += `Programa: ${programName || 'Sin Especificar'}\n`;
      content += `===================================\n\n`;

      exportItems.forEach((item, idx) => {
          content += `[${idx + 1}]\n`;
          content += `Titulo: ${item.title}\n`;
          content += `Autor: ${item.author || '---'}\n`;
          content += `Pais del autor: ${item.authorCountry || '---'}\n`;
          content += `Interprete: ${item.performer || '---'}\n`;
          content += `Pais del interprete: ${item.performerCountry || '---'}\n`;
          content += `Genero: ${item.genre || '---'}\n`;
          content += `-----------------------------------\n`;
      });

      content += `\nFIRMA DIGITAL: ${currentUser.uniqueId}\n`;

      // Create Blob (Text)
      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REPORTE_RCM_${currentUser.uniqueId}_${today}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
  };

  const handleApplyCredits = (newCredits: CreditInfo) => {
    if (!selectedTrack) return;
    updateTracks(prev => prev.map(t => t.id === selectedTrack.id ? { ...t, isVerified: true, metadata: newCredits } : t));
    setSelectedTrack(prev => prev ? { ...prev, isVerified: true, metadata: newCredits } : null);
    setView(ViewState.LIST);
    setFoundCredits(null);
  };
  const handleManualEdit = (updatedTrack: Track) => {
      updateTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      setSelectedTrack(updatedTrack);
  };
  const handleDiscardResults = () => { setView(ViewState.LIST); setFoundCredits(null); };

  if (view === ViewState.LOGIN) {
      return (
        <LoginScreen onLoginSuccess={handleLoginSuccess} users={users} onUpdateUsers={handleSyncUsers} isUpdating={isUpdating} />
      );
  }

  const navigateTo = (v: ViewState) => { setView(v); window.history.pushState({ view: v }, ''); };

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <button 
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none"
                    onClick={() => navigateTo(ViewState.LIST)}
                >
                    <span className="material-symbols-outlined text-2xl">radio</span>
                    <h1 className="text-lg font-bold tracking-tight">RCM Música</h1>
                </button>
                <div className="flex items-center gap-2">
                    {isSaving && <span className="size-2 bg-yellow-400 rounded-full animate-pulse" title="Guardando..."></span>}
                    {currentUser && authMode !== 'admin' && (
                        <button 
                            onClick={() => alert(`FIRMA DIGITAL:\n${currentUser.uniqueId}`)}
                            className="bg-white/10 text-white rounded-full p-1.5 hover:bg-white/20"
                        >
                            <span className="material-symbols-outlined text-sm">vpn_key</span>
                        </button>
                    )}
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase ${authMode === 'admin' ? 'bg-miel text-white' : 'bg-green-600 text-white'}`}>
                        {authMode === 'admin' ? 'ADMIN' : 'INVITADO'}
                    </div>
                    <button onClick={handleLogout} className="text-white bg-white/10 hover:bg-red-500/50 p-2 rounded-full transition-colors flex items-center justify-center size-10">
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>
        )}

        {/* LOADING / UPLOAD MODAL */}
        {(isUpdating || uploadStatus.isUploading) && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6">
                <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                
                {isUpdating ? (
                    <p className="font-bold text-lg animate-pulse">Sincronizando...</p>
                ) : (
                    <div className="text-center w-full max-w-xs">
                        <p className="font-bold text-lg mb-2">Procesando Archivos...</p>
                        <p className="text-sm text-gray-300 mb-4 truncate">{uploadStatus.currentFileName}</p>
                        
                        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2 overflow-hidden">
                            <div 
                                className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${(uploadStatus.currentFile / uploadStatus.totalFiles) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-gray-400 font-mono">
                            {uploadStatus.currentFile} / {uploadStatus.totalFiles}
                        </p>
                    </div>
                )}
            </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList 
                    tracks={tracks} onSelectTrack={handleSelectTrack} onUploadTxt={handleUploadMultipleTxt} isAdmin={authMode === 'admin'}
                    onSyncRoot={handleSyncMusicRoot} onExportRoot={handleExportMusicRoot} onClearRoot={handleClearMusicRoot}
                    selectedTrackIds={new Set(selectedTracksList.map(t => t.id))} onToggleSelection={handleToggleSelection}
                />
            )}
            
            {view === ViewState.SELECTION && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto flex flex-col">
                    <TrackList 
                        tracks={selectedTracksList} onSelectTrack={handleSelectTrack} onUploadTxt={handleUploadMultipleTxt} onBulkSelectTxt={handleBulkSelectTxt}
                        isAdmin={false} onSyncRoot={() => {}} onExportRoot={() => {}} onClearRoot={() => {}} 
                        selectedTrackIds={new Set(selectedTracksList.map(t => t.id))} onToggleSelection={handleToggleSelection}
                        onOpenExportPreview={handleOpenExportModal} isSelectionView={true} onClearSelection={handleClearSelection}
                        onOpenWishlist={() => setShowWishlist(true)} missingQueries={missingQueries} onClearMissing={() => setMissingQueries([])}
                    />
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && (
                <Settings 
                    tracks={tracks} users={users} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} onExportUsers={handleExportUsers}
                />
            )}

            {view === ViewState.PRODUCTIONS && authMode === 'admin' && (
                <Productions onAddTracks={(t) => updateTracks(prev => [...prev, ...t])} allTracks={tracks} />
            )}

            {view === ViewState.RESULTS && selectedTrack && (
                <CreditResults 
                    originalTrack={selectedTrack} foundCredits={foundCredits} isLoading={isSearching}
                    onApply={handleApplyCredits} onDiscard={handleDiscardResults}
                />
            )}
        </div>

        {/* WISHLIST MODAL */}
        {showWishlist && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowWishlist(false)}>
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             <span className="material-symbols-outlined text-miel">list_alt</span> Lista de Deseos
                        </h3>
                        <button onClick={() => setShowWishlist(false)} className="text-gray-400 hover:text-gray-600"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Ingresa hasta 50 temas (uno por línea).</p>
                    <textarea 
                        className="w-full h-48 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
                        placeholder="Ejemplo:&#10;Lágrimas Negras - Matamoros&#10;La Guantanamera"
                        value={wishlistText}
                        onChange={e => setWishlistText(e.target.value)}
                    ></textarea>
                    <button onClick={handleWishlistSubmit} className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg hover:bg-primary-dark flex justify-center items-center gap-2">
                        <span className="material-symbols-outlined">search</span> Buscar
                    </button>
                </div>
            </div>
        )}

        {/* EXPORT / EDIT MODAL */}
        {showExportModal && (
            <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setShowExportModal(false)}>
                <div 
                    className="w-full max-w-lg bg-white dark:bg-zinc-900 h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-slide-up"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-miel">edit_document</span> Editar y Exportar
                        </h3>
                        <button onClick={() => setShowExportModal(false)} className="text-gray-400"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-black/10">
                         <label className="block text-xs font-bold text-gray-500 mb-1">Nombre del Programa</label>
                         <input 
                            value={programName}
                            onChange={(e) => setProgramName(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-zinc-800"
                            placeholder="Ej. De Mañana"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {exportItems.map((item, idx) => (
                            <div key={item.id} className={`p-3 rounded-xl border ${item.source === 'manual' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200 bg-white'} dark:border-gray-700 dark:bg-zinc-800`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-100 dark:bg-white/10 px-1.5 rounded">{idx + 1}</span>
                                    {item.source === 'manual' && <span className="text-[10px] font-bold text-orange-500 uppercase">No encontrado</span>}
                                </div>
                                <div className="grid gap-2">
                                    <input 
                                        className="w-full p-1.5 text-sm font-bold border-b border-transparent focus:border-primary bg-transparent outline-none"
                                        placeholder="Título" value={item.title} onChange={e => handleUpdateExportItem(item.id, 'title', e.target.value)}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input className="text-xs p-1 border rounded bg-white/50 dark:bg-black/20" placeholder="Autor" value={item.author} onChange={e => handleUpdateExportItem(item.id, 'author', e.target.value)} />
                                        <input className="text-xs p-1 border rounded bg-white/50 dark:bg-black/20" placeholder="País Autor" value={item.authorCountry} onChange={e => handleUpdateExportItem(item.id, 'authorCountry', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input className="text-xs p-1 border rounded bg-white/50 dark:bg-black/20" placeholder="Intérprete" value={item.performer} onChange={e => handleUpdateExportItem(item.id, 'performer', e.target.value)} />
                                        <input className="text-xs p-1 border rounded bg-white/50 dark:bg-black/20" placeholder="País Intérprete" value={item.performerCountry} onChange={e => handleUpdateExportItem(item.id, 'performerCountry', e.target.value)} />
                                    </div>
                                    <input className="text-xs p-1 border rounded bg-white/50 dark:bg-black/20 w-1/2" placeholder="Género" value={item.genre} onChange={e => handleUpdateExportItem(item.id, 'genre', e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-3 shrink-0">
                         <button 
                            onClick={handleShareCredits}
                            className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 hover:brightness-95"
                        >
                            <span className="material-symbols-outlined text-lg">share</span> 
                            <span>Compartir Créditos</span>
                            <span className="text-[9px] font-normal opacity-80">(WhatsApp General)</span>
                        </button>
                         
                         <button 
                            onClick={handleDownloadReport}
                            className="bg-azul-header text-white py-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 hover:brightness-95"
                        >
                            <span className="material-symbols-outlined text-lg">download</span> 
                            <span>Descargar Reporte</span>
                            <span className="text-[9px] font-normal opacity-80">(TXT a Admin)</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Other Modals remain the same... */}
        {(view === ViewState.LIST || view === ViewState.SELECTION) && selectedTrack && (
            <TrackDetail track={selectedTrack} onClose={() => setSelectedTrack(null)} onSearchCredits={() => {}} authMode={authMode} onSaveEdit={handleManualEdit} />
        )}
        
        {view !== ViewState.RESULTS && (
            <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-2 flex items-center justify-between pb-2 z-20 shrink-0">
                <NavButton icon="folder_open" label="Explorador" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
                <NavButton icon="checklist" label="Seleccionar" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
                {authMode === 'admin' && <NavButton icon="playlist_add" label="Producciones" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
                {authMode === 'admin' && <NavButton icon="settings" label="Ajustes" active={view === ViewState.SETTINGS} onClick={() => navigateTo(ViewState.SETTINGS)} />}
            </nav>
        )}
    </div>
  );
};

interface NavButtonProps {
    icon: string;
    label: string;
    active: boolean;
    onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex-1 flex flex-col items-center justify-center h-full transition-colors relative ${active ? 'text-azul-header dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
    >
        <span className={`material-symbols-outlined text-2xl ${active ? 'material-symbols-filled' : ''}`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide mt-1">{label}</span>
        {active && <span className="absolute bottom-1 w-1 h-1 bg-current rounded-full"></span>}
    </button>
);

export default App;
