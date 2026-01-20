
import React, { useState } from 'react';
import { Track, PROGRAMS_LIST, Report } from '../types';
import { extractTextFromPDF } from '../services/pdfService';
import { loadReportsFromDB } from '../services/db';
import * as docx from 'docx';
import * as XLSX from 'xlsx';

interface ProductionsProps {
  onAddTracks: (tracks: Track[]) => void;
  allTracks?: Track[];
}

const Productions: React.FC<ProductionsProps> = ({ onAddTracks, allTracks = [] }) => {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryProgram, setEntryProgram] = useState(PROGRAMS_LIST[0]);
  const [pdfProcessing, setPdfProcessing] = useState(false);
  
  // Report State
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportProgram, setReportProgram] = useState(PROGRAMS_LIST[0]);
  const [reportScope, setReportScope] = useState<'program'>('program');
  const [showGlobalStats, setShowGlobalStats] = useState(false);
  const [globalReports, setGlobalReports] = useState<Report[]>([]);

  // PARSER SPECIFIC FOR REPORT PDF FORMAT
  // Format:
  // [1] Title
  // Autor: Name (Country)
  // Intérprete: Name (Country)
  // Género: ...
  const parseReportText = (text: string): Track[] => {
    const lines = text.split('\n');
    const tracks: Track[] = [];
    let currentTrack: Partial<Track['metadata']> | null = null;
    let currentId = 0;

    const saveCurrent = () => {
        if (currentTrack && currentTrack.title) {
            tracks.push({
                id: `imp-${Date.now()}-${currentId++}`,
                filename: `${currentTrack.title}.mp3`,
                path: 'Importado PDF',
                isVerified: true,
                metadata: {
                    title: currentTrack.title,
                    author: currentTrack.author || 'Desconocido',
                    authorCountry: currentTrack.authorCountry || '',
                    performer: currentTrack.performer || 'Desconocido',
                    performerCountry: currentTrack.performerCountry || '',
                    genre: currentTrack.genre || '',
                    album: `Producción: ${entryProgram} (${entryDate})`,
                    year: entryDate.split('-')[0]
                }
            } as Track);
        }
    };

    const extractNameCountry = (str: string) => {
        // Regex: Matches "Name (Country)" taking the last parenthesis group
        const match = str.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (match) return { name: match[1].trim(), country: match[2].trim() };
        return { name: str.trim(), country: '' };
    };

    lines.forEach(line => {
        const l = line.trim();
        // Match [1] Title or [10] Title
        const titleMatch = l.match(/^\[\d+\]\s+(.+)/);
        
        if (titleMatch) {
            saveCurrent();
            currentTrack = { title: titleMatch[1].trim() };
        } else if (currentTrack) {
            if (l.toLowerCase().startsWith('autor:')) {
                const raw = l.substring(6).trim();
                const { name, country } = extractNameCountry(raw);
                currentTrack.author = name;
                currentTrack.authorCountry = country;
            } else if (l.toLowerCase().startsWith('intérprete:') || l.toLowerCase().startsWith('interprete:')) {
                const raw = l.substring(11).trim();
                const { name, country } = extractNameCountry(raw);
                currentTrack.performer = name;
                currentTrack.performerCountry = country;
            } else if (l.toLowerCase().startsWith('género:') || l.toLowerCase().startsWith('genero:')) {
                currentTrack.genre = l.substring(7).trim();
            }
        }
    });
    saveCurrent();
    return tracks;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setPdfProcessing(true);
      try {
          const text = await extractTextFromPDF(file);
          const tracks = parseReportText(text); 
          
          if (tracks.length === 0) {
              alert("No se detectaron pistas válidas en el PDF. Asegúrese que sea un Reporte Oficial.");
          } else {
              onAddTracks(tracks);
              alert(`${tracks.length} pistas extraídas del Reporte PDF correctamente.`);
          }
      } catch (err) {
          alert("Error leyendo el PDF.");
      } finally {
          setPdfProcessing(false);
          e.target.value = ''; // Reset input
      }
  };

  // --- REPORTING LOGIC ---
  const handleOpenGlobalStats = async () => {
      // Load all reports from DB
      const reports = await loadReportsFromDB();
      setGlobalReports(reports);
      setShowGlobalStats(true);
  };

  const getFilteredTracks = () => {
      const start = new Date(reportStartDate);
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59);

      return allTracks.filter(t => {
          if (!t.metadata.album || !t.metadata.album.startsWith("Producción:")) return false;
          const match = t.metadata.album.match(/\(([\d-]+)\)$/);
          if (!match) return false;
          const trackDate = new Date(match[1]);
          if (isNaN(trackDate.getTime())) return false;
          const inRange = trackDate >= start && trackDate <= end;
          if (!inRange) return false;
          if (reportScope === 'program') {
              return t.metadata.album.includes(`Producción: ${reportProgram}`);
          }
          return true;
      });
  };

  const exportToCSV = () => {
      const reportTracks = getFilteredTracks();
      if (reportTracks.length === 0) { alert("No hay datos."); return; }
      const dataForCsv = reportTracks.map(t => {
          let fecha = "";
          let programa = "";
          const match = t.metadata.album.match(/Producción: (.*) \(([\d-]+)\)$/);
          if (match) { programa = match[1]; fecha = match[2]; }
          return {
              "Fecha": fecha, "Programa": programa, "Título": t.metadata.title,
              "Autor": t.metadata.author, "País Autor": t.metadata.authorCountry,
              "Intérprete": t.metadata.performer, "País Intérprete": t.metadata.performerCountry,
              "Género": t.metadata.genre, "Año": t.metadata.year
          };
      });
      const worksheet = XLSX.utils.json_to_sheet(dataForCsv);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Producciones");
      XLSX.writeFile(workbook, "Producciones.csv");
  };

  const generateDocxReport = async () => {
      const reportTracks = getFilteredTracks();
      if (reportTracks.length === 0) { alert("No hay datos."); return; }

      const totalWorks = reportTracks.length;
      const cubaCount = reportTracks.filter(t => 
          (t.metadata.authorCountry && t.metadata.authorCountry.toLowerCase().includes('cuba')) || 
          (t.metadata.performerCountry && t.metadata.performerCountry.toLowerCase().includes('cuba'))
      ).length;
      const foreignCount = totalWorks - cubaCount;

      const getTop = (key: 'title' | 'author' | 'performer' | 'genre', limit = 5) => {
          const counts: Record<string, number> = {};
          reportTracks.forEach(t => { const val = t.metadata[key]; if (val && val !== 'Desconocido' && val !== '') counts[val] = (counts[val] || 0) + 1; });
          return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, limit);
      };

      const topWorks = getTop('title');
      const topAuthors = getTop('author');
      const topGenres = getTop('genre');
      const titleText = reportScope === 'program' ? `Programa: ${reportProgram}` : "Reporte General";

      const doc = new docx.Document({
          sections: [{
              properties: {},
              children: [
                  new docx.Paragraph({ children: [new docx.TextRun({ text: "DIRECCIÓN NACIONAL DE MÚSICA", bold: true, size: 28 })], alignment: docx.AlignmentType.CENTER }),
                  new docx.Paragraph({ children: [new docx.TextRun({ text: "ESTADÍSTICAS MUSICALES", bold: true, size: 24 })], alignment: docx.AlignmentType.CENTER, spacing: { after: 200 } }),
                  new docx.Paragraph({ text: `Emisora: RADIO CIUDAD MONUMENTO | ${titleText}`, heading: docx.HeadingLevel.HEADING_3 }),
                  new docx.Paragraph({ text: `Periodo: ${reportStartDate} al ${reportEndDate}`, heading: docx.HeadingLevel.HEADING_3, spacing: { after: 200 } }),
                  new docx.Paragraph({ text: "Obras por origen", bold: true }),
                  new docx.Table({
                      width: { size: 100, type: docx.WidthType.PERCENTAGE },
                      rows: [
                          new docx.TableRow({ children: ["Origen", "Cantidad", "%"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]})) }),
                          new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph("Cuba")] }), new docx.TableCell({ children: [new docx.Paragraph(cubaCount.toString())] }), new docx.TableCell({ children: [new docx.Paragraph(totalWorks > 0 ? ((cubaCount/totalWorks)*100).toFixed(1) + "%" : "0%")] })] }),
                          new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph("Extranjera")] }), new docx.TableCell({ children: [new docx.Paragraph(foreignCount.toString())] }), new docx.TableCell({ children: [new docx.Paragraph(totalWorks > 0 ? ((foreignCount/totalWorks)*100).toFixed(1) + "%" : "0%")] })] })
                      ]
                  }),
                   new docx.Paragraph({ text: "" }),
                   new docx.Paragraph({ text: "Más difundidos", bold: true }),
                   new docx.Table({
                       width: { size: 100, type: docx.WidthType.PERCENTAGE },
                       rows: [
                           new docx.TableRow({ children: ["Categoría", "Top 1"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]})) }),
                           new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph("Obra")] }), new docx.TableCell({ children: [new docx.Paragraph(topWorks[0]?.[0] || "-")] })] }),
                           new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph("Autor")] }), new docx.TableCell({ children: [new docx.Paragraph(topAuthors[0]?.[0] || "-")] })] }),
                           new docx.TableRow({ children: [new docx.TableCell({ children: [new docx.Paragraph("Género")] }), new docx.TableCell({ children: [new docx.Paragraph(topGenres[0]?.[0] || "-")] })] }),
                       ]
                   })
              ]
          }]
      });

      docx.Packer.toBlob(doc).then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = `Reporte.docx`; a.click(); window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        
        {/* DATA ENTRY */}
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-6 text-primary">
                <span className="material-symbols-outlined text-3xl">playlist_add</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ingreso de Datos</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Reporte</label>
                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Programa</label>
                    <select value={entryProgram} onChange={e => setEntryProgram(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white appearance-none">
                        {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {/* PDF Entry */}
            <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-500 mb-2">Importar Reporte PDF (Oficial)</label>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex items-center justify-center border-dashed border-2 hover:border-primary transition-colors">
                    {pdfProcessing ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-gray-500">Procesando Reporte...</span>
                        </div>
                    ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 group w-full">
                            <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-primary transition-colors">upload_file</span>
                            <span className="text-sm font-bold text-gray-500 group-hover:text-primary">Seleccionar PDF de Reporte</span>
                            <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                        </label>
                    )}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Solo se admiten reportes PDF generados por la aplicación (PM-...).</p>
            </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700 mb-8"/>

        {/* REPORTS DASHBOARD */}
        <div>
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3 text-green-700 dark:text-green-500">
                    <span className="material-symbols-outlined text-3xl">summarize</span>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas</h2>
                 </div>
                 <button 
                    onClick={handleOpenGlobalStats}
                    className="bg-miel text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-yellow-600 shadow-sm"
                >
                    <span className="material-symbols-outlined text-sm">leaderboard</span>
                    Consultar Reportes Globales
                </button>
            </div>

             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Filtrar Producción por Periodo</label>
                    <div className="grid grid-cols-2 gap-4">
                         <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                         <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                    </div>
                </div>
                 <div className="flex gap-3 mt-4">
                    <button onClick={generateDocxReport} className="flex-1 bg-azul-header text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors">
                        <span className="material-symbols-outlined">description</span> Reporte (DOCX)
                    </button>
                    <button onClick={exportToCSV} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">
                        <span className="material-symbols-outlined">csv</span> Base Datos (CSV)
                    </button>
                </div>
            </div>
        </div>

        {/* GLOBAL STATS MODAL */}
        {showGlobalStats && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowGlobalStats(false)}>
                <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[80vh] rounded-2xl p-6 flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tablero de Control de Reportes PDF</h3>
                        <button onClick={() => setShowGlobalStats(false)} className="text-gray-400 hover:text-red-500"><span className="material-symbols-outlined">close</span></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto grid md:grid-cols-2 gap-6">
                        {/* By Month */}
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 pb-2">Reportes por Mes</h4>
                            <div className="space-y-2">
                                {Object.entries(globalReports.reduce((acc, r) => {
                                    const month = new Date(r.date).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                                    if(!acc[month]) acc[month] = { count: 0, programs: new Set<string>() };
                                    acc[month].count++;
                                    acc[month].programs.add(r.program);
                                    return acc;
                                }, {} as Record<string, {count: number, programs: Set<string>}>)).map(([key, val]: [string, {count: number, programs: Set<string>}]) => (
                                    <div key={key} className="flex justify-between text-xs">
                                        <span className="capitalize font-medium">{key}</span>
                                        <span className="text-gray-500">{val.count} reportes ({val.programs.size} programas)</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* By Director */}
                        <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 pb-2">Reportes por Director</h4>
                            <div className="space-y-2">
                                {Object.entries(globalReports.reduce((acc, r) => {
                                    if(!acc[r.generatedBy]) acc[r.generatedBy] = { count: 0, programs: new Set<string>() };
                                    acc[r.generatedBy].count++;
                                    acc[r.generatedBy].programs.add(r.program);
                                    return acc;
                                }, {} as Record<string, {count: number, programs: Set<string>}>)).map(([key, val]: [string, {count: number, programs: Set<string>}]) => (
                                    <div key={key} className="flex justify-between text-xs">
                                        <span className="font-bold text-blue-600">{key}</span>
                                        <span className="text-gray-500">{val.count} reportes ({Array.from(val.programs).length} progs)</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* By Program */}
                         <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl md:col-span-2">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 mb-3 border-b border-gray-200 pb-2">Detalle por Programa</h4>
                            <div className="max-h-60 overflow-y-auto">
                                <table className="w-full text-xs text-left">
                                    <thead>
                                        <tr className="text-gray-400">
                                            <th className="pb-2">Programa</th>
                                            <th className="pb-2 text-center">Cant. Reportes</th>
                                            <th className="pb-2 text-right">Último Reporte</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(globalReports.reduce((acc, r) => {
                                            if(!acc[r.program]) acc[r.program] = { count: 0, lastDate: r.date };
                                            acc[r.program].count++;
                                            if(new Date(r.date) > new Date(acc[r.program].lastDate)) acc[r.program].lastDate = r.date;
                                            return acc;
                                        }, {} as Record<string, {count: number, lastDate: string}>))
                                        .sort((a: [string, {count: number, lastDate: string}], b: [string, {count: number, lastDate: string}]) => b[1].count - a[1].count)
                                        .map(([key, val]: [string, {count: number, lastDate: string}]) => (
                                            <tr key={key} className="border-b border-gray-100 dark:border-white/5">
                                                <td className="py-2 font-medium">{key}</td>
                                                <td className="py-2 text-center">{val.count}</td>
                                                <td className="py-2 text-right">{new Date(val.lastDate).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Productions;
