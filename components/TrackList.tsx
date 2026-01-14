
import React, { useState, useMemo, useEffect } from 'react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
}

const FIXED_ROOTS = ['Música 1', 'Música 2', 'Música 3', 'Música 4', 'Música 5'];

const TrackList: React.FC<TrackListProps> = ({ tracks, onSelectTrack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); // Default to Música 1
  const [currentPath, setCurrentPath] = useState<string>(''); 

  // Reset path and search when changing root tab
  const handleRootChange = (root: string) => {
      setActiveRoot(root);
      setCurrentPath(''); 
      setSearchQuery('');
  };

  const handleNavigateUp = () => {
      if (!currentPath) return; 
      
      // If currentPath is exactly the root (or just a slash), clear it to show root contents
      if (currentPath === activeRoot) {
          setCurrentPath('');
          return;
      }

      // Remove last segment
      const segments = currentPath.split('/');
      segments.pop();
      const newPath = segments.join('/');
      
      // If we went back too far (empty), just clear it
      setCurrentPath(newPath || '');
  };

  const handleFolderClick = (folderPath: string) => {
      setCurrentPath(folderPath);
      setSearchQuery('');
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
        alert("Ruta copiada al portapapeles");
    });
  };

  // --- Filtering Logic ---
  const displayItems = useMemo(() => {
      // 1. Filter tracks that belong to the Active Root (e.g. starts with "Música 1")
      // We normalize matches to handle cases like "Música 1" matching "Música 1/Salsa"
      const rootTracks = tracks.filter(t => {
          if (!t.path) return false;
          // Check if path starts with the active root string
          return t.path.toLowerCase().startsWith(activeRoot.toLowerCase());
      });

      // A. SEARCH MODE (Scoped to Active Root)
      if (searchQuery.trim()) {
          const lowerQuery = searchQuery.toLowerCase();
          return rootTracks
              .filter(t => 
                  t.filename.toLowerCase().includes(lowerQuery) ||
                  t.metadata.title.toLowerCase().includes(lowerQuery) ||
                  t.metadata.performer.toLowerCase().includes(lowerQuery) ||
                  t.path.toLowerCase().includes(lowerQuery)
              )
              .map(t => ({
                  type: 'track' as const,
                  data: t,
                  key: t.id
              }));
      }

      // B. BROWSE MODE
      // If we are at the "Root Level" (currentPath is empty), we show the first level of folders/files inside "Música X"
      // If we are deep inside (currentPath = "Música 1/Salsa"), we show contents of that.
      
      const targetPath = currentPath || activeRoot;
      const targetDepth = targetPath.split('/').length;

      const foldersMap = new Set<string>();
      const filesList: any[] = [];

      rootTracks.forEach(t => {
          // Check if the track belongs to the current view path
          if (!t.path.startsWith(targetPath)) return;

          // Exact match = File in this folder
          // Note: We handle the edge case where targetPath might equal activeRoot but the file is directly there
          if (t.path === targetPath || t.path === targetPath + '/') {
              filesList.push({
                  type: 'track' as const,
                  data: t,
                  key: t.id
              });
          } else {
              // It is inside a subfolder relative to targetPath
              // Example: targetPath = "Música 1", t.path = "Música 1/Salsa/Van Van"
              // Relative = "/Salsa/Van Van"
              
              let relative = t.path.substring(targetPath.length);
              if (relative.startsWith('/')) relative = relative.substring(1);
              
              const segments = relative.split('/');
              const nextFolder = segments[0];

              if (nextFolder) {
                  const fullFolderPath = targetPath === '' ? nextFolder : `${targetPath}/${nextFolder}`;
                  foldersMap.add(fullFolderPath);
              }
          }
      });

      const foldersList = Array.from(foldersMap).sort().map(fPath => ({
          type: 'folder' as const,
          name: fPath.split('/').pop() || 'Carpeta',
          fullPath: fPath,
          key: fPath
      }));

      // Sort files alphabetically
      filesList.sort((a, b) => a.data.filename.localeCompare(b.data.filename));

      return [...foldersList, ...filesList];

  }, [tracks, activeRoot, currentPath, searchQuery]);


  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Header Area */}
      <div className="bg-white dark:bg-background-dark shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        
        {/* 1. FIXED TABS (Música 1 - 5) */}
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

        {/* 2. Breadcrumbs & Tools */}
        <div className="px-4 py-3 flex flex-col gap-3">
            
            {/* Breadcrumb Path Display */}
            <div className="flex items-center gap-2 text-gray-500 text-xs min-h-[20px]">
                <span className="material-symbols-outlined text-base text-miel">hard_drive</span>
                <span className="font-bold text-gray-700 dark:text-gray-300">{activeRoot}</span>
                {currentPath && currentPath !== activeRoot && (
                    <>
                        <span className="material-symbols-outlined text-sm text-gray-400">chevron_right</span>
                        <span className="truncate font-mono text-gray-600 dark:text-gray-400">
                            {currentPath.substring(activeRoot.length).replace(/^\//, '').replace(/\//g, ' / ')}
                        </span>
                    </>
                )}
            </div>

            <div className="flex gap-2 items-center">
                {/* Back Button (Only visible if deep in folders) */}
                {currentPath && currentPath !== activeRoot && !searchQuery && (
                    <button 
                        onClick={handleNavigateUp}
                        className="size-11 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors shrink-0 border border-gray-200 dark:border-gray-700"
                        title="Subir nivel"
                    >
                        <span className="material-symbols-outlined">arrow_upward</span>
                    </button>
                )}
                
                {/* Search Bar */}
                <label className="flex-1 flex flex-col relative">
                    <div className="flex w-full items-stretch rounded-lg h-11 overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-900 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
                    <div className="text-gray-400 flex items-center justify-center pl-3">
                        <span className="material-symbols-outlined text-xl">search</span>
                    </div>
                    <input 
                        className="flex w-full border-none bg-transparent text-gray-900 dark:text-white focus:ring-0 placeholder:text-gray-400 px-3 text-sm font-normal" 
                        placeholder={`Buscar en ${activeRoot}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="pr-3 text-gray-400 hover:text-gray-600 flex items-center"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    )}
                    </div>
                </label>
            </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24 bg-white dark:bg-background-dark">
        {displayItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <span className="material-symbols-outlined text-5xl mb-4 text-gray-200 dark:text-gray-700">folder_open</span>
             <p className="text-sm font-medium">Carpeta vacía</p>
             <p className="text-xs mt-1 opacity-60">No se encontraron elementos en esta ruta</p>
           </div>
        ) : (
          displayItems.map(item => (
            <div 
              key={item.key} 
              onClick={() => item.type === 'folder' ? handleFolderClick(item.fullPath) : onSelectTrack(item.data)}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer active:bg-gray-100"
            >
              {/* Icon */}
              <div className={`flex items-center justify-center rounded-lg shrink-0 size-10 ${item.type === 'track' ? 'bg-orange-50 text-primary dark:bg-primary/20' : 'bg-blue-50 text-azul-header dark:bg-blue-900/30 dark:text-blue-300'}`}>
                <span className={`material-symbols-outlined ${item.type === 'folder' ? 'material-symbols-filled' : ''} text-2xl`}>
                    {item.type === 'folder' ? 'folder' : 'music_note'}
                </span>
              </div>

              {/* Text */}
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-gray-900 dark:text-gray-100 text-sm font-semibold leading-tight truncate">
                  {item.type === 'folder' ? item.name : (item.data.metadata.title || item.data.filename)}
                </p>
                
                {item.type === 'track' && (
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[80%]">
                            {item.data.metadata.performer || "Desconocido"}
                        </p>
                        {item.data.isVerified && (
                            <span className="text-[10px] text-green-600 flex items-center" title="Verificado">
                                <span className="material-symbols-outlined text-[12px]">verified</span>
                            </span>
                        )}
                    </div>
                )}
                
                {/* Show full path hint when searching to know where the file is */}
                {searchQuery && (
                    <p className="text-gray-300 text-[9px] mt-0.5 truncate">
                        {item.type === 'track' ? item.data.path : item.fullPath}
                    </p>
                )}
              </div>
              
              {/* Actions */}
              <div className="shrink-0 flex items-center">
                 {item.type === 'folder' ? (
                     <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-xl">chevron_right</span>
                 ) : (
                     <button 
                        onClick={(e) => copyToClipboard(item.data.path, e)}
                        className="size-8 flex items-center justify-center rounded-full text-gray-300 hover:text-azul-cauto hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                        title="Copiar ruta"
                     >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                     </button>
                 )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrackList;
