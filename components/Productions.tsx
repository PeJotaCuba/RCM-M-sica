
import React, { useEffect, useState } from 'react';
import { Track, Report } from '../types';
import * as XLSX from 'xlsx';

const GITHUB_REPORTS_URL = 'https://github.com/PeJotaCuba/RCM-M-sica/tree/89cf9deefcaac20834f2c2b63e60921a0c5a322a/Reportes%20';

interface ProductionsProps {
  onUpdateTracks: (updateFunc: (prev: Track[]) => Track[]) => void;
  allTracks?: Track[];
}

const Productions: React.FC<ProductionsProps> = ({ allTracks = [] }) => {
  const [sharedReports, setSharedReports] = useState<Report[]>([]);

  useEffect(() => {
      // Load mock shared reports or simulate functionality
      const shared = JSON.parse(localStorage.getItem('rcm_shared_reports') || '[]');
      setSharedReports(shared);
  }, []);

  const handleExportCSV = () => {
    if (allTracks.length === 0) return alert("Base de datos vacía.");
    const data = allTracks.map(t => ({
      Título: t.metadata.title,
      Autor: t.metadata.author,
      Intérprete: t.metadata.performer,
      Género: t.metadata.genre,
      Año: t.metadata.year,
      Ruta: t.path
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BaseDatos");
    XLSX.writeFile(wb, "RCM_Backup_Musical.csv");
  };

  const handleGenerateDOCXReport = () => {
    alert("Generando informe consolidado DOCX... (Simulación)");
    // Logic for DOCX generation would go here using 'docx' library
    setTimeout(() => alert("Informe descargado."), 500);
  };

  const handleDownloadCloudReport = (report: Report) => {
      const url = URL.createObjectURL(report.pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PM-Cloud-${report.fileName}`;
      a.click();
  };

  return (
    <div className="flex flex-col h-full bg-background-light p-6 overflow-y-auto pb-24">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary">playlist_add</span> Control de Producciones</h2>

        <div className="grid grid-cols-2 gap-3 mb-8">
            <button onClick={handleExportCSV} className="bg-white border border-gray-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all">
                <span className="material-symbols-outlined text-green-600 text-3xl">database</span>
                <span className="text-[10px] font-bold uppercase">Exportar CSV</span>
            </button>
            <button onClick={handleGenerateDOCXReport} className="bg-white border border-gray-200 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all">
                <span className="material-symbols-outlined text-blue-600 text-3xl">description</span>
                <span className="text-[10px] font-bold uppercase">Informe DOCX</span>
            </button>
        </div>

        <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reportes de Directores</h3>
            <button onClick={() => window.open(GITHUB_REPORTS_URL, '_blank')} className="text-[10px] text-blue-500 font-bold flex items-center gap-1 hover:underline">
                Carpeta en GitHub <span className="material-symbols-outlined text-sm">open_in_new</span>
            </button>
        </div>

        <div className="space-y-3">
            {sharedReports.map(report => (
                <div key={report.id} className="bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined">cloud_download</span>
                        </div>
                        <div className="truncate">
                            <p className="font-bold text-xs truncate">{report.fileName}</p>
                            <p className="text-[9px] text-gray-400">Enviado por: {report.generatedBy}</p>
                        </div>
                    </div>
                    <button onClick={() => handleDownloadCloudReport(report)} className="size-8 rounded-lg bg-azul-header text-white flex items-center justify-center">
                         <span className="material-symbols-outlined text-sm">download</span>
                    </button>
                </div>
            ))}
            {sharedReports.length === 0 && <div className="p-8 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-400 text-xs italic">No hay reportes sincronizados localmente.</div>}
        </div>
    </div>
  );
};

export default Productions;
