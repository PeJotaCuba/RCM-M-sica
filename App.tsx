
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode } from './types';
import { INITIAL_DB_CONTENT, parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import { fetchCreditsFromGemini } from './services/geminiService';

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

  // Initialize DB
  useEffect(() => {
    // Try to load from musica.json first with cache busting
    fetch(`./musica.json?v=${new Date().getTime()}`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data: Track[]) => {
        console.log("Database loaded from musica.json");
        setTracks(data);
      })
      .catch(error => {
        console.warn("Could not load musica.json, falling back to static data.", error);
        // Fallback to constants if file doesn't exist or fails
        const parsed = parseTxtDatabase(INITIAL_DB_CONTENT);
        setTracks(parsed);
      });
  }, []);

  const handleLogin = (mode: 'guest' | 'admin') => {
    setAuthMode(mode);
    setView(ViewState.LIST);
  };

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    // Add to recents (deduplicate)
    setRecentTracks(prev => {
        const filtered = prev.filter(t => t.id !== track.id);
        return [track, ...filtered].slice(0, 10); // Keep last 10
    });
  };

  const handleCloseDetail = () => {
    setSelectedTrack(null);
  };

  const handleSearchCredits = async () => {
    if (!selectedTrack) return;
    setIsSearching(true);
    setView(ViewState.RESULTS); // Full screen for results
    
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
    setTracks(prev => prev.map(t => t.id === selectedTrack.id ? { ...t, isVerified: true, metadata: newCredits } : t));
    
    // Return to list (Modal closes)
    setView(ViewState.LIST);
    setSelectedTrack(null);
    setFoundCredits(null);
  };

  const handleDiscardResults = () => {
      setView(ViewState.LIST);
      setFoundCredits(null);
  };

  // --- Real File Import Logic ---

  const readFileContent = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = (error) => reject(error);
          reader.readAsText(file);
      });
  };

  const handleImportFolders = async (file: File) => {
      if (!file) return;
      
      try {
          const text = await readFileContent(file);
          let newTracks: Track[] = [];

          // Try parsing as JSON first
          try {
              const json = JSON.parse(text);
              if (Array.isArray(json)) {
                  newTracks = json;
              } else {
                  throw new Error("JSON no es un array");
              }
          } catch (e) {
              // Fallback to TXT format
              console.log("Detectado formato TXT o error en JSON, parseando texto plano...");
              newTracks = parseTxtDatabase(text);
          }

          if (newTracks.length > 0) {
              if (window.confirm(`Se han detectado ${newTracks.length} archivos. ¿Deseas reemplazar la base de datos actual?`)) {
                  setTracks(newTracks);
                  alert("Base de datos de carpetas actualizada correctamente.");
              }
          } else {
              alert("No se pudieron leer pistas del archivo.");
          }

      } catch (error) {
          console.error("Error importando:", error);
          alert("Error leyendo el archivo.");
      }
  };

  const handleImportCredits = async (file: File) => {
      if (!file) return;

      try {
          const text = await readFileContent(file);
          let importedTracks: Track[] = [];

          try {
              const json = JSON.parse(text);
              if (Array.isArray(json)) importedTracks = json;
          } catch (e) {
              importedTracks = parseTxtDatabase(text);
          }

          if (importedTracks.length === 0) {
              alert("No se encontraron datos válidos para importar.");
              return;
          }

          // Logic: Update metadata of EXISTING tracks if filenames match
          let updatedCount = 0;
          const updatedTracks = tracks.map(existingTrack => {
              const match = importedTracks.find(t => 
                  t.filename.trim().toLowerCase() === existingTrack.filename.trim().toLowerCase()
              );
              
              if (match && (match.metadata.title || match.metadata.author)) {
                  updatedCount++;
                  return {
                      ...existingTrack,
                      isVerified: true,
                      metadata: {
                          ...existingTrack.metadata,
                          ...match.metadata // Overwrite with imported data
                      }
                  };
              }
              return existingTrack;
          });

          setTracks(updatedTracks);
          alert(`Proceso finalizado. Se actualizaron los créditos de ${updatedCount} archivos coincidentes.`);

      } catch (error) {
          console.error("Error importando créditos:", error);
          alert("Error procesando el archivo de créditos.");
      }
  };

  if (view === ViewState.LOGIN) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-100 shadow-2xl overflow-hidden relative border-x border-gray-200 flex flex-col">
        
        {/* Header */}
        {view !== ViewState.RESULTS && (
             <header className="bg-azul-header text-white px-4 py-4 flex items-center justify-between shadow-md relative z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined cursor-pointer">radio</span>
                    <h1 className="text-lg font-bold tracking-tight">
                        {view === ViewState.SETTINGS ? 'Ajustes' : (view === ViewState.RECENT ? 'Recientes' : 'RCM Música')}
                    </h1>
                </div>
                {authMode === 'admin' && (
                    <div className="bg-miel text-white text-[10px] font-bold px-2 py-0.5 rounded">ADMIN</div>
                )}
            </header>
        )}

        {/* Main Content Area */}
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

            {/* Results View (Full Screen) */}
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

        {/* Detail Modal Overlay */}
        {(view === ViewState.LIST || view === ViewState.RECENT) && selectedTrack && (
            <TrackDetail 
                track={selectedTrack} 
                onClose={handleCloseDetail}
                onSearchCredits={handleSearchCredits}
            />
        )}
        
        {/* Bottom Navigation */}
        {view !== ViewState.RESULTS && (
            <nav className="bg-white dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 h-20 px-6 flex items-center justify-between pb-2 z-20 shrink-0">
                <button 
                    onClick={() => setView(ViewState.LIST)}
                    className={`flex flex-col items-center gap-1 transition-colors ${view === ViewState.LIST ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.LIST ? 'material-symbols-filled' : ''}`}>folder</span>
                    <span className="text-[10px] font-bold">Explorador</span>
                </button>
                
                <button 
                    onClick={() => setView(ViewState.RECENT)}
                    className={`flex flex-col items-center gap-1 transition-colors ${view === ViewState.RECENT ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.RECENT ? 'material-symbols-filled' : ''}`}>history</span>
                    <span className="text-[10px] font-bold">Recientes</span>
                </button>

                {authMode === 'admin' && (
                    <button 
                        onClick={() => setView(ViewState.SETTINGS)}
                        className={`flex flex-col items-center gap-1 transition-colors ${view === ViewState.SETTINGS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                    >
                        <span className={`material-symbols-outlined ${view === ViewState.SETTINGS ? 'material-symbols-filled' : ''}`}>settings</span>
                        <span className="text-[10px] font-bold">Ajustes</span>
                    </button>
                )}
            </nav>
        )}
    </div>
  );
};

export default App;
