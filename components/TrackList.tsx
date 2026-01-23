
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
  
  // Custom Roots
  customRoots: string[];
  onAddCustomRoot: (name: string) => void;
  onRenameRoot: (oldName: string, newName: string) => void;
  
  onOpenExportPreview?: () => void;
}

const FIXED_ROOTS = ['Música 1', 'Música 2', 'Música 3', 'Música 4', 'Música 5', 'Otros'];
const ITEMS_PER_PAGE = 50;

const TrackList: React.FC<TrackListProps> = ({ 
    tracks, onSelectTrack, onUploadTxt, isAdmin, 
    onSyncRoot, onExportRoot, onClearRoot,
    selectedTrackIds, onToggleSelection, isSelectionView,
    onClearSelection, 
    customRoots, onAddCustomRoot, onRenameRoot,
    onOpenExportPreview
}) => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); 
  const [currentPath, setCurrentPath] = useState<string>(''); 
  const [renderLimit, setRenderLimit] = useState(ITEMS_PER_PAGE);
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

  const handleRootClick = (root: string) => {
      if (activeRoot === root && !isSelectionView) {
          // Rename dialog only for custom roots or if user wants to rename fixed ones (not recommended but allowed as per prompt)
          setRenameInput(root);
          setShowRenameModal(true);
      } else {
          setActiveRoot(root);
          setCurrentPath(''); 
          setInputValue(''); 
          setSearchQuery('');
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
          setActiveRoot(renameInput.trim());
      }
      setShowRenameModal(false);
  };

  const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const displayItems = useMemo(() => {
      if (isSelectionView) {
          let list = tracks;
          if (searchQuery.trim()) {
              const cleanQuery = normalizeStr(searchQuery.trim());
              list = list.filter(t => normalizeStr(t.filename).includes(cleanQuery) || normalizeStr(t.metadata.title).includes(cleanQuery));
          }
          return list.map(t => ({ type: 'track' as const, data: t, key: t.id }));
      }
      const targetPath = currentPath || activeRoot;
      const targetPathNorm = normalizeStr(targetPath);
      const filesList: any[] = [];
      const foldersMap = new Set<string>();
      
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
      return [...foldersList, ...filesList];
  }, [tracks, activeRoot, currentPath, searchQuery, isSelectionView]);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      <div className="bg-white dark:bg-background-dark border-b border-gray-200 sticky top-0 z-10">
        {!isSelectionView && (
            <div className="bg-azul-header flex items-center">
                <div ref={tabsContainerRef} className="flex flex-1 overflow-x-auto no-scrollbar scroll-smooth">
                    {allRoots.map(root => (
                        <button key={root} onClick={() => handleRootClick(root)} className={`flex-none min-w-[80px] py-4 px-2 text-[10px] font-bold uppercase tracking-wider relative transition-all ${activeRoot === root ? 'bg-white/10 text-white' : 'text-gray-300'}`}>
                            {root}
                            {activeRoot === root && <div className="absolute bottom-0 left-0 w-full h-1 bg-miel"></div>}
                        </button>
                    ))}
                    <button onClick={() => setShowAddRootModal(true)} className="px-4 py-4 text-miel hover:text-white transition-colors" title="Nuevo Espacio">
                        <span className="material-symbols-outlined">add_circle</span>
                    </button>
                </div>
            </div>
        )}

        <div className="px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
                 <input className="flex-1 p-2.5 rounded-lg border bg-gray-50 text-sm" placeholder="Buscar..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                 {!isSelectionView && isAdmin && (
                    <label className="bg-primary text-white size-10 flex items-center justify-center rounded-lg cursor-pointer">
                        <span className="material-symbols-outlined">upload_file</span>
                        <input type="file" multiple className="hidden" onChange={(e) => e.target.files && onUploadTxt(e.target.files, activeRoot)} />
                    </label>
                 )}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-white dark:bg-zinc-900 pb-20">
        {displayItems.map(item => (
          <div key={item.key} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer">
            <div className={`size-10 rounded-lg flex items-center justify-center ${item.type === 'track' ? 'bg-orange-50 text-primary' : 'bg-blue-50 text-azul-header'}`} onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
              <span className="material-symbols-outlined">{item.type === 'folder' ? 'folder' : 'music_note'}</span>
            </div>
            <div className="flex-1 min-w-0" onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
                <p className="font-bold text-sm truncate text-gray-800 dark:text-white">{item.type === 'track' ? item.data.metadata.title : item.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{item.type === 'track' ? item.data.metadata.performer : 'Directorio'}</p>
            </div>
            {item.type === 'track' && onToggleSelection && (
                <button onClick={() => onToggleSelection(item.data)} className={`size-8 rounded-full flex items-center justify-center border ${selectedTrackIds?.has(item.data.id) ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-300'}`}>
                    <span className="material-symbols-outlined text-sm">{selectedTrackIds?.has(item.data.id) ? 'check' : 'add'}</span>
                </button>
            )}
          </div>
        ))}
        {displayItems.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">No se encontraron elementos.</p>}
      </div>

      {/* MODALS FOR ADD/RENAME ROOT */}
      {showAddRootModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddRootModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Nueva Carpeta / Espacio</h4>
                  <input className="w-full p-3 border rounded-xl mb-4" placeholder="Nombre (Ej: Musica 6)" value={newNameInput} onChange={e => setNewNameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddRootModal(false)} className="flex-1 py-2 text-gray-500 font-bold">Cerrar</button>
                    <button onClick={handleAddRootSubmit} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold">Crear</button>
                  </div>
              </div>
          </div>
      )}

      {showRenameModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRenameModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Renombrar Espacio</h4>
                  <input className="w-full p-3 border rounded-xl mb-4" placeholder="Nuevo nombre" value={renameInput} onChange={e => setRenameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => setShowRenameModal(false)} className="flex-1 py-2 text-gray-500 font-bold">Cerrar</button>
                    <button onClick={handleRenameSubmit} className="flex-1 py-2 bg-azul-header text-white rounded-lg font-bold">Cambiar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrackList;
