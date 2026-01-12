
import React, { useState, useMemo } from 'react';
import { Track, FilterType } from '../types';

interface TrackListProps {
  tracks: Track[];
  onSelectTrack: (track: Track) => void;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onSelectTrack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('folder'); // Default to folder based on user request "Load options of folders well"

  // Process data based on active filter
  const listItems = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    // Filter source first by query (loose search across fields including PATH)
    const matches = tracks.filter(t => 
       t.filename.toLowerCase().includes(query) ||
       t.path.toLowerCase().includes(query) ||
       t.metadata.title.toLowerCase().includes(query) ||
       t.metadata.author.toLowerCase().includes(query) ||
       t.metadata.performer.toLowerCase().includes(query) ||
       t.metadata.album.toLowerCase().includes(query)
    );

    if (activeFilter === 'folder') {
        // Group by Album (which we mapped from "Nombre de Carpeta") or Path
        // The prompt asks for "Nombre de las carpetas".
        const uniqueFolders = new Map<string, Track[]>();
        
        matches.forEach(t => {
            const folderName = t.metadata.album || "Sin Carpeta";
            if (!uniqueFolders.has(folderName)) {
                uniqueFolders.set(folderName, []);
            }
            uniqueFolders.get(folderName)!.push(t);
        });

        // Convert Map to display items
        return Array.from(uniqueFolders.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([folderName, folderTracks]) => ({
            id: `folder-${folderName}`,
            mainText: folderName,
            subText: `${folderTracks.length} temas`,
            type: 'folder',
            payload: folderTracks[0] // Just a reference, clicking might need to expand?
            // Note: For simplicity in this architecture, clicking a folder could filter by that folder or just show the first track. 
            // Better UX: Clicking folder switches filter to Title but filters by that folder? 
            // For now, let's keep consistent: Click selects the reference track (first one) OR we need a sub-navigation.
            // Requirement says "buscar temas por titulo o carpeta".
        }));

    } else if (activeFilter === 'title') {
        return matches.map(t => ({
            id: t.id,
            mainText: t.metadata.title || t.filename,
            subText: t.metadata.performer || "Intérprete desconocido",
            type: 'track',
            payload: t
        }));
    } else if (activeFilter === 'author') {
        const authors = Array.from(new Set(matches.map(t => t.metadata.author).filter(Boolean)));
        return authors.sort().map(author => ({
            id: `auth-${author}`,
            mainText: author,
            subText: "Autor / Compositor",
            type: 'author',
            payload: matches.find(t => t.metadata.author === author)!
        }));
    } else if (activeFilter === 'performer') {
        const performers = Array.from(new Set(matches.map(t => t.metadata.performer).filter(Boolean)));
        return performers.sort().map(perf => ({
            id: `perf-${perf}`,
            mainText: perf,
            subText: "Intérprete",
            type: 'performer',
            payload: matches.find(t => t.metadata.performer === perf)!
        }));
    }
    return [];
  }, [tracks, searchQuery, activeFilter]);

  const handleItemClick = (item: any) => {
      if (item.type === 'folder') {
          // If clicking a folder, user likely wants to see tracks INSIDE that folder.
          // Let's set the search query to the folder name and switch to Title view
          setSearchQuery(item.mainText);
          setActiveFilter('title');
      } else {
          onSelectTrack(item.payload);
      }
  };

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
        console.log("Ruta copiada:", text);
    });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Search Header */}
      <div className="px-4 py-4 bg-white dark:bg-background-dark shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="flex flex-col gap-3">
          {/* Top Options Bar */}
          <div className="flex w-full bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
             <button 
                onClick={() => setActiveFilter('folder')}
                className={`flex-1 min-w-[70px] py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${activeFilter === 'folder' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
                Carpetas
             </button>
             <button 
                onClick={() => setActiveFilter('title')}
                className={`flex-1 min-w-[70px] py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${activeFilter === 'title' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
                Títulos
             </button>
             <button 
                onClick={() => setActiveFilter('author')}
                className={`flex-1 min-w-[70px] py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${activeFilter === 'author' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
                Autores
             </button>
             <button 
                onClick={() => setActiveFilter('performer')}
                className={`flex-1 min-w-[70px] py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${activeFilter === 'performer' ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
                Intérpretes
             </button>
          </div>

          <label className="flex flex-col w-full relative">
            <div className="flex w-full items-stretch rounded-xl h-12 overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
              <div className="text-gray-400 flex items-center justify-center pl-4">
                <span className="material-symbols-outlined">search</span>
              </div>
              <input 
                className="flex w-full border-none bg-transparent text-gray-900 dark:text-white focus:ring-0 placeholder:text-gray-400 px-3 text-base font-normal leading-normal" 
                placeholder="Buscar..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </label>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 pb-24">
        {listItems.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 text-gray-400">
             <span className="material-symbols-outlined text-4xl mb-2">sentiment_dissatisfied</span>
             <p>No se encontraron resultados</p>
           </div>
        ) : (
          listItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => handleItemClick(item)}
              className="group flex items-center gap-4 bg-white dark:bg-background-dark px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer active:scale-[0.99]"
            >
              <div className={`flex items-center justify-center rounded-xl shrink-0 size-12 border ${activeFilter === 'title' ? 'bg-primary/10 border-primary/20 text-primary' : (activeFilter === 'folder' ? 'bg-miel/10 border-miel/20 text-miel' : 'bg-gray-100 border-gray-200 text-gray-600')}`}>
                <span className="material-symbols-outlined">
                    {activeFilter === 'title' ? 'music_note' : (activeFilter === 'folder' ? 'folder' : (activeFilter === 'author' ? 'person_edit' : 'mic_external_on'))}
                </span>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-gray-900 dark:text-gray-100 text-base font-bold leading-tight truncate">
                  {item.mainText}
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 truncate" title={item.subText}>
                    {item.subText}
                </p>
              </div>
              
              <div className="shrink-0 flex items-center gap-2">
                 <span className="material-symbols-outlined text-gray-300 dark:text-gray-600">
                     {activeFilter === 'folder' ? 'chevron_right' : 'visibility'}
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
