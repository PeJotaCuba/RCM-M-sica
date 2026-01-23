
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode, User, PROGRAMS_LIST, Report, ExportItem, SavedSelection } from './types';
import { parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import ReportsViewer from './components/ReportsViewer';
import Guide from './components/Guide';
import { fetchCreditsFromGemini } from './services/geminiService';
import { loadTracksFromDB, saveTracksToDB, saveReportToDB, deleteReportFromDB } from './services/db'; 
import { generateReportPDF } from './services/pdfService';

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';
const SELECTION_KEY = 'rcm_current_selection';
const CUSTOM_ROOTS_KEY = 'rcm_custom_roots';

const USERS_DB_URL = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/musuarios.json';

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
  const [customRoots, setCustomRoots] = useState<string[]>([]);

  const [showWishlist, setShowWishlist] = useState(false);
  const [wishlistText, setWishlistText] = useState('');

  // Export State
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

        const savedSelection = localStorage.getItem(SELECTION_KEY);
        if (savedSelection) setSelectedTracksList(JSON.parse(savedSelection));

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

  useEffect(() => {
    if (authMode) {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedTracksList));
    }
  }, [selectedTracksList, authMode]);

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

  const handleSyncUsersAndApp = async () => {
      setIsUpdating(true);
      try {
          const r = await fetch(USERS_DB_URL);
          const j = await r.json();
          setUsers(j);
          localStorage.setItem(USERS_KEY, JSON.stringify(j));
          alert("Sincronización completada.");
          window.location.reload(); 
      } catch(e) {
          alert("Error al sincronizar.");
      } finally {
          setIsUpdating(false);
      }
  };

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
      alert(`Carpeta renombrada de "${oldName}" a "${newName}".`);
  };

  const handleUploadMultipleTxt = async (files: FileList, targetRoot: string) => {
      if (!files || files.length === 0) return;
      const filesArray = Array.from(files);
      setIsUpdating(true);
      let parsedTracks: Track[] = [];
      try {
          for (let i = 0; i < filesArray.length; i++) {
              const text = await filesArray[i].text();
              const t = parseTxtDatabase(text, targetRoot);
              parsedTracks = [...parsedTracks, ...t];
          }
          await updateTracks(prev => [...prev, ...parsedTracks]);
          alert(`${parsedTracks.length} pistas integradas.`);
      } catch (e) { console.error(e); } finally { setIsUpdating(false); }
  };

  const handleSelectTrack = (track: Track) => { setSelectedTrack(track); };
  
  const handleToggleSelection = (track: Track) => { 
      setSelectedTracksList(prev => prev.find(t => t.id === track.id) ? prev.filter(t => t.id !== track.id) : [...prev, track]); 
  };

  const handleClearSelection = () => { 
      if (window.confirm('¿Está seguro de eliminar la selección actual?')) { 
          setSelectedTracksList([]); localStorage.removeItem(SELECTION_KEY);
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
          alert(`${found.length} temas encontrados y añadidos.`);
      } else {
          alert("No se encontraron coincidencias exactas.");
      }
      setShowWishlist(false);
      setWishlistText('');
  };

  const handleOpenExportModal = () => {
      setEditingReportId(null);
      const items: ExportItem[] = selectedTracksList.map(t => ({ 
          id: t.id, title: t.metadata.title, author: t.metadata.author, authorCountry: t.metadata.authorCountry || '', 
          performer: t.metadata.performer, performerCountry: t.metadata.performerCountry || '', 
          genre: t.metadata.genre || '', source: 'db', path: t.path 
      }));
      setExportItems(items); 
      setShowExportModal(true);
  };

  const handleShareWhatsApp = () => {
      let message = `*CRÉDITOS RCM*\n*Programa:* ${programName}\n\n`;
      exportItems.forEach(item => { 
          message += `🎵 *${item.title}*\n👤 ${item.performer}\n📂 _${item.path || 'Manual'}_\n\n`; 
      });
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDownloadReport = async () => {
      if (!currentUser) return;
      const pdfBlob = generateReportPDF({
          userFullName: currentUser.fullName,
          userUniqueId: currentUser.uniqueId || 'N/A',
          program: programName,
          items: exportItems
      });
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `PM-${programName}-${dateStr}.pdf`;
      
      await saveReportToDB({
          id: editingReportId || `rep-${Date.now()}`,
          date: new Date().toISOString(),
          program: programName,
          generatedBy: currentUser.username,
          fileName: fileName,
          pdfBlob: pdfBlob,
          items: exportItems,
          status: { downloaded: false, sent: false }
      });
      alert("Reporte guardado.");
      setShowExportModal(false);
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

  if (view === ViewState.LOGIN) return <LoginScreen onLoginSuccess={handleLoginSuccess} users={users} onUpdateUsers={handleSyncUsersAndApp} isUpdating={isUpdating} />;

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col font-display">
        
        {/* HEADER CON LOGO REDISEÑADO */}
        <header className="bg-azul-header text-white px-4 py-3 flex items-center justify-between shadow-md relative z-20 shrink-0">
            <button className="flex items-center gap-3" onClick={() => navigateTo(ViewState.LIST)}>
                <div className="size-10 flex items-center justify-center bg-white rounded-full border-2 border-miel/40 shadow-inner">
                    <svg viewBox="0 0 100 100" className="size-8">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#d4a017" strokeWidth="2" strokeDasharray="4 2" className="animate-[spin_10s_linear_infinite]" />
                        <path d="M40 35 L40 65 Q40 70 35 70 Q30 70 30 65 Q30 60 35 60 Q40 60 40 65" fill="#df4534" />
                        <path d="M40 35 L65 30 L65 60 Q65 65 60 65 Q55 65 55 60 Q55 55 60 55 Q65 55 65 60" fill="#1a3a5f" />
                    </svg>
                </div>
                <div className="text-left">
                    <h1 className="text-sm font-bold leading-tight tracking-tight">RCM MÚSICA</h1>
                    <span className="text-[8px] opacity-60 tracking-widest font-bold uppercase">Patrimonio Sonoro</span>
                </div>
            </button>
            <div className="flex items-center gap-2">
                <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${authMode === 'admin' ? 'bg-miel' : 'bg-green-600'}`}>
                    {authMode === 'admin' ? 'COORD.' : (authMode === 'director' ? 'DIR.' : 'USR.')}
                </div>
                <button onClick={handleLogout} className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full size-8 flex items-center justify-center transition-colors">
                    <span className="material-symbols-outlined text-base">logout</span>
                </button>
            </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList 
                    tracks={tracks} 
                    onSelectTrack={handleSelectTrack} 
                    onUploadTxt={handleUploadMultipleTxt} 
                    isAdmin={authMode === 'admin'} 
                    onSyncRoot={() => {}} 
                    onExportRoot={() => {}} 
                    onClearRoot={() => {}} 
                    customRoots={customRoots}
                    onAddCustomRoot={handleAddCustomRoot}
                    onRenameRoot={handleRenameRoot}
                    selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                    onToggleSelection={handleToggleSelection}
                />
            )}
            
            {view === ViewState.SELECTION && (
                <div className="h-full bg-background-light flex flex-col">
                    <div className="p-4 bg-white border-b flex items-center justify-between">
                         <h2 className="font-bold text-gray-800 flex items-center gap-2"><span className="material-symbols-outlined text-primary">checklist</span> Selección</h2>
                         <div className="flex gap-2">
                             <button onClick={() => setShowWishlist(true)} className="text-[10px] font-bold uppercase bg-miel/10 text-miel px-3 py-1.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">list_alt</span> Deseos
                             </button>
                             <button onClick={handleClearSelection} className="text-[10px] font-bold uppercase bg-red-50 text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">delete</span> Limpiar
                             </button>
                         </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <TrackList 
                            tracks={selectedTracksList} 
                            onSelectTrack={handleSelectTrack} 
                            onUploadTxt={() => {}} 
                            isAdmin={false} 
                            onSyncRoot={() => {}} onExportRoot={() => {}} onClearRoot={() => {}} 
                            isSelectionView={true} 
                            customRoots={[]} onAddCustomRoot={() => {}} onRenameRoot={() => {}}
                            onToggleSelection={handleToggleSelection}
                            selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                        />
                    </div>
                    <div className="p-4 bg-white border-t">
                         <button onClick={handleOpenExportModal} className="w-full bg-azul-header text-white py-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined">description</span> Exportar Reporte ({selectedTracksList.length})
                         </button>
                    </div>
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && <Settings tracks={tracks} users={users} onAddUser={() => {}} onEditUser={() => {}} onDeleteUser={() => {}} onExportUsers={() => {}} onImportUsers={() => {}} currentUser={currentUser} />}
            {view === ViewState.PRODUCTIONS && authMode === 'admin' && <Productions onUpdateTracks={updateTracks} allTracks={tracks} />}
            {view === ViewState.REPORTS && authMode === 'director' && <ReportsViewer onEdit={handleEditReport} currentUser={currentUser} />}
            {view === ViewState.GUIDE && <Guide />}
        </div>

        {/* MODAL LISTA DE DESEOS */}
        {showWishlist && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowWishlist(false)}>
                <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <h3 className="font-bold text-lg mb-2">Lista de Deseos</h3>
                    <p className="text-xs text-gray-400 mb-4">Pega títulos de canciones (uno por línea) para buscarlos automáticamente.</p>
                    <textarea 
                        className="w-full h-40 p-3 border rounded-xl text-sm focus:border-miel outline-none"
                        placeholder="Ejemplo:&#10;La Guantanamera&#10;Sauto&#10;El Manisero"
                        value={wishlistText}
                        onChange={e => setWishlistText(e.target.value)}
                    />
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setShowWishlist(false)} className="flex-1 py-3 text-gray-500 font-bold">Cancelar</button>
                        <button onClick={handleProcessWishlist} className="flex-1 py-3 bg-miel text-white rounded-xl font-bold shadow-lg">Buscar temas</button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL EXPORTAR */}
        {showExportModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowExportModal(false)}>
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="font-bold text-gray-800">Finalizar Reporte</h3>
                        <button onClick={() => setShowExportModal(false)}><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <div className="p-4 bg-gray-50">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nombre del Programa</label>
                         <select value={programName} onChange={e => setProgramName(e.target.value)} className="w-full p-2 border rounded bg-white text-sm">
                            {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {exportItems.map(item => (
                            <div key={item.id} className="p-3 border rounded-xl text-[11px] bg-white">
                                <p className="font-bold text-gray-800">{item.title}</p>
                                <p className="text-gray-500">{item.performer}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-3 bg-gray-50 rounded-b-2xl">
                        <button onClick={handleShareWhatsApp} className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">share</span> WhatsApp
                        </button>
                        <button onClick={handleDownloadReport} className="bg-primary text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg">
                            <span className="material-symbols-outlined text-sm">save_as</span> Guardar PDF
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* BARRA DE NAVEGACIÓN */}
        <nav className="bg-white border-t border-gray-200 h-20 px-4 flex items-center justify-between pb-2 z-20 shrink-0">
            <NavButton icon="folder_open" label="Explorar" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
            <NavButton icon="checklist" label="Selección" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
            {authMode === 'director' && <NavButton icon="description" label="Reportes" active={view === ViewState.REPORTS} onClick={() => navigateTo(ViewState.REPORTS)} />}
            {authMode === 'admin' && <NavButton icon="playlist_add" label="Producción" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
            {authMode === 'admin' && <NavButton icon="settings" label="Ajustes" active={view === ViewState.SETTINGS} onClick={() => navigateTo(ViewState.SETTINGS)} />}
            <NavButton icon="help" label="Guía" active={view === ViewState.GUIDE} onClick={() => navigateTo(ViewState.GUIDE)} />
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
