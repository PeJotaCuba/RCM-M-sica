
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
  onUploadTxt: (files: FileList, root: string) => void;
  isAdmin: boolean;
  onSyncRoot: (root: string) => void;
  onExportRoot: (root: string) => void;
  onClearRoot: (root: string) => void;
  
  // Selection Props
  selectedTrackIds?: Set<string>;
  onToggleSelection?: (track: Track) => void;
  isSelectionView?: boolean;
  onClearSelection?: () => void;
  onBulkSelectTxt?: (file: File) => void;
  
  // Custom Roots
  customRoots: string[];
  onAddCustomRoot: (name: string) => void;
  onRenameRoot: (oldName: string, newName: string) => void;
  
  // Wishlist & Missing Props
  onOpenWishlist?: () => void;
  missingQueries?: string[];
  onClearMissing?: () => void;
  
  onOpenExportPreview?: () => void;
}

const FIXED_ROOTS = ['Música 1', 'Música 2', 'Música 3', 'Música 4', 'Música 5'];
const ITEMS_PER_PAGE = 50;
const HISTORY_KEY = 'rcm_search_history';

const TrackList: React.FC<TrackListProps> = ({ 
    tracks, onSelectTrack, onUploadTxt, isAdmin, 
    onSyncRoot, onExportRoot, onClearRoot,
    selectedTrackIds, onToggleSelection, isSelectionView,
    onClearSelection, onBulkSelectTxt,
    customRoots, onAddCustomRoot, onRenameRoot,
    onOpenWishlist, missingQueries, onClearMissing,
    onOpenExportPreview
}) => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); 
  const [currentPath, setCurrentPath] = useState<string>(''); 
  const [renderLimit, setRenderLimit] = useState(ITEMS_PER_PAGE);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);

  // History State
  const [recentSearches, setRecentSearches] = useState<{term: string, time: number}[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [renameInput, setRenameInput] = useState('');

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const allRoots = useMemo(() => [...FIXED_ROOTS, ...customRoots], [customRoots]);

  // Load History on Mount
  useEffect(() => {
      try {
          const raw = localStorage.getItem(HISTORY_KEY);
          if (raw) {
              const parsed = JSON.parse(raw);
              const now = Date.now();
              // Filter items older than 24 hours (86400000 ms)
              const valid = parsed.filter((i: any) => (now - i.time) < 86400000);
              setRecentSearches(valid);
          }
      } catch (e) {
          console.error("Error loading search history", e);
      }
  }, []);

  useEffect(() => {
      const handler = setTimeout(() => { setSearchQuery(inputValue); }, 300);
      return () => { clearTimeout(handler); };
  }, [inputValue]);

  useEffect(() => {
      setRenderLimit(ITEMS_PER_PAGE);
  }, [searchQuery, activeRoot, currentPath]);

  const addToHistory = (term: string) => {
      if (!term.trim()) return;
      const clean = term.trim();
      setRecentSearches(prev => {
          const filtered = prev.filter(i => i.term.toLowerCase() !== clean.toLowerCase());
          const next = [{term: clean, time: Date.now()}, ...filtered].slice(0, 5); // Limit to 5 items
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          return next;
      });
  };

  const handleClearSearch = () => {
      setInputValue('');
      setSearchQuery('');
      inputRef.current?.focus();
  };

  const handleHistoryItemClick = (term: string) => {
      setInputValue(term);
      setShowHistory(false);
  };

  const handleNavigate = (item: any) => {
      // Save search to history if we are in search mode
      if (searchQuery) addToHistory(searchQuery);

      if (item.type === 'track') {
          onSelectTrack(item.data);
      } else {
          // Folder Logic
          const targetPath = item.fullPath;
          
          // Identify root from the path (e.g. "Música 4/Infantil" -> root "Música 4")
          // Note: Our path structure usually starts with the Root Name.
          // If we are in Global Search, we might be clicking a folder in a different root.
          
          // Check if path starts with any known root
          let newRoot = activeRoot;
          for (const r of allRoots) {
              if (targetPath.startsWith(r)) {
                  newRoot = r;
                  break;
              }
          }

          setActiveRoot(newRoot);
          setCurrentPath(targetPath);
          
          // Clear search to show contents of that folder
          setInputValue('');
          setSearchQuery('');
          setIsGlobalSearch(false);
      }
  };

  const handleRootClick = (root: string) => {
      if (activeRoot === root && !isSelectionView && isAdmin) {
          setActiveRoot(root);
          setCurrentPath(''); 
          setInputValue(''); 
          setSearchQuery('');
          setIsGlobalSearch(false);
      } else {
          setActiveRoot(root);
          setCurrentPath(''); 
          setInputValue(''); 
          setSearchQuery('');
          setIsGlobalSearch(false);
      }
  };

  const handleAddRootSubmit = () => {
      if (newNameInput.trim()) {
          onAddCustomRoot(newNameInput.trim());
          setNewNameInput('');
          setShowAddRootModal(false);
      }
  };

  const handleRenameSubmit = () => {
      if (renameInput.trim() && renameInput !== activeRoot) {
          onRenameRoot(activeRoot, renameInput.trim());
      }
      setShowRenameModal(false);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
      if (tabsContainerRef.current) {
          tabsContainerRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
      }
  };

  const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const displayItems = useMemo(() => {
      if (isSelectionView) {
          let list = tracks;
          if (searchQuery.trim()) {
              const cleanQuery = normalizeStr(searchQuery.trim());
              list = list.filter(t => normalizeStr(t.filename).includes(cleanQuery) || normalizeStr(t.metadata.title).includes(cleanQuery));
          }
          return list.map(t => ({ type: 'track' as const, data: t, key: t.id })).sort((a,b) => a.data.filename.localeCompare(b.data.filename));
      }

      const targetPath = currentPath || activeRoot;
      const targetPathNorm = normalizeStr(targetPath);
      const filesList: any[] = [];
      const foldersMap = new Set<string>();
      
      let pool = tracks;

      if (searchQuery.trim()) {
          const cleanQuery = normalizeStr(searchQuery.trim());
          
          if (!isGlobalSearch) {
              pool = pool.filter(t => normalizeStr(t.path).startsWith(targetPathNorm));
          }

          const matchedFiles = pool.filter(t => 
              normalizeStr(t.filename).includes(cleanQuery) || 
              normalizeStr(t.metadata.title).includes(cleanQuery) || 
              normalizeStr(t.metadata.performer).includes(cleanQuery)
          ).map(t => ({ type: 'track' as const, data: t, key: t.id }));

          const matchedFolders: any[] = [];
          const seenFolders = new Set<string>();

          pool.forEach(t => {
              const pathParts = t.path.split('/'); 
              let currentPathBuild = "";

              pathParts.forEach((part, index) => {
                  if (index === 0) { 
                      currentPathBuild = part; 
                      return; 
                  }
                  
                  currentPathBuild += "/" + part;
                  
                  if (normalizeStr(part).includes(cleanQuery)) {
                      if (!isGlobalSearch) {
                          if (!normalizeStr(currentPathBuild).startsWith(targetPathNorm)) return;
                      }

                      if (!seenFolders.has(currentPathBuild)) {
                          seenFolders.add(currentPathBuild);
                          matchedFolders.push({
                              type: 'folder' as const,
                              name: part,
                              fullPath: currentPathBuild, // Ensure this path matches the 'path' structure in Track
                              key: currentPathBuild
                          });
                      }
                  }
              });
          });

          return [...matchedFolders, ...matchedFiles];
      }

      const relevantTracks = tracks.filter(t => t.path && normalizeStr(t.path).startsWith(targetPathNorm));
      
      for (const t of relevantTracks) {
          const trackSegments = t.path.split('/').filter(p => p);
          const targetSegments = targetPath.split('/').filter(p => p);
          if (trackSegments.length === targetSegments.length) {
               filesList.push({ type: 'track' as const, data: t, key: t.id });
          } else if (trackSegments.length > targetSegments.length) {
              foldersMap.add(trackSegments.slice(0, targetSegments.length + 1).join('/'));
          }
      }
      const foldersList = Array.from(foldersMap).sort().map(fPath => ({ type: 'folder' as const, name: fPath.split('/').pop() || 'Carpeta', fullPath: fPath, key: fPath }));
      
      return [...foldersList, ...filesList.sort((a, b) => a.data.filename.localeCompare(b.data.filename))];
  }, [tracks, activeRoot, currentPath, searchQuery, isSelectionView, isGlobalSearch]);

  const visibleItems = displayItems.slice(0, renderLimit);
  const currentFolderName = currentPath ? currentPath.split('/').pop() : activeRoot;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <div className="bg-white dark:bg-background-dark shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        
        {/* TAB BAR (Solo en explorador) */}
        {!isSelectionView && (
            <div className="relative group bg-azul-header flex items-center">
                <button onClick={() => scrollTabs('left')} className="px-1 text-white/70 hover:text-white"><span className="material-symbols-outlined text-sm">chevron_left</span></button>
                <div ref={tabsContainerRef} className="flex flex-1 overflow-x-auto no-scrollbar scroll-smooth">
                    {allRoots.map(root => (
                        <button key={root} onClick={() => handleRootClick(root)} className={`flex-none min-w-[90px] py-4 text-[10px] font-bold uppercase tracking-wider relative transition-all ${activeRoot === root ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}>
                            {root}
                            {activeRoot === root && <div className="absolute bottom-0 left-0 w-full h-1 bg-miel"></div>}
                        </button>
                    ))}
                </div>
                {isAdmin && (
                    <button onClick={() => setShowAddRootModal(true)} className="px-3 py-4 text-miel hover:text-white transition-colors" title="Nueva Carpeta">
                        <span className="material-symbols-outlined">add_circle</span>
                    </button>
                )}
                <button onClick={() => scrollTabs('right')} className="px-1 text-white/70 hover:text-white"><span className="material-symbols-outlined text-sm">chevron_right</span></button>
            </div>
        )}

        {/* ADMIN DATABASE CONTROLS */}
        {!isSelectionView && isAdmin && (
            <div className="flex gap-2 p-2 bg-gray-50 border-b border-gray-100 justify-center">
                <button 
                    onClick={() => onSyncRoot(activeRoot)} 
                    className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                    title="Cargar base de datos desde la nube"
                >
                    <span className="material-symbols-outlined text-sm text-green-600">cloud_download</span> Actualizar
                </button>
                <button 
                    onClick={() => onExportRoot(activeRoot)} 
                    className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                    title="Descargar base de datos local"
                >
                    <span className="material-symbols-outlined text-sm text-blue-600">save</span> Guardar
                </button>
                <button 
                    onClick={() => onClearRoot(activeRoot)} 
                    className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-bold text-gray-700 hover:bg-red-50 hover:text-red-600"
                    title="Eliminar todos los datos de esta carpeta"
                >
                    <span className="material-symbols-outlined text-sm text-red-500">delete</span> Limpiar
                </button>
                {/* Specific Rename logic trigger for custom roots */}
                {customRoots.includes(activeRoot) && (
                    <button 
                        onClick={() => { setRenameInput(activeRoot); setShowRenameModal(true); }}
                        className="flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm text-[10px] font-bold text-gray-700 hover:bg-gray-100"
                    >
                        <span className="material-symbols-outlined text-sm text-gray-500">edit</span>
                    </button>
                )}
            </div>
        )}

        {/* SEARCH BAR AREA */}
        <div className="px-4 py-3 flex flex-col gap-2 relative">
             <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2 top-2.5 text-gray-400 text-lg">search</span>
                    <input 
                        ref={inputRef}
                        className="w-full pl-9 pr-9 py-2.5 rounded-lg border bg-gray-50 text-sm outline-none focus:border-primary transition-colors" 
                        placeholder={isSelectionView ? "Filtrar en selección..." : `Buscar en ${currentFolderName}...`} 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)} 
                        onFocus={() => setShowHistory(true)}
                        onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    />
                    {inputValue && (
                        <button 
                            onClick={handleClearSearch}
                            className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    )}

                    {/* SEARCH HISTORY DROPDOWN */}
                    {showHistory && recentSearches.length > 0 && !inputValue && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden">
                            <p className="text-[10px] text-gray-400 uppercase font-bold px-3 py-2 bg-gray-50 dark:bg-white/5">Recientes (24h)</p>
                            {recentSearches.map((item, idx) => (
                                <button 
                                    key={idx}
                                    onMouseDown={() => handleHistoryItemClick(item.term)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-white/10 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-gray-400 text-sm">history</span>
                                    {item.term}
                                </button>
                            ))}
                        </div>
                    )}
                 </div>
             </div>

             {/* Search Options (Global vs Local) */}
             {!isSelectionView && searchQuery.trim() && (
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsGlobalSearch(false)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${!isGlobalSearch ? 'bg-miel text-white border-miel shadow-sm' : 'text-gray-400 border-gray-200 bg-white'}`}>En esta carpeta</button>
                    <button onClick={() => setIsGlobalSearch(true)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg border transition-all ${isGlobalSearch ? 'bg-miel text-white border-miel shadow-sm' : 'text-gray-400 border-gray-200 bg-white'}`}>Búsqueda Global</button>
                </div>
            )}

            {/* Back Button */}
            {currentPath && !isSelectionView && !searchQuery.trim() && (
                <button onClick={() => setCurrentPath(currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : '')} className="self-start flex items-center gap-1 text-[10px] font-bold text-azul-header uppercase hover:underline">
                    <span className="material-symbols-outlined text-sm">arrow_back</span> Regresar
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24 bg-white dark:bg-background-dark">
        {visibleItems.map(item => (
          <div key={item.key} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
            <div className={`flex items-center justify-center rounded-lg size-10 shrink-0 ${item.type === 'track' ? 'bg-orange-50 text-primary' : 'bg-blue-50 text-azul-header'}`} onClick={() => handleNavigate(item)}>
              <span className="material-symbols-outlined">{item.type === 'folder' ? 'folder' : 'music_note'}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0" onClick={() => handleNavigate(item)}>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{item.type === 'track' ? item.data.metadata.title : item.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{item.type === 'track' ? item.data.metadata.performer : (item.type === 'folder' ? 'Directorio' : '')}</p>
            </div>
            
            {item.type === 'track' && onToggleSelection && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleSelection(item.data); }} 
                    className={`size-8 rounded-full flex items-center justify-center border transition-all ${selectedTrackIds?.has(item.data.id) ? 'bg-primary border-primary text-white shadow-md' : 'border-gray-200 text-gray-300 hover:border-gray-400'}`}
                >
                    <span className="material-symbols-outlined text-sm">{selectedTrackIds?.has(item.data.id) ? 'check' : 'add'}</span>
                </button>
            )}
          </div>
        ))}

        {visibleItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
                <span className="material-symbols-outlined text-4xl opacity-50">search_off</span>
                <p className="text-xs font-medium">No se encontraron resultados.</p>
            </div>
        )}
        
        {displayItems.length > renderLimit && (
             <div className="p-4 flex justify-center">
                 <button onClick={() => setRenderLimit(prev => prev + 50)} className="text-xs font-bold text-azul-header hover:underline">Cargar más...</button>
             </div>
        )}

        {/* ADMIN UPLOAD AREA AT BOTTOM */}
        {!isSelectionView && isAdmin && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 mt-4">
                <label className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:bg-gray-50 hover:border-primary transition-colors">
                    <span className="material-symbols-outlined text-gray-400 text-3xl">upload_file</span>
                    <span className="text-xs font-bold text-gray-600 text-center">
                        Cargar archivos TXT en <span className="text-primary">{activeRoot}</span>
                    </span>
                    <input type="file" multiple accept=".txt" className="hidden" onChange={(e) => onUploadTxt(e.target.files!, activeRoot)} />
                </label>
            </div>
        )}
      </div>

      {/* MODALS */}
      {showAddRootModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddRootModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Nuevo Espacio</h4>
                  <input className="w-full p-3 border rounded-xl mb-4 text-sm" placeholder="Ej: Música 6" value={newNameInput} onChange={e => setNewNameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddRootModal(false)} className="flex-1 py-2 text-gray-500 font-bold text-sm">Cerrar</button>
                    <button onClick={handleAddRootSubmit} className="flex-1 py-2 bg-primary text-white rounded-xl font-bold text-sm">Crear</button>
                  </div>
              </div>
          </div>
      )}

      {showRenameModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRenameModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Renombrar Carpeta</h4>
                  <input className="w-full p-3 border rounded-xl mb-4 text-sm" value={renameInput} onChange={e => setRenameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRenameModal(false)} className="flex-1 py-2 text-gray-500 font-bold text-sm">Cerrar</button>
                    <button onClick={handleRenameSubmit} className="flex-1 py-2 bg-azul-header text-white rounded-xl font-bold text-sm">Guardar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrackList;
