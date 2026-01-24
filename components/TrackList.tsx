
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

  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [renameInput, setRenameInput] = useState('');

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const allRoots = useMemo(() => [...FIXED_ROOTS, ...customRoots], [customRoots]);

  useEffect(() => {
      const handler = setTimeout(() => { setSearchQuery(inputValue); }, 300);
      return () => { clearTimeout(handler); };
  }, [inputValue]);

  useEffect(() => {
      setRenderLimit(ITEMS_PER_PAGE);
  }, [searchQuery, activeRoot, currentPath]);

  const handleRootClick = (root: string) => {
      if (activeRoot === root && !isSelectionView && isAdmin) {
          // Double click logic replaced by long press or simple button click logic
          // But here, if admin clicks active tab, we show rename modal? No, let's keep simple.
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
          pool = pool.filter(t => 
              normalizeStr(t.filename).includes(cleanQuery) || 
              normalizeStr(t.metadata.title).includes(cleanQuery) || 
              normalizeStr(t.metadata.performer).includes(cleanQuery)
          );
          return pool.map(t => ({ type: 'track' as const, data: t, key: t.id }));
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
            <div className="flex gap-3 p-3 bg-gray-50 border-b border-gray-100 justify-center">
                <button 
                    onClick={() => onSyncRoot(activeRoot)} 
                    className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all hover:shadow-md"
                    title="Cargar base de datos desde la nube"
                >
                    <span className="material-symbols-outlined text-lg text-green-600">cloud_download</span> Actualizar
                </button>
                <button 
                    onClick={() => onExportRoot(activeRoot)} 
                    className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all hover:shadow-md"
                    title="Descargar base de datos local"
                >
                    <span className="material-symbols-outlined text-lg text-blue-600">save</span> Guardar
                </button>
                <button 
                    onClick={() => onClearRoot(activeRoot)} 
                    className="flex items-center gap-2 bg-white border border-gray-200 px-6 py-2.5 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all hover:shadow-md"
                    title="Eliminar todos los datos de esta carpeta"
                >
                    <span className="material-symbols-outlined text-lg text-red-500">delete</span> Limpiar
                </button>
                
                {/* Specific Rename logic trigger for custom roots */}
                {customRoots.includes(activeRoot) && (
                    <button 
                        onClick={() => { setRenameInput(activeRoot); setShowRenameModal(true); }}
                        className="flex items-center gap-1 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg text-gray-500">edit</span>
                    </button>
                )}
            </div>
        )}

        {/* SEARCH BAR AREA */}
        <div className="px-4 py-3 flex flex-col gap-2">
             <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2 top-2.5 text-gray-400 text-lg">search</span>
                    <input className="w-full pl-9 pr-3 py-2.5 rounded-lg border bg-gray-50 text-sm outline-none focus:border-primary transition-colors" placeholder={isSelectionView ? "Filtrar en selección..." : `Buscar en ${currentFolderName}...`} value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
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
            <div className={`flex items-center justify-center rounded-lg size-10 shrink-0 ${item.type === 'track' ? 'bg-orange-50 text-primary' : 'bg-blue-50 text-azul-header'}`} onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
              <span className="material-symbols-outlined">{item.type === 'folder' ? 'folder' : 'music_note'}</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0" onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{item.type === 'track' ? item.data.metadata.title : item.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{item.type === 'track' ? item.data.metadata.performer : 'Directorio'}</p>
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
