
import React, { useEffect, useState } from 'react';
import { Report, User } from '../types';
import { loadReportsFromDB, deleteReportFromDB, updateReportStatus } from '../services/db';

interface ReportsViewerProps {
    onEdit: (report: Report) => void;
    currentUser?: User | null;
}

const ReportsViewer: React.FC<ReportsViewerProps> = ({ onEdit, currentUser }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setIsLoading(true);
        const filterUser = (currentUser && currentUser.role !== 'admin') ? currentUser.username : undefined;
        const data = await loadReportsFromDB(filterUser);
        setReports(data);
        setIsLoading(false);
    };

    const handleDownload = async (report: Report) => {
        const url = URL.createObjectURL(report.pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName;
        a.click();
        URL.revokeObjectURL(url);
        await updateReportStatus(report.id, { downloaded: true });
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Desea eliminar este reporte permanentemente?")) {
            await deleteReportFromDB(id);
            loadData();
        }
    };

    const handleUploadCloud = async (report: Report) => {
        setIsLoading(true);
        await new Promise(r => setTimeout(r, 1200));
        const sharedKey = 'rcm_shared_reports';
        const shared = JSON.parse(localStorage.getItem(sharedKey) || '[]');
        localStorage.setItem(sharedKey, JSON.stringify([...shared, { ...report, id: `cloud-${Date.now()}` }]));
        await updateReportStatus(report.id, { cloudUploaded: true });
        alert("Reporte compartido con éxito.");
        loadData();
    };

    if (isLoading) return <div className="p-20 text-center text-gray-400">Cargando reportes...</div>;

    return (
        <div className="flex flex-col h-full bg-background-light p-5 overflow-y-auto pb-24">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-miel">description</span> Mis Reportes</h2>

            {reports.map((report) => (
                <div key={report.id} className="bg-white p-4 rounded-xl border mb-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="size-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined">picture_as_pdf</span>
                            </div>
                            <div className="truncate">
                                <p className="font-bold text-xs truncate text-gray-800">{report.fileName}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{report.program} • {new Date(report.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                             <button onClick={() => onEdit(report)} className="size-8 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center border" title="Editar"><span className="material-symbols-outlined text-sm">edit</span></button>
                             <button onClick={() => handleDownload(report)} className="size-8 rounded-lg bg-azul-header text-white flex items-center justify-center shadow-sm" title="Descargar"><span className="material-symbols-outlined text-sm">download</span></button>
                             <button onClick={() => handleDelete(report.id)} className="size-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center border border-red-100" title="Eliminar"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>
                    </div>
                    
                    {(currentUser?.role === 'director' || currentUser?.role === 'admin') && (
                        <button 
                            onClick={() => handleUploadCloud(report)}
                            className={`w-full py-2.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 border transition-all ${report.status?.cloudUploaded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                            {report.status?.cloudUploaded ? 'Compartido en Nube' : 'Compartir con Coordinador'}
                        </button>
                    )}
                </div>
            ))}

            {reports.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center gap-2">
                    <span className="material-symbols-outlined text-4xl">folder_off</span>
                    <p className="text-sm">No has generado reportes todavía.</p>
                </div>
            )}
        </div>
    );
};

export default ReportsViewer;
