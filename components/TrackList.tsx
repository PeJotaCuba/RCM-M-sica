
import React, { useState, useMemo, useEffect } from 'react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
  onUploadTxt: (files: FileList, root: string) => void;
  isAdmin: boolean;
  onSyncRoot: (root: string) => void;
  onExportRoot: (root: string) => void;
  onClearRoot: (root: string) => void;
  selectedTrackIds?: Set<string>;
  onToggleSelection?: (track: Track) => void;
  isSelectionView?: boolean;
  onClearSelection?: () => void;
  customRoots: string[];
  onAddCustomRoot: (name: string) => void;
  onRenameRoot: (oldName: string, newName: string) => void;
}

const FIXED_ROOTS = ['Música 1', 'Música 2', 'Música 3', 'Música 4', 'Música 5', 'Otros'];

const TrackList: React.FC<TrackListProps> = ({ 
    tracks, onSelectTrack, onUploadTxt, isAdmin, 
    selectedTrackIds, onToggleSelection, isSelectionView,
    customRoots, onAddCustomRoot, onRenameRoot
}) => {
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); 
  const [currentPath, setCurrentPath] = useState<string>(''); 
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [showAddRootModal, setShowAddRootModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  const [renameInput, setRenameInput] = useState('');

  const allRoots = useMemo(() => [...FIXED_ROOTS, ...customRoots], [customRoots]);

  useEffect(() => {
      const handler = setTimeout(() => { setSearchQuery(inputValue); }, 300);
      return () => { clearTimeout(handler); };
  }, [inputValue]);

  const handleRootClick = (root: string) => {
      if (activeRoot === root && !isSelectionView && isAdmin) {
          setRenameInput(root);
          setShowRenameModal(true);
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

  const normalizeStr = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const displayItems = useMemo(() => {
      if (isSelectionView) {
          let list = tracks;
          if (searchQuery.trim()) {
              const cleanQuery = normalizeStr(searchQuery.trim());
              list = list.filter(t => normalizeStr(t.filename).includes(cleanQuery) || normalizeStr(t.metadata.title).includes(cleanQuery) || normalizeStr(t.metadata.performer).includes(cleanQuery));
          }
          return list.map(t => ({ type: 'track' as const, data: t, key: t.id }));
      }

      const targetPath = currentPath || activeRoot;
      const targetPathNorm = normalizeStr(targetPath);
      const filesList: any[] = [];
      const foldersMap = new Set<string>();
      
      let pool = tracks;
      if (searchQuery.trim()) {
          const cleanQuery = normalizeStr(searchQuery.trim());
          if (!isGlobalSearch) pool = pool.filter(t => normalizeStr(t.path).startsWith(targetPathNorm));
          pool = pool.filter(t => normalizeStr(t.filename).includes(cleanQuery) || normalizeStr(t.metadata.title).includes(cleanQuery) || normalizeStr(t.metadata.performer).includes(cleanQuery));
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
      return [...foldersList, ...filesList];
  }, [tracks, activeRoot, currentPath, searchQuery, isSelectionView, isGlobalSearch]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="sticky top-0 z-10 bg-white border-b">
        {!isSelectionView && (
            <div className="bg-azul-header flex items-center overflow-x-auto no-scrollbar">
                {allRoots.map(root => (
                    <button key={root} onClick={() => handleRootClick(root)} className={`flex-none py-4 px-5 text-[10px] font-bold uppercase tracking-wider relative ${activeRoot === root ? 'text-white' : 'text-white/50'}`}>
                        {root}
                        {activeRoot === root && <div className="absolute bottom-0 left-0 w-full h-1 bg-miel"></div>}
                    </button>
                ))}
                {isAdmin && (
                    <button onClick={() => setShowAddRootModal(true)} className="px-4 py-4 text-miel flex-none"><span className="material-symbols-outlined text-xl">add_circle</span></button>
                )}
            </div>
        )}
        <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
                 <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-2 top-2 text-gray-400 text-lg">search</span>
                    <input className="w-full pl-8 pr-3 py-2 rounded-lg border bg-gray-50 text-xs outline-none" placeholder="Buscar..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                 </div>
            </div>
            {!isSelectionView && searchQuery.trim() && (
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsGlobalSearch(false)} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg border ${!isGlobalSearch ? 'bg-miel text-white border-miel' : 'text-gray-400 border-gray-200'}`}>En Carpeta</button>
                    <button onClick={() => setIsGlobalSearch(true)} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg border ${isGlobalSearch ? 'bg-miel text-white border-miel' : 'text-gray-400 border-gray-200'}`}>Global</button>
                </div>
            )}
            {currentPath && !isSelectionView && !searchQuery.trim() && (
                <button onClick={() => setCurrentPath(currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : '')} className="flex items-center gap-1 text-[9px] font-bold text-azul-header uppercase"><span className="material-symbols-outlined text-sm">arrow_back</span> Atrás</button>
            )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 pb-20">
        {displayItems.map(item => (
          <div key={item.key} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'track' ? 'bg-red-50 text-primary' : 'bg-blue-50 text-azul-header'}`} onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
              <span className="material-symbols-outlined text-xl">{item.type === 'folder' ? 'folder' : 'music_note'}</span>
            </div>
            <div className="flex-1 min-w-0" onClick={() => item.type === 'folder' ? setCurrentPath(item.fullPath) : onSelectTrack(item.data)}>
                <p className="font-bold text-xs truncate text-gray-800">{item.type === 'track' ? item.data.metadata.title : item.name}</p>
                <p className="text-[10px] text-gray-400 truncate mt-0.5">{item.type === 'track' ? item.data.metadata.performer : 'Carpeta'}</p>
            </div>
            {item.type === 'track' && onToggleSelection && (
                <button onClick={() => onToggleSelection(item.data)} className={`size-8 rounded-full flex items-center justify-center border ${selectedTrackIds?.has(item.data.id) ? 'bg-primary border-primary text-white' : 'border-gray-200 text-gray-300'}`}><span className="material-symbols-outlined text-sm">{selectedTrackIds?.has(item.data.id) ? 'check' : 'add'}</span></button>
            )}
          </div>
        ))}
      </div>
      {showAddRootModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAddRootModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Nuevo Espacio</h4>
                  <input className="w-full p-3 border rounded-xl mb-4 text-sm" value={newNameInput} onChange={e => setNewNameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2"><button onClick={() => setShowAddRootModal(false)} className="flex-1 py-2 text-gray-500 font-bold text-sm">Cerrar</button><button onClick={handleAddRootSubmit} className="flex-1 py-2 bg-primary text-white rounded-xl font-bold text-sm">Crear</button></div>
              </div>
          </div>
      )}
      {showRenameModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRenameModal(false)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                  <h4 className="font-bold mb-4">Cambiar nombre</h4>
                  <input className="w-full p-3 border rounded-xl mb-4 text-sm" value={renameInput} onChange={e => setRenameInput(e.target.value)} autoFocus />
                  <div className="flex gap-2"><button onClick={() => setShowRenameModal(false)} className="flex-1 py-2 text-gray-500 font-bold text-sm">Cerrar</button><button onClick={handleRenameSubmit} className="flex-1 py-2 bg-azul-header text-white rounded-xl font-bold text-sm">Guardar</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TrackList;
