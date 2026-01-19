
import React, { useEffect, useState } from 'react';
import { Report } from '../types';
import { loadReportsFromDB, deleteReportFromDB } from '../services/db';

const ReportsViewer: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        const data = await loadReportsFromDB();
        setReports(data);
        setIsLoading(false);
    };

    const handleDownload = (report: Report) => {
        const url = URL.createObjectURL(report.pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = report.fileName;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Eliminar este reporte permanentemente?")) {
            await deleteReportFromDB(id);
            loadData();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-miel">description</span>
                Reportes Musicales
            </h2>

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
                        <div key={report.id} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex items-center justify-between group hover:border-primary/50 transition-colors">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="size-12 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-gray-800 dark:text-white truncate">{report.fileName}</h4>
                                    <div className="flex text-xs text-gray-500 gap-3 mt-1">
                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">calendar_today</span> {new Date(report.date).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">radio</span> {report.program}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 truncate">Por: {report.generatedBy}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleDownload(report)}
                                    className="size-10 rounded-full bg-gray-100 dark:bg-white/10 text-azul-header dark:text-blue-400 hover:bg-azul-header hover:text-white transition-colors flex items-center justify-center"
                                    title="Descargar PDF"
                                >
                                    <span className="material-symbols-outlined">download</span>
                                </button>
                                <button 
                                    onClick={() => handleDelete(report.id)}
                                    className="size-10 rounded-full bg-gray-100 dark:bg-white/10 text-gray-400 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
                                    title="Eliminar"
                                >
                                    <span className="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReportsViewer;
