
import React, { useState } from 'react';
import { Track, AuthMode, CreditInfo } from '../types';

interface TrackDetailProps {
  track: Track;
  authMode: AuthMode;
  onClose: () => void;
  onSearchCredits: () => void;
  onSaveEdit?: (track: Track) => void;
}

const TrackDetail: React.FC<TrackDetailProps> = ({ track, authMode, onClose, onSearchCredits, onSaveEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<CreditInfo>(track.metadata);
  const [copied, setCopied] = useState(false);
  
  const handleSave = () => {
      if (onSaveEdit) {
          onSaveEdit({
              ...track,
              isVerified: true,
              metadata: editData
          });
          setIsEditing(false);
      }
  };

  const handleCopyPath = () => {
      // Logic to copy exact path
      const fullPath = `${track.path}/${track.filename}`;
      navigator.clipboard.writeText(fullPath).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  const handleSearchAppleMusic = () => {
      // Abre Apple Music con la búsqueda del título y el intérprete (o autor)
      const term = `${track.metadata.title} ${track.metadata.performer || track.metadata.author || ''}`;
      const url = `https://music.apple.com/search?term=${encodeURIComponent(term)}`;
      window.open(url, '_blank');
  };

  const isAdmin = authMode === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={onClose}>
        
        <div 
            className="w-full max-w-md bg-white dark:bg-[#1a1a1a] h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()} 
        >
            <div className="absolute inset-0 pointer-events-none colonial-pattern h-full w-full z-0 opacity-10"></div>

            {/* Modal Header */}
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10 bg-white/50 dark:bg-black/20">
                <div>
                     <p className="text-[10px] uppercase tracking-widest text-miel font-bold">Detalle de Créditos</p>
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-[250px]">{track.metadata.title || "Sin Título"}</h2>
                </div>
                <button onClick={onClose} className="size-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 z-10 space-y-4">
                
                {/* File Info (PATH) - Copy to Clipboard */}
                {!isEditing && (
                    <div 
                        className="bg-azul-header/5 dark:bg-blue-900/10 rounded-xl p-4 border border-azul-header/10 dark:border-blue-500/10 mb-2 group relative overflow-hidden"
                    >
                        <div className="flex items-start gap-3 relative z-10">
                            <div className="size-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-azul-header dark:text-blue-400 shadow-sm">
                                <span className="material-symbols-outlined">folder_open</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase font-bold text-azul-header/60 dark:text-blue-400/60 mb-0.5">Ubicación del Archivo</p>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 break-words leading-tight">{track.path}</p>
                                <p className="text-xs text-gray-500 mt-1 font-mono bg-white/50 dark:bg-black/20 p-1 rounded inline-block">{track.filename}</p>
                            </div>
                            <button 
                                onClick={handleCopyPath}
                                className={`size-8 rounded-full flex items-center justify-center transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-white dark:bg-white/10 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/20'}`}
                                title="Copiar ruta"
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {copied ? 'check' : 'content_copy'}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Metadata Grid (View or Edit) */}
                <div className="grid gap-4">
                    {isEditing ? (
                        <>
                             <EditField label="Título" value={editData.title} onChange={v => setEditData({...editData, title: v})} />
                             <EditField label="Autor" value={editData.author} onChange={v => setEditData({...editData, author: v})} />
                             <EditField label="Intérprete" value={editData.performer} onChange={v => setEditData({...editData, performer: v})} />
                             <EditField label="País Autor" value={editData.authorCountry || ""} onChange={v => setEditData({...editData, authorCountry: v})} />
                             <EditField label="País Intérprete" value={editData.performerCountry || ""} onChange={v => setEditData({...editData, performerCountry: v})} />
                             <EditField label="Género" value={editData.genre || ""} onChange={v => setEditData({...editData, genre: v})} />
                             <EditField label="Álbum/Carpeta" value={editData.album} onChange={v => setEditData({...editData, album: v})} />
                             <EditField label="Año" value={editData.year} onChange={v => setEditData({...editData, year: v})} />
                             
                             <div className="flex gap-2 mt-4">
                                 <button onClick={() => setIsEditing(false)} className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 rounded-lg">Cancelar</button>
                                 <button onClick={handleSave} className="flex-1 py-3 text-white font-bold bg-primary rounded-lg">Guardar Cambios</button>
                             </div>
                        </>
                    ) : (
                        <>
                            <div className="grid gap-4">
                                <DetailRow icon="person_edit" label="Autor / Compositor" value={track.metadata.author} sub={track.metadata.authorCountry} />
                                <DetailRow icon="mic" label="Intérprete" value={track.metadata.performer} sub={track.metadata.performerCountry} />
                                {track.metadata.genre && <DetailRow icon="music_note" label="Género" value={track.metadata.genre} />}
                                <DetailRow icon="album" label="Álbum" value={track.metadata.album} />
                                <DetailRow icon="calendar_today" label="Año" value={track.metadata.year} />
                            </div>

                            {/* Verification Badge */}
                             <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/10 mt-2">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${track.isVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                    <span className="material-symbols-outlined text-[14px]">{track.isVerified ? 'verified' : 'help'}</span>
                                    {track.isVerified ? 'Datos Verificados' : 'Pendiente de Revisión'}
                                </span>
                                
                                {isAdmin && (
                                    <button onClick={() => setIsEditing(true)} className="text-primary text-xs font-bold flex items-center gap-1 hover:bg-gray-50 p-2 rounded-lg transition-colors">
                                        <span className="material-symbols-outlined text-sm">edit</span> Editar Datos
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Apple Music Search Action */}
                {!isEditing && (
                    <button 
                        onClick={handleSearchAppleMusic}
                        className="w-full mt-2 bg-gradient-to-r from-pink-500 to-red-500 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:opacity-90 transition-transform active:scale-95"
                    >
                        <span className="material-symbols-outlined">music_note</span>
                        Buscar en Apple Music
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: string, label: string, value: string, sub?: string }> = ({ icon, label, value, sub }) => (
    <div className="flex items-center gap-4 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
        <div className="size-10 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div>
            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{label}</p>
            <div className="flex flex-wrap items-baseline gap-2">
                 <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{value || "---"}</p>
                 {sub && <span className="text-[10px] text-miel font-bold px-1.5 py-0.5 bg-miel/10 rounded"> {sub}</span>}
            </div>
        </div>
    </div>
);

const EditField: React.FC<{ label: string, value: string, onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs text-gray-500 font-bold mb-1 ml-1">{label}</label>
        <input 
            className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

export default TrackDetail;
