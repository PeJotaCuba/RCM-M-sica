
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

  const isAdmin = authMode === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in" onClick={onClose}>
        
        <div 
            className="w-full max-w-md bg-white dark:bg-[#1a1a1a] h-[85vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-slide-up"
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

            <div className="flex-1 overflow-y-auto p-6 z-10 space-y-6">
                
                {/* Status & Edit Toggle */}
                <div className="flex justify-between items-center">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${track.isVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        <span className="material-symbols-outlined text-sm">{track.isVerified ? 'verified' : 'help'}</span>
                        {track.isVerified ? 'Verificado' : 'Pendiente'}
                    </span>
                    
                    {isAdmin && !isEditing && (
                        <button onClick={() => setIsEditing(true)} className="text-primary text-xs font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">edit</span> Editar
                        </button>
                    )}
                </div>

                {/* Metadata Grid (View or Edit) */}
                <div className="grid gap-4">
                    {isEditing ? (
                        <>
                             <EditField label="Título" value={editData.title} onChange={v => setEditData({...editData, title: v})} />
                             <EditField label="Autor" value={editData.author} onChange={v => setEditData({...editData, author: v})} />
                             <EditField label="País Autor" value={editData.authorCountry || ""} onChange={v => setEditData({...editData, authorCountry: v})} />
                             <EditField label="Intérprete" value={editData.performer} onChange={v => setEditData({...editData, performer: v})} />
                             <EditField label="País Intérprete" value={editData.performerCountry || ""} onChange={v => setEditData({...editData, performerCountry: v})} />
                             <EditField label="Género" value={editData.genre || ""} onChange={v => setEditData({...editData, genre: v})} />
                             <EditField label="Álbum/Carpeta" value={editData.album} onChange={v => setEditData({...editData, album: v})} />
                             <EditField label="Año" value={editData.year} onChange={v => setEditData({...editData, year: v})} />
                             
                             <div className="flex gap-2 mt-2">
                                 <button onClick={() => setIsEditing(false)} className="flex-1 py-2 text-gray-500 font-bold bg-gray-100 rounded-lg">Cancelar</button>
                                 <button onClick={handleSave} className="flex-1 py-2 text-white font-bold bg-primary rounded-lg">Guardar</button>
                             </div>
                        </>
                    ) : (
                        <>
                            <DetailRow icon="person_edit" label="Autor / Compositor" value={track.metadata.author} sub={track.metadata.authorCountry} />
                            <DetailRow icon="mic" label="Intérprete" value={track.metadata.performer} sub={track.metadata.performerCountry} />
                            {track.metadata.genre && <DetailRow icon="music_note" label="Género" value={track.metadata.genre} />}
                            <DetailRow icon="album" label="Álbum" value={track.metadata.album} />
                            <DetailRow icon="calendar_today" label="Año" value={track.metadata.year} />
                        </>
                    )}
                </div>

                {/* File Info */}
                {!isEditing && (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5 mt-4">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Archivo Físico</p>
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-gray-400">folder_open</span>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">{track.filename}</p>
                                <p className="text-[10px] text-gray-500 truncate">{track.path}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action */}
                {!isEditing && (
                    <button 
                        onClick={onSearchCredits}
                        className="w-full mt-4 bg-gradient-to-r from-primary to-primary-dark text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                    >
                        <span className="material-symbols-outlined">travel_explore</span>
                        Consultar IA (Créditos)
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: string, label: string, value: string, sub?: string }> = ({ icon, label, value, sub }) => (
    <div className="flex items-center gap-4">
        <div className="size-10 rounded-full bg-azul-header/10 dark:bg-blue-900/20 text-azul-header dark:text-blue-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">{label}</p>
            <div className="flex items-baseline gap-2">
                 <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value || "---"}</p>
                 {sub && <span className="text-xs text-miel font-bold">({sub})</span>}
            </div>
        </div>
    </div>
);

const EditField: React.FC<{ label: string, value: string, onChange: (v: string) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs text-gray-500 font-bold mb-1">{label}</label>
        <input 
            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-800 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

export default TrackDetail;
