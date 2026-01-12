
import React, { useState } from 'react';
import { Track, PROGRAMS_LIST } from '../types';
import { parseTxtDatabase } from '../constants';

interface ProductionsProps {
  onAddTracks: (tracks: Track[]) => void;
}

const Productions: React.FC<ProductionsProps> = ({ onAddTracks }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [program, setProgram] = useState(PROGRAMS_LIST[0]);
  const [txtInput, setTxtInput] = useState('');

  const handleProcess = () => {
      if (!txtInput.trim()) return;
      
      const tracks = parseTxtDatabase(txtInput);
      if (tracks.length === 0) {
          alert("No se detectaron pistas válidas. Verifique el formato.");
          return;
      }

      // Add Program and Date info to metadata (optional, but good for context)
      const tracksWithContext = tracks.map(t => ({
          ...t,
          metadata: {
              ...t.metadata,
              album: t.metadata.album && t.metadata.album !== 'Carpeta General' ? t.metadata.album : `Producción: ${program} (${date})`
          }
      }));

      onAddTracks(tracksWithContext);
      setTxtInput('');
      alert("Pistas enviadas a la base de datos.");
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 mb-6 text-primary">
            <span className="material-symbols-outlined text-3xl">playlist_add</span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hoja de Producción</h2>
        </div>

        {/* Top Controls */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Emisión</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Programa</label>
                <select 
                    value={program} 
                    onChange={e => setProgram(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white appearance-none"
                >
                    {PROGRAMS_LIST.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Input Area */}
        <div className="flex-1 flex flex-col">
            <label className="block text-xs font-bold text-gray-500 mb-2">Ingreso de Pistas (Formato TXT)</label>
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex-1 flex flex-col">
                <p className="text-xs text-gray-400 mb-2 font-mono bg-gray-50 dark:bg-black/20 p-2 rounded">
                    Título: [Nombre]<br/>
                    Autor: [Nombre]<br/>
                    País: [País]<br/>
                    Intérprete: [Nombre]<br/>
                    País: [País]<br/>
                    Género: [Género]
                </p>
                <textarea 
                    value={txtInput}
                    onChange={e => setTxtInput(e.target.value)}
                    className="w-full flex-1 resize-none bg-transparent outline-none font-mono text-sm text-gray-800 dark:text-gray-200 placeholder-gray-300"
                    placeholder="Pegue aquí el bloque de texto..."
                />
            </div>
            
            <button 
                onClick={handleProcess}
                className="mt-4 w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors"
            >
                <span className="material-symbols-outlined">save_as</span>
                Procesar y Guardar
            </button>
        </div>
    </div>
  );
};

export default Productions;
