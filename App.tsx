
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

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';

// CONFIGURACIÓN DE URLS DE GITHUB
// Mapeo explícito para garantizar la conexión correcta a los archivos del repositorio
const DB_URLS: Record<string, string> = {
    'Música 1': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos1.json',
    'Música 2': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos2.json',
    'Música 3': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos3.json',
    'Música 4': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos4.json', 
    'Música 5': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos5.json'
};

const USERS_DB_URL = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/musuarios.json';

// Default admin if no users exist
const DEFAULT_ADMIN: User = { 
    username: 'admin', 
    password: 'RCMM26', 
    role: 'admin',
    fullName: 'Administrador Principal',
    phone: '55555555' 
};

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  
  // User Management State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Selection and History
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  // Search State
  const [foundCredits, setFoundCredits] = useState<CreditInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Visual indicator for saving

  // Helper to save tracks (Optimized for IndexedDB)
  const updateTracks = async (newTracks: Track[] | ((prev: Track[]) => Track[])) => {
      let updated: Track[] = [];
      
      // Update State Immediately (Responsive UI)
      setTracks(prev => {
          updated = typeof newTracks === 'function' ? newTracks(prev) : newTracks;
          return updated;
      });

      // Save to IndexedDB in background
      setIsSaving(true);
      try {
          await saveTracksToDB(updated);
      } catch (e) {
          console.error("Error crítico guardando base de datos local:", e);
          alert("Error: No se pudo guardar la base de datos en el dispositivo. Verifique el espacio disponible.");
      } finally {
          setIsSaving(false);
      }
  };

  // Helper to save users (Keep in LocalStorage as it's small)
  const updateUsers = (newUsers: User[]) => {
      setUsers(newUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
      
      if (currentUser) {
          const stillExists = newUsers.find(u => u.username === currentUser.username);
          if (!stillExists) {
               handleLogout();
               alert("Su usuario ha sido eliminado.");
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
        // 1. Load Tracks from IndexedDB (Async)
        try {
            const dbTracks = await loadTracksFromDB();
            if (dbTracks.length > 0) {
                setTracks(dbTracks);
            } else {
                console.log("Base de datos local vacía o inicial.");
            }
        } catch (e) {
            console.error("Error inicializando DB:", e);
        }

        // 2. Load Users
        const localUsers = localStorage.getItem(USERS_KEY);
        let currentUsersList = [DEFAULT_ADMIN];
        if (localUsers) {
            try {
                const parsed = JSON.parse(localUsers);
                if (Array.isArray(parsed) && parsed.length > 0) currentUsersList = parsed;
            } catch { }
        }
        setUsers(currentUsersList);

        // 3. Restore Session
        const savedUserStr = localStorage.getItem(AUTH_KEY);
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                const validUser = currentUsersList.find(u => u.username === savedUser.username && u.password === savedUser.password);
                if (validUser) {
                    setCurrentUser(validUser);
                    setAuthMode(validUser.role);
                    setView(ViewState.LIST);
                } else {
                    localStorage.removeItem(AUTH_KEY);
                }
            } catch { 
                localStorage.removeItem(AUTH_KEY);
            }
        }
    };

    initApp();
  }, []);

  const handleLoginSuccess = (user: User) => {
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
      setRecentTracks([]);
  };

  // --- USER MANAGEMENT ---
  const handleAddUser = (u: User) => updateUsers([...users, u]);
  const handleEditUser = (updatedUser: User) => updateUsers(users.map(u => u.username === updatedUser.username ? updatedUser : u));
  const handleDeleteUser = (username: string) => {
      if (users.length <= 1) return alert("No se puede eliminar el último usuario.");
      updateUsers(users.filter(u => u.username !== username));
  };

  // --- SYNC FUNCTIONS ---

  const handleSyncUsers = async () => {
      setIsUpdating(true);
      try {
          const url = USERS_DB_URL;
          console.log("Sincronizando usuarios desde:", url);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP: ${response.status}`);
          const jsonUsers = await response.json();
          if (Array.isArray(jsonUsers)) {
              updateUsers(jsonUsers);
              alert("Usuarios actualizados correctamente desde Github.");
              if (view === ViewState.LOGIN) window.location.reload();
          }
      } catch (e) {
          console.error(e);
          alert("Error actualizando usuarios. Verifique conexión o la URL del repositorio.");
      } finally {
          setIsUpdating(false);
      }
  };

  const handleSyncMusicRoot = async (rootName: string) => {
      if (authMode !== 'admin') return;

      const url = DB_URLS[rootName];
      if (!url) {
          alert(`No hay una URL configurada para ${rootName}`);
          return;
      }

      if (!window.confirm(`¿Reemplazar datos locales de "${rootName}" con la versión de GitHub?`)) return;

      setIsUpdating(true);
      try {
          console.log(`Descargando datos para ${rootName} desde: ${url}`);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP: ${response.status}`);
          
          const newTracks = await response.json();
          if (!Array.isArray(newTracks)) throw new Error("JSON inválido");

          // Optimización: Filtrar de forma segura usando el path
          // Mantenemos todo lo que NO sea de esta raíz, y agregamos lo nuevo
          const tracksToKeep = tracks.filter(t => !t.path.startsWith(rootName));
          const updatedList = [...tracksToKeep, ...newTracks];
          
          await updateTracks(updatedList);
          alert(`Sincronización de ${rootName} completada (${newTracks.length} temas).`);
          
      } catch (e) {
          console.error(e);
          alert(`Error al descargar datos de ${rootName}.\nVerifique que la URL: ${url} sea accesible y el archivo exista.`);
      } finally {
          setIsUpdating(false);
      }
  };

  const handleExportMusicRoot = (rootName: string) => {
      if (authMode !== 'admin') return;
      const rootTracks = tracks.filter(t => t.path.startsWith(rootName));
      if (rootTracks.length === 0) return alert(`No hay temas en ${rootName}.`);

      const rootNumber = rootName.split(' ')[1];
      const filename = `mdatos${rootNumber}.json`;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rootTracks, null, 2));
      
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
  };

  const handleExportUsers = () => {
      if (authMode !== 'admin') return;
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = "musuarios.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
  };

  const handleUploadTxt = (file: File, targetRoot: string) => {
      if (authMode !== 'admin') return alert("Requiere permisos de administrador.");
      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              const newTracks = parseTxtDatabase(text, targetRoot);
              if (newTracks.length > 0) {
                  await updateTracks(prev => [...prev, ...newTracks]);
                  alert(`${newTracks.length} temas añadidos a ${targetRoot}.`);
              } else {
                  alert("No se encontraron temas válidos.");
              }
          }
      };
      reader.readAsText(file);
  };

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setRecentTracks(prev => [track, ...prev.filter(t => t.id !== track.id)].slice(0, 10));
  };

  const handleSearchCredits = async () => {
    if (!selectedTrack) return;
    setIsSearching(true);
    setView(ViewState.RESULTS);
    try {
        const credits = await fetchCreditsFromGemini(selectedTrack.filename, selectedTrack.path);
        setFoundCredits(credits);
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
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
        <LoginScreen 
            onLoginSuccess={handleLoginSuccess} 
            users={users} 
            onUpdateUsers={handleSyncUsers}
            isUpdating={isUpdating}
        />
      );
  }

  const navigateTo = (v: ViewState) => setView(v);

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigateTo(ViewState.LIST)}
                >
                    <span className="material-symbols-outlined">radio</span>
                    <h1 className="text-lg font-bold tracking-tight">RCM Música</h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* Saving Indicator */}
                    {isSaving && <span className="size-2 bg-yellow-400 rounded-full animate-pulse" title="Guardando..."></span>}
                    
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase ${authMode === 'admin' ? 'bg-miel text-white' : 'bg-green-600 text-white'}`}>
                        {authMode === 'admin' ? 'ADMIN' : 'USER'}
                    </div>
                    <button onClick={handleLogout} className="text-white bg-white/10 hover:bg-red-500/50 p-2 rounded-full transition-colors flex items-center justify-center size-10">
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>
        )}

        {isUpdating && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
                <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-lg animate-pulse">Sincronizando...</p>
            </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList 
                    tracks={tracks} 
                    onSelectTrack={handleSelectTrack} 
                    onUploadTxt={handleUploadTxt}
                    isAdmin={authMode === 'admin'}
                    onSyncRoot={handleSyncMusicRoot}
                    onExportRoot={handleExportMusicRoot}
                />
            )}
            
            {view === ViewState.RECENT && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto">
                    <TrackList tracks={recentTracks} onSelectTrack={handleSelectTrack} onUploadTxt={() => {}} isAdmin={false} onSyncRoot={() => {}} onExportRoot={() => {}} />
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && (
                <Settings 
                    tracks={tracks}
                    users={users}
                    onAddUser={handleAddUser}
                    onEditUser={handleEditUser}
                    onDeleteUser={handleDeleteUser}
                    onExportUsers={handleExportUsers}
                />
            )}

            {view === ViewState.PRODUCTIONS && authMode === 'admin' && (
                <Productions onAddTracks={(t) => updateTracks(prev => [...prev, ...t])} allTracks={tracks} />
            )}

            {view === ViewState.RESULTS && selectedTrack && (
                <CreditResults 
                    originalTrack={selectedTrack}
                    foundCredits={foundCredits}
                    isLoading={isSearching}
                    onApply={handleApplyCredits}
                    onDiscard={handleDiscardResults}
                />
            )}
        </div>

        {(view === ViewState.LIST || view === ViewState.RECENT) && selectedTrack && (
            <TrackDetail 
                track={selectedTrack} 
                onClose={() => setSelectedTrack(null)}
                onSearchCredits={handleSearchCredits}
                authMode={authMode}
                onSaveEdit={handleManualEdit}
            />
        )}
        
        {view !== ViewState.RESULTS && (
            <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-2 flex items-center justify-between pb-2 z-20 shrink-0">
                <NavButton icon="folder_open" label="Explorador" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
                <NavButton icon="history" label="Recientes" active={view === ViewState.RECENT} onClick={() => navigateTo(ViewState.RECENT)} />
                {authMode === 'admin' && <NavButton icon="playlist_add" label="Producciones" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
                {authMode === 'admin' && <NavButton icon="settings" label="Ajustes" active={view === ViewState.SETTINGS} onClick={() => navigateTo(ViewState.SETTINGS)} />}
            </nav>
        )}
    </div>
  );
};

const NavButton: React.FC<{icon: string, label: string, active: boolean, onClick: () => void}> = ({icon, label, active, onClick}) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center gap-1 transition-colors px-2 flex-1 ${active ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
    >
        <span className={`material-symbols-outlined ${active ? 'material-symbols-filled' : ''}`}>{icon}</span>
        <span className="text-[9px] sm:text-[10px] font-bold">{label}</span>
    </button>
);

export default App;
