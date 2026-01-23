
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
import { loadTracksFromDB, saveTracksToDB, saveReportToDB } from './services/db'; 
import { generateReportPDF } from './services/pdfService';
import * as XLSX from 'xlsx';

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';
const SELECTION_KEY = 'rcm_current_selection';
const CUSTOM_ROOTS_KEY = 'rcm_custom_roots';

const DB_URLS: Record<string, string> = {
    'Música 1': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos1.json',
    'Música 2': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos2.json',
    'Música 3': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos3.json',
    'Música 4': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos4.json', 
    'Música 5': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/mdatos5.json',
    'Otros': 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/refs/heads/main/motros.json'
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
  const [missingQueries, setMissingQueries] = useState<string[]>([]);
  const [wishlistText, setWishlistText] = useState('');

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportItems, setExportItems] = useState<ExportItem[]>([]);
  const [programName, setProgramName] = useState(PROGRAMS_LIST[0]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null); 

  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const initApp = async () => {
        try { const dbTracks = await loadTracksFromDB(); if (dbTracks.length > 0) setTracks(dbTracks); } catch (e) { console.error(e); }
        
        // Load Users
        const localUsers = localStorage.getItem(USERS_KEY);
        let currentUsersList = [DEFAULT_ADMIN];
        if (localUsers) { try { const parsed = JSON.parse(localUsers); if (Array.isArray(parsed) && parsed.length > 0) currentUsersList = parsed; } catch { } }
        setUsers(currentUsersList);

        // Load Custom Roots
        const savedRoots = localStorage.getItem(CUSTOM_ROOTS_KEY);
        if (savedRoots) setCustomRoots(JSON.parse(savedRoots));

        // Load Persistent Selection
        const savedSelection = localStorage.getItem(SELECTION_KEY);
        if (savedSelection) setSelectedTracksList(JSON.parse(savedSelection));

        // Auth
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

  // Save selection to storage whenever it changes
  useEffect(() => {
    if (authMode) {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selectedTracksList));
    }
  }, [selectedTracksList, authMode]);

  // Back Button Logic for internal navigation
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

  const updateUsers = (newUsers: User[]) => {
      setUsers(newUsers);
      localStorage.setItem(USERS_KEY, JSON.stringify(newUsers));
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
          updateUsers(j);
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

  const handleRenameRoot = (oldName: string, newName: string) => {
      const newRoots = customRoots.map(r => r === oldName ? newName : r);
      setCustomRoots(newRoots);
      localStorage.setItem(CUSTOM_ROOTS_KEY, JSON.stringify(newRoots));
      // Update tracks path
      setTracks(prev => prev.map(t => t.path.startsWith(oldName) ? { ...t, path: t.path.replace(oldName, newName) } : t));
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
      if (window.confirm('¿Está seguro de eliminar la selección actual? Esta acción no se puede deshacer.')) { 
          setSelectedTracksList([]); setMissingQueries([]); localStorage.removeItem(SELECTION_KEY);
      } 
  };

  const handleSaveSelection = () => {
      if (selectedTracksList.length === 0) return alert("Selección vacía.");
      const date = new Date().toISOString().split('T')[0];
      const prog = programName || "General";
      const name = `S+${date.replace(/-/g, '')}+${prog.replace(/\s+/g, '')}`;
      
      const saved: SavedSelection = {
          id: `sel-${Date.now()}`,
          name: name,
          date: date,
          program: prog,
          tracks: [...selectedTracksList]
      };
      
      const existing = JSON.parse(localStorage.getItem('rcm_saved_selections') || '[]');
      localStorage.setItem('rcm_saved_selections', JSON.stringify([...existing, saved]));
      alert(`Selección guardada como: ${name}`);
  };

  const handleOpenExportModal = () => {
      setEditingReportId(null);
      const items: ExportItem[] = [];
      selectedTracksList.forEach(t => { items.push({ id: t.id, title: t.metadata.title || t.filename, author: t.metadata.author || '', authorCountry: t.metadata.authorCountry || '', performer: t.metadata.performer || '', performerCountry: t.metadata.performerCountry || '', genre: t.metadata.genre || '', source: 'db', path: t.path }); });
      missingQueries.forEach((q, idx) => { items.push({ id: `missing-${idx}`, title: q, author: '', authorCountry: '', performer: '', performerCountry: '', genre: '', source: 'manual' }); });
      setExportItems(items); setShowExportModal(true);
  };

  const handleUpdateExportItem = (id: string, field: keyof ExportItem, value: string) => { 
      setExportItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item)); 
  };

  const handleShareWhatsApp = () => {
      let message = `*CRÉDITOS RCM*\n*Programa:* ${programName}\n\n`;
      exportItems.forEach(item => { 
          message += `🎵 *${item.title}*\n👤 ${item.performer}\n✍️ ${item.author}\n📂 _${item.path || 'Manual'}_\n\n`; 
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
      const reportId = editingReportId || `rep-${Date.now()}`;
      
      await saveReportToDB({
          id: reportId,
          date: new Date().toISOString(),
          program: programName,
          generatedBy: currentUser.username,
          fileName: fileName,
          pdfBlob: pdfBlob,
          items: exportItems,
          status: { downloaded: false, sent: false }
      });
      alert("Reporte guardado localmente en la sección de Reportes.");
      setShowExportModal(false);
  };

  // Added handleEditReport to fix "Cannot find name 'handleEditReport'" error
  const handleEditReport = (report: Report) => {
      if (report.items) {
          setExportItems(report.items);
          setProgramName(report.program);
          setEditingReportId(report.id);
          setShowExportModal(true);
      } else {
          alert("Este reporte no contiene items editables.");
      }
  };

  const navigateTo = (v: ViewState) => { 
      if (view === ViewState.SELECTION && v !== ViewState.SELECTION && selectedTracksList.length > 0) {
          // Warning already handled by persistence, but good to keep UI consistent
      }
      setView(v); 
      window.history.pushState({ view: v }, ''); 
  };

  if (view === ViewState.LOGIN) return <LoginScreen onLoginSuccess={handleLoginSuccess} users={users} onUpdateUsers={handleSyncUsersAndApp} isUpdating={isUpdating} />;

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {/* HEADER WITH NEW LOGO INSPIRED BY IMAGE */}
        <header className="bg-azul-header text-white px-4 py-3 flex items-center justify-between shadow-md relative z-20 shrink-0">
            <button className="flex items-center gap-2" onClick={() => navigateTo(ViewState.LIST)}>
                <div className="size-10 relative flex items-center justify-center bg-white rounded-full p-1 shadow-inner overflow-hidden border-2 border-miel/30">
                    <svg viewBox="0 0 100 100" className="size-full">
                        <circle cx="50" cy="50" r="48" fill="white" />
                        <rect x="0" y="60" width="100" height="40" fill="#df4534" opacity="0.8" />
                        <path d="M40 30 L40 50 Q40 55 35 55 Q30 55 30 50 Q30 45 35 45 Q40 45 40 50" stroke="#df4534" strokeWidth="4" fill="none" />
                        <path d="M60 55 L60 25 L75 40" stroke="#1a3a5f" strokeWidth="4" fill="none" />
                        <line x1="60" y1="55" x2="60" y2="25" stroke="#1a3a5f" strokeWidth="4" />
                        <circle cx="60" cy="25" r="3" fill="#df4534" />
                        <path d="M55 20 Q60 10 65 20" stroke="#1a3a5f" strokeWidth="1" fill="none" opacity="0.5" />
                        <rect x="35" y="70" width="30" height="2" fill="white" />
                        <circle cx="40" cy="80" r="2" fill="white" />
                        <circle cx="50" cy="80" r="2" fill="white" />
                        <circle cx="60" cy="80" r="2" fill="white" />
                    </svg>
                </div>
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold leading-none tracking-tight">RCM MÚSICA</h1>
                    <span className="text-[8px] opacity-70 tracking-widest font-bold">FONOTECA DIGITAL</span>
                </div>
            </button>
            <div className="flex items-center gap-2">
                <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${authMode === 'admin' ? 'bg-miel' : 'bg-green-600'}`}>
                    {authMode === 'admin' ? 'COORDINADOR' : (authMode === 'director' ? 'DIRECTOR' : 'USUARIO')}
                </div>
                <button onClick={handleLogout} className="text-white bg-white/10 p-2 rounded-full size-8 flex items-center justify-center"><span className="material-symbols-outlined text-base">logout</span></button>
            </div>
        </header>

        {/* LOADING OVERLAY */}
        {isUpdating && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6">
                <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-bold">Sincronizando...</p>
            </div>
        )}

        {/* MAIN CONTENT */}
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
                        isSelectionView={true} 
                        onClearSelection={handleClearSelection}
                        onOpenExportPreview={handleOpenExportModal}
                        customRoots={[]}
                        onAddCustomRoot={() => {}}
                        onRenameRoot={() => {}}
                    />
                    <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                         <button onClick={handleSaveSelection} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-sm">save</span> Guardar Selección
                         </button>
                         <button onClick={handleClearSelection} className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                            <span className="material-symbols-outlined text-sm">delete</span> Eliminar Selección
                         </button>
                    </div>
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && <Settings tracks={tracks} users={users} onAddUser={() => {}} onEditUser={() => {}} onDeleteUser={() => {}} onExportUsers={() => {}} onImportUsers={() => {}} currentUser={currentUser} />}
            {view === ViewState.PRODUCTIONS && authMode === 'admin' && <Productions onUpdateTracks={updateTracks} allTracks={tracks} />}
            {view === ViewState.REPORTS && (authMode === 'director' || authMode === 'admin') && <ReportsViewer onEdit={handleEditReport} currentUser={currentUser} />}
            {view === ViewState.GUIDE && <Guide />}
        </div>

        {/* EXPORT MODAL */}
        {showExportModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowExportModal(false)}>
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="font-bold text-gray-800">Exportar Reporte</h3>
                        <button onClick={() => setShowExportModal(false)}><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <div className="p-4 bg-gray-50 space-y-3">
                         <label className="block text-[10px] font-bold text-gray-400 uppercase">Programa</label>
                         <select value={programName} onChange={e => setProgramName(e.target.value)} className="w-full p-2 border rounded bg-white">
                            {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {exportItems.map(item => (
                            <div key={item.id} className="p-2 border rounded text-xs">
                                <p className="font-bold">{item.title}</p>
                                <p className="text-gray-500">{item.performer} | {item.author}</p>
                                <p className="text-[10px] text-gray-400 italic truncate">{item.path || 'Manual'}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-2">
                        <button onClick={handleShareWhatsApp} className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">share</span> WhatsApp
                        </button>
                        <button onClick={handleDownloadReport} className="bg-azul-header text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">save_as</span> PDF
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* NAVIGATION BAR */}
        <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-2 flex items-center justify-between pb-2 z-20 shrink-0">
            <NavButton icon="folder_open" label="Explorador" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
            <NavButton icon="checklist" label="Selección" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
            {(authMode === 'director' || authMode === 'admin') && <NavButton icon="description" label="Reportes" active={view === ViewState.REPORTS} onClick={() => navigateTo(ViewState.REPORTS)} />}
            {authMode === 'admin' && <NavButton icon="playlist_add" label="Producción" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
            <NavButton icon="help" label="Guía" active={view === ViewState.GUIDE} onClick={() => navigateTo(ViewState.GUIDE)} />
        </nav>
    </div>
  );
};

const NavButton: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center h-full transition-colors relative ${active ? 'text-azul-header' : 'text-gray-400'}`}>
        <span className={`material-symbols-outlined text-2xl ${active ? 'material-symbols-filled' : ''}`}>{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide mt-1">{label}</span>
    </button>
);

export default App;
