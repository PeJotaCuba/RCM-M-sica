import React from 'react';
import { Track } from '../types';

interface SettingsProps {
  tracks: Track[];
  onImportFolders: (file: File) => void;
  onImportCredits: (file: File) => void;
}

const Settings: React.FC<SettingsProps> = ({ tracks, onImportFolders, onImportCredits }) => {
  
  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tracks, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "musica.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'folders' | 'credits') => {
    if (e.target.files && e.target.files[0]) {
        if (type === 'folders') onImportFolders(e.target.files[0]);
        else onImportCredits(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ajustes</h2>
        
        <div className="space-y-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-azul-header dark:text-blue-400">
                    <span className="material-symbols-outlined">folder_managed</span>
                    <h3 className="font-bold">Gestión de Carpetas</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">Carga un archivo .txt o .xlsx con la estructura de carpetas.</p>
                <label className="block w-full">
                    <span className="sr-only">Elegir archivo</span>
                    <input type="file" accept=".txt,.xlsx" 
                        onChange={(e) => handleFileChange(e, 'folders')}
                        className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-semibold
                        file:bg-azul-header file:text-white
                        hover:file:bg-azul-cauto
                    "/>
                </label>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                 <div className="flex items-center gap-3 mb-4 text-miel">
                    <span className="material-symbols-outlined">library_music</span>
                    <h3 className="font-bold">Créditos Musicales</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">Importar base de datos de créditos masivos.</p>
                <label className="block w-full">
                    <input type="file" accept=".txt,.xlsx" 
                        onChange={(e) => handleFileChange(e, 'credits')}
                        className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-xs file:font-semibold
                        file:bg-miel file:text-white
                        hover:file:bg-yellow-600
                    "/>
                </label>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-green-600">
                    <span className="material-symbols-outlined">data_object</span>
                    <h3 className="font-bold">Exportar Base de Datos</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">Genera el archivo "musica.json" con el estado actual.</p>
                <button 
                    onClick={handleDownloadJson}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined">download</span>
                    Descargar musica.json
                </button>
            </div>
        </div>
    </div>
  );
};

export default Settings;