
import React, { useEffect, useState } from 'react';
import { Track, Report } from '../types';

interface ProductionsProps {
  onUpdateTracks: (updateFunc: (prev: Track[]) => Track[]) => void;
  allTracks?: Track[];
}

const Productions: React.FC<ProductionsProps> = ({ allTracks = [] }) => {
  const [sharedReports, setSharedReports] = useState<Report[]>([]);
  const [previewReport, setPreviewReport] = useState<Report | null>(null);

  useEffect(() => {
      const loadShared = () => {
          const shared = JSON.parse(localStorage.getItem('rcm_shared_reports') || '[]');
          setSharedReports(shared);
      };
      loadShared();
  }, []);

  const handleDownload = (report: Report) => {
      // Logic would normally fetch from Git, here we use the stored mock
      alert(`Descargando: ${report.fileName}`);
  };

  return (
    <div className="flex flex-col h-full bg-background-light p-6 overflow-y-auto pb-24">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary">playlist_add</span> Producciones</h2>

        <div className="mb-8">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Reportes Compartidos (Nube)</h3>
            <div className="space-y-3">
                {sharedReports.map(report => (
                    <div key={report.id} className="bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="material-symbols-outlined text-azul-header">cloud_done</span>
                            <div className="truncate">
                                <p className="font-bold text-sm truncate">{report.fileName}</p>
                                <p className="text-[10px] text-gray-400">De: @{report.generatedBy} • {report.program}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setPreviewReport(report)} className="size-8 rounded bg-gray-100 text-gray-500 flex items-center justify-center"><span className="material-symbols-outlined text-sm">visibility</span></button>
                             <button onClick={() => handleDownload(report)} className="size-8 rounded bg-azul-header text-white flex items-center justify-center"><span className="material-symbols-outlined text-sm">download</span></button>
                        </div>
                    </div>
                ))}
                {sharedReports.length === 0 && <p className="text-xs text-gray-400 text-center py-4 italic">No hay reportes compartidos aún.</p>}
            </div>
        </div>
        
        {previewReport && (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewReport(null)}>
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center">
                    <p className="font-bold mb-4">Vista Previa de Reporte en la Nube</p>
                    <p className="text-xs text-gray-500 mb-6">Esta es una simulación del PDF subido por {previewReport.generatedBy}.</p>
                    <button onClick={() => setPreviewReport(null)} className="bg-azul-header text-white px-6 py-2 rounded-xl font-bold">Cerrar</button>
                </div>
            </div>
        )}
    </div>
  );
};

export default Productions;
