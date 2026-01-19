
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode, User, PROGRAMS_LIST, Report } from './types';
import { parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import ReportsViewer from './components/ReportsViewer';
import { fetchCreditsFromGemini } from './services/geminiService';
import { loadTracksFromDB, saveTracksToDB, saveReportToDB } from './services/db'; 
import { generateReportPDF } from './services/pdfService';
import * as XLSX from 'xlsx';
import * as docx from 'docx';

const AUTH_KEY = 'rcm_auth_session';
const USERS_KEY = 'rcm_users_db';

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
  const [programName, setProgramName] = useState(PROGRAMS_LIST[0]);
  const [editingReportId, setEditingReportId] = useState<string | null>(null); // To track if we are updating an existing report

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

  const generateUniqueId = (name: string) => {
      const cleanName = name ? name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10) : 'USR';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let random = '';
      for (let i = 0; i < 16; i++) { random += chars.charAt(Math.floor(Math.random() * chars.length)); }
      return `RCM-${cleanName}-${random}`;
  };

  useEffect(() => {
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
      if (currentUser) {
          const stillExists = newUsers.find(u => u.username === currentUser.username);
          if (!stillExists) { handleLogout(); } 
          else if (stillExists.password !== currentUser.password) { handleLogout(); alert("Contraseña cambiada."); } 
          else { setCurrentUser(stillExists); localStorage.setItem(AUTH_KEY, JSON.stringify(stillExists)); }
      }
  };

  useEffect(() => {
    const initApp = async () => {
        try { const dbTracks = await loadTracksFromDB(); if (dbTracks.length > 0) setTracks(dbTracks); } catch (e) { console.error(e); }
        const localUsers = localStorage.getItem(USERS_KEY);
        let currentUsersList = [DEFAULT_ADMIN];
        if (localUsers) { try { const parsed = JSON.parse(localUsers); if (Array.isArray(parsed) && parsed.length > 0) currentUsersList = parsed; } catch { } }
        setUsers(currentUsersList);
        const savedUserStr = localStorage.getItem(AUTH_KEY);
        if (savedUserStr) {
            try {
                const savedUser = JSON.parse(savedUserStr);
                const validUser = currentUsersList.find(u => u.username === savedUser.username && u.password === savedUser.password);
                if (validUser) {
                    if (!validUser.uniqueId) { validUser.uniqueId = generateUniqueId(validUser.fullName); updateUsers(currentUsersList.map(u => u.username === validUser.username ? validUser : u)); }
                    setCurrentUser(validUser); setAuthMode(validUser.role); setView(ViewState.LIST);
                } else { 
                    localStorage.removeItem(AUTH_KEY); 
                }
            } catch { localStorage.removeItem(AUTH_KEY); }
        }
    };
    initApp();
  }, []);

  const handleLoginSuccess = (user: User) => {
    const existingUser = users.find(u => u.username === user.username);
    if (existingUser && !user.uniqueId) { user.uniqueId = generateUniqueId(user.fullName); updateUsers(users.map(u => u.username === user.username ? user : u)); }
    setCurrentUser(user); setAuthMode(user.role); setView(ViewState.LIST); localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
      localStorage.removeItem(AUTH_KEY); setAuthMode(null); setCurrentUser(null); setView(ViewState.LOGIN); setSelectedTrack(null); setSelectedTracksList([]);
  };

  const handleAddUser = (u: User) => updateUsers([...users, u]);
  // Updated signature to allow username change
  const handleEditUser = (updatedUser: User, originalUsername?: string) => {
      const targetUsername = originalUsername || updatedUser.username;
      updateUsers(users.map(u => u.username === targetUsername ? updatedUser : u));
  };
  const handleDeleteUser = (username: string) => { if (users.length <= 1) return alert("Error"); updateUsers(users.filter(u => u.username !== username)); };
  
  // New Bulk Import Function
  const handleImportUsers = (newUsers: User[]) => {
      // Filter duplicates
      const existingUsernames = new Set(users.map(u => u.username.toLowerCase()));
      const validNewUsers = newUsers.filter(u => !existingUsernames.has(u.username.toLowerCase()));
      
      if (validNewUsers.length === 0) {
          alert("No se añadieron usuarios (posibles duplicados o archivo vacío).");
          return;
      }
      
      // Ensure unique IDs
      const processedUsers = validNewUsers.map(u => ({
          ...u,
          uniqueId: u.uniqueId || generateUniqueId(u.fullName)
      }));

      updateUsers([...users, ...processedUsers]);
      alert(`${processedUsers.length} usuarios importados correctamente.`);
  };

  const handleSyncUsers = async () => { /* ... same ... */ setIsUpdating(true); try { const r = await fetch(USERS_DB_URL); const j = await r.json(); updateUsers(j); alert("Ok"); if(view===ViewState.LOGIN) window.location.reload(); } catch(e){ alert("Err"); } finally { setIsUpdating(false); } };
  const handleSyncMusicRoot = async (rootName: string) => { /* ... same ... */ const url = DB_URLS[rootName]; if(!url) return; if(!confirm("Sync?")) return; setIsUpdating(true); try { const r = await fetch(url); const n = await r.json(); const k = tracks.filter(t => !t.path.startsWith(rootName)); await updateTracks([...k, ...n]); alert("Ok"); } catch(e){ alert("Err"); } finally { setIsUpdating(false); } };
  const handleClearMusicRoot = async (rootName: string) => { if(!confirm("Del?")) return; const k = tracks.filter(t => !t.path.startsWith(rootName)); await updateTracks(k); alert("Ok"); };
  const handleExportMusicRoot = (rootName: string) => { if(authMode!=='admin') return; const k = tracks.filter(t => t.path.startsWith(rootName)); if(k.length===0) return; const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(k)); a.download = "data.json"; a.click(); };
  const handleExportUsers = () => { if(authMode!=='admin') return; const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users)); a.download = "users.json"; a.click(); };

  const readFileAsText = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => typeof e.target?.result === 'string' ? resolve(e.target.result) : reject("Err");
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
      });
  };

  // --- SMART TXT UPLOAD ---
  const handleUploadMultipleTxt = async (files: FileList, targetRoot: string) => {
      if (authMode !== 'admin') return alert("Solo Admin.");
      if (!files || files.length === 0) return;
      const filesArray = Array.from(files);
      setUploadStatus({ isUploading: true, totalFiles: filesArray.length, currentFile: 0, currentFileName: '' });

      let parsedTracks: Track[] = [];

      try {
          for (let i = 0; i < filesArray.length; i++) {
              setUploadStatus(prev => ({ ...prev, currentFile: i + 1, currentFileName: filesArray[i].name }));
              await new Promise(r => setTimeout(r, 20)); // UI flush
              try {
                  const text = await readFileAsText(filesArray[i]);
                  const t = parseTxtDatabase(text, targetRoot);
                  parsedTracks = [...parsedTracks, ...t];
              } catch (err) { console.error(err); }
          }

          if (parsedTracks.length > 0) {
              setUploadStatus(prev => ({ ...prev, currentFileName: 'Integrando datos...' }));
              
              await updateTracks(currentTracks => {
                  const updatedList = [...currentTracks];
                  let addedCount = 0;
                  let updatedCount = 0;

                  parsedTracks.forEach(newT => {
                      // Find duplicate by path + filename
                      const existingIndex = updatedList.findIndex(ex => ex.path === newT.path && ex.filename === newT.filename);
                      
                      if (existingIndex > -1) {
                          // Merge Strategy: Only fill if empty/"Desconocido"
                          const existing = updatedList[existingIndex];
                          const merged = { ...existing };
                          let changed = false;

                          const fields = ['title', 'author', 'performer', 'genre', 'album', 'year'] as const;
                          fields.forEach(f => {
                              const existingVal = existing.metadata[f];
                              const newVal = newT.metadata[f];
                              if ((!existingVal || existingVal === 'Desconocido' || existingVal === '---') && newVal && newVal !== 'Desconocido') {
                                  // @ts-ignore
                                  merged.metadata[f] = newVal;
                                  changed = true;
                              }
                          });
                          
                          if (changed) {
                              updatedList[existingIndex] = merged;
                              updatedCount++;
                          }
                      } else {
                          // Add new
                          updatedList.push(newT);
                          addedCount++;
                      }
                  });
                  alert(`Proceso finalizado.\nNuevos: ${addedCount}\nActualizados: ${updatedCount}`);
                  return updatedList;
              });
          } else { alert("Sin datos válidos."); }
      } catch (e) { console.error(e); alert("Error."); } finally { setUploadStatus(prev => ({ ...prev, isUploading: false })); }
  };

  const performBulkSearch = (text: string) => { /* ... same logic ... */ 
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

      // Simple token matching
      const normalize = (s:string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      
      let newSelection = [...selectedTracksList];
      let missing: string[] = [];

      queries.forEach(q => {
          const tQ = normalize(q.title || "");
          const pQ = normalize(q.performer || "");
          
          const match = tracks.find(t => {
               const tT = normalize(t.metadata.title);
               const tP = normalize(t.metadata.performer);
               const titleMatch = tT.includes(tQ);
               const perfMatch = pQ ? tP.includes(pQ) : true;
               return titleMatch && perfMatch;
          });

          if(match) {
               if(!newSelection.find(s=>s.id===match.id)) newSelection.push(match);
          } else {
               missing.push(q.raw);
          }
      });
      setSelectedTracksList(newSelection);
      setMissingQueries(missing);
  };
  
  const handleBulkSelectTxt = (file: File) => { const r = new FileReader(); r.onload = (e) => typeof e.target?.result==='string' && performBulkSearch(e.target.result); r.readAsText(file); };
  const handleWishlistSubmit = () => { if(!wishlistText.trim()) return; performBulkSearch(wishlistText); setShowWishlist(false); setWishlistText(''); };
  const handleSelectTrack = (track: Track) => { setSelectedTrack(track); };
  const handleToggleSelection = (track: Track) => { setSelectedTracksList(prev => prev.find(t => t.id === track.id) ? prev.filter(t => t.id !== track.id) : [...prev, track]); };
  const handleClearSelection = () => { if (window.confirm('¿Limpiar?')) { setSelectedTracksList([]); setMissingQueries([]); } };

  const handleOpenExportModal = () => {
      setEditingReportId(null);
      const items: ExportItem[] = [];
      selectedTracksList.forEach(t => { items.push({ id: t.id, title: t.metadata.title || t.filename, author: t.metadata.author || '', authorCountry: t.metadata.authorCountry || '', performer: t.metadata.performer || '', performerCountry: t.metadata.performerCountry || '', genre: t.metadata.genre || '', source: 'db', path: t.path }); });
      missingQueries.forEach((q, idx) => { items.push({ id: `missing-${idx}`, title: q, author: '', authorCountry: '', performer: '', performerCountry: '', genre: '', source: 'manual' }); });
      setExportItems(items); setShowExportModal(true);
  };
  const handleUpdateExportItem = (id: string, field: keyof ExportItem, value: string) => { setExportItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item)); };

  const handleShareCredits = () => {
      let message = `*CRÉDITOS RCM*\n*Programa:* ${programName}\n\n`;
      exportItems.forEach(item => { message += `🎵 *${item.title}*\n👤 ${item.performer}\n✍️ ${item.author}\n\n`; });
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDownloadTxt = () => {
      let content = `PROGRAMA: ${programName}\n\n`;
      exportItems.forEach(item => {
          content += `TITULO: ${item.title}\n`;
          content += `INTERPRETE: ${item.performer} (${item.performerCountry})\n`;
          content += `AUTOR: ${item.author} (${item.authorCountry})\n`;
          content += `GENERO: ${item.genre}\n`;
          content += `-----------------------------------\n`;
      });
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Seleccion_${programName.replace(/\s+/g, '_')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
  };

  // --- PDF REPORT & STORAGE ---
  const handleDownloadReport = async () => {
      if (!currentUser) return;
      const pdfBlob = generateReportPDF({
          userFullName: currentUser.fullName,
          userUniqueId: currentUser.uniqueId || 'N/A',
          program: programName,
          items: exportItems
      });

      // Save to IndexedDB
      // Format Name: Produccion Musical + programa + fecha
      const dateStr = new Date().toLocaleDateString('es-ES').replace(/\//g, '-');
      const safeProgram = programName.replace(/[^a-zA-Z0-9 ]/g, '');
      const fileName = `Produccion Musical ${safeProgram} ${dateStr}.pdf`;

      const reportId = editingReportId || `rep-${Date.now()}`;
      
      await saveReportToDB({
          id: reportId,
          date: new Date().toISOString(),
          program: programName,
          generatedBy: currentUser.username,
          fileName: fileName,
          pdfBlob: pdfBlob,
          items: exportItems, // Guardar items para re-editar
          status: { downloaded: false, sent: false }
      });

      alert("Reporte generado correctamente.\nPuede encontrarlo en la sección 'Reportes' para descargarlo.");
      setShowExportModal(false);
      setEditingReportId(null);
  };

  const handleEditReport = (report: Report) => {
      if (report.items) {
          setExportItems(report.items);
          setProgramName(report.program);
          setEditingReportId(report.id);
          setShowExportModal(true);
      } else {
          alert("Este reporte es antiguo y no contiene los datos necesarios para editarlo.");
      }
  };

  // --- GLOBAL METADATA UPDATE ---
  const handleManualEdit = (updatedTrack: Track) => {
      const normalize = (s:string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
      const targetTitle = normalize(updatedTrack.metadata.title);
      const targetPerf = normalize(updatedTrack.metadata.performer);

      updateTracks(prev => prev.map(t => {
          if (t.id === updatedTrack.id) return updatedTrack;
          const tTitle = normalize(t.metadata.title);
          const tPerf = normalize(t.metadata.performer);
          
          if (tTitle === targetTitle && tPerf === targetPerf) {
             return {
                 ...t,
                 metadata: {
                     ...t.metadata,
                     author: updatedTrack.metadata.author,
                     authorCountry: updatedTrack.metadata.authorCountry,
                     performerCountry: updatedTrack.metadata.performerCountry,
                     genre: updatedTrack.metadata.genre
                 }
             };
          }
          return t;
      }));
      setSelectedTrack(updatedTrack);
  };

  const handleApplyCredits = (newCredits: CreditInfo) => { /* ... */ }; 
  const handleDiscardResults = () => { setView(ViewState.LIST); setFoundCredits(null); };

  if (view === ViewState.LOGIN) { return <LoginScreen onLoginSuccess={handleLoginSuccess} users={users} onUpdateUsers={handleSyncUsers} isUpdating={isUpdating} />; }
  const navigateTo = (v: ViewState) => { setView(v); window.history.pushState({ view: v }, ''); };

  const getRoleLabel = () => {
      if (authMode === 'admin') return 'COORDINADOR';
      if (authMode === 'director') return 'DIRECTOR';
      return 'REALIZADOR'; // Usuario
  };

  return (
    <div className="max-w-md mx-auto h-[100dvh] bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <button className="flex items-center gap-3" onClick={() => navigateTo(ViewState.LIST)}>
                    <span className="material-symbols-outlined text-2xl">radio</span><h1 className="text-lg font-bold">RCM Música</h1>
                </button>
                <div className="flex items-center gap-2">
                    {isSaving && <span className="size-2 bg-yellow-400 rounded-full animate-pulse"></span>}
                    {currentUser && authMode === 'director' && <button onClick={() => alert(`ID:\n${currentUser.uniqueId}`)} className="bg-white/10 text-white rounded-full p-1.5"><span className="material-symbols-outlined text-sm">vpn_key</span></button>}
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${authMode === 'admin' ? 'bg-miel' : 'bg-green-600'}`}>
                        {getRoleLabel()}
                    </div>
                    <button onClick={handleLogout} className="text-white bg-white/10 p-2 rounded-full size-10 flex items-center justify-center"><span className="material-symbols-outlined text-xl">logout</span></button>
                </div>
            </header>
        )}

        {(isUpdating || uploadStatus.isUploading) && (
            <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6">
                <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-center w-full max-w-xs">
                    <p className="font-bold text-lg mb-2">Procesando...</p>
                    <p className="text-sm text-gray-300 mb-4 truncate">{uploadStatus.currentFileName}</p>
                    {uploadStatus.totalFiles > 0 && <p className="text-xs text-gray-400 font-mono">{uploadStatus.currentFile} / {uploadStatus.totalFiles}</p>}
                </div>
            </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList tracks={tracks} onSelectTrack={handleSelectTrack} onUploadTxt={handleUploadMultipleTxt} isAdmin={authMode === 'admin'} onSyncRoot={handleSyncMusicRoot} onExportRoot={handleExportMusicRoot} onClearRoot={handleClearMusicRoot} selectedTrackIds={new Set(selectedTracksList.map(t => t.id))} onToggleSelection={handleToggleSelection} />
            )}
            
            {view === ViewState.SELECTION && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto flex flex-col">
                    <TrackList tracks={selectedTracksList} onSelectTrack={handleSelectTrack} onUploadTxt={handleUploadMultipleTxt} onBulkSelectTxt={handleBulkSelectTxt} isAdmin={false} onSyncRoot={() => {}} onExportRoot={() => {}} onClearRoot={() => {}} selectedTrackIds={new Set(selectedTracksList.map(t => t.id))} onToggleSelection={handleToggleSelection} onOpenExportPreview={handleOpenExportModal} isSelectionView={true} onClearSelection={handleClearSelection} onOpenWishlist={() => setShowWishlist(true)} missingQueries={missingQueries} onClearMissing={() => setMissingQueries([])} />
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && <Settings tracks={tracks} users={users} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} onExportUsers={handleExportUsers} onImportUsers={handleImportUsers} currentUser={currentUser} />}
            {view === ViewState.PRODUCTIONS && authMode === 'admin' && <Productions onAddTracks={(t) => updateTracks(prev => [...prev, ...t])} allTracks={tracks} />}
            {view === ViewState.REPORTS && authMode === 'director' && <ReportsViewer users={users} onEdit={handleEditReport} />}
            {view === ViewState.RESULTS && selectedTrack && <CreditResults originalTrack={selectedTrack} foundCredits={foundCredits} isLoading={isSearching} onApply={handleApplyCredits} onDiscard={handleDiscardResults} />}
        </div>

        {/* EXPORT MODAL (EDIT PDF CONTENT / SHARE) */}
        {showExportModal && (
            <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setShowExportModal(false)}>
                <div className="w-full max-w-lg bg-white dark:bg-zinc-900 h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-miel">edit_document</span> Editar y Exportar</h3>
                            <p className="text-[10px] text-gray-500">Revise los datos antes de exportar.</p>
                        </div>
                        <button onClick={() => setShowExportModal(false)} className="text-gray-400"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-black/10">
                         <label className="block text-xs font-bold text-gray-500 mb-1">Nombre del Programa</label>
                         <select value={programName} onChange={e => setProgramName(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-zinc-800 appearance-none">
                            {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                         </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {exportItems.map((item, idx) => (
                            <div key={item.id} className={`p-3 rounded-xl border ${item.source === 'manual' ? 'border-orange-200 bg-orange-50/50' : 'border-gray-200 bg-white'} dark:border-gray-700 dark:bg-zinc-800`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-100 dark:bg-white/10 px-1.5 rounded">{idx + 1}</span>
                                    {item.source === 'manual' && <span className="text-[10px] font-bold text-orange-500 uppercase">No encontrado</span>}
                                </div>
                                <div className="grid gap-2">
                                    <input className="w-full p-1.5 text-sm font-bold border-b border-transparent focus:border-primary bg-transparent outline-none" placeholder="Título" value={item.title} onChange={e => handleUpdateExportItem(item.id, 'title', e.target.value)} />
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
                    <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-gray-800 shrink-0 grid grid-cols-2 gap-3">
                         <button onClick={handleShareCredits} className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 hover:brightness-95">
                            <span className="material-symbols-outlined text-lg">share</span> <span>WhatsApp</span>
                        </button>
                        <button onClick={handleDownloadTxt} className="bg-gray-600 text-white py-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 hover:brightness-95">
                            <span className="material-symbols-outlined text-lg">text_snippet</span> <span>TXT</span>
                        </button>

                        {/* Only Director can generate PDF */}
                        {authMode === 'director' && (
                             <button onClick={handleDownloadReport} className="col-span-2 bg-azul-header text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:brightness-95 shadow-md">
                                <span className="material-symbols-outlined text-lg">save_as</span> 
                                <span>{editingReportId ? 'Actualizar Reporte PDF' : 'Generar Reporte PDF'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* TRACK DETAIL, WISHLIST, ETC... (Existing code) */}
        {showWishlist && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowWishlist(false)}>
                <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold mb-4">Lista de Deseos</h3>
                    <textarea className="w-full h-48 p-3 rounded-xl border mb-4 text-sm bg-gray-50" placeholder="Temas..." value={wishlistText} onChange={e => setWishlistText(e.target.value)}></textarea>
                    <button onClick={handleWishlistSubmit} className="w-full bg-primary text-white font-bold py-3 rounded-xl">Buscar</button>
                </div>
            </div>
        )}

        {(view === ViewState.LIST || view === ViewState.SELECTION) && selectedTrack && (
            <TrackDetail track={selectedTrack} onClose={() => setSelectedTrack(null)} onSearchCredits={() => {}} authMode={authMode} onSaveEdit={handleManualEdit} />
        )}
        
        {view !== ViewState.RESULTS && (
            <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-2 flex items-center justify-between pb-2 z-20 shrink-0 overflow-x-auto">
                <NavButton icon="folder_open" label="Explorador" active={view === ViewState.LIST} onClick={() => navigateTo(ViewState.LIST)} />
                <NavButton icon="checklist" label="Selección" active={view === ViewState.SELECTION} onClick={() => navigateTo(ViewState.SELECTION)} />
                
                {/* Reports only for Directors */}
                {authMode === 'director' && <NavButton icon="description" label="Reportes" active={view === ViewState.REPORTS} onClick={() => navigateTo(ViewState.REPORTS)} />}
                
                {authMode === 'admin' && <NavButton icon="playlist_add" label="Producción" active={view === ViewState.PRODUCTIONS} onClick={() => navigateTo(ViewState.PRODUCTIONS)} />}
                {authMode === 'admin' && <NavButton icon="settings" label="Ajustes" active={view === ViewState.SETTINGS} onClick={() => navigateTo(ViewState.SETTINGS)} />}
            </nav>
        )}
    </div>
  );
};

const NavButton: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex-1 min-w-[60px] flex flex-col items-center justify-center h-full transition-colors relative ${active ? 'text-azul-header dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
        <span className={`material-symbols-outlined text-2xl ${active ? 'material-symbols-filled' : ''}`}>{icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide mt-1 truncate">{label}</span>
        {active && <span className="absolute bottom-1 w-1 h-1 bg-current rounded-full"></span>}
    </button>
);

export default App;
