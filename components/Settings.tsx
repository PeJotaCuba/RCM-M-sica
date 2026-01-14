
import React, { useState } from 'react';
import { Track } from '../types';

interface SettingsProps {
  tracks: Track[];
  onImportFolders: (file: File) => void;
  onImportCredits: (file: File) => void;
}

const Settings: React.FC<SettingsProps> = ({ tracks, onImportFolders, onImportCredits }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'folders' | 'credits') => {
    if (e.target.files && e.target.files[0]) {
        setIsProcessing(true);
        setTimeout(() => {
            if (type === 'folders') onImportFolders(e.target.files![0]);
            else onImportCredits(e.target.files![0]);
            setIsProcessing(false);
        }, 100);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ajustes</h2>
        
        {isProcessing && (
            <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="font-bold text-gray-700">Procesando archivo...</span>
                </div>
            </div>
        )}

        <div className="space-y-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-azul-header dark:text-blue-400">
                    <span className="material-symbols-outlined">folder_managed</span>
                    <h3 className="font-bold">Importar Base de Datos Local</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                    Soporta Excel (.xlsx) y Texto (.txt) con los formatos:<br/>
                    1. Tabla Excel (Nombre Carpeta | Ruta | Título)<br/>
                    2. Bloques TXT (Título: X, Compositor: Y, Carpeta: Z...)
                </p>
                <label className="block w-full cursor-pointer group">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <span className="material-symbols-outlined text-gray-400 text-3xl mb-2 group-hover:text-primary transition-colors">upload_file</span>
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Clic para subir Excel o TXT</span></p>
                        </div>
                    </div>
                    <input type="file" accept=".xlsx, .xls, .txt" 
                        onChange={(e) => handleFileChange(e, 'folders')}
                        className="hidden"
                    />
                </label>
            </div>
            
            <div className="text-center p-4">
                <p className="text-xs text-gray-400">
                    Nota: La actualización principal se realiza vía GitHub desde la pantalla de inicio.
                </p>
            </div>
        </div>
    </div>
  );
};

export default Settings;
