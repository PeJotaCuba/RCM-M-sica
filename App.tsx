
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode } from './types';
import { INITIAL_DB_CONTENT, parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import { fetchCreditsFromGemini } from './services/geminiService';
import * as XLSX from 'xlsx';

const DB_KEY = 'rcm_db_tracks';

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  
  // Selection and History
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);

  // Search State
  const [foundCredits, setFoundCredits] = useState<CreditInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Helper to save to local storage
  const updateTracks = (newTracks: Track[] | ((prev: Track[]) => Track[])) => {
      setTracks(prev => {
          const updated = typeof newTracks === 'function' ? newTracks(prev) : newTracks;
          try {
              localStorage.setItem(DB_KEY, JSON.stringify(updated));
          } catch (e) {
              console.error("Error saving to local storage", e);
          }
          return updated;
      });
  };

  // Initialize DB
  useEffect(() => {
    const loadDB = async () => {
        // 1. Try Local Storage first
        const localData = localStorage.getItem(DB_KEY);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setTracks(parsed);
                    console.log("Cargado desde Local Storage");
                    return; // Stop if local data exists
                }
            } catch (e) {
                console.warn("Datos locales corruptos");
            }
        }

        // 2. Fallback to json file if no local data
        try {
            const response = await fetch(`./musica.json?v=${new Date().getTime()}`);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    setTracks(data);
                    // Save to local for next time
                    localStorage.setItem(DB_KEY, JSON.stringify(data));
                }
            } else {
                console.log("Iniciando con base de datos vacía.");
            }
        } catch (error) {
            console.log("Base de datos local no disponible, iniciando limpio.");
        }
    };
    loadDB();
  }, []);

  const handleLogin = (mode: 'guest' | 'admin') => {
    setAuthMode(mode);
    setView(ViewState.LIST);
  };

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setRecentTracks(prev => {
        const filtered = prev.filter(t => t.id !== track.id);
        return [track, ...filtered].slice(0, 10);
    });
  };

  const handleCloseDetail = () => {
    setSelectedTrack(null);
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

  // --- Merge Logic ---
  const mergeTracks = (incomingTracks: Track[]) => {
      updateTracks(currentTracks => {
          const merged = [...currentTracks];
          let updatedCount = 0;
          let addedCount = 0;

          incomingTracks.forEach(incoming => {
              const index = merged.findIndex(existing => {
                  const titleMatch = existing.metadata.title.toLowerCase() === incoming.metadata.title.toLowerCase();
                  const folderMatch = (existing.metadata.album || "").toLowerCase() === (incoming.metadata.album || "").toLowerCase() ||
                                      existing.path.toLowerCase() === incoming.path.toLowerCase();
                  return titleMatch && folderMatch;
              });

              if (index >= 0) {
                  merged[index] = {
                      ...merged[index],
                      metadata: { ...merged[index].metadata, ...incoming.metadata },
                      path: incoming.path && incoming.path !== '/Importado/Txt' ? incoming.path : merged[index].path,
                      isVerified: true
                  };
                  updatedCount++;
              } else {
                  merged.push(incoming);
                  addedCount++;
              }
          });
          
          alert(`Importación completada.\nActualizados: ${updatedCount}\nAgregados: ${addedCount}`);
          return merged;
      });
  };

  const handleImportFolders = async (file: File) => {
      if (!file) return;
      const fileName = file.name.toLowerCase();
      
      if (fileName.endsWith('.txt')) {
          const reader = new FileReader();
          reader.onload = (e) => {
              const text = e.target?.result as string;
              const newTracks = parseTxtDatabase(text);
              if (newTracks.length > 0) mergeTracks(newTracks);
              else alert("No se pudieron leer pistas del archivo TXT. Verifique el formato.");
          };
          reader.readAsText(file);
          return;
      }

      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (rows.length < 2) {
              alert("El archivo parece vacío o no tiene datos.");
              return;
          }

          const newTracks: Track[] = [];
          let startIndex = 0;
          if (rows[0][0] && typeof rows[0][0] === 'string' && (rows[0][0].toLowerCase().includes('nombre') || rows[0][0].toLowerCase().includes('titulo'))) {
              startIndex = 1;
          }

          for (let i = startIndex; i < rows.length; i++) {
              const row = rows[i];
              if (!row[0] && !row[1] && !row[2]) continue;

              const folderName = String(row[0] || "Desconocido");
              const fullPath = String(row[1] || "").trim(); 
              const rawTitle = String(row[2] || "").trim(); 

              let filename = rawTitle;
              if (!filename.match(/\.[0-9a-z]+$/i)) {
                   const pathParts = fullPath.split(/[\\/]/);
                   const lastPart = pathParts[pathParts.length - 1];
                   if (lastPart && lastPart.match(/\.[0-9a-z]+$/i)) filename = lastPart;
                   else filename = (rawTitle || "Audio") + ".mp3"; 
              }
              const cleanTitle = rawTitle.replace(/\.[^/.]+$/, "") || filename.replace(/\.[^/.]+$/, "");

              newTracks.push({
                  id: `imp-${Date.now()}-${i}`,
                  filename: filename,
                  path: fullPath, 
                  size: '---',
                  isVerified: false, 
                  metadata: {
                      title: cleanTitle,
                      author: '', 
                      performer: '', 
                      album: folderName, 
                      year: ''
                  }
              });
          }

          if (newTracks.length > 0) mergeTracks(newTracks);
          else alert("No se pudieron interpretar las filas del Excel.");

      } catch (error) {
          console.error("Error importando excel:", error);
          alert("Error leyendo el archivo.");
      }
  };

  const handleImportCredits = async (file: File) => {
      handleImportFolders(file);
  };

  const handleAddProductionTracks = (tracks: Track[]) => {
      mergeTracks(tracks);
  };

  if (view === ViewState.LOGIN) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined cursor-pointer">radio</span>
                    <h1 className="text-lg font-bold tracking-tight">
                        {view === ViewState.SETTINGS ? 'Ajustes' : (view === ViewState.RECENT ? 'Recientes' : (view === ViewState.PRODUCTIONS ? 'Producciones' : 'RCM Música'))}
                    </h1>
                </div>
                {authMode === 'admin' && (
                    <div className="bg-miel text-white text-[10px] font-bold px-2 py-0.5 rounded">ADMIN</div>
                )}
            </header>
        )}

        <div className="flex-1 overflow-hidden relative">
            {view === ViewState.LIST && (
                <TrackList tracks={tracks} onSelectTrack={handleSelectTrack} />
            )}

            {view === ViewState.RECENT && (
                <div className="h-full bg-background-light dark:bg-background-dark overflow-y-auto">
                    {recentTracks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                             <p>No hay temas recientes</p>
                        </div>
                    ) : (
                        <TrackList tracks={recentTracks} onSelectTrack={handleSelectTrack} />
                    )}
                </div>
            )}

            {view === ViewState.SETTINGS && authMode === 'admin' && (
                <Settings 
                    tracks={tracks}
                    onImportFolders={handleImportFolders}
                    onImportCredits={handleImportCredits}
                />
            )}

            {view === ViewState.PRODUCTIONS && (
                <Productions 
                    onAddTracks={handleAddProductionTracks} 
                    allTracks={tracks} // Pass all tracks for reporting
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
                onClose={handleCloseDetail}
                onSearchCredits={handleSearchCredits}
                authMode={authMode}
                onSaveEdit={handleManualEdit}
            />
        )}
        
        {view !== ViewState.RESULTS && (
            <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-2 flex items-center justify-between pb-2 z-20 shrink-0">
                <button 
                    onClick={() => setView(ViewState.LIST)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.LIST ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.LIST ? 'material-symbols-filled' : ''}`}>folder</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Explorador</span>
                </button>
                
                <button 
                    onClick={() => setView(ViewState.RECENT)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.RECENT ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.RECENT ? 'material-symbols-filled' : ''}`}>history</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Recientes</span>
                </button>

                <button 
                    onClick={() => setView(ViewState.PRODUCTIONS)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.PRODUCTIONS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.PRODUCTIONS ? 'material-symbols-filled' : ''}`}>playlist_add</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Producciones</span>
                </button>

                {authMode === 'admin' && (
                    <button 
                        onClick={() => setView(ViewState.SETTINGS)}
                        className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.SETTINGS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
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
