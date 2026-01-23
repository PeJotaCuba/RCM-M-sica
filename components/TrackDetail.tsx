
import React, { useState, useEffect } from 'react';
import { Track, AuthMode } from '../types';
import { GENRES_LIST, COUNTRIES_LIST } from '../constants';

interface TrackDetailProps {
  track: Track;
  authMode: AuthMode;
  onClose: () => void;
  onSearchCredits: () => void;
  onSaveEdit?: (track: Track) => void;
}

const TrackDetail: React.FC<TrackDetailProps> = ({ track, authMode, onClose, onSearchCredits, onSaveEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
      title: track.metadata.title,
      author: track.metadata.author,
      authorCountry: track.metadata.authorCountry || '',
      performer: track.metadata.performer,
      performerCountry: track.metadata.performerCountry || '',
      genre: track.metadata.genre || '',
      album: track.metadata.album,
      year: track.metadata.year
  });

  // Reset edit data when track changes
  useEffect(() => {
    setEditData({
      title: track.metadata.title,
      author: track.metadata.author,
      authorCountry: track.metadata.authorCountry || '',
      performer: track.metadata.performer,
      performerCountry: track.metadata.performerCountry || '',
      genre: track.metadata.genre || '',
      album: track.metadata.album,
      year: track.metadata.year
    });
    setIsEditing(false);
  }, [track]);

  const handleSave = () => {
      if (onSaveEdit) {
          onSaveEdit({
              ...track,
              metadata: {
                  ...track.metadata,
                  title: editData.title,
                  author: editData.author,
                  authorCountry: editData.authorCountry,
                  performer: editData.performer,
                  performerCountry: editData.performerCountry,
                  genre: editData.genre,
                  album: editData.album,
                  year: editData.year
              }
          });
          setIsEditing(false);
      }
  };

  const EditField = ({ label, value, field, list }: { label: string, value: string, field: keyof typeof editData, list?: string }) => (
      <div className="mb-3">
          <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
          <input 
              className="w-full p-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium focus:border-primary outline-none"
              value={value}
              onChange={(e) => setEditData({...editData, [field]: e.target.value})}
              list={list}
          />
      </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="size-10 rounded-full bg-miel/10 text-miel flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined">music_note</span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{track.metadata.title}</h3>
                        <p className="text-xs text-gray-500 truncate">{track.filename}</p>
                    </div>
                </div>
                <button onClick={onClose} className="size-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isEditing ? (
                    <div className="grid grid-cols-1 gap-1">
                        <EditField label="Título" value={editData.title} field="title" />
                        <div className="grid grid-cols-2 gap-3">
                             <EditField label="Autor" value={editData.author} field="author" />
                             <EditField label="País Autor" value={editData.authorCountry} field="authorCountry" list="country-options" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             <EditField label="Intérprete" value={editData.performer} field="performer" />
                             <EditField label="País Intérprete" value={editData.performerCountry} field="performerCountry" list="country-options" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                             <EditField label="Género" value={editData.genre} field="genre" list="genre-options" />
                             <EditField label="Año" value={editData.year} field="year" />
                        </div>
                        <EditField label="Álbum / Carpeta" value={editData.album} field="album" />

                        {/* Datalists for autocomplete */}
                        <datalist id="genre-options">
                            {GENRES_LIST.map(g => <option key={g} value={g} />)}
                        </datalist>
                        <datalist id="country-options">
                            {COUNTRIES_LIST.map(c => <option key={c} value={c} />)}
                        </datalist>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <InfoBox icon="person" label="Autor" value={track.metadata.author} sub={track.metadata.authorCountry} />
                            <InfoBox icon="mic" label="Intérprete" value={track.metadata.performer} sub={track.metadata.performerCountry} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InfoBox icon="piano" label="Género" value={track.metadata.genre} />
                            <InfoBox icon="calendar_today" label="Año" value={track.metadata.year} />
                        </div>
                        <InfoBox icon="album" label="Álbum / Carpeta" value={track.metadata.album} />
                        
                        <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                            <p className="text-xs text-gray-400 font-mono break-all">{track.path}/{track.filename}</p>
                            <p className="text-[10px] text-gray-300 mt-1">ID: {track.id}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-black/20 rounded-b-2xl shrink-0 flex gap-3">
                {isEditing ? (
                    <>
                        <button onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300">Cancelar</button>
                        <button onClick={handleSave} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark">Guardar Cambios</button>
                    </>
                ) : (
                    <>
                        {authMode !== 'user' && (
                             <button onClick={() => setIsEditing(true)} className="flex-1 py-3 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-700 dark:text-gray-200 flex items-center justify-center gap-2 hover:bg-gray-100">
                                <span className="material-symbols-outlined">edit</span> Editar
                            </button>
                        )}
                        <button onClick={onSearchCredits} className="flex-1 py-3 bg-azul-header text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:brightness-110">
                             <span className="material-symbols-outlined">smart_toy</span> Completar con IA
                        </button>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};

const InfoBox = ({ icon, label, value, sub }: { icon: string, label: string, value?: string, sub?: string }) => (
    <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 mb-1 text-gray-400 dark:text-gray-500">
            <span className="material-symbols-outlined text-sm">{icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </div>
        <p className="font-bold text-gray-800 dark:text-white truncate">{value || '---'}</p>
        {sub && <p className="text-xs text-gray-500 truncate">{sub}</p>}
    </div>
);

export default TrackDetail;
