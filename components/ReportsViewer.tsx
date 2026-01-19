
import React, { useEffect, useState } from 'react';
import { Report, User } from '../types';
import { loadReportsFromDB, deleteReportFromDB, updateReportStatus } from '../services/db';

interface ReportsViewerProps {
    users?: User[]; 
    onEdit: (report: Report) => void;
}

const ReportsViewer: React.FC<ReportsViewerProps> = ({ users = [], onEdit }) => {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const data = await loadReportsFromDB();
        setReports(data);
        setIsLoading(false);
    };

    const handleDownload = async (report: Report) => {
        const url = URL.createObjectURL(report.pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();

        // Update Status
        await updateReportStatus(report.id, { downloaded: true });
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: { ...r.status, downloaded: true, sent: r.status?.sent || false } } : r));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Eliminar este reporte permanentemente?")) {
            await deleteReportFromDB(id);
            loadData();
        }
    };

    // Calculate Summary Stats
    const summaryData = React.useMemo(() => {
        const stats: Record<string, { total: number, downloaded: number }> = {};
        
        reports.forEach(r => {
            if (!stats[r.program]) {
                stats[r.program] = { total: 0, downloaded: 0 };
            }
            stats[r.program].total++;
            if (r.status?.downloaded) stats[r.program].downloaded++;
        });
        
        return Object.entries(stats).map(([program, data]) => ({ program, ...data }));
    }, [reports]);

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24 relative">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-miel">description</span>
                    Reportes (Directores)
                </h2>
                <button 
                    onClick={() => setShowSummary(true)}
                    className="bg-azul-header text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-opacity-90 shadow-sm"
                >
                    <span className="material-symbols-outlined text-sm">analytics</span>
                    Resumen
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <span className="material-symbols-outlined text-5xl mb-4 opacity-50">folder_off</span>
                    <p>No hay reportes generados.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {reports.map((report) => (
                        <div key={report.id} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col gap-3 group hover:border-primary/50 transition-colors relative overflow-hidden">
                            {/* Status Indicators */}
                            <div className="absolute top-0 right-0 p-2 flex gap-1">
                                {report.status?.downloaded && <span title="Descargado" className="size-2 rounded-full bg-blue-500"></span>}
                            </div>

                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="size-12 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 dark:text-white truncate text-sm">{report.fileName}</h4>
                                    <div className="flex flex-wrap text-xs text-gray-500 gap-x-3 gap-y-1 mt-1">
                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">calendar_today</span> {new Date(report.date).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1 truncate"><span className="material-symbols-outlined text-[10px]">radio</span> {report.program}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 truncate">Director(a): {report.generatedBy}</p>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end border-t border-gray-100 dark:border-white/5 pt-3">
                                 {/* Edit Button */}
                                 <button 
                                    onClick={() => onEdit(report)}
                                    className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-[10px] font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-gray-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">edit_document</span> Editar
                                </button>

                                <button 
                                    onClick={() => handleDownload(report)}
                                    className="size-8 rounded-full bg-gray-100 dark:bg-white/10 text-azul-header dark:text-blue-400 hover:bg-azul-header hover:text-white transition-colors flex items-center justify-center"
                                    title="Descargar PDF"
                                >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                </button>
                                <button 
                                    onClick={() => handleDelete(report.id)}
                                    className="size-8 rounded-full bg-gray-100 dark:bg-white/10 text-gray-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
                                    title="Eliminar"
                                >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SUMMARY MODAL */}
            {showSummary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowSummary(false)}>
                    <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-white/10 pb-2">
                             <h3 className="text-lg font-bold text-gray-800 dark:text-white">Resumen Estadístico</h3>
                             <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-gray-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        
                        <div className="max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-500 text-left border-b border-gray-100 dark:border-white/5">
                                        <th className="py-2 font-bold">Programa</th>
                                        <th className="py-2 font-bold text-center">Gen.</th>
                                        <th className="py-2 font-bold text-center">Desc.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map(row => (
                                        <tr key={row.program} className="border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <td className="py-2 font-medium text-gray-800 dark:text-gray-200 pr-2">{row.program}</td>
                                            <td className="py-2 text-center text-gray-600 dark:text-gray-400">{row.total}</td>
                                            <td className="py-2 text-center text-blue-500 font-bold">{row.downloaded}</td>
                                        </tr>
                                    ))}
                                    {summaryData.length === 0 && (
                                        <tr><td colSpan={3} className="py-4 text-center text-gray-400">Sin datos</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsViewer;
