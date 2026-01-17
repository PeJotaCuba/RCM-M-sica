
import React, { useState, useMemo, useEffect } from 'react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
  onUploadTxt: (file: File, root: string) => void;
  isAdmin: boolean;
  onSyncRoot: (root: string) => void;
  onExportRoot: (root: string) => void;
  onClearRoot: (root: string) => void;
  
  // Selection Props
  selectedTrackIds?: Set<string>;
  onToggleSelection?: (track: Track) => void;
  onDownloadReport?: () => void;
  isSelectionView?: boolean;
  onClearSelection?: () => void;
  onShareWhatsApp?: () => void;
}

const FIXED_ROOTS = ['Música 1', 'Música 2', 'Música 3', 'Música 4', 'Música 5', 'Otros'];
const ITEMS_PER_PAGE = 50;

type SearchScope = 'global' | 'root';

const TrackList: React.FC<TrackListProps> = ({ 
    tracks, onSelectTrack, onUploadTxt, isAdmin, 
    onSyncRoot, onExportRoot, onClearRoot,
    selectedTrackIds, onToggleSelection, onDownloadReport, isSelectionView,
    onClearSelection, onShareWhatsApp
}) => {
  // Input State (Visual)
  const [inputValue, setInputValue] = useState('');
  // Query State (Applied after delay)
  const [searchQuery, setSearchQuery] = useState('');
  // Search Scope
  const [searchScope, setSearchScope] = useState<SearchScope>('global');
  
  // Navigation State
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); 
  const [currentPath, setCurrentPath] = useState<string>(''); 

  // Pagination State (To prevent rendering freezing)
  const [renderLimit, setRenderLimit] = useState(ITEMS_PER_PAGE);

  // Debounce Effect: Updates search query only after user stops typing for 300ms
  useEffect(() => {
      const handler = setTimeout(() => {
          setSearchQuery(inputValue);
      }, 300);

      return () => {
          clearTimeout(handler);
      };
  }, [inputValue]);

  // Reset pagination when filter or view changes
  useEffect(() => {
      setRenderLimit(ITEMS_PER_PAGE);
  }, [searchQuery, activeRoot, currentPath, searchScope]);

  // Handle Back Button for Folder Navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        // If we are deep in folders (currentPath exists) AND not searching, go up
        if (currentPath && !inputValue && !isSelectionView) {
            // Prevent default back behavior (exit) if we handled it
            handleNavigateUp();
        }
    };

    if (currentPath && !isSelectionView) {
        window.history.pushState({ folder: currentPath }, '');
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
        window.removeEventListener('popstate', handlePopState);
    };
  }, [currentPath, inputValue, isSelectionView]);


  const handleRootChange = (root: string) => {
      setActiveRoot(root);
      setCurrentPath(''); 
      setInputValue(''); 
      setSearchQuery('');
  };

  const handleNavigateUp = () => {
      if (!currentPath) return; 
      
      if (currentPath === activeRoot) {
          setCurrentPath('');
          return;
      }

      const segments = currentPath.split('/');
      segments.pop();
      const newPath = segments.join('/');
      setCurrentPath(newPath || '');
  };

  const handleFolderClick = (folderPath: string) => {
      setCurrentPath(folderPath);
      
      const folderRoot = folderPath.split('/')[0];
      // Sync active root tab if we clicked a folder that matches one of the fixed roots
      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
      const matchingFixedRoot = FIXED_ROOTS.find(r => normalize(r) === normalize(folderRoot));
      
      if (matchingFixedRoot) {
          setActiveRoot(matchingFixedRoot);
      }
      
      setInputValue('');
      setSearchQuery('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onUploadTxt(e.target.files[0], activeRoot);
      }
  };

  const handleLoadMore = () => {
      setRenderLimit(prev => prev + ITEMS_PER_PAGE);
  };

  const toggleSearchScope = () => {
      setSearchScope(prev => prev === 'global' ? 'root' : 'global');
  };

  const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // --- Filtering Logic ---
  const displayItems = useMemo(() => {
      // Si estamos en vista de selección, mostrar lista plana sin carpetas
      if (isSelectionView) {
          let list = tracks;
          if (searchQuery.trim()) {
              const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
              const cleanQuery = normalizeStr(searchQuery.trim());
              const queryRegex = new RegExp(`\\b${escapeRegExp(cleanQuery)}`, 'i');
              
              list = list.filter(t => {
                   const normFilename = normalizeStr(t.filename);
                   const normTitle = normalizeStr(t.metadata.title || "");
                   const normPerformer = normalizeStr(t.metadata.performer || "");
                   return queryRegex.test(normFilename) || queryRegex.test(normTitle) || queryRegex.test(normPerformer);
              });
          }
          return list.map(t => ({
              type: 'track' as const,
              data: t,
              key: t.id
          })).sort((a,b) => a.data.filename.localeCompare(b.data.filename));
      }

      // --- SEARCH MODE ---
      if (searchQuery.trim()) {
          const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 

          const cleanQuery = normalizeStr(searchQuery.trim());
          const queryRegex = new RegExp(`\\b${escapeRegExp(cleanQuery)}`, 'i');
          
          const matchingTracks: any[] = [];
          const matchingFolders = new Set<string>();

          let tracksPool = tracks;
          const contextPath = currentPath || activeRoot;

          if (searchScope === 'root') {
              const contextPathNorm = normalizeStr(contextPath);
              tracksPool = tracks.filter(t => t.path && normalizeStr(t.path).startsWith(contextPathNorm));
          }

          for (const t of tracksPool) {
               const normFilename = normalizeStr(t.filename);
               const normTitle = normalizeStr(t.metadata.title || "");
               const normPerformer = normalizeStr(t.metadata.performer || "");
               const normPath = t.path ? normalizeStr(t.path) : "";

               const matchesTrack = 
                  queryRegex.test(normFilename) ||
                  queryRegex.test(normTitle) ||
                  queryRegex.test(normPerformer) ||
                  queryRegex.test(normPath);

               if (matchesTrack) {
                   matchingTracks.push({
                      type: 'track' as const,
                      data: t,
                      key: t.id
                   });
               }

               if (t.path) {
                  const segments = t.path.split('/');
                  let progressive = "";
                  for (const seg of segments) {
                      progressive = progressive ? `${progressive}/${seg}` : seg;
                      
                      if (searchScope === 'root' && !normalizeStr(progressive).startsWith(normalizeStr(contextPath))) {
                          continue;
                      }

                      const normSeg = normalizeStr(seg);
                      if (queryRegex.test(normSeg)) {
                          matchingFolders.add(progressive);
                      }
                  }
               }
          }

          const folderItems = Array.from(matchingFolders).map(fPath => ({
              type: 'folder' as const,
              name: fPath.split('/').pop() || 'Carpeta',
              fullPath: fPath,
              key: `folder-${fPath}`
          }));

          return [...folderItems.sort((a,b) => a.name.localeCompare(b.name)), ...matchingTracks];
      }

      // --- BROWSE MODE (Tab Scoped) ---
      
      const targetPath = currentPath || activeRoot;
      const targetPathNorm = normalizeStr(targetPath);
      const rootFilterStr = normalizeStr(activeRoot);
      
      const rootTracks = tracks.filter(t => {
          if (!t.path) return false;
          const pathNorm = normalizeStr(t.path);
          return pathNorm.startsWith(rootFilterStr);
      });

      const foldersMap = new Set<string>();
      const filesList: any[] = [];

      for (const t of rootTracks) {
          const trackPath = t.path; 
          const trackPathNorm = normalizeStr(trackPath);
          
          if (!trackPathNorm.startsWith(targetPathNorm)) continue;

          const trackSegments = trackPath.split('/').filter(p => p);
          const targetSegmentCount = currentPath ? currentPath.split('/').filter(p => p).length : 1; 
          
          if (trackSegments.length === targetSegmentCount + 1) {
              filesList.push({
                  type: 'track' as const,
                  data: t,
                  key: t.id
              });
          } else if (trackSegments.length > targetSegmentCount + 1) {
              const folderPath = trackSegments.slice(0, targetSegmentCount + 1).join('/');
              foldersMap.add(folderPath);
          }
      }

      const foldersList = Array.from(foldersMap).sort().map(fPath => ({
          type: 'folder' as const,
          name: fPath.split('/').pop() || 'Carpeta',
          fullPath: fPath,
          key: fPath
      }));

      filesList.sort((a, b) => a.data.filename.localeCompare(b.data.filename));

      return [...foldersList, ...filesList];

  }, [tracks, activeRoot, currentPath, searchQuery, searchScope, isSelectionView]);

  const visibleItems = displayItems.slice(0, renderLimit);
  const currentFolderName = currentPath ? currentPath.split('/').pop() : activeRoot;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Header Area */}
      <div className="bg-white dark:bg-background-dark shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        
        {/* 1. FIXED TABS (Hide in Selection View or Search) */}
        {!inputValue && !isSelectionView && (
            <div className="flex w-full overflow-x-auto no-scrollbar bg-azul-header text-white">
                {FIXED_ROOTS.map(root => (
                    <button 
                        key={root}
                        onClick={() => handleRootChange(root)} 
                        className={`flex-1 min-w-[90px] py-4 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors relative ${activeRoot === root ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                    >
                        {root}
                        {activeRoot === root && (
                            <div className="absolute bottom-0 left-0 w-full h-1 bg-miel"></div>
                        )}
                    </button>
                ))}
            </div>
        )}

        {/* 1.5 Header for Selection View */}
        {isSelectionView && (
             <div className="bg-white dark:bg-background-dark p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                     <div>
                         <h2 className="text-lg font-bold text-primary">Canciones Seleccionadas</h2>
                         <p className="text-xs text-gray-500">{tracks.length} elementos</p>
                     </div>
                     {onClearSelection && tracks.length > 0 && (
                         <button 
                             onClick={onClearSelection}
                             className="text-red-500 text-[10px] font-bold uppercase border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                         >
                             Limpiar Lista
                         </button>
                     )}
                 </div>
                 
                 {tracks.length > 0 && (
                    <div className="flex gap-2">
                        {onDownloadReport && (
                            <button 
                                onClick={onDownloadReport}
                                className="flex-1 bg-blue-600 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1 hover:bg-blue-700 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                DOCX
                            </button>
                        )}
                        {onShareWhatsApp && (
                            <button 
                                onClick={onShareWhatsApp}
                                className="flex-1 bg-[#25D366] text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1 hover:bg-[#20bd5a] shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">share</span>
                                WhatsApp
                            </button>
                        )}
                    </div>
                 )}
             </div>
        )}

        {/* 2. Tools & Breadcrumbs */}
        <div className="px-4 py-3 flex flex-col gap-3">
            
            {/* Search Bar */}
             <label className="flex-1 flex flex-col relative">
                <div className="flex w-full items-stretch rounded-lg h-11 overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-900 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
                    <div className="text-gray-400 flex items-center justify-center pl-3">
                        <span className="material-symbols-outlined text-xl">search</span>
                    </div>
                    <input 
                        className="flex w-full border-none bg-transparent text-gray-900 dark:text-white focus:ring-0 placeholder:text-gray-400 px-3 text-sm font-normal" 
                        placeholder={isSelectionView ? "Filtrar seleccionados..." : (searchScope === 'global' ? "Buscar en todo..." : `Buscar en ${currentFolderName}...`)}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />
                    
                    {/* Toggle Search Scope (Hide in Selection View) */}
                    {!isSelectionView && (
                        <button 
                            onClick={toggleSearchScope}
                            className={`px-3 flex items-center justify-center border-l border-gray-200 dark:border-gray-700 transition-colors ${searchScope === 'global' ? 'text-gray-400 hover:text-primary' : 'text-primary bg-primary/10'}`}
                            title={searchScope === 'global' ? "Cambiar a búsqueda local" : `Cambiar a búsqueda global`}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {searchScope === 'global' ? 'public' : 'folder_open'}
                            </span>
                        </button>
                    )}

                    {inputValue && (
                        <button 
                            onClick={() => { setInputValue(''); setSearchQuery(''); }}
                            className="px-3 text-gray-400 hover:text-gray-600 flex items-center"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    )}
                </div>
            </label>

            {!inputValue && !isSelectionView && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-gray-500 text-xs min-h-[20px]">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-miel">hard_drive</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">{activeRoot}</span>
                        {currentPath && normalizeStr(currentPath) !== normalizeStr(activeRoot) && (
                            <>
                                <span className="material-symbols-outlined text-sm text-gray-400">chevron_right</span>
                                <span className="truncate font-mono text-gray-600 dark:text-gray-400 max-w-[120px]">
                                    {currentPath.split('/').slice(1).join(' / ')}
                                </span>
                            </>
                        )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                        {isAdmin && (
                            <button 
                                onClick={() => onClearRoot(activeRoot)}
                                className="bg-red-500 text-white rounded px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-red-600 transition-colors"
                                title={`BORRAR DATOS DE ${activeRoot}`}
                            >
                                <span className="material-symbols-outlined text-xs">delete</span>
                                Limpiar
                            </button>
                        )}

                        <button 
                            onClick={() => onSyncRoot(activeRoot)}
                            className="bg-green-600 text-white rounded px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-green-700 transition-colors"
                            title={`Actualizar ${activeRoot} desde GitHub`}
                        >
                            <span className="material-symbols-outlined text-xs">sync</span>
                            Actualizar
                        </button>
                        
                        {isAdmin && (
                            <button 
                                onClick={() => onExportRoot(activeRoot)}
                                className="bg-azul-header text-white rounded px-2 py-1 text-[10px] font-bold uppercase flex items-center gap-1 hover:bg-blue-900 transition-colors"
                                title={`Guardar ${activeRoot} a JSON`}
                            >
                                <span className="material-symbols-outlined text-xs">save</span>
                                Guardar
                            </button>
                        )}
                    </div>

                    {currentPath && normalizeStr(currentPath) !== normalizeStr(activeRoot) && (
                        <button 
                            onClick={handleNavigateUp}
                            className="ml-auto size-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors border border-gray-200 dark:border-gray-700"
                            title="Subir nivel"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_upward</span>
                        </button>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24 bg-white dark:bg-background-dark">
        {/* Upload Area - Show if not searching and user is admin */}
        {!inputValue && isAdmin && !isSelectionView && (
            <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-dashed border-gray-300 dark:border-gray-700">
                <label className="flex items-center justify-center gap-3 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary hover:bg-white dark:hover:bg-white/10 transition-all group">
                    <span className="material-symbols-outlined text-gray-400 group-hover:text-primary">upload_file</span>
                    <span className="text-xs font-bold text-gray-500 group-hover:text-primary">Cargar TXT en {activeRoot}</span>
                    <input type="file" accept=".txt" onChange={handleFileChange} className="hidden" />
                </label>
            </div>
        )}

        {visibleItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <span className="material-symbols-outlined text-5xl mb-4 text-gray-200 dark:text-gray-700">
                 {inputValue ? 'search_off' : 'folder_open'}
             </span>
             <p className="text-sm font-medium">{inputValue ? 'Sin resultados' : (isSelectionView ? 'No hay canciones seleccionadas' : 'Carpeta vacía')}</p>
             <p className="text-xs mt-1 opacity-60">
                 {inputValue ? 'Intenta con otro término' : (isSelectionView ? 'Agrega canciones desde el Explorador' : 'No se encontraron elementos')}
             </p>
           </div>
        ) : (
            <>
              {visibleItems.map(item => (
                <div 
                  key={item.key} 
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors active:bg-gray-100"
                >
                  {/* Icon */}
                  <div 
                      className={`flex items-center justify-center rounded-lg shrink-0 size-10 cursor-pointer ${item.type === 'track' ? 'bg-orange-50 text-primary dark:bg-primary/20' : 'bg-blue-50 text-azul-header dark:bg-blue-900/30 dark:text-blue-300'}`}
                      onClick={() => item.type === 'folder' ? handleFolderClick(item.fullPath) : onSelectTrack(item.data)}
                  >
                    <span className={`material-symbols-outlined ${item.type === 'folder' ? 'material-symbols-filled' : ''} text-2xl`}>
                        {item.type === 'folder' ? 'folder' : 'music_note'}
                    </span>
                  </div>

                  {/* Text */}
                  <div 
                      className="flex flex-col flex-1 min-w-0 cursor-pointer"
                      onClick={() => item.type === 'folder' ? handleFolderClick(item.fullPath) : onSelectTrack(item.data)}
                  >
                    <div className="flex items-center justify-between">
                        <p className="text-gray-900 dark:text-gray-100 text-sm font-semibold leading-tight truncate pr-2">
                            {item.type === 'folder' ? item.name : (item.data.metadata.title || item.data.filename)}
                        </p>
                        {/* Show root tag if needed */}
                        {(inputValue || isSelectionView) && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase font-bold shrink-0">
                                {item.fullPath ? item.fullPath.split('/')[0] : (item.data.path ? item.data.path.split('/')[0] : '')}
                            </span>
                        )}
                    </div>
                    
                    {item.type === 'track' && (
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate">
                                {item.data.metadata.performer || "Desconocido"}
                            </p>
                        </div>
                    )}
                    
                    {/* Show full path when searching */}
                    {(inputValue || isSelectionView) && (
                        <p className="text-gray-400 text-[10px] mt-0.5 truncate flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">folder</span>
                            {item.type === 'track' ? item.data.path : item.fullPath}
                        </p>
                    )}
                  </div>
                  
                  {/* Action Area: Selection Checkbox or Chevron */}
                  <div className="flex items-center justify-center size-10 shrink-0">
                    {item.type === 'track' && onToggleSelection && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSelection(item.data);
                            }}
                            className={`size-8 rounded-full flex items-center justify-center transition-all ${selectedTrackIds?.has(item.data.id) ? (isSelectionView ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary text-white') : 'bg-gray-100 dark:bg-white/10 text-gray-300 dark:text-gray-600 hover:bg-gray-200'}`}
                        >
                            <span className="material-symbols-outlined text-lg">
                                {isSelectionView ? 'delete' : (selectedTrackIds?.has(item.data.id) ? 'check' : 'add')}
                            </span>
                        </button>
                    )}

                    {item.type === 'folder' && (
                        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-xl pointer-events-none">chevron_right</span>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Load More Button */}
              {displayItems.length > visibleItems.length && (
                  <div className="p-4 flex justify-center">
                      <button 
                        onClick={handleLoadMore}
                        className="text-xs font-bold text-gray-500 hover:text-primary bg-gray-100 dark:bg-white/5 hover:bg-gray-200 px-4 py-2 rounded-full transition-colors"
                      >
                          Mostrar más resultados ({visibleItems.length} de {displayItems.length})
                      </button>
                  </div>
              )}
            </>
        )}
      </div>
    </div>
  );
};

export default TrackList;
