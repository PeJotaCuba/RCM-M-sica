
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode, User, PROGRAMS_LIST, Report, ExportItem, SavedSelection } from './types';
import { parseTxtDatabase, GENRES_LIST, COUNTRIES_LIST } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import ReportsViewer from './components/ReportsViewer';
import Guide from './components/Guide';
import { fetchCreditsFromGemini } from './services/geminiService';
import { loadTracksFromDB, saveTracksToDB, saveReportToDB } from './services/db'; 
import { generateReportPDF } from './services/pdfService';

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';
const SELECTION_KEY = 'rcm_current_selection';
const SAVED_SELECTIONS_KEY = 'rcm_saved_selections';
const CUSTOM_ROOTS_KEY = 'rcm_custom_roots';

// Configuration for Database URLs and Filenames
const USERS_DB_URL = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/musuarios.json';

const ROOT_DB_CONFIG: Record<string, { url: string, filename: string }> = {
    'Música 1': { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos1.json', filename: 'mdatos1.json' },
    'Música 2': { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos2.json', filename: 'mdatos2.json' },
    'Música 3': { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos3.json', filename: 'mdatos3.json' },
    'Música 4': { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos4.json', filename: 'mdatos4.json' },
    'Música 5': { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos5.json', filename: 'mdatos5.json' },
    'Otros':    { url: 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/motros.json', filename: 'motros.json' }
};

const DEFAULT_ADMIN: User = { 
    username: 'admin', 
    password: 'RCMM26', 
    role: 'admin',
    fullName: 'Administrador Principal',
    phone: '55555555',
    uniqueId: 'RCM-ADMIN-X9Y8Z7A6B5C4'
};

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedTracksList, setSelectedTracksList] = useState<Track[]>([]);
  const [savedSelections, setSavedSelections] = useState<SavedSelection[]>([]);

  const [customRoots, setCustomRoots] = useState<string[]>([]);
  
  const [showWishlist, setShowWishlist] = useState(false);
  const [wishlistText, setWishlistText] = useState('');

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportItems, setExportItems] = useState<ExportItem[]>([]);
  const [programName, setProgramName] = useState(PROGRAMS_LIST[0]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null); 

  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initApp = async () => {
        try { const dbTracks = await loadTracksFromDB(); if (dbTracks.length > 0) setTracks(dbTracks); } catch (e) { console.error(e); }
        
        const localUsers = localStorage.getItem(USERS_KEY);
        let currentUsersList = [DEFAULT_ADMIN];
        if (localUsers) { try { const parsed = JSON.parse(localUsers); if (Array.isArray(parsed) && parsed.length > 0) currentUsersList = parsed; } catch { } }
        setUsers(currentUsersList);

        const savedRoots = localStorage.getItem(CUSTOM_ROOTS_KEY);
        if (savedRoots) setCustomRoots(JSON.parse(savedRoots));

        const currentSel = localStorage.getItem(SELECTION_KEY);
        if (currentSel) setSelectedTracksList(JSON.parse(currentSel));

        const savedSels = localStorage.getItem(SAVED_SELECTIONS_KEY);
        if (savedSels) setSavedSelections(JSON.parse(savedSels));

        const savedUserStr = localStorage.getItem(AUTH_KEY);
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                const validUser = currentUsersList.find(u => u.username === savedUser.username && u.password === savedUser.password);
                if (validUser) {
                    setCurrentUser(validUser); setAuthMode(validUser.role); setView(ViewState.LIST);
                } else { 
                    localStorage.removeItem(AUTH_KEY); 
                }
            } catch { localStorage.removeItem(AUTH_KEY); }
        }
    };
    initApp();
  }, []);

  // Persistence
  useEffect(() => { if (authMode) localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedTracksList)); }, [selectedTracksList, authMode]);
  useEffect(() => { if (authMode) localStorage.setItem(SAVED_SELECTIONS_KEY, JSON.stringify(savedSelections)); }, [savedSelections, authMode]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        if (selectedTrack) { setSelectedTrack(null); event.preventDefault(); return; }
        if (showWishlist) { setShowWishlist(false); event.preventDefault(); return; }
        if (showExportModal) { setShowExportModal(false); event.preventDefault(); return; }
        if (view !== ViewState.LIST) { setView(ViewState.LIST); event.preventDefault(); return; }
    };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [selectedTrack, view, showWishlist, showExportModal]);

  const updateTracks = async (newTracksInput: Track[] | ((prev: Track[]) => Track[])) => {
      let finalTracks: Track[];
      if (typeof newTracksInput === 'function') { finalTracks = newTracksInput(tracks); } else { finalTracks = newTracksInput; }
      setTracks(finalTracks);
      setIsSaving(true);
      try { await saveTracksToDB(finalTracks); } catch (e) { console.error("Error guardando DB:", e); } finally { setIsSaving(false); }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user); setAuthMode(user.role); setView(ViewState.LIST); localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
      localStorage.removeItem(AUTH_KEY); setAuthMode(null); setCurrentUser(null); setView(ViewState.LOGIN); setSelectedTrack(null);
  };

  // --- SYNC & EXPORT HANDLERS ---

  // 1. Sync Users & Custom Roots (musuarios.json)
  const handleSyncData = async () => {
      setIsUpdating(true);
      try {
          const r = await fetch(USERS_DB_URL);
          const data = await r.json();
          
          let fetchedUsers: User[] = [];
          let fetchedRoots: string[] = [];

          if (Array.isArray(data)) {
              // Legacy format: just users array
              fetchedUsers = data;
          } else if (data.users || data.customRoots) {
              // New format: object with users and roots
              fetchedUsers = data.users || [];
              fetchedRoots = data.customRoots || [];
          }

          if (fetchedUsers.length > 0) {
              setUsers(fetchedUsers);
              localStorage.setItem(USERS_KEY, JSON.stringify(fetchedUsers));
          }
          
          if (fetchedRoots.length > 0) {
              setCustomRoots(fetchedRoots);
              localStorage.setItem(CUSTOM_ROOTS_KEY, JSON.stringify(fetchedRoots));
          }

          alert("Sincronización de usuarios y carpetas completada.");
          window.location.reload(); 
      } catch(e) {
          alert("Error al sincronizar usuarios.");
      } finally {
          setIsUpdating(false);
      }
  };

  // 2. Export Users & Custom Roots (musuarios.json)
  const handleExportUsersDB = () => {
      const exportData = {
          users: users,
          customRoots: customRoots
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = "musuarios.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // 3. Folder Specific Handlers
  const handleSyncRoot = async (rootName: string) => {
      const config = ROOT_DB_CONFIG[rootName];
      if (!config) return alert(`No hay configuración remota para ${rootName}`);
      
      setIsUpdating(true);
      try {
          const r = await fetch(config.url);
          if (!r.ok) throw new Error("No se pudo descargar la base de datos.");
          const newTracks: Track[] = await r.json();

          // Merge Logic: Remove old tracks from this root, add new ones
          const otherTracks = tracks.filter(t => !t.path.startsWith(rootName));
          // Ensure new tracks have the correct path prefix just in case, or trust the JSON
          const finalNewTracks = newTracks.map(t => ({...t, path: t.path.startsWith(rootName) ? t.path : `${rootName}/${t.path}`})); // Basic safety

          await updateTracks([...otherTracks, ...newTracks]); // Assuming JSON has correct paths
          alert(`Base de datos de ${rootName} actualizada (${newTracks.length} pistas).`);
      } catch (e) {
          alert(`Error al actualizar ${rootName}. Verifique la conexión.`);
          console.error(e);
      } finally {
          setIsUpdating(false);
      }
  };

  const handleExportRoot = (rootName: string) => {
      const config = ROOT_DB_CONFIG[rootName];
      // Filter tracks belonging to this root
      const rootTracks = tracks.filter(t => t.path.startsWith(rootName));
      if (rootTracks.length === 0) return alert(`No hay datos en ${rootName} para guardar.`);

      const dataStr = JSON.stringify(rootTracks, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = config ? config.filename : `${rootName.replace(/\s+/g, '').toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleClearRoot = async (rootName: string) => {
      if (!window.confirm(`¿Está seguro de BORRAR todos los datos de ${rootName}?`)) return;
      const remainingTracks = tracks.filter(t => !t.path.startsWith(rootName));
      await updateTracks(remainingTracks);
      alert(`Datos de ${rootName} eliminados.`);
  };

  // --- END HANDLERS ---

  const handleAddCustomRoot = (name: string) => {
      const newRoots = [...customRoots, name];
      setCustomRoots(newRoots);
      localStorage.setItem(CUSTOM_ROOTS_KEY, JSON.stringify(newRoots));
  };

  const handleRenameRoot = async (oldName: string, newName: string) => {
      const newRoots = customRoots.map(r => r === oldName ? newName : r);
      setCustomRoots(newRoots);
      localStorage.setItem(CUSTOM_ROOTS_KEY, JSON.stringify(newRoots));
      const updatedTracks = tracks.map(t => t.path.startsWith(oldName) ? { ...t, path: t.path.replace(oldName, newName) } : t);
      await updateTracks(updatedTracks);
      alert(`Carpeta "${oldName}" ahora es "${newName}".`);
  };

  const handleUploadMultipleTxt = async (files: FileList, targetRoot: string) => {
      if (!files || files.length === 0) return;
      setIsUpdating(true);
      let parsedTracks: Track[] = [];
      try {
          for (let i = 0; i < files.length; i++) {
              const text = await files[i].text();
              const t = parseTxtDatabase(text, targetRoot);
              parsedTracks = [...parsedTracks, ...t];
          }
          await updateTracks(prev => [...prev, ...parsedTracks]);
          alert(`${parsedTracks.length} pistas añadidas.`);
      } catch (e) { console.error(e); } finally { setIsUpdating(false); }
  };

  const handleSelectTrack = (track: Track) => { setSelectedTrack(track); };
  
  const handleToggleSelection = (track: Track) => { 
      setSelectedTracksList(prev => prev.find(t => t.id === track.id) ? prev.filter(t => t.id !== track.id) : [...prev, track]); 
  };

  const handleClearSelection = () => { 
      if (window.confirm('¿Eliminar la selección actual? El proceso no se puede deshacer.')) { 
          setSelectedTracksList([]); localStorage.removeItem(SELECTION_KEY);
      } 
  };

  const handleSaveSelectionPersist = () => {
    if (selectedTracksList.length === 0) return alert("No hay temas seleccionados para guardar.");
    if (savedSelections.length >= 5) {
        return alert("Has alcanzado el límite de 5 selecciones guardadas. Por favor, elimina alguna antes de guardar una nueva.");
    }
    const name = window.prompt("Nombre para esta selección:");
    if (!name) return;
    const newSelection: SavedSelection = {
        id: `sel-${Date.now()}`,
        name: name.trim(),
        date: new Date().toISOString(),
        tracks: [...selectedTracksList]
    };
    setSavedSelections(prev => [newSelection, ...prev]);
    setSelectedTracksList([]); 
    localStorage.removeItem(SELECTION_KEY);
    alert("Selección guardada y panel limpiado.");
  };

  const handleLoadSavedSelection = (sel: SavedSelection) => {
      if (selectedTracksList.length > 0) {
          if (!window.confirm("Tienes temas seleccionados actualmente. ¿Deseas agregar la selección guardada a los actuales?")) return;
      }
      const currentIds = new Set(selectedTracksList.map(t => t.id));
      const toAdd = sel.tracks.filter(t => !currentIds.has(t.id));
      setSelectedTracksList(prev => [...prev, ...toAdd]);
      alert(`${toAdd.length} temas cargados de "${sel.name}".`);
  };

  const handleDeleteSavedSelection = (id: string) => {
      if (window.confirm("¿Eliminar esta selección guardada?")) {
          setSavedSelections(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleProcessWishlist = () => {
      if (!wishlistText.trim()) return;
      const queries = wishlistText.split('\n').map(l => l.trim()).filter(l => l);
      const found: Track[] = [];
      queries.forEach(q => {
          const match = tracks.find(t => t.metadata.title.toLowerCase().includes(q.toLowerCase()) || t.filename.toLowerCase().includes(q.toLowerCase()));
          if (match && !selectedTracksList.find(s => s.id === match.id)) found.push(match);
      });
      if (found.length > 0) {
          setSelectedTracksList(prev => [...prev, ...found]);
          alert(`${found.length} temas añadidos.`);
      } else { alert("No se encontraron temas."); }
      setShowWishlist(false); setWishlistText('');
  };

  const handleOpenExportModal = () => {
      setEditingReportId(null);
      const items: ExportItem[] = selectedTracksList.map(t => ({ 
          id: t.id, 
          title: t.metadata.title, 
          author: t.metadata.author, 
          authorCountry: t.metadata.authorCountry || '', 
          performer: t.metadata.performer, 
          performerCountry: t.metadata.performerCountry || '', 
          genre: t.metadata.genre || '', 
          source: 'db', 
          path: t.path 
      }));
      setExportItems(items); 
      setShowExportModal(true);
  };

  const handleUpdateExportItem = (index: number, field: keyof ExportItem, value: string) => {
      const newItems = [...exportItems];
      newItems[index] = { ...newItems[index], [field]: value };
      setExportItems(newItems);
  };

  const handleShareWhatsApp = () => {
      let message = `*CRÉDITOS RCM*\n*Programa:* ${programName}\n\n`;
      exportItems.forEach(item => { 
          message += `🎵 *${item.title}* - ${item.performer}\n📂 _${item.path || 'Manual'}_\n\n`; 
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDownloadReport = async () => {
      if (!currentUser) return;
      const pdfBlob = generateReportPDF({ userFullName: currentUser.fullName, userUniqueId: currentUser.uniqueId || 'N/A', program: programName, items: exportItems });
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `PM-${programName}-${dateStr}.pdf`;
      await saveReportToDB({ id: editingReportId || `rep-${Date.now()}`, date: new Date().toISOString(), program: programName, generatedBy: currentUser.username, fileName, pdfBlob, items: exportItems, status: { downloaded: false, sent: false } });
      alert("Reporte PDF generado y guardado en Reportes.");
      setShowExportModal(false);
  };

  const handleSaveEdit = (updatedTrack: Track) => {
      updateTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      if (view === ViewState.SELECTION) {
           setSelectedTracksList(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
      }
      setSelectedTrack(null);
  };

  const handleEditReport = (report: Report) => {
      if (report.items) {
          setExportItems(report.items);
          setProgramName(report.program);
          setEditingReportId(report.id);
          setShowExportModal(true);
      }
  };

  const navigateTo = (v: ViewState) => { setView(v); window.history.pushState({ view: v }, ''); };

  if (view === ViewState.LOGIN) return <LoginScreen onLoginSuccess={handleLoginSuccess} users={users} onUpdateUsers={handleSyncData} isUpdating={isUpdating} />;

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col font-display">
        
        <datalist id="genre-options">
            {GENRES_LIST.map(g => <option key={g} value={g} />)}
        </datalist>
        <datalist id="country-options">
            {COUNTRIES_LIST.map(c => <option key={c} value={c} />)}
        </datalist>

        <header className="bg-azul-header text-white px-4 py-3 flex items-center justify-between shadow-md relative z-20 shrink-0">
            <button className="flex items-center gap-3" onClick={() => navigateTo(ViewState.LIST)}>
                <div className="size-10 flex items-center justify-center bg-white/10 rounded-full border-2 border-white/20 overflow-hidden p-1">
                     <img 
                        src="icons/Logo Cmnl Musica.png" 
                        alt="Logo" 
                        className="w-full h-full object-contain"
                     />
                </div>
                <div className="text-left">
                    <h1 className="text-sm font-bold tracking-tight">CMNL MÚSICA</h1>
                    <span className="text-[8px] opacity-60 font-bold uppercase">Gestión Musical</span>
                </div>
            </button>
            <div className="flex items-center gap-2">
                <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${authMode === 'admin' ? 'bg-miel' : 'bg-green-600'}`}>
                    {authMode === 'admin' ? 'COORDINADOR' : (authMode === 'director' ? 'DIRECTOR' : 'USUARIO')}
                </div>
                {authMode === 'admin' && (
                    <button onClick={handleExportUsersDB} className="text-white/70 hover:text-white size-8 flex items-center justify-center bg-white/10 rounded-full transition-colors" title="Guardar BD Usuarios">
                        <span className="material-symbols-outlined text-sm">save</span>
                    </button>
                )}
                <button onClick={handleSyncData} className="text-white/70 hover:text-white size-8 flex items-center justify-center bg-white/10 rounded-full transition-colors" title="Sincronizar">
                    <span className={`material-symbols-outlined text-sm ${isUpdating ? 'animate-spin' : ''}`}>sync</span>
                </button>
                <button onClick={handleLogout} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full size-8 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-base">logout</span>
                </button>
            </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList 
                    tracks={tracks} onSelectTrack={handleSelectTrack} onUploadTxt={handleUploadMultipleTxt} isAdmin={authMode === 'admin'} 
                    onSyncRoot={handleSyncRoot} onExportRoot={handleExportRoot} onClearRoot={handleClearRoot} 
                    customRoots={customRoots} onAddCustomRoot={handleAddCustomRoot} onRenameRoot={handleRenameRoot}
                    selectedTrackIds={new Set(selectedTracksList.map(t => t.id))} onToggleSelection={handleToggleSelection}
                />
            )}
            
            {view === ViewState.SELECTION && (
                <div className="h-full bg-background-light flex flex-col">
                    <div className="p-4 bg-white border-b flex items-center justify-between">
                         <h2 className="font-bold text-gray-800 flex items-center gap-2"><span className="material-symbols-outlined text-primary">checklist</span> Selección</h2>
                         <div className="flex gap-2">
                             <button onClick={() => setShowWishlist(true)} className="text-[9px] font-bold uppercase bg-miel/10 text-miel px-3 py-1.5 rounded-lg flex items-center gap-1">Deseos</button>
                             <button onClick={handleClearSelection} className="text-[9px] font-bold uppercase bg-red-50 text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1">Limpiar</button>
                         </div>
                    </div>
                    
                    {savedSelections.length > 0 && (
                        <div className="bg-white border-b border-gray-100 p-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Guardadas ({savedSelections.length}/5)</p>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-2">
                                {savedSelections.map(sel => (
                                    <div key={sel.id} className="flex-none bg-gray-50 border border-gray-200 rounded-lg p-2 min-w-[120px] flex flex-col gap-1">
                                        <div className="flex justify-between items-start">
                                            <span className="font-bold text-xs text-gray-800 truncate w-20">{sel.name}</span>
                                            <button onClick={() => handleDeleteSavedSelection(sel.id)} className="text-gray-400 hover:text-red-500"><span className="material-symbols-outlined text-xs">close</span></button>
                                        </div>
                                        <div className="text-[9px] text-gray-500">{sel.tracks.length} temas</div>
                                        <button onClick={() => handleLoadSavedSelection(sel)} className="text-[9px] bg-white border border-gray-200 rounded py-1 font-bold text-azul-header hover:bg-azul-header hover:text-white transition-colors">Cargar</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto">
                        <TrackList 
                            tracks={selectedTracksList} onSelectTrack={handleSelectTrack} onUploadTxt={() => {}} isAdmin={false} 
                            onSyncRoot={() => {}} onExportRoot={() => {}} onClearRoot={() => {}} 
                            isSelectionView={true} customRoots={[]} onAddCustomRoot={() => {}} onRenameRoot={() => {}}
                            onToggleSelection={handleToggleSelection} selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                        />
                    </div>
                    <div className="p-4 bg-white border-t flex flex-col gap-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                         <button onClick={handleSaveSelectionPersist} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2">
                             <span className="material-symbols-outlined text-sm">save</span> Guardar Selección
                         </button>
                         <button onClick={handleOpenExportModal} className="w-full bg-azul-header text-white py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">ios_share</span> Exportar / Compartir ({selectedTracksList.length})
                         </button>
                    </div>
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && <Settings tracks={tracks} users={users} onAddUser={() => {}} onEditUser={() => {}} onDeleteUser={() => {}} onExportUsers={handleExportUsersDB} onImportUsers={() => {}} currentUser={currentUser} />}
            {view === ViewState.PRODUCTIONS && authMode === 'admin' && <Productions onUpdateTracks={updateTracks} allTracks={tracks} />}
            {view === ViewState.REPORTS && authMode === 'director' && <ReportsViewer onEdit={handleEditReport} currentUser={currentUser} />}
            {view === ViewState.GUIDE && authMode !== 'admin' && <Guide />}
        </div>

        {selectedTrack && (
            <TrackDetail 
                track={selectedTrack} authMode={authMode} onClose={() => setSelectedTrack(null)} 
                onSearchCredits={() => {}} 
                onSaveEdit={handleSaveEdit}
            />
        )}

        {showWishlist && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowWishlist(false)}>
                <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h3 className="font-bold text-lg mb-2">Lista de Deseos</h3>
                    <textarea className="w-full h-40 p-3 border rounded-xl text-sm outline-none" placeholder="Títulos..." value={wishlistText} onChange={e => setWishlistText(e.target.value)} />
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setShowWishlist(false)} className="flex-1 py-3 text-gray-500 font-bold">Cerrar</button>
                        <button onClick={handleProcessWishlist} className="flex-1 py-3 bg-miel text-white rounded-xl font-bold shadow-lg">Buscar</button>
                    </div>
                </div>
            </div>
        )}

        {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowExportModal(false)}>
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[85vh]" onClick={e => e.stopPropagation()}>
                    
                    <div className="flex justify-between items-center p-4 border-b shrink-0">
                        <div>
                            <h3 className="font-bold text-gray-900">Exportar Selección</h3>
                            <p className="text-xs text-gray-400">Edita los detalles antes de compartir</p>
                        </div>
                        <button onClick={() => setShowExportModal(false)}><span className="material-symbols-outlined text-gray-400">close</span></button>
                    </div>

                    <div className="p-4 bg-gray-50 border-b shrink-0">
                        <label className="text-xs font-bold text-gray-500 block mb-1">Programa</label>
                        <select value={programName} onChange={e => setProgramName(e.target.value)} className="w-full p-2 border rounded bg-white text-sm outline-none">
                            {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {exportItems.map((item, idx) => (
                            <div key={item.id} className="p-4 border rounded-xl bg-white shadow-sm">
                                <div className="mb-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Título</label>
                                    <input className="w-full p-1 border-b text-sm font-bold outline-none focus:border-primary" value={item.title} onChange={e => handleUpdateExportItem(idx, 'title', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Autor</label>
                                        <input className="w-full p-1 border-b text-xs outline-none focus:border-primary" value={item.author} onChange={e => handleUpdateExportItem(idx, 'author', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">País Autor</label>
                                        <input className="w-full p-1 border-b text-xs outline-none focus:border-primary" list="country-options" value={item.authorCountry} onChange={e => handleUpdateExportItem(idx, 'authorCountry', e.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Intérprete</label>
                                        <input className="w-full p-1 border-b text-xs outline-none focus:border-primary" value={item.performer} onChange={e => handleUpdateExportItem(idx, 'performer', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">País Intérprete</label>
                                        <input className="w-full p-1 border-b text-xs outline-none focus:border-primary" list="country-options" value={item.performerCountry} onChange={e => handleUpdateExportItem(idx, 'performerCountry', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Género</label>
                                    <input className="w-full p-1 border-b text-xs outline-none focus:border-primary" list="genre-options" value={item.genre} onChange={e => handleUpdateExportItem(idx, 'genre', e.target.value)} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-3 bg-gray-50 border-t shrink-0">
                        <button onClick={handleShareWhatsApp} className={`bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm ${authMode !== 'director' ? 'col-span-2' : ''}`}>
                            <i className="material-symbols-outlined text-lg">chat</i> WhatsApp
                        </button>
                        {authMode === 'director' && (
                            <button onClick={handleDownloadReport} className="bg-primary text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                                <i className="material-symbols-outlined text-lg">picture_as_pdf</i> Generar PDF
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* GLOBAL LOADING OVERLAY */}
        {isUpdating && (
            <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 animate-fade-in">
                    <div className="relative size-12">
                        <svg className="animate-spin size-12 text-gray-200" viewBox="0 0 24 24"></svg> 
                        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div className="text-center">
                        <h4 className="font-bold text-gray-800 dark:text-white">Actualizando</h4>
                        <p className="text-xs text-gray-500">Por favor espere...</p>
                    </div>
                </div>
            </div>
        )}

        <nav className="bg-white border-t border-gray-200 h-20 px-4 flex items-center justify-between pb-2 z-20 shrink-0">
            <NavButton icon="folder_open" label="Explorar" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
            <NavButton icon="checklist" label="Selección" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
            {authMode === 'director' && <NavButton icon="description" label="Reportes" active={view === ViewState.REPORTS} onClick={() => navigateTo(ViewState.REPORTS)} />}
            {authMode === 'admin' && <NavButton icon="playlist_add" label="Producción" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
            {authMode === 'admin' && <NavButton icon="settings" label="Ajustes" active={view === ViewState.SETTINGS} onClick={() => navigateTo(ViewState.SETTINGS)} />}
            {authMode !== 'admin' && <NavButton icon="help" label="Guía" active={view === ViewState.GUIDE} onClick={() => navigateTo(ViewState.GUIDE)} />}
        </nav>
    </div>
  );
};

const NavButton: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center transition-all ${active ? 'text-primary' : 'text-gray-400'}`}>
        <span className={`material-symbols-outlined text-2xl ${active ? 'material-symbols-filled' : ''}`}>{icon}</span>
        <span className="text-[9px] font-bold uppercase mt-1">{label}</span>
    </button>
);

export default App;
