import React from 'react';
import { Track } from '../types';

interface TrackDetailProps {
  track: Track;
  onClose: () => void;
  onSearchCredits: () => void;
}

const TrackDetail: React.FC<TrackDetailProps> = ({ track, onClose, onSearchCredits }) => {
  // Requirement 2: "Cuadro de diálogo superpuesto"
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
                
                {/* Status Badge */}
                <div className="flex justify-center">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${track.isVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        <span className="material-symbols-outlined text-sm">{track.isVerified ? 'verified' : 'help'}</span>
                        {track.isVerified ? 'Metadatos Verificados' : 'Información Pendiente'}
                    </span>
                </div>

                {/* Metadata Grid */}
                <div className="grid gap-4">
                    <DetailRow icon="person_edit" label="Autor / Compositor" value={track.metadata.author} />
                    <DetailRow icon="mic" label="Intérprete" value={track.metadata.performer} />
                    <DetailRow icon="album" label="Álbum" value={track.metadata.album} />
                    <DetailRow icon="calendar_today" label="Año" value={track.metadata.year} />
                </div>

                {/* File Info */}
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

                {/* Action */}
                <button 
                    onClick={onSearchCredits}
                    className="w-full mt-4 bg-gradient-to-r from-primary to-primary-dark text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                    <span className="material-symbols-outlined">travel_explore</span>
                    Consultar IA (Créditos)
                </button>
            </div>
        </div>
    </div>
  );
};

const DetailRow: React.FC<{ icon: string, label: string, value: string }> = ({ icon, label, value }) => (
    <div className="flex items-center gap-4">
        <div className="size-10 rounded-full bg-azul-header/10 dark:bg-blue-900/20 text-azul-header dark:text-blue-300 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
        <div>
            <p className="text-xs text-gray-500 uppercase font-semibold">{label}</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value || "---"}</p>
        </div>
    </div>
);

export default TrackDetail;