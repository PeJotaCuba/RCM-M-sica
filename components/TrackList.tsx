
import React, { useState, useMemo, useEffect } from 'react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onSelectTrack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [activeRoot, setActiveRoot] = useState<string>(''); // e.g., "Música 1"
  const [currentPath, setCurrentPath] = useState<string>(''); // e.g., "Música 1/Salsa/Van Van"

  // 1. Extract Roots (First segment of every path)
  const roots = useMemo(() => {
      const allRoots = new Set<string>();
      tracks.forEach(t => {
          if (t.path) {
              const root = t.path.split('/')[0];
              if (root) allRoots.add(root);
          }
      });
      return Array.from(allRoots).sort();
  }, [tracks]);

  // Set default root if none selected
  useEffect(() => {
      if (!activeRoot && roots.length > 0) {
          setActiveRoot(roots[0]);
      }
  }, [roots, activeRoot]);

  // Reset path when changing root
  const handleRootChange = (root: string) => {
      setActiveRoot(root);
      setCurrentPath(''); // Go to top of new root
      setSearchQuery('');
  };

  const handleNavigateUp = () => {
      if (!currentPath) return; // Already at top
      const segments = currentPath.split('/');
      segments.pop(); // Remove last folder
      const newPath = segments.join('/');
      // If newPath becomes just empty or doesn't start with root (shouldn't happen logically but for safety), reset
      setCurrentPath(newPath);
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
      if (!activeRoot) return [];

      // A. SEARCH MODE (Scoped to Active Root)
      if (searchQuery.trim()) {
          const lowerQuery = searchQuery.toLowerCase();
          return tracks
              .filter(t => t.path.startsWith(activeRoot)) // Only search in current tab
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
      
      // Determine what to show based on currentPath (or activeRoot if path empty)
      const targetPath = currentPath || activeRoot;
      const depth = targetPath.split('/').length;

      // 1. Get all tracks that belong to this tree
      const relevantTracks = tracks.filter(t => t.path.startsWith(targetPath));
      
      const foldersMap = new Set<string>();
      const filesList: any[] = [];

      relevantTracks.forEach(t => {
          // If exact match path, it's a file in this folder
          if (t.path === targetPath) {
              filesList.push({
                  type: 'track' as const,
                  data: t,
                  key: t.id
              });
          } else {
              // It's in a subfolder
              // targetPath: "Música 1"
              // t.path: "Música 1/Salsa/Van Van"
              // relative: "/Salsa/Van Van" -> parts: ["", "Salsa", "Van Van"]
              // We want "Salsa"
              const remainder = t.path.substring(targetPath.length);
              // Ensure we strip leading slash
              const cleanRemainder = remainder.startsWith('/') ? remainder.substring(1) : remainder;
              const nextSegment = cleanRemainder.split('/')[0];
              
              if (nextSegment) {
                  // Construct full path for the folder
                  const fullFolderPath = targetPath === '' ? nextSegment : `${targetPath}/${nextSegment}`;
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

      return [...foldersList, ...filesList];

  }, [tracks, activeRoot, currentPath, searchQuery]);


  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Search Header */}
      <div className="px-4 py-4 bg-white dark:bg-background-dark shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex flex-col gap-3">
          
          {/* ROOT TABS (Música 1, Música 2...) */}
          <div className="flex w-full bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
             {roots.length === 0 ? (
                 <span className="text-xs text-gray-400 p-2">Sin datos cargados</span>
             ) : (
                 roots.map(root => (
                    <button 
                        key={root}
                        onClick={() => handleRootChange(root)} 
                        className={`flex-shrink-0 px-4 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all whitespace-nowrap ${activeRoot === root ? 'bg-white dark:bg-gray-700 text-primary shadow-sm ring-1 ring-black/5' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                        {root}
                    </button>
                 ))
             )}
          </div>

          <div className="flex gap-2 items-center">
            {/* Back Button */}
            {currentPath && currentPath !== activeRoot && !searchQuery && (
                <button 
                    onClick={handleNavigateUp}
                    className="size-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl text-primary hover:bg-gray-200 transition-colors shrink-0"
                    title="Subir nivel"
                >
                    <span className="material-symbols-outlined">arrow_upward</span>
                </button>
            )}
            
            {/* Search Bar */}
            <label className="flex-1 flex flex-col relative">
                <div className="flex w-full items-stretch rounded-xl h-12 overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
                <div className="text-gray-400 flex items-center justify-center pl-4">
                    <span className="material-symbols-outlined">search</span>
                </div>
                <input 
                    className="flex w-full border-none bg-transparent text-gray-900 dark:text-white focus:ring-0 placeholder:text-gray-400 px-3 text-base font-normal leading-normal" 
                    placeholder={activeRoot ? `Buscar en ${activeRoot}...` : "Selecciona una categoría"}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={!activeRoot}
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="pr-4 text-gray-400 hover:text-gray-600 flex items-center"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                )}
                </div>
            </label>
          </div>

          {/* Breadcrumbs (Current Path Display) */}
          {!searchQuery && currentPath && (
              <div className="text-[10px] text-gray-500 font-mono truncate px-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">folder_open</span>
                  {currentPath.replace(/\//g, ' / ')}
              </div>
          )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24">
        {displayItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <span className="material-symbols-outlined text-4xl mb-2">folder_off</span>
             <p className="text-sm">Carpeta vacía o sin resultados</p>
           </div>
        ) : (
          displayItems.map(item => (
            <div 
              key={item.key} 
              onClick={() => item.type === 'folder' ? handleFolderClick(item.fullPath) : onSelectTrack(item.data)}
              className="group flex items-center gap-4 bg-white dark:bg-background-dark px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer active:scale-[0.99]"
            >
              {/* Icon */}
              <div className={`flex items-center justify-center rounded-xl shrink-0 size-10 border ${item.type === 'track' ? 'bg-primary/5 border-primary/10 text-primary' : 'bg-miel/10 border-miel/20 text-miel'}`}>
                <span className="material-symbols-outlined text-xl">
                    {item.type === 'folder' ? 'folder' : 'music_note'}
                </span>
              </div>

              {/* Text */}
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-gray-900 dark:text-gray-100 text-sm font-bold leading-tight truncate">
                  {item.type === 'folder' ? item.name : (item.data.metadata.title || item.data.filename)}
                </p>
                {item.type === 'track' && (
                    <p className="text-gray-500 dark:text-gray-400 text-[10px] mt-0.5 truncate">
                        {item.data.metadata.performer || "Artista desconocido"}
                    </p>
                )}
                {/* Show path context if searching */}
                {searchQuery && item.type === 'track' && (
                    <p className="text-gray-400 text-[9px] mt-0.5 truncate">
                        {item.data.path}
                    </p>
                )}
              </div>
              
              {/* Actions */}
              <div className="shrink-0 flex items-center gap-1">
                 {item.type === 'track' && item.data.path && (
                     <button 
                        onClick={(e) => copyToClipboard(item.data.path, e)}
                        className="p-2 rounded-full text-gray-300 hover:text-azul-cauto transition-colors"
                     >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                     </button>
                 )}
                 <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">
                     {item.type === 'folder' ? 'chevron_right' : 'play_arrow'}
                 </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrackList;
