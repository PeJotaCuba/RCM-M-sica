
import React, { useState, useEffect } from 'react';
import { Track, ViewState, CreditInfo, AuthMode } from './types';
import { INITIAL_DB_TXT, parseTxtDatabase } from './constants';
import TrackList from './components/TrackList';
import TrackDetail from './components/TrackDetail';
import CreditResults from './components/CreditResults';
import LoginScreen from './components/LoginScreen';
import Settings from './components/Settings';
import Productions from './components/Productions';
import { fetchCreditsFromGemini } from './services/geminiService';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const DB_KEY = 'rcm_db_datosm';
const AUTH_KEY = 'rcm_auth_session';

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
  const [isUpdating, setIsUpdating] = useState(false);

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

  // Initialize DB and Restore Session
  useEffect(() => {
    // 1. Restore Database
    const loadDB = async () => {
        const localData = localStorage.getItem(DB_KEY);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (Array.isArray(parsed)) {
                    setTracks(parsed);
                    console.log("Cargado desde Local Storage");
                }
            } catch (e) {
                console.warn("Datos locales corruptos");
            }
        }
    };
    loadDB();

    // 2. Restore Session
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth === 'admin' || savedAuth === 'guest') {
        setAuthMode(savedAuth as AuthMode);
        setView(ViewState.LIST);
    }
  }, []);

  const handleLogin = (mode: 'guest' | 'admin') => {
    localStorage.setItem(AUTH_KEY, mode);
    setAuthMode(mode);
    setView(ViewState.LIST);
  };

  const handleLogout = () => {
      localStorage.removeItem(AUTH_KEY);
      setAuthMode(null);
      setView(ViewState.LOGIN);
      setSelectedTrack(null);
      setRecentTracks([]);
  };

  const handleUpdateDatabase = async () => {
      const confirmUpdate = window.confirm(
          `¿Actualizar base de datos musical?\n\nSe descargará y procesará el archivo 'Info.zip' desde GitHub.\n\nEsto puede tardar unos segundos dependiendo de su conexión.`
      );
      if (!confirmUpdate) return;

      setIsUpdating(true);
      let totalTracks: Track[] = [];
      let filesProcessed = 0;

      const zipUrl = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/main/Info.zip';
      const fallbackUrl = 'https://raw.githubusercontent.com/PeJotaCuba/RCM-M-sica/master/Info.zip';

      try {
          // 1. Descargar el ZIP como ArrayBuffer
          let response = await fetch(zipUrl);
          if (!response.ok) {
              console.log("Intentando URL alternativa...");
              response = await fetch(fallbackUrl);
          }
          
          if (!response.ok) throw new Error("No se pudo descargar Info.zip");

          const blob = await response.arrayBuffer();

          // 2. Abrir con JSZip
          const zip = await JSZip.loadAsync(blob);
          
          // 3. Iterar archivos
          const filePromises: Promise<void>[] = [];

          zip.forEach((relativePath, zipEntry) => {
              if (zipEntry.name.toLowerCase().endsWith('.txt') && !zipEntry.name.startsWith('__MACOSX')) {
                  const promise = zipEntry.async('string').then(content => {
                      const newTracks = parseTxtDatabase(content);
                      totalTracks = [...totalTracks, ...newTracks];
                      filesProcessed++;
                  });
                  filePromises.push(promise);
              }
          });

          await Promise.all(filePromises);

          if (totalTracks.length > 0) {
               updateTracks(totalTracks);
               alert(`Actualización completada con éxito.\nSe procesaron ${filesProcessed} archivos TXT dentro del ZIP.\nTotal de temas indexados: ${totalTracks.length}.`);
               window.location.reload(); 
          } else {
              alert("El archivo ZIP se descargó pero no se encontraron datos válidos en los archivos de texto.");
          }
      } catch (error) {
          console.error("Update failed", error);
          alert("Error durante la actualización. Verifique que 'Info.zip' existe en el repositorio y revise su conexión.");
      } finally {
          setIsUpdating(false);
      }
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

  // --- Merge Logic for Production/Manual Adds ---
  const mergeTracks = (incomingTracks: Track[]) => {
      updateTracks(currentTracks => [...currentTracks, ...incomingTracks]);
  };

  const handleImportFolders = async (file: File) => {
      if (!file) return;
      alert("Para importar masivamente, use la opción de actualización desde GitHub (ZIP) en la pantalla de inicio.");
  };

  const handleImportCredits = async (file: File) => {
      handleImportFolders(file);
  };

  const handleAddProductionTracks = (tracks: Track[]) => {
      mergeTracks(tracks);
  };

  if (view === ViewState.LOGIN) {
      return (
        <>
            {isUpdating && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
                    <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-bold text-lg animate-pulse">Descargando y procesando Info.zip...</p>
                    <p className="text-sm text-gray-400 mt-2">Por favor espere</p>
                </div>
            )}
            <LoginScreen onLogin={handleLogin} onUpdate={handleUpdateDatabase} />
        </>
      );
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
                {/* Auth Controls */}
                <div className="flex items-center gap-4">
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${authMode === 'admin' ? 'bg-miel text-white' : 'bg-green-600 text-white'}`}>
                        {authMode === 'admin' ? 'ADMIN' : 'USUARIO'}
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleUpdateDatabase}
                            className={`text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors flex items-center justify-center size-10 ${isUpdating ? 'animate-spin bg-white/30' : ''}`}
                            title="Sincronizar Info.zip desde GitHub"
                            disabled={isUpdating}
                        >
                            <span className="material-symbols-outlined text-xl">sync_alt</span>
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="text-white bg-white/10 hover:bg-red-500/50 p-2 rounded-full transition-colors flex items-center justify-center size-10"
                            title="Cerrar Sesión"
                        >
                            <span className="material-symbols-outlined text-xl">logout</span>
                        </button>
                    </div>
                </div>
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
                    <span className={`material-symbols-outlined ${view === ViewState.LIST ? 'material-symbols-filled' : ''}`}>folder_open</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Explorador</span>
                </button>
                
                <button 
                    onClick={() => setView(ViewState.RECENT)}
                    className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.RECENT ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                >
                    <span className={`material-symbols-outlined ${view === ViewState.RECENT ? 'material-symbols-filled' : ''}`}>history</span>
                    <span className="text-[9px] sm:text-[10px] font-bold">Recientes</span>
                </button>

                {authMode === 'admin' && (
                    <button 
                        onClick={() => setView(ViewState.PRODUCTIONS)}
                        className={`flex flex-col items-center gap-1 transition-colors px-2 ${view === ViewState.PRODUCTIONS ? 'text-primary' : 'text-gray-400 hover:text-azul-cauto'}`}
                    >
                        <span className={`material-symbols-outlined ${view === ViewState.PRODUCTIONS ? 'material-symbols-filled' : ''}`}>playlist_add</span>
                        <span className="text-[9px] sm:text-[10px] font-bold">Producciones</span>
                    </button>
                )}

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
