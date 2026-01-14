
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
  const [activeRoot, setActiveRoot] = useState<string>(FIXED_ROOTS[0]); 
  const [currentPath, setCurrentPath] = useState<string>(''); 

  // Reset path when changing root tab
  const handleRootChange = (root: string) => {
      setActiveRoot(root);
      setCurrentPath(''); 
      // Do not clear search query if user wants to switch tabs while searching? 
      // Actually, search is global now, so switching tabs shouldn't matter for search, 
      // but visually we might want to clear search to show the tab content.
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
      // If we are in search mode, clicking a folder should probably clear search and jump to that context?
      // Or just drill down. Let's drill down and clear search to show context.
      setCurrentPath(folderPath);
      
      // Determine the root of this folder to set the active tab correctly
      const folderRoot = folderPath.split('/')[0];
      const matchingFixedRoot = FIXED_ROOTS.find(r => r.toLowerCase() === folderRoot.toLowerCase());
      if (matchingFixedRoot) {
          setActiveRoot(matchingFixedRoot);
      }
      
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
      // --- GLOBAL SEARCH MODE ---
      if (searchQuery.trim()) {
          const lowerQuery = searchQuery.toLowerCase();
          
          // 1. Find matching TRACKS
          const matchingTracks = tracks.filter(t => 
              t.filename.toLowerCase().includes(lowerQuery) ||
              t.metadata.title.toLowerCase().includes(lowerQuery) ||
              t.metadata.performer.toLowerCase().includes(lowerQuery) ||
              t.path.toLowerCase().includes(lowerQuery)
          ).map(t => ({
              type: 'track' as const,
              data: t,
              key: t.id
          }));

          // 2. Find matching FOLDERS
          // We iterate all paths and check if any segment matches
          const matchingFolders = new Set<string>();
          tracks.forEach(t => {
              if (!t.path) return;
              const segments = t.path.split('/');
              // Reconstruct progressive paths
              let progressive = "";
              segments.forEach(seg => {
                  progressive = progressive ? `${progressive}/${seg}` : seg;
                  if (seg.toLowerCase().includes(lowerQuery)) {
                      matchingFolders.add(progressive);
                  }
              });
          });

          const folderItems = Array.from(matchingFolders).map(fPath => ({
              type: 'folder' as const,
              name: fPath.split('/').pop() || 'Carpeta',
              fullPath: fPath,
              key: `folder-${fPath}`
          }));

          // Sort: Folders first, then files
          return [...folderItems.sort((a,b) => a.name.localeCompare(b.name)), ...matchingTracks];
      }

      // --- BROWSE MODE (Tab Scoped) ---
      
      // Filter tracks that belong to the Active Root
      const rootTracks = tracks.filter(t => {
          if (!t.path) return false;
          // Normalized comparison
          return t.path.toLowerCase().startsWith(activeRoot.toLowerCase());
      });

      const targetPath = currentPath || activeRoot;

      const foldersMap = new Set<string>();
      const filesList: any[] = [];

      rootTracks.forEach(t => {
          // Normalized checks for path matching
          // t.path: "Música 1/Carpeta/Archivo.mp3"
          // targetPath: "Música 1"
          
          const trackPath = t.path; // Case sensitive for display, but logic should be careful
          
          // Only process if track is inside targetPath
          // We use simple startsWith because we assume paths are normalized in constants.ts
          if (!trackPath.startsWith(targetPath)) return;

          // Check if it's a direct file in this folder
          // Case 1: t.path is exactly targetPath
          if (trackPath === targetPath || trackPath === targetPath + '/') {
              filesList.push({
                  type: 'track' as const,
                  data: t,
                  key: t.id
              });
          } else {
              // Case 2: It's in a subfolder
              // Get the relative part
              let relative = trackPath.substring(targetPath.length);
              if (relative.startsWith('/')) relative = relative.substring(1);
              
              if (!relative) return; // Should not happen if logic above is correct

              const segments = relative.split('/');
              const nextFolder = segments[0];

              if (nextFolder) {
                  // Reconstruct full path for the folder item
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
        
        {/* 1. FIXED TABS - Only show if NOT searching */}
        {!searchQuery && (
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

        {/* 2. Tools & Breadcrumbs */}
        <div className="px-4 py-3 flex flex-col gap-3">
            
            {/* Search Bar - Always Visible */}
             <label className="flex-1 flex flex-col relative">
                <div className="flex w-full items-stretch rounded-lg h-11 overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-900 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
                <div className="text-gray-400 flex items-center justify-center pl-3">
                    <span className="material-symbols-outlined text-xl">search</span>
                </div>
                <input 
                    className="flex w-full border-none bg-transparent text-gray-900 dark:text-white focus:ring-0 placeholder:text-gray-400 px-3 text-sm font-normal" 
                    placeholder="Buscar en toda la base de datos..."
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

            {/* Breadcrumb Path Display (Only when NOT searching) */}
            {!searchQuery && (
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
                    
                    {/* UP Button */}
                    {currentPath && currentPath !== activeRoot && (
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
            
            {/* Search Results Count hint */}
            {searchQuery && (
                <div className="text-xs text-gray-500 px-1 font-semibold flex justify-between">
                    <span>Resultados para "{searchQuery}"</span>
                    <span>{displayItems.length} encontrados</span>
                </div>
            )}
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24 bg-white dark:bg-background-dark">
        {displayItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <span className="material-symbols-outlined text-5xl mb-4 text-gray-200 dark:text-gray-700">
                 {searchQuery ? 'search_off' : 'folder_open'}
             </span>
             <p className="text-sm font-medium">{searchQuery ? 'Sin resultados' : 'Carpeta vacía'}</p>
             <p className="text-xs mt-1 opacity-60">
                 {searchQuery ? 'Intenta con otro término' : 'No se encontraron elementos en esta ruta'}
             </p>
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
                <div className="flex items-center justify-between">
                    <p className="text-gray-900 dark:text-gray-100 text-sm font-semibold leading-tight truncate pr-2">
                        {item.type === 'folder' ? item.name : (item.data.metadata.title || item.data.filename)}
                    </p>
                    {/* Show root tag in search mode if item belongs to different root */}
                    {searchQuery && (
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
                {searchQuery && (
                    <p className="text-gray-400 text-[10px] mt-0.5 truncate flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">folder</span>
                        {item.type === 'track' ? item.data.path : item.fullPath}
                    </p>
                )}
              </div>
              
              {/* Chevron for folder */}
              {item.type === 'folder' && (
                  <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-xl">chevron_right</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrackList;
