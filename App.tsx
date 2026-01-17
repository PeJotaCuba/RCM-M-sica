
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
    phone: '55555555',
    uniqueId: 'ADMIN01'
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

  // Wishlist & Bulk Search State
  const [showWishlist, setShowWishlist] = useState(false);
  const [missingQueries, setMissingQueries] = useState<string[]>([]);
  const [wishlistText, setWishlistText] = useState('');

  // NEW: Export Preview & Editing
  const [showExportModal, setShowExportModal] = useState(false);
  const [manualEntries, setManualEntries] = useState<string[]>([]);

  // Search State
  const [foundCredits, setFoundCredits] = useState<CreditInfo | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Visual indicator for saving

  // Helper to generate Unique ID (Uppercase Letters + Numbers) if missing
  const generateUniqueId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
  };

  // Handle Browser Back Button
  useEffect(() => {
    // Only attach logic if logged in
    if (view === ViewState.LOGIN) return;

    const handlePopState = (event: PopStateEvent) => {
        // Priority 1: Close Modal or Wishlist
        if (selectedTrack) {
            setSelectedTrack(null);
            return;
        }
        if (showWishlist) {
            setShowWishlist(false);
            return;
        }
        if (showExportModal) {
            setShowExportModal(false);
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
  }, [selectedTrack, view, showWishlist, showExportModal]);


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
               // Update current user but preserve session
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
                    // MIGRATION: Ensure user has ID if it was created before this update
                    if (!validUser.uniqueId) {
                        validUser.uniqueId = generateUniqueId();
                        // Update in full list
                        const updatedList = currentUsersList.map(u => u.username === validUser.username ? validUser : u);
                        currentUsersList = updatedList;
                        localStorage.setItem(USERS_KEY, JSON.stringify(currentUsersList));
                    }
                    
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
    // Check if ID exists (legacy users)
    if (!user.uniqueId) {
        user.uniqueId = generateUniqueId();
        updateUsers(users.map(u => u.username === user.username ? user : u));
    }
    
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

  // --- CORE SEARCH LOGIC (Revised: Strict Word Matching + Phonetic Flexibility) ---
  
  // 1. Phonetic/Orthographic Normalizer
  // Targets: Accents, B/V, S/Z/C, H mute, LL/Y, Double Letters
  const normalizeFlexible = (text: string) => {
      if (!text) return "";
      let s = text.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Tildes y diacríticos

      // Simplificación Fonética Estricta para Búsqueda
      s = s.replace(/v/g, 'b'); // v -> b
      s = s.replace(/z/g, 's'); // z -> s
      s = s.replace(/ce/g, 'se').replace(/ci/g, 'si'); // ce, ci -> se, si
      s = s.replace(/qu/g, 'k'); // qu -> k
      s = s.replace(/k/g, 'c');  // k -> c (unifica sonido fuerte)
      s = s.replace(/ll/g, 'y'); // ll -> y
      s = s.replace(/i/g, 'y');  // i -> y (para uniformar vocales/consonantes sonoras similares)
      s = s.replace(/h/g, '');   // h -> (muda)
      s = s.replace(/ñ/g, 'n');  // ñ -> n

      // Reducción de letras dobles (rr -> r, mm -> m, ss -> s, etc)
      s = s.replace(/([a-z])\1+/g, '$1');

      // Eliminar caracteres no alfanuméricos (mantener espacios para separar palabras)
      s = s.replace(/[^a-z0-9\s]/g, '');
      
      return s.trim();
  };

  // 2. Tokenizer: Split into words, remove tiny meaningless words
  const getTokens = (text: string) => {
      const normalized = normalizeFlexible(text);
      return normalized.split(/\s+/).filter(t => t.length > 1); // Ignorar letras sueltas
  };

  const performBulkSearch = (text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) return alert("No se encontraron criterios de búsqueda.");

      const queries = lines.map(line => {
          // Detect manual format "Title - Performer" or explicit keys
          const lower = line.toLowerCase();
          if (lower.startsWith('titulo:')) {
              return { title: line.split(':')[1].trim(), raw: line };
          }
          // Simple heuristic: "Title - Performer" or just "Title"
          if (line.includes('-')) {
              const parts = line.split('-');
              if (parts.length >= 2) {
                  return { title: parts[0].trim(), performer: parts[1].trim(), raw: line };
              }
          }
          return { title: line, raw: line };
      });

      let foundCount = 0;
      const newSelection = [...selectedTracksList];
      const notFoundList: string[] = [];

      queries.forEach(q => {
          // Prepare query tokens
          const qTitleTokens = getTokens(q.title || "");
          const qPerfTokens = getTokens(q.performer || "");
          
          // Should have at least one valid token to search
          if (qTitleTokens.length === 0 && qPerfTokens.length === 0) return;

          let bestMatch: Track | null = null;
          // Boolean match: We want FULL WORDS found, not partial substrings
          // We iterate all tracks (can be slow for huge DB, but safe for 50 items wishlist)

          // Optimization: Pre-filter? No, we need flexible match.
          
          for (const t of tracks) {
              const tTitleTokens = getTokens(t.metadata.title || t.filename);
              const tPerfTokens = getTokens(t.metadata.performer || "");
              
              // Logic: 
              // 1. If Query has Title, ALL significant title tokens must exist in Track Title tokens.
              // 2. If Query has Performer, ALL significant performer tokens must exist in Track Performer tokens.
              
              let titleMatch = false;
              if (qTitleTokens.length > 0) {
                  // Check if every token in query title exists in track title
                  const allTokensFound = qTitleTokens.every(qt => tTitleTokens.includes(qt));
                  if (allTokensFound) titleMatch = true;
              } else {
                  // No title provided? Assume true if performer matches (rare case in wishlist)
                  titleMatch = true; 
              }

              let perfMatch = false;
              if (q.performer && qPerfTokens.length > 0) {
                  const allPerfFound = qPerfTokens.every(qp => tPerfTokens.includes(qp));
                  if (allPerfFound) perfMatch = true;
              } else {
                  // If no performer specified, we don't enforce it
                  perfMatch = true;
              }

              if (titleMatch && perfMatch) {
                  bestMatch = t;
                  break; // Found a solid match, stop looking for this query
              }
          }

          if (bestMatch) {
              // Avoid duplicates
              if (!newSelection.find(s => s.id === (bestMatch as Track).id)) {
                  newSelection.push(bestMatch);
                  foundCount++;
              }
          } else {
              notFoundList.push(q.raw);
          }
      });

      setSelectedTracksList(newSelection);
      setMissingQueries(notFoundList);

      if (foundCount > 0 || notFoundList.length > 0) {
          // Feedback message
          // alert(`Búsqueda completada.\nEncontrados: ${foundCount}\nNo encontrados: ${notFoundList.length}`);
      }
  };

  // --- HANDLERS ---
  const handleBulkSelectTxt = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target?.result;
          if (typeof text === 'string') {
              performBulkSearch(text);
          }
      };
      reader.readAsText(file);
  };

  const handleWishlistSubmit = () => {
      if (!wishlistText.trim()) return;
      performBulkSearch(wishlistText);
      setShowWishlist(false);
      setWishlistText('');
  };

  // ------------------------------------

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
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

  const handleClearSelection = () => {
      if (selectedTracksList.length === 0) return;
      if (window.confirm('¿Desea limpiar toda la lista de selección?')) {
          setSelectedTracksList([]);
          setMissingQueries([]);
      }
  };

  const handleOpenExportPreview = () => {
      // Initialize manual entries with missing queries
      setManualEntries(missingQueries);
      setShowExportModal(true);
  };

  // --- EXPORT LOGIC WITH MANUAL ENTRIES ---
  const handleShareWhatsApp = () => {
      const today = new Date().toISOString().split('T')[0];
      let message = `*SELECCIÓN MUSICAL RCM - ${today}*\n\n`;
      
      // Found Tracks
      selectedTracksList.forEach(t => {
          const root = t.path.split('/')[0] || 'Desconocido';
          message += `🎵 ${t.metadata.title || t.filename}\n`;
          message += `👤 ${t.metadata.performer || 'Desconocido'}\n`;
          message += `📂 ${root}\n\n`;
      });

      // Manual / Missing Tracks
      if (manualEntries.length > 0) {
          message += `*TEMAS NO EN BASE DE DATOS:*\n`;
          manualEntries.forEach(entry => {
              if (entry.trim()) message += `❌ ${entry.trim()}\n`;
          });
      }

      const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const handleGenerateSelectionReport = async () => {
      // Generar contador diario
      const today = new Date().toISOString().split('T')[0];
      const storedDate = localStorage.getItem('rcm_daily_date');
      let count = 1;

      if (storedDate === today) {
          const storedCount = localStorage.getItem('rcm_daily_count');
          count = storedCount ? parseInt(storedCount) + 1 : 1;
      }

      localStorage.setItem('rcm_daily_date', today);
      localStorage.setItem('rcm_daily_count', count.toString());

      // DB Tracks Rows
      const dbRows = selectedTracksList.map(t => 
          new docx.TableRow({
              children: [
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.title || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.author || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.metadata.performer || "Desconocido")] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.path || "")] }), 
              ]
          })
      );

      // Manual Entries Rows
      const manualRows = manualEntries.filter(e => e.trim()).map(entry => 
        new docx.TableRow({
            children: [
                new docx.TableCell({ children: [new docx.Paragraph(entry)] }),
                new docx.TableCell({ children: [new docx.Paragraph("---")] }),
                new docx.TableCell({ children: [new docx.Paragraph("---")] }),
                new docx.TableCell({ children: [new docx.Paragraph("NO EN BD")] }), 
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
                              children: ["Título", "Autor", "Intérprete", "Ruta/Estado"].map(t => 
                                  new docx.TableCell({ 
                                      children: [new docx.Paragraph({text: t, bold: true})],
                                      shading: { fill: "EEEEEE" }
                                  })
                              )
                          }),
                          ...dbRows,
                          ...manualRows
                      ]
                  })
              ]
          }]
      });

      docx.Packer.toBlob(doc).then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Selección Musical ${today} ${count}.docx`;
          a.click();
          window.URL.revokeObjectURL(url);
      });
  };

  const handleGenerateDigitalSignature = () => {
      if (!currentUser) return;
      
      const today = new Date().toISOString().split('T')[0];
      let content = `CERTIFICADO DE SELECCIÓN RCM - DOCUMENTO BLINDADO\n`;
      content += `--------------------------------------------------\n`;
      content += `FECHA: ${today}\n`;
      content += `USUARIO: ${currentUser.fullName}\n`;
      content += `FIRMA DIGITAL ID: ${currentUser.uniqueId}\n`;
      content += `--------------------------------------------------\n\n`;
      
      content += `[TEMAS SELECCIONADOS DE BASE DE DATOS]\n`;
      selectedTracksList.forEach((t, i) => {
           content += `${i + 1}. ${t.metadata.title || t.filename} - ${t.metadata.performer || 'Desc.'} [${t.path}]\n`;
      });
      
      content += `\n[TEMAS NO ENCONTRADOS / AGREGADOS MANUALMENTE]\n`;
      if (manualEntries.length > 0) {
          manualEntries.forEach((e, i) => {
              if (e.trim()) content += `${i + 1}. ${e.trim()}\n`;
          });
      } else {
          content += `(Ninguno)\n`;
      }
      
      content += `\n--------------------------------------------------\n`;
      content += `FIN DEL DOCUMENTO - NO EDITABLE\n`;
      content += `Este archivo confirma la solicitud realizada por el usuario portador de la firma.\n`;

      const blob = new Blob([content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FIRMA_DIGITAL_${currentUser.uniqueId}_${today}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
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
                    
                    {/* User ID Button (User Only) */}
                    {currentUser && authMode !== 'admin' && (
                        <button 
                            onClick={() => alert(`TU ID DE FIRMA DIGITAL:\n\n${currentUser.uniqueId}\n\nEste código es único e intransferible.`)}
                            className="bg-white/10 text-white rounded-full p-1.5 hover:bg-white/20"
                            title="Ver mi ID de Firma"
                        >
                            <span className="material-symbols-outlined text-sm">vpn_key</span>
                        </button>
                    )}

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
                        onBulkSelectTxt={handleBulkSelectTxt}
                        isAdmin={false} 
                        onSyncRoot={() => {}} 
                        onExportRoot={() => {}} 
                        onClearRoot={() => {}} 
                        selectedTrackIds={new Set(selectedTracksList.map(t => t.id))}
                        onToggleSelection={handleToggleSelection}
                        // Export hooks now point to modal opener
                        onOpenExportPreview={handleOpenExportPreview}
                        isSelectionView={true}
                        onClearSelection={handleClearSelection}
                        
                        onOpenWishlist={() => setShowWishlist(true)}
                        missingQueries={missingQueries}
                        onClearMissing={() => setMissingQueries([])}
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

        {/* WISHLIST MODAL */}
        {showWishlist && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowWishlist(false)}>
                <div 
                    className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 animate-slide-up"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             <span className="material-symbols-outlined text-miel">list_alt</span>
                             Lista de Deseos
                        </h3>
                        <button onClick={() => setShowWishlist(false)} className="text-gray-400 hover:text-gray-600">
                             <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Ingresa hasta 50 temas (uno por línea). Si no se encuentran, podrás buscarlos en YouTube.</p>
                    <textarea 
                        className="w-full h-48 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none mb-4"
                        placeholder="Ejemplo:&#10;Lágrimas Negras - Matamoros (Recomendado: Título - Intérprete)&#10;La Guantanamera&#10;Chan Chan"
                        value={wishlistText}
                        onChange={e => setWishlistText(e.target.value)}
                    ></textarea>
                    <button 
                        onClick={handleWishlistSubmit}
                        className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg hover:bg-primary-dark transition-colors flex justify-center items-center gap-2"
                    >
                        <span className="material-symbols-outlined">search</span>
                        Buscar Temas
                    </button>
                </div>
            </div>
        )}

        {/* EXPORT PREVIEW MODAL */}
        {showExportModal && (
            <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={() => setShowExportModal(false)}>
                <div 
                    className="w-full max-w-md bg-white dark:bg-zinc-900 h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-slide-up"
                    onClick={e => e.stopPropagation()}
                >
                     <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Previsualización Exportación</h3>
                        <button onClick={() => setShowExportModal(false)} className="text-gray-400">
                             <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        {/* Summary */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg mb-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Temas de Base de Datos:</span>
                            <span className="text-sm font-bold bg-white dark:bg-black/20 px-2 rounded">{selectedTracksList.length}</span>
                        </div>

                        {/* Manual Entries Editor */}
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                             <span className="material-symbols-outlined text-sm">edit_note</span>
                             Editar Temas No Encontrados (Incluir Créditos)
                        </h4>
                        
                        {manualEntries.length === 0 ? (
                            <p className="text-xs text-gray-400 italic mb-4">No hay temas pendientes.</p>
                        ) : (
                            <div className="space-y-2 mb-4">
                                {manualEntries.map((entry, idx) => (
                                    <input 
                                        key={idx}
                                        value={entry}
                                        onChange={(e) => {
                                            const newEntries = [...manualEntries];
                                            newEntries[idx] = e.target.value;
                                            setManualEntries(newEntries);
                                        }}
                                        className="w-full p-2 text-sm border border-orange-200 dark:border-orange-500/30 rounded bg-orange-50/50 dark:bg-orange-900/10 focus:ring-1 focus:ring-orange-500 outline-none"
                                        placeholder="Editar: Título - Intérprete"
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                         <button 
                            onClick={handleShareWhatsApp}
                            className="bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:brightness-95"
                        >
                            <span className="material-symbols-outlined text-sm">share</span> WhatsApp
                        </button>
                         <button 
                            onClick={handleGenerateSelectionReport}
                            className="bg-blue-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:brightness-95"
                        >
                            <span className="material-symbols-outlined text-sm">description</span> DOCX
                        </button>
                        <button 
                            onClick={handleGenerateDigitalSignature}
                            className="col-span-2 bg-gray-800 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1 hover:bg-black mt-1"
                        >
                            <span className="material-symbols-outlined text-sm">verified_user</span> 
                            Firma Digital (TXT Blindado)
                        </button>
                    </div>
                </div>
            </div>
        )}

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
