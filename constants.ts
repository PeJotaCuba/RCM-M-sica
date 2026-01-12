
import { Track } from "./types";

// Base de datos inicial vacía, esperando carga por Excel.
export const INITIAL_DB_CONTENT = ``;

export const parseTxtDatabase = (txt: string): Track[] => {
  if (!txt || txt.trim() === '') return [];
  
  const lines = txt.trim().split('\n');
  return lines.map((line, index) => {
    // Basic CSV/Pipe handling
    const parts = line.split('|');
    // Ensure we have enough parts, fill with empty strings if not
    const safeParts = [...parts, ...Array(8).fill('')];

    const [id, filename, path, title, author, performer, album, year] = safeParts;

    const safeId = id && id.trim() !== '' ? id : `import-${Date.now()}-${index}`;

    return {
      id: safeId,
      filename: filename || 'Archivo_Desconocido.mp3',
      path: path || '/ruta/desconocida',
      size: 'Unknown', 
      isVerified: !!(title && author && performer && album && year),
      metadata: {
        title: title || '',
        author: author || '',
        performer: performer || '',
        album: album || '',
        year: year || ''
      }
    };
  });
};
