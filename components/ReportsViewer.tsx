
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
    const [previewReport, setPreviewReport] = useState<Report | null>(null);

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

    const handleUploadCloud = async (report: Report) => {
        setIsLoading(true);
        // Simulate GitHub folder upload
        await new Promise(r => setTimeout(r, 1500));
        
        // Mark as cloud uploaded in internal shared DB
        const sharedKey = 'rcm_shared_reports';
        const shared = JSON.parse(localStorage.getItem(sharedKey) || '[]');
        localStorage.setItem(sharedKey, JSON.stringify([...shared, { ...report, id: `cloud-${Date.now()}` }]));
        
        await updateReportStatus(report.id, { cloudUploaded: true });
        alert("Reporte subido correctamente a la carpeta compartida.");
        loadData();
    };

    return (
        <div className="flex flex-col h-full bg-background-light p-6 overflow-y-auto pb-24">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-miel">description</span> Reportes</h2>

            {reports.map((report) => (
                <div key={report.id} className="bg-white p-4 rounded-xl border mb-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="material-symbols-outlined text-red-500">picture_as_pdf</span>
                            <div className="truncate">
                                <p className="font-bold text-sm truncate">{report.fileName}</p>
                                <p className="text-[10px] text-gray-400">{report.program} • {new Date(report.date).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex gap-1">
                             <button onClick={() => setPreviewReport(report)} className="size-8 rounded bg-gray-100 text-gray-500 flex items-center justify-center" title="Previsualizar"><span className="material-symbols-outlined text-sm">visibility</span></button>
                             <button onClick={() => onEdit(report)} className="size-8 rounded bg-gray-100 text-gray-500 flex items-center justify-center" title="Editar"><span className="material-symbols-outlined text-sm">edit</span></button>
                             <button onClick={() => handleDownload(report)} className="size-8 rounded bg-azul-header text-white flex items-center justify-center" title="Descargar"><span className="material-symbols-outlined text-sm">download</span></button>
                        </div>
                    </div>
                    {(currentUser?.role === 'director' || currentUser?.role === 'admin') && (
                        <button 
                            onClick={() => handleUploadCloud(report)}
                            className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 border ${report.status?.cloudUploaded ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >
                            <span className="material-symbols-outlined text-sm">cloud_upload</span>
                            {report.status?.cloudUploaded ? 'Enviado a la Nube' : 'Subir a Reportes (GitHub)'}
                        </button>
                    )}
                </div>
            ))}

            {previewReport && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewReport(null)}>
                    <div className="bg-white rounded-2xl p-2 w-full max-w-2xl h-[80vh] flex flex-col relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewReport(null)} className="absolute -top-10 right-0 text-white flex items-center gap-2 font-bold"><span className="material-symbols-outlined">close</span> Cerrar</button>
                        <iframe src={URL.createObjectURL(previewReport.pdfBlob)} className="flex-1 w-full rounded-xl" />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsViewer;
