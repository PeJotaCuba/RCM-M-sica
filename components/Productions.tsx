
import React, { useState } from 'react';
import { Track, PROGRAMS_LIST } from '../types';
import { parseTxtDatabase } from '../constants';
import * as docx from 'docx';

interface ProductionsProps {
  onAddTracks: (tracks: Track[]) => void;
  allTracks?: Track[];
}

const Productions: React.FC<ProductionsProps> = ({ onAddTracks, allTracks = [] }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [program, setProgram] = useState(PROGRAMS_LIST[0]);
  const [txtInput, setTxtInput] = useState('');
  const [manualEntry, setManualEntry] = useState({
      title: '', author: '', authorCountry: '', performer: '', performerCountry: '', genre: ''
  });

  const handleManualSubmit = () => {
      if (!manualEntry.title) return alert("El título es obligatorio");
      
      const newTrack: Track = {
          id: `man-${Date.now()}`,
          filename: `${manualEntry.title}.mp3`,
          path: `Producción: ${program}`,
          size: '---',
          isVerified: true,
          metadata: {
              title: manualEntry.title,
              author: manualEntry.author,
              authorCountry: manualEntry.authorCountry,
              performer: manualEntry.performer,
              performerCountry: manualEntry.performerCountry,
              genre: manualEntry.genre,
              album: `Producción: ${program} (${date})`,
              year: date.split('-')[0]
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
              album: t.metadata.album && t.metadata.album !== 'Carpeta General' ? t.metadata.album : `Producción: ${program} (${date})`
          }
      }));

      onAddTracks(tracksWithContext);
      setTxtInput('');
      alert("Pistas enviadas a la base de datos.");
  };

  const generateReport = async () => {
      // Filter tracks for this program and date (or just program if user wants broad stats, but usually date specific)
      // Heuristic: Filter by Album name which we set as "Producción: Program (Date)" OR allow filtering just by program if needed.
      // Let's filter by Date AND Program from the metadata we just injected.
      
      const targetAlbum = `Producción: ${program} (${date})`;
      // Also include loose matches if possible, or just strict.
      
      const reportTracks = allTracks.filter(t => t.metadata.album === targetAlbum);
      
      if (reportTracks.length === 0) {
          alert("No hay datos guardados para esta fecha y programa para generar el reporte.");
          return;
      }

      // Calculate Stats
      const totalWorks = reportTracks.length;
      
      // Zone Stats (Simplified: Cuba vs Extranjera)
      const cubaCount = reportTracks.filter(t => 
          (t.metadata.authorCountry && t.metadata.authorCountry.toLowerCase().includes('cuba')) || 
          (t.metadata.performerCountry && t.metadata.performerCountry.toLowerCase().includes('cuba'))
      ).length;
      const foreignCount = totalWorks - cubaCount;

      // Top Counts
      const getTop = (key: 'title' | 'author' | 'performer' | 'genre', limit = 5) => {
          const counts: Record<string, number> = {};
          reportTracks.forEach(t => {
              const val = t.metadata[key];
              if (val && val !== 'Desconocido') counts[val] = (counts[val] || 0) + 1;
          });
          return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, limit);
      };

      const topWorks = getTop('title');
      const topAuthors = getTop('author');
      const topPerformers = getTop('performer');
      const topGenres = getTop('genre');

      // Create Document
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
                      text: `Emisora: RADIO CIUDAD MONUMENTO | Programa: ${program} | Fecha: ${date}`,
                      heading: docx.HeadingLevel.HEADING_3,
                      spacing: { after: 200 }
                  }),

                  // Table 1: Zonas
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
                                  new docx.TableCell({ children: [new docx.Paragraph(((cubaCount/totalWorks)*100).toFixed(1) + "%")] }),
                              ]
                          }),
                          new docx.TableRow({
                              children: [
                                  new docx.TableCell({ children: [new docx.Paragraph("Extranjera")] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(foreignCount.toString())] }),
                                  new docx.TableCell({ children: [new docx.Paragraph(((foreignCount/totalWorks)*100).toFixed(1) + "%")] }),
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
                  new docx.Paragraph({ text: "" }), // Spacer

                  // Table 2: Most Diffused Works
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

                   // Table 3: Authors
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

                  // Table 4: Genres
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
          a.download = `Reporte_${program.replace(/\s+/g, '_')}_${date}.docx`;
          a.click();
          window.URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark p-6 overflow-y-auto pb-24">
        <div className="flex items-center gap-3 mb-6 text-primary">
            <span className="material-symbols-outlined text-3xl">playlist_add</span>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hoja de Producción</h2>
        </div>

        {/* Top Controls */}
        <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Fecha de Emisión</label>
                <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white"
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Programa</label>
                <select 
                    value={program} 
                    onChange={e => setProgram(e.target.value)}
                    className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-800 dark:text-white appearance-none"
                >
                    {PROGRAMS_LIST.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Manual Entry Form */}
        <div className="mb-6 bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">edit_note</span> Agregar Tema Individual
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <input placeholder="Título *" className="input-field" value={manualEntry.title} onChange={e => setManualEntry({...manualEntry, title: e.target.value})} />
                <input placeholder="Género" className="input-field" value={manualEntry.genre} onChange={e => setManualEntry({...manualEntry, genre: e.target.value})} />
                <input placeholder="Autor" className="input-field" value={manualEntry.author} onChange={e => setManualEntry({...manualEntry, author: e.target.value})} />
                <input placeholder="País Autor" className="input-field" value={manualEntry.authorCountry} onChange={e => setManualEntry({...manualEntry, authorCountry: e.target.value})} />
                <input placeholder="Intérprete" className="input-field" value={manualEntry.performer} onChange={e => setManualEntry({...manualEntry, performer: e.target.value})} />
                <input placeholder="País Intérprete" className="input-field" value={manualEntry.performerCountry} onChange={e => setManualEntry({...manualEntry, performerCountry: e.target.value})} />
            </div>
            <button 
                onClick={handleManualSubmit}
                className="w-full py-2 bg-azul-header text-white font-bold rounded-lg text-xs hover:bg-opacity-90 transition-colors"
            >
                Agregar a la Lista
            </button>
        </div>

        {/* TXT Input Area */}
        <div className="flex-1 flex flex-col mb-4">
            <label className="block text-xs font-bold text-gray-500 mb-2">Carga Masiva (Formato TXT)</label>
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex-1 flex flex-col min-h-[200px]">
                <textarea 
                    value={txtInput}
                    onChange={e => setTxtInput(e.target.value)}
                    className="w-full flex-1 resize-none bg-transparent outline-none font-mono text-sm text-gray-800 dark:text-gray-200 placeholder-gray-300"
                    placeholder="Pegue aquí el bloque de texto..."
                />
            </div>
            <button 
                onClick={handleTxtProcess}
                className="mt-4 w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors"
            >
                <span className="material-symbols-outlined">upload_file</span>
                Procesar TXT
            </button>
        </div>

        {/* Generate Report */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
             <button 
                onClick={generateReport}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
            >
                <span className="material-symbols-outlined">description</span>
                Generar Informe (DOCX)
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">Genera tabla estadística basada en los temas guardados para esta fecha y programa.</p>
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
