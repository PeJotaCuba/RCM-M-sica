
import React, { useState } from 'react';
import { Track, PROGRAMS_LIST } from '../types';
import { parseTxtDatabase } from '../constants';
import { extractTextFromPDF } from '../services/pdfService';
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
  
  const [manualEntry, setManualEntry] = useState({
      title: '', author: '', authorCountry: '', performer: '', performerCountry: '', genre: ''
  });

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Track[]>([]);

  // Report State
  const [reportStartDate, setReportStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportProgram, setReportProgram] = useState(PROGRAMS_LIST[0]);
  const [reportScope, setReportScope] = useState<'general' | 'program'>('program');

  // --- AUTOCOMPLETE LOGIC ---
  const handleInputChange = (field: keyof typeof manualEntry, value: string) => {
      setManualEntry(prev => ({ ...prev, [field]: value }));
      
      if (field === 'title' && value.length > 2) {
          const lowerVal = value.toLowerCase();
          const matches = allTracks.filter(t => t.metadata.title.toLowerCase().includes(lowerVal)).slice(0, 5);
          setSuggestions(matches);
      } else {
          setSuggestions([]);
      }
  };

  const selectSuggestion = (track: Track) => {
      setManualEntry({
          title: track.metadata.title,
          author: track.metadata.author,
          authorCountry: track.metadata.authorCountry || '',
          performer: track.metadata.performer,
          performerCountry: track.metadata.performerCountry || '',
          genre: track.metadata.genre || ''
      });
      setSuggestions([]);
  };

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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      
      setPdfProcessing(true);
      try {
          const text = await extractTextFromPDF(file);
          const tracks = parseTxtDatabase(text); // Reusamos el parser de texto ya que el PDF se convierte a string
          
          if (tracks.length === 0) {
              alert("No se detectaron pistas válidas en el PDF.");
          } else {
              const tracksWithContext = tracks.map(t => ({
                  ...t,
                  metadata: {
                      ...t.metadata,
                      album: `Producción: ${entryProgram} (${entryDate})`
                  }
              }));
              onAddTracks(tracksWithContext);
              alert(`${tracks.length} pistas extraídas del PDF.`);
          }
      } catch (err) {
          alert("Error leyendo el PDF.");
      } finally {
          setPdfProcessing(false);
          e.target.value = ''; // Reset input
      }
  };

  // ... (Reports Logic remains similar) ...
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

  const generateReport = async () => {
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
                    <label className="block text-xs font-bold text-gray-500 mb-1">Fecha</label>
                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Programa</label>
                    <select value={entryProgram} onChange={e => setEntryProgram(e.target.value)} className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white appearance-none">
                        {PROGRAMS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {/* Manual Entry with Autocomplete */}
            <div className="mb-6 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">edit_note</span> Manual (Tema por tema)
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="relative">
                        <input placeholder="Título *" className="input-field" value={manualEntry.title} onChange={e => handleInputChange('title', e.target.value)} />
                        {suggestions.length > 0 && (
                            <div className="absolute top-full left-0 w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                                {suggestions.map(s => (
                                    <div key={s.id} onClick={() => selectSuggestion(s)} className="p-2 text-xs hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer">
                                        <strong>{s.metadata.title}</strong> - {s.metadata.performer}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <input placeholder="Género" className="input-field" value={manualEntry.genre} onChange={e => handleInputChange('genre', e.target.value)} />
                    <input placeholder="Autor" className="input-field" value={manualEntry.author} onChange={e => handleInputChange('author', e.target.value)} />
                    <input placeholder="País Autor" className="input-field" value={manualEntry.authorCountry} onChange={e => handleInputChange('authorCountry', e.target.value)} />
                    <input placeholder="Intérprete" className="input-field" value={manualEntry.performer} onChange={e => handleInputChange('performer', e.target.value)} />
                    <input placeholder="País Intérprete" className="input-field" value={manualEntry.performerCountry} onChange={e => handleInputChange('performerCountry', e.target.value)} />
                </div>
                <button onClick={handleManualSubmit} className="w-full py-2 bg-azul-header text-white font-bold rounded-lg text-xs hover:bg-opacity-90 transition-colors">Agregar</button>
            </div>

            {/* PDF Entry */}
            <div className="flex flex-col">
                <label className="block text-xs font-bold text-gray-500 mb-2">Carga Masiva (PDF)</label>
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex items-center justify-center border-dashed border-2">
                    {pdfProcessing ? (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-gray-500">Procesando PDF...</span>
                        </div>
                    ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 group">
                            <span className="material-symbols-outlined text-4xl text-gray-300 group-hover:text-primary transition-colors">picture_as_pdf</span>
                            <span className="text-sm font-bold text-gray-500 group-hover:text-primary">Seleccionar Archivo PDF</span>
                            <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                        </label>
                    )}
                </div>
            </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-700 mb-8"/>

        {/* REPORTS */}
        <div>
            <div className="flex items-center gap-3 mb-6 text-green-700 dark:text-green-500">
                <span className="material-symbols-outlined text-3xl">summarize</span>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Informes y Base de Datos</h2>
            </div>
             <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Periodo</label>
                    <div className="grid grid-cols-2 gap-4">
                         <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                         <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900"/>
                    </div>
                </div>
                 <div className="flex gap-3 mt-4">
                    <button onClick={generateReport} className="flex-1 bg-azul-header text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors">
                        <span className="material-symbols-outlined">description</span> Reporte (DOCX)
                    </button>
                    <button onClick={exportToCSV} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">
                        <span className="material-symbols-outlined">csv</span> Base Datos (CSV)
                    </button>
                </div>
            </div>
        </div>

        <style>{`
            .input-field { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #e5e7eb; font-size: 0.875rem; outline: none; }
            .dark .input-field { background-color: #27272a; border-color: #3f3f46; color: white; }
        `}</style>
    </div>
  );
};

export default Productions;
