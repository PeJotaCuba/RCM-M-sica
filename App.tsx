
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode } from './types';
import { INITIAL_DB_CONTENT, parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import { fetchCreditsFromGemini } from './services/geminiService';
import * as XLSX from 'xlsx';

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
           return []; // If 404 or empty, return empty array
        }
        return response.json();
      })
      .then((data: Track[]) => {
        if (Array.isArray(data) && data.length > 0) {
            console.log("Database loaded from musica.json");
            setTracks(data);
        } else {
            console.log("Database empty or not found, starting clean.");
            setTracks([]); 
        }
      })
      .catch(error => {
        console.warn("Error loading musica.json", error);
        setTracks([]); // Start empty on error
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

  // --- Real File Import Logic (Excel) ---

  const handleImportFolders = async (file: File) => {
      if (!file) return;
      
      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Parse as array of arrays to handle columns by index
          // Option '1' produces array of arrays (e.g., [["Name", "Path", "Title"], ["Val1", "Val2", "Val3"]])
          const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (rows.length < 2) {
              alert("El archivo parece vacío o no tiene datos.");
              return;
          }

          // Convert rows to Track objects
          // Assumptions based on PDF:
          // Col 0: "Nombre de Carpeta" (Folder Name / Group) -> Mapped to 'album' usually or just tag
          // Col 1: "Ruta de Carpeta" (Full Path) -> Mapped to 'path'
          // Col 2: "Título del Tema Musical" -> Mapped to 'title' and used for 'filename' if possible

          const newTracks: Track[] = [];

          // Skip header row if it looks like a header
          let startIndex = 0;
          if (rows[0][0] && typeof rows[0][0] === 'string' && rows[0][0].toLowerCase().includes('nombre')) {
              startIndex = 1;
          }

          for (let i = startIndex; i < rows.length; i++) {
              const row = rows[i];
              // Ensure row has at least path
              if (!row[1]) continue;

              const folderName = String(row[0] || "");
              const fullPath = String(row[1] || "").trim(); // PDF Col 2: Ruta
              const rawTitle = String(row[2] || "").trim(); // PDF Col 3: Título

              // Heuristic to get filename: last part of path, OR use title if it ends in extension
              let filename = rawTitle;
              if (!filename.match(/\.[0-9a-z]+$/i)) {
                   // If title doesn't look like a file, check path
                   const pathParts = fullPath.split(/[\\/]/);
                   const lastPart = pathParts[pathParts.length - 1];
                   if (lastPart.match(/\.[0-9a-z]+$/i)) {
                       filename = lastPart;
                   } else {
                       filename = rawTitle + ".mp3"; // Fallback assumption
                   }
              }

              // Clean Title (remove extension)
              const cleanTitle = rawTitle.replace(/\.[^/.]+$/, "") || filename.replace(/\.[^/.]+$/, "");

              newTracks.push({
                  id: `imp-${Date.now()}-${i}`,
                  filename: filename,
                  path: fullPath, // Keep full path from Excel
                  size: '---',
                  isVerified: false, // Imported from folder list is usually unverified until AI check
                  metadata: {
                      title: cleanTitle,
                      author: '', // Not provided in this Excel format
                      performer: '', // Not provided
                      album: folderName, // Use "Nombre de Carpeta" as Album/Group context
                      year: ''
                  }
              });
          }

          if (newTracks.length > 0) {
              if (window.confirm(`Se encontraron ${newTracks.length} pistas. ¿Reemplazar base de datos?`)) {
                  setTracks(newTracks);
                  alert("Base de datos cargada exitosamente.");
              }
          } else {
              alert("No se pudieron interpretar las filas del Excel.");
          }

      } catch (error) {
          console.error("Error importando excel:", error);
          alert("Error leyendo el archivo Excel. Asegúrese de que sea un .xlsx válido.");
      }
  };

  const handleImportCredits = async (file: File) => {
      // For credits, we assume a similar logic or standard Excel parsing
      if (!file) return;

      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet); // Map by headers

          if (json.length === 0) {
               alert("No se encontraron datos.");
               return;
          }
          
          let updatedCount = 0;
          const updatedTracks = tracks.map(t => {
              // Try to find match by filename
              const match = json.find((row: any) => {
                  const rowFilename = row['filename'] || row['Archivo'] || row['Nombre'];
                  return rowFilename && String(rowFilename).trim() === t.filename.trim();
              });

              if (match) {
                  updatedCount++;
                  return {
                      ...t,
                      isVerified: true,
                      metadata: {
                          ...t.metadata,
                          title: match['Title'] || match['Título'] || t.metadata.title,
                          author: match['Author'] || match['Autor'] || t.metadata.author,
                          performer: match['Performer'] || match['Intérprete'] || t.metadata.performer,
                          year: match['Year'] || match['Año'] || t.metadata.year,
                          album: match['Album'] || match['Álbum'] || t.metadata.album
                      }
                  };
              }
              return t;
          });

          setTracks(updatedTracks);
          alert(`Créditos actualizados en ${updatedCount} archivos.`);

      } catch (error) {
          console.error(error);
          alert("Error importando créditos.");
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
