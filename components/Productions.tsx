
import React, { useState } from 'react';
import { Track, PROGRAMS_LIST } from '../types';
import { parseTxtDatabase } from '../constants';
import * as docx from 'docx';
import * as XLSX from 'xlsx';

interface ProductionsProps {
  onAddTracks: (tracks: Track[]) => void;
  allTracks?: Track[];
}

const Productions: React.FC<ProductionsProps> = ({ onAddTracks, allTracks = [] }) => {
  // Input State
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryProgram, setEntryProgram] = useState(PROGRAMS_LIST[0]);
  const [txtInput, setTxtInput] = useState('');
  const [manualEntry, setManualEntry] = useState({
      title: '', author: '', authorCountry: '', performer: '', performerCountry: '', genre: ''
  });

  // Report State
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportProgram, setReportProgram] = useState(PROGRAMS_LIST[0]);
  const [reportScope, setReportScope] = useState<'general' | 'program'>('program');

  const handleManualSubmit = () => {
      if (!manualEntry.title) return alert("El título es obligatorio");
      
      const newTrack: Track = {
          id: `man-${Date.now()}`,
          filename: `${manualEntry.title}.mp3`,
          path: `Producción: ${entryProgram}`,
          size: '---',
          isVerified: true,
          metadata: {
              title: manualEntry.title,
              author: manualEntry.author,
              authorCountry: manualEntry.authorCountry,
              performer: manualEntry.performer,
              performerCountry: manualEntry.performerCountry,
              genre: manualEntry.genre,
              album: `Producción: ${entryProgram} (${entryDate})`,
              year: entryDate.split('-')[0]
          }
      };
      
      onAddTracks([newTrack]);
      setManualEntry({ title: '', author: '', authorCountry: '', performer: '', performerCountry: '', genre: '' });
      alert("Tema agregado correctamente.");
  };

  const handleTxtProcess = () => {
      if (!txtInput.trim()) return;
      
      const tracks = parseTxtDatabase(txtInput);
      if (tracks.length === 0) {
          alert("No se detectaron pistas válidas. Verifique el formato.");
          return;
      }

      const tracksWithContext = tracks.map(t => ({
          ...t,
          metadata: {
              ...t.metadata,
              album: t.metadata.album && t.metadata.album !== 'Carpeta General' ? t.metadata.album : `Producción: ${entryProgram} (${entryDate})`
          }
      }));

      onAddTracks(tracksWithContext);
      setTxtInput('');
      alert("Pistas enviadas a la base de datos.");
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
      if (reportTracks.length === 0) {
          alert("No hay datos de producciones para exportar en este periodo.");
          return;
      }

      // Preparar datos para CSV
      const dataForCsv = reportTracks.map(t => {
          // Extraer fecha y programa del string "Producción: PROGRAMA (FECHA)"
          let fecha = "";
          let programa = "";
          const match = t.metadata.album.match(/Producción: (.*) \(([\d-]+)\)$/);
          if (match) {
              programa = match[1];
              fecha = match[2];
          }

          return {
              "Fecha": fecha,
              "Programa": programa,
              "Título": t.metadata.title,
              "Autor": t.metadata.author,
              "País Autor": t.metadata.authorCountry,
              "Intérprete": t.metadata.performer,
              "País Intérprete": t.metadata.performerCountry,
              "Género": t.metadata.genre,
              "Año": t.metadata.year
          };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataForCsv);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Producciones");
      
      const fileName = reportScope === 'program' 
          ? `Producciones_${reportProgram.replace(/\s/g, '_')}_${reportStartDate}_${reportEndDate}.csv`
          : `Producciones_General_${reportStartDate}_${reportEndDate}.csv`;

      XLSX.writeFile(workbook, fileName);
  };

  const generateReport = async () => {
      const reportTracks = getFilteredTracks();
      if (reportTracks.length === 0) {
          alert("No hay datos guardados para este periodo y criterios.");
          return;
      }

      const totalWorks = reportTracks.length;
      
      const cubaCount = reportTracks.filter(t => 
          (t.metadata.authorCountry && t.metadata.authorCountry.toLowerCase().includes('cuba')) || 
          (t.metadata.performerCountry && t.metadata.performerCountry.toLowerCase().includes('cuba'))
      ).length;
      const foreignCount = totalWorks - cubaCount;

      const getTop = (key: 'title' | 'author' | 'performer' | 'genre', limit = 5) => {
          const counts: Record<string, number> = {};
          reportTracks.forEach(t => {
              const val = t.metadata[key];
              if (val && val !== 'Desconocido' && val !== '') counts[val] = (counts[val] || 0) + 1;
          });
          return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, limit);
      };

      const topWorks = getTop('title');
      const topAuthors = getTop('author');
      const topPerformers = getTop('performer');
      const topGenres = getTop('genre');

      const titleText = reportScope === 'program' 
          ? `Programa: ${reportProgram}` 
          : "Reporte General (Todos los Programas)";

      const doc = new docx.Document({
          sections: [{
              properties: {},
              children: [
                  new docx.Paragraph({
                      children: [new docx.TextRun({ text: "DIRECCIÓN NACIONAL DE MÚSICA", bold: true, size: 28 })],
                      alignment: docx.AlignmentType.CENTER,
                  }),
                  new docx.Paragraph({
                      children: [new docx.TextRun({ text: "ESTADÍSTICAS MUSICALES", bold: true, size: 24 })],
                      alignment: docx.AlignmentType.CENTER,
                      spacing: { after: 200 }
                  }),
                   new docx.Paragraph({
                      text: `Emisora: RADIO CIUDAD MONUMENTO | ${titleText}`,
                      heading: docx.HeadingLevel.HEADING_3,
                  }),
                  new docx.Paragraph({
                      text: `Periodo: ${reportStartDate} al ${reportEndDate}`,
                      heading: docx.HeadingLevel.HEADING_3,
                      spacing: { after: 200 }
                  }),

                  new docx.Paragraph({ text: "Obras, autores e intérpretes por zonas geográficas", bold: true }),
                  new docx.Table({
                      width: { size: 100, type: docx.WidthType.PERCENTAGE },
                      rows: [
                          new docx.TableRow({
                              children: ["Zonas", "Cantidad Obras", "%"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]}))
                          }),
                          new docx.TableRow({
                              children: [
                                  new docx.TableCell({ children: [new docx.Paragraph("Cuba")] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(cubaCount.toString())] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(totalWorks > 0 ? ((cubaCount/totalWorks)*100).toFixed(1) + "%" : "0%")] }),
                              ]
                          }),
                          new docx.TableRow({
                              children: [
                                  new docx.TableCell({ children: [new docx.Paragraph("Extranjera")] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(foreignCount.toString())] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(totalWorks > 0 ? ((foreignCount/totalWorks)*100).toFixed(1) + "%" : "0%")] }),
                              ]
                          }),
                           new docx.TableRow({
                              children: [
                                  new docx.TableCell({ children: [new docx.Paragraph("Total General")] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(totalWorks.toString())] }),
                                  new docx.TableCell({ children: [new docx.Paragraph("100%")] }),
                              ]
                          })
                      ]
                  }),
                  new docx.Paragraph({ text: "" }), 

                  new docx.Paragraph({ text: "Obras musicales más difundidas", bold: true, spacing: { before: 200 } }),
                  new docx.Table({
                       width: { size: 100, type: docx.WidthType.PERCENTAGE },
                       rows: [
                           new docx.TableRow({
                               children: ["Título", "Frecuencia"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]}))
                           }),
                           ...topWorks.map(([name, count]) => new docx.TableRow({
                               children: [
                                   new docx.TableCell({ children: [new docx.Paragraph(name)] }),
                                   new docx.TableCell({ children: [new docx.Paragraph(count.toString())] }),
                               ]
                           }))
                       ]
                  }),
                  new docx.Paragraph({ text: "" }),

                  new docx.Paragraph({ text: "Autores más difundidos", bold: true, spacing: { before: 200 } }),
                  new docx.Table({
                       width: { size: 100, type: docx.WidthType.PERCENTAGE },
                       rows: [
                           new docx.TableRow({
                               children: ["Autor", "Frecuencia"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]}))
                           }),
                           ...topAuthors.map(([name, count]) => new docx.TableRow({
                               children: [
                                   new docx.TableCell({ children: [new docx.Paragraph(name)] }),
                                   new docx.TableCell({ children: [new docx.Paragraph(count.toString())] }),
                               ]
                           }))
                       ]
                  }),
                  new docx.Paragraph({ text: "" }),

                  new docx.Paragraph({ text: "Géneros más difundidos", bold: true, spacing: { before: 200 } }),
                   new docx.Table({
                       width: { size: 100, type: docx.WidthType.PERCENTAGE },
                       rows: [
                           new docx.TableRow({
                               children: ["Género", "Frecuencia"].map(t => new docx.TableCell({ children: [new docx.Paragraph({text: t, bold: true})]}))
                           }),
                           ...topGenres.map(([name, count]) => new docx.TableRow({
                               children: [
                                   new docx.TableCell({ children: [new docx.Paragraph(name)] }),
                                   new docx.TableCell({ children: [new docx.Paragraph(count.toString())] }),
                               ]
                           }))
                       ]
                  }),
              ]
          }]
      });

      docx.Packer.toBlob(doc).then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Reporte_Estadistico.docx`;
          a.click();
          window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        
        {/* SECTION 1: DATA ENTRY */}
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-6 text-primary">
                <span className="material-symbols-outlined text-3xl">playlist_add</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Ingreso de Datos</h2>
            </div>

            {/* Entry Controls */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Fecha</label>
                    <input 
                        type="date" 
                        value={entryDate} 
                        onChange={e => setEntryDate(e.target.value)}
                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Programa</label>
                    <select 
                        value={entryProgram} 
                        onChange={e => setEntryProgram(e.target.value)}
                        className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white appearance-none"
                    >
                        {PROGRAMS_LIST.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Manual Entry */}
            <div className="mb-6 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">edit_note</span> Manual (Tema por tema)
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <input placeholder="Título *" className="input-field" value={manualEntry.title} onChange={e => setManualEntry({...manualEntry, title: e.target.value})} />
                    <input placeholder="Género" className="input-field" value={manualEntry.genre} onChange={e => setManualEntry({...manualEntry, genre: e.target.value})} />
                    <input placeholder="Autor" className="input-field" value={manualEntry.author} onChange={e => setManualEntry({...manualEntry, author: e.target.value})} />
                    <input placeholder="País Autor" className="input-field" value={manualEntry.authorCountry} onChange={e => setManualEntry({...manualEntry, authorCountry: e.target.value})} />
                    <input placeholder="Intérprete" className="input-field" value={manualEntry.performer} onChange={e => setManualEntry({...manualEntry, performer: e.target.value})} />
                    <input placeholder="País Intérprete" className="input-field" value={manualEntry.performerCountry} onChange={e => setManualEntry({...manualEntry, performerCountry: e.target.value})} />
                </div>
                <button onClick={handleManualSubmit} className="w-full py-2 bg-azul-header text-white font-bold rounded-lg text-xs hover:bg-opacity-90 transition-colors">Agregar</button>
            </div>

            {/* TXT Entry */}
            <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-500 mb-2">Carga Masiva (TXT)</label>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm min-h-[150px] relative">
                    <textarea 
                        value={txtInput}
                        onChange={e => setTxtInput(e.target.value)}
                        className="w-full h-32 resize-none bg-transparent outline-none font-mono text-sm text-gray-800 dark:text-gray-200 relative z-10"
                    />
                    {!txtInput && (
                        <div className="absolute inset-4 z-0 pointer-events-none text-gray-300 font-mono text-sm leading-relaxed whitespace-pre-line select-none">
                            Título: <br/>Autor: <br/>País: <br/>Intérprete: <br/>País: <br/>Género: 
                        </div>
                    )}
                </div>
                <button onClick={handleTxtProcess} className="mt-2 w-full bg-primary text-white py-2 rounded-xl font-bold text-sm shadow-md hover:bg-primary-dark transition-colors">Procesar TXT</button>
            </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700 mb-8"/>

        {/* SECTION 2: REPORTS & EXPORTS */}
        <div>
            <div className="flex items-center gap-3 mb-6 text-green-700 dark:text-green-500">
                <span className="material-symbols-outlined text-3xl">summarize</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Informes y Base de Datos</h2>
            </div>

            <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                
                {/* Periodo */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Periodo</label>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <span className="text-[10px] text-gray-400">Desde</span>
                            <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                         </div>
                         <div>
                            <span className="text-[10px] text-gray-400">Hasta</span>
                            <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                         </div>
                    </div>
                </div>

                {/* Scope Selection */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Alcance</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="reportScope" 
                                checked={reportScope === 'program'} 
                                onChange={() => setReportScope('program')}
                                className="accent-primary"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Por Programa</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="reportScope" 
                                checked={reportScope === 'general'} 
                                onChange={() => setReportScope('general')}
                                className="accent-primary"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">General (Todos)</span>
                        </label>
                    </div>
                </div>

                {/* Program Selector (Conditional) */}
                {reportScope === 'program' && (
                    <div className="animate-fade-in">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Seleccionar Programa</label>
                        <select 
                            value={reportProgram} 
                            onChange={e => setReportProgram(e.target.value)}
                            className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 appearance-none"
                        >
                            {PROGRAMS_LIST.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={generateReport}
                        className="flex-1 bg-azul-header text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors"
                        title="Generar reporte estadístico en Word"
                    >
                        <span className="material-symbols-outlined">description</span>
                        Reporte (DOCX)
                    </button>
                    <button 
                        onClick={exportToCSV}
                        className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                        title="Exportar base de datos de producción a CSV (Excel)"
                    >
                        <span className="material-symbols-outlined">csv</span>
                        Base Datos (CSV)
                    </button>
                </div>
            </div>
        </div>

        <style>{`
            .input-field {
                width: 100%;
                padding: 8px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                font-size: 0.875rem;
                outline: none;
            }
            .dark .input-field {
                background-color: #27272a;
                border-color: #3f3f46;
                color: white;
            }
        `}</style>
    </div>
  );
};

export default Productions;
