
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
import * as XLSX from 'xlsx';
import initSqlJs from 'sql.js';

const DB_KEY = 'rcm_db_datosm';
const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';

// REEMPLAZA ESTO CON TU URL REAL DE GITHUB (RAW)
const GITHUB_DB_URL = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/mdatos.db";

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

  // Helper to save tracks
  const updateTracks = (newTracks: Track[] | ((prev: Track[]) => Track[])) => {
      setTracks(prev => {
          const updated = typeof newTracks === 'function' ? newTracks(prev) : newTracks;
          try {
              localStorage.setItem(DB_KEY, JSON.stringify(updated));
          } catch (e) {
              console.error("Error saving tracks", e);
          }
          return updated;
      });
  };

  // Helper to save users
  const updateUsers = (newUsers: User[]) => {
      setUsers(newUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
      
      // If the current user was modified or deleted, we need to verify session integrity
      if (currentUser) {
          const stillExists = newUsers.find(u => u.username === currentUser.username);
          
          if (!stillExists) {
               handleLogout();
               alert("Su usuario ha sido eliminado. La sesión se ha cerrado.");
          } else if (stillExists.password !== currentUser.password) {
               handleLogout();
               alert("Su contraseña ha cambiado. Por favor inicie sesión nuevamente.");
          } else {
               setCurrentUser(stillExists);
               localStorage.setItem(AUTH_KEY, JSON.stringify(stillExists));
          }
      }
  };

  // Initialize
  useEffect(() => {
    // 1. Tracks
    const localData = localStorage.getItem(DB_KEY);
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) setTracks(parsed);
        } catch (e) { console.warn("DB Corrupt"); }
    }

    // 2. Users & Session Validation
    const localUsers = localStorage.getItem(USERS_KEY);
    let currentUsersList = [DEFAULT_ADMIN];

    if (localUsers) {
        try {
            const parsed = JSON.parse(localUsers);
            if (Array.isArray(parsed) && parsed.length > 0) {
                currentUsersList = parsed;
            }
        } catch { }
    }
    setUsers(currentUsersList);

    // 3. Restore Session with Validation
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
  const handleAddUser = (u: User) => {
      updateUsers([...users, u]);
  };
  
  const handleEditUser = (updatedUser: User) => {
      updateUsers(users.map(u => u.username === updatedUser.username ? updatedUser : u));
  };

  const handleDeleteUser = (username: string) => {
      if (users.length <= 1) {
          alert("No se puede eliminar el último usuario.");
          return;
      }
      updateUsers(users.filter(u => u.username !== username));
  };

  // --- SYNC WITH GITHUB (SQLITE DB) ---
  const handleUpdateDatabase = async () => {
      if (authMode !== 'admin' && view !== ViewState.LOGIN) return;

      const confirmUpdate = window.confirm(
          `¿Actualizar desde GitHub?\n\nSe buscará el archivo 'mdatos.db'.\nEsto reemplazará la base de datos local.`
      );
      if (!confirmUpdate) return;

      setIsUpdating(true);
      
      try {
          // 1. Descargar el archivo binario desde GitHub
          console.log("Descargando mdatos.db desde:", GITHUB_DB_URL);
          const response = await fetch(GITHUB_DB_URL);
          
          if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();

          // 2. Inicializar SQL.js
          const SQL = await initSqlJs({
            // Es necesario apuntar al archivo WASM correcto
            locateFile: file => `https://sql.js.org/dist/${file}`
          });

          // 3. Cargar Base de Datos
          const db = new SQL.Database(new Uint8Array(arrayBuffer));

          // 4. Ejecutar consulta
          // ASUMIMOS QUE LA TABLA SE LLAMA 'tracks'
          // Ajusta esta consulta según la estructura real de tu .db
          const stmt = db.prepare("SELECT * FROM tracks");
          
          const newTracks: Track[] = [];

          while (stmt.step()) {
              const row = stmt.getAsObject();
              
              // Mapeo flexible de columnas SQL -> Objeto Track
              // Intenta leer columnas comunes (en inglés o español)
              const title = (row.title || row.titulo || 'Sin Título') as string;
              const author = (row.author || row.autor || 'Desconocido') as string;
              const performer = (row.performer || row.interprete || row.artist || 'Desconocido') as string;
              const album = (row.album || row.carpeta || row.folder || 'Desconocido') as string;
              const path = (row.path || row.ruta || album) as string;
              const filename = (row.filename || row.archivo || `${title}.mp3`) as string;
              const year = (row.year || row.ano || row.anio || '') as string;
              const genre = (row.genre || row.genero || '') as string;
              const authorCountry = (row.authorCountry || row.pais_autor || '') as string;
              const performerCountry = (row.performerCountry || row.pais_interprete || '') as string;

              newTracks.push({
                  id: `db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  filename: filename,
                  path: path,
                  size: 'DB',
                  isVerified: true,
                  metadata: {
                      title,
                      author,
                      authorCountry,
                      performer,
                      performerCountry,
                      album,
                      year: String(year),
                      genre
                  }
              });
          }

          stmt.free();
          db.close();

          if (newTracks.length > 0) {
              updateTracks(newTracks);
              alert(`Sincronización Exitosa.\nSe han cargado ${newTracks.length} temas desde la base de datos SQLite.`);
              
              if (view === ViewState.LOGIN) {
                  window.location.reload();
              }
          } else {
              alert("La base de datos se descargó, pero la tabla 'tracks' parece estar vacía o no existe.");
          }

      } catch (error) {
          console.error("Update failed", error);
          alert("Error al sincronizar con GitHub.\n\nVerifique:\n1. Que la URL en el código sea correcta.\n2. Que el archivo 'mdatos.db' exista en el repo.\n3. Que el repo sea público.");
      } finally {
          setIsUpdating(false);
      }
  };

  // --- EXPORT JSON ---
  const handleExportDatabase = () => {
      if (tracks.length === 0) {
          alert("No hay datos para exportar.");
          return;
      }
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tracks, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "datosm.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  // --- HANDLE MANUAL TXT UPLOAD PER TAB ---
  const handleUploadTxt = async (file: File, targetRoot: string) => {
      if (authMode !== 'admin') {
          alert("Solo el administrador puede cargar archivos.");
          return;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              const newTracks = parseTxtDatabase(text, targetRoot);
              if (newTracks.length > 0) {
                  updateTracks(prev => [...prev, ...newTracks]);
                  alert(`Se han añadido ${newTracks.length} temas a ${targetRoot}.`);
              } else {
                  alert("No se encontraron temas en el archivo TXT. Verifique el formato.");
              }
          }
      };
      reader.readAsText(file);
  };

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setRecentTracks(prev => {
        const filtered = prev.filter(t => t.id !== track.id);
        return [track, ...filtered].slice(0, 10);
    });
  };

  const handleSearchCredits = async () => {
    if (!selectedTrack) return;
    setIsSearching(true);
    setView(ViewState.RESULTS);
    
    const minDelay = new Promise(resolve => setTimeout(resolve, 1500));
    try {
        const [credits] = await Promise.all([
            fetchCreditsFromGemini(selectedTrack.filename, selectedTrack.path),
            minDelay
        ]);
        setFoundCredits(credits);
    } catch (e) {
        console.error("Search failed", e);
    } finally {
        setIsSearching(false);
    }
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

  const handleDiscardResults = () => {
      setView(ViewState.LIST);
      setFoundCredits(null);
  };

  const mergeTracks = (incomingTracks: Track[]) => {
      updateTracks(currentTracks => [...currentTracks, ...incomingTracks]);
  };

  const handleAddProductionTracks = (tracks: Track[]) => {
      mergeTracks(tracks);
  };

  if (view === ViewState.LOGIN) {
      return (
        <LoginScreen 
            onLoginSuccess={handleLoginSuccess} 
            users={users} 
            onUpdate={handleUpdateDatabase}
            isUpdating={isUpdating}
        />
      );
  }

  // --- NAVIGATION HANDLER (RESET TO LIST) ---
  const navigateTo = (v: ViewState) => {
      setView(v);
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <div 
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigateTo(ViewState.LIST)}
                >
                    <span className="material-symbols-outlined">radio</span>
                    <h1 className="text-lg font-bold tracking-tight">
                        RCM Música
                    </h1>
                </div>
                {/* Auth Controls */}
                <div className="flex items-center gap-2">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase ${authMode === 'admin' ? 'bg-miel text-white' : 'bg-green-600 text-white'}`}>
                        {authMode === 'admin' ? 'ADMINISTRADOR' : 'USUARIO'}
                    </div>

                    {/* Botón Exportar JSON (Solo Admin) */}
                    {authMode === 'admin' && view === ViewState.LIST && (
                        <button 
                            onClick={handleExportDatabase}
                            className="text-white bg-white/10 hover:bg-green-500/50 p-2 rounded-full transition-colors flex items-center justify-center size-10"
                            title="Generar datosm.json (Actualizar)"
                        >
                            <span className="material-symbols-outlined text-xl">save_alt</span>
                        </button>
                    )}
                    
                    {/* Botón Update ahora apunta a GitHub/SQLite */}
                    <button 
                        onClick={handleUpdateDatabase}
                        className={`text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors flex items-center justify-center size-10 ${isUpdating ? 'animate-spin bg-white/30' : ''}`}
                        title="Sincronizar desde GitHub (mdatos.db)"
                        disabled={isUpdating}
                    >
                        <span className="material-symbols-outlined text-xl">sync</span>
                    </button>

                    <button 
                        onClick={handleLogout}
                        className="text-white bg-white/10 hover:bg-red-500/50 p-2 rounded-full transition-colors flex items-center justify-center size-10"
                        title="Cerrar Sesión"
                    >
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>
        )}

        {isUpdating && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
                <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold text-lg animate-pulse">Descargando DB...</p>
                <p className="text-xs text-gray-400 mt-2">GitHub / mdatos.db</p>
            </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList 
                    tracks={tracks} 
                    onSelectTrack={handleSelectTrack} 
                    onUploadTxt={handleUploadTxt}
                    isAdmin={authMode === 'admin'}
                />
            )}

            {view === ViewState.RECENT && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto">
                    {recentTracks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                             <p>No hay temas recientes</p>
                        </div>
                    ) : (
                        <TrackList 
                            tracks={recentTracks} 
                            onSelectTrack={handleSelectTrack} 
                            onUploadTxt={() => {}} 
                            isAdmin={false}
                        />
                    )}
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && (
                <Settings 
                    tracks={tracks}
                    users={users}
                    onAddUser={handleAddUser}
                    onEditUser={handleEditUser}
                    onDeleteUser={handleDeleteUser}
                />
            )}

            {view === ViewState.PRODUCTIONS && authMode === 'admin' && (
                <Productions 
                    onAddTracks={handleAddProductionTracks} 
                    allTracks={tracks} 
                />
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
                <button 
                    onClick={() => navigateTo(ViewState.LIST)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 flex-1 ${view === ViewState.LIST ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.LIST ? 'material-symbols-filled' : ''}`}>folder_open</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Explorador</span>
                </button>
                
                <button 
                    onClick={() => navigateTo(ViewState.RECENT)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 flex-1 ${view === ViewState.RECENT ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.RECENT ? 'material-symbols-filled' : ''}`}>history</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Recientes</span>
                </button>

                {authMode === 'admin' && (
                    <button 
                        onClick={() => navigateTo(ViewState.PRODUCTIONS)}
                        className={`flex flex-col items-center gap-1 transition-colors px-2 flex-1 ${view === ViewState.PRODUCTIONS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                    >
                        <span className={`material-symbols-outlined ${view === ViewState.PRODUCTIONS ? 'material-symbols-filled' : ''}`}>playlist_add</span>
                        <span className="text-[9px] sm:text-[10px] font-bold">Producciones</span>
                    </button>
                )}

                {authMode === 'admin' && (
                    <button 
                        onClick={() => navigateTo(ViewState.SETTINGS)}
                        className={`flex flex-col items-center gap-1 transition-colors px-2 flex-1 ${view === ViewState.SETTINGS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                    >
                        <span className={`material-symbols-outlined ${view === ViewState.SETTINGS ? 'material-symbols-filled' : ''}`}>settings</span>
                        <span className="text-[9px] sm:text-[10px] font-bold">Ajustes</span>
                    </button>
                )}
            </nav>
        )}
    </div>
  );
};

export default App;
