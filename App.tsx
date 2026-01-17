
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
// RECENT_TRACKS_KEY removed as requested

// CONFIGURACIÓN DE URLS DE GITHUB
// Mapeo explícito para garantizar la conexión correcta a los archivos del repositorio
const DB_URLS: Record<string, string> = {
    'Música 1': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos1.json',
    'Música 2': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos2.json',
    'Música 3': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos3.json',
    'Música 4': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos4.json', 
    'Música 5': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos5.json',
    'Otros': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos6.json'
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

  // Selection and Details
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  
  // NEW: Manual Selection List (replaces recents)
  const [selectedTracksList, setSelectedTracksList] = useState<Track[]>([]);

  // Search State
  const [foundCredits, setFoundCredits] = useState<CreditInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Visual indicator for saving

  // Handle Browser Back Button
  useEffect(() => {
    // Only attach logic if logged in
    if (view === ViewState.LOGIN) return;

    const handlePopState = (event: PopStateEvent) => {
        // Priority 1: Close Modal
        if (selectedTrack) {
            setSelectedTrack(null);
            return;
        }

        // Priority 2: Return to List View if in Settings/Productions/Results
        if (view !== ViewState.LIST) {
            setView(ViewState.LIST);
            return;
        }
        
        // Note: Folder navigation back is handled inside TrackList
    };

    // Push initial state so we have something to pop
    window.history.pushState({ appLevel: true }, '');

    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [selectedTrack, view]);


  // Helper to save tracks (Optimized for IndexedDB)
  const updateTracks = async (newTracksInput: Track[] | ((prev: Track[]) => Track[])) => {
      let finalTracks: Track[];
      
      if (typeof newTracksInput === 'function') {
          finalTracks = newTracksInput(tracks);
      } else {
          finalTracks = newTracksInput;
      }

      setTracks(finalTracks);

      setIsSaving(true);
      try {
          await saveTracksToDB(finalTracks);
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
        try {
            const dbTracks = await loadTracksFromDB();
            if (dbTracks.length > 0) {
                setTracks(dbTracks);
            }
        } catch (e) {
            console.error("Error inicializando DB:", e);
        }

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
      setSelectedTracksList([]); // Clear selection on logout
  };

  const handleAddUser = (u: User) => updateUsers([...users, u]);
  const handleEditUser = (updatedUser: User) => updateUsers(users.map(u => u.username === updatedUser.username ? updatedUser : u));
  const handleDeleteUser = (username: string) => {
      if (users.length <= 1) return alert("No se puede eliminar el último usuario.");
      updateUsers(users.filter(u => u.username !== username));
  };

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

  // NEW FUNCTION: Clear Data for specific root
  const handleClearMusicRoot = async (rootName: string) => {
      if (!window.confirm(`¿Estás seguro de que quieres ELIMINAR todos los temas de "${rootName}"?\nEsta acción no se puede deshacer.`)) {
          return;
      }

      const tracksToKeep = tracks.filter(t => !t.path.startsWith(rootName));
      await updateTracks(tracksToKeep);
      alert(`Se han eliminado los datos de ${rootName}.`);
  };

  const handleExportMusicRoot = (rootName: string) => {
      if (authMode !== 'admin') return;
      const rootTracks = tracks.filter(t => t.path.startsWith(rootName));
      if (rootTracks.length === 0) return alert(`No hay temas en ${rootName}.`);

      // Determine number or just use name for Other
      let filename = 'mdatos.json';
      if (rootName.includes(' ')) {
          const rootNumber = rootName.split(' ')[1];
          filename = `mdatos${rootNumber}.json`;
      } else if (rootName === 'Otros') {
          filename = 'mdatos6.json';
      }

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
    // Push state so back button closes it
    window.history.pushState({ trackId: track.id }, '');
  };

  // --- SELECTION LOGIC ---
  const handleToggleSelection = (track: Track) => {
      setSelectedTracksList(prev => {
          const exists = prev.find(t => t.id === track.id);
          if (exists) {
              return prev.filter(t => t.id !== track.id);
          } else {
              return [...prev, track];
          }
      });
  };

  const handleGenerateSelectionReport = async () => {
      if (selectedTracksList.length === 0) {
          alert("No hay canciones seleccionadas para generar el reporte.");
          return;
      }

      const rows = selectedTracksList.map(t => 
          new docx.TableRow({
              children: [
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.title || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.author || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.performer || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.year || "")] }),
              ]
          })
      );

      const doc = new docx.Document({
          sections: [{
              properties: {},
              children: [
                  new docx.Paragraph({
                      children: [new docx.TextRun({ text: "REPORTE DE CRÉDITOS SELECCIONADOS", bold: true, size: 28 })],
                      alignment: docx.AlignmentType.CENTER,
                      spacing: { after: 300 }
                  }),
                  new docx.Table({
                      width: { size: 100, type: docx.WidthType.PERCENTAGE },
                      rows: [
                          new docx.TableRow({
                              children: ["Título", "Autor", "Intérprete", "Año"].map(t => 
                                  new docx.TableCell({ 
                                      children: [new docx.Paragraph({text: t, bold: true})],
                                      shading: { fill: "EEEEEE" }
                                  })
                              )
                          }),
                          ...rows
                      ]
                  })
              ]
          }]
      });

      docx.Packer.toBlob(doc).then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Reporte_Seleccion_${new Date().toISOString().split('T')[0]}.docx`;
          a.click();
          window.URL.revokeObjectURL(url);
      });
  };
  // -----------------------

  // Old Search Credits logic kept for compatibility with TrackDetail prop type if needed, 
  // but button will be removed in TrackDetail.
  const handleSearchCredits = async () => {
    // Legacy function, replaced by direct google search in TrackDetail
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

  const navigateTo = (v: ViewState) => {
      setView(v);
      window.history.pushState({ view: v }, '');
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
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
                    {isSaving && <span className="size-2 bg-yellow-400 rounded-full animate-pulse" title="Guardando en dispositivo..."></span>}
                    
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
                    onClearRoot={handleClearMusicRoot}
                    selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                    onToggleSelection={handleToggleSelection}
                />
            )}
            
            {view === ViewState.SELECTION && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto flex flex-col">
                    <TrackList 
                        tracks={selectedTracksList} 
                        onSelectTrack={handleSelectTrack} 
                        onUploadTxt={() => {}} 
                        isAdmin={false} 
                        onSyncRoot={() => {}} 
                        onExportRoot={() => {}} 
                        onClearRoot={() => {}} 
                        selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                        onToggleSelection={handleToggleSelection}
                        onDownloadReport={handleGenerateSelectionReport}
                        isSelectionView={true}
                    />
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

        {(view === ViewState.LIST || view === ViewState.SELECTION) && selectedTrack && (
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
                <NavButton icon="checklist" label="Seleccionar" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
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
