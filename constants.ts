
import { Track } from "./types";

// Simulating the content of the "base de datos proporcionada desde la administración en formato txt"
// Format assumed: ID|FILENAME|PATH|TITLE|AUTHOR|PERFORMER|ALBUM|YEAR
export const INITIAL_DB_CONTENT = `
1|La Bayamesa.mp3|/Archivos/Patrimonio/Himnos|La Bayamesa|Céspedes, Castillo y Fornaris|Coro Profesional de Bayamo|Himnos de la Patria|1998
2|Songo_01_Master.wav|/archivo/radio_monumento/musica/cubana/|Songo 01||||
3|Guateque_Campesino_01.wav|/Archivos/Musica_Cubana/Tradicional|Guateque Campesino||||
4|Entrevista_Sindo_Garay_Restaurada.mp3|/Archivos/Historicos/Entrevistas|Entrevista a Sindo||Sindo Garay||
5|Son_de_la_Ma_Teodora.flac|/Archivos/Musica_Cubana/Origenes|Son de la Ma Teodora|Ginés Salomón|||
6|Longina_Manuel_Corona.mp3|/Archivos/Trova/Tradicional|Longina|Manuel Corona|María Teresa Vera|Veinte Años|1950
`;

export const parseTxtDatabase = (txt: string): Track[] => {
  const lines = txt.trim().split('\n');
  return lines.map((line, index) => {
    // Basic CSV/Pipe handling
    const parts = line.split('|');
    // Ensure we have enough parts, fill with empty strings if not
    const safeParts = [...parts, ...Array(8).fill('')];

    const [id, filename, path, title, author, performer, album, year] = safeParts;

    // Generate a temporary ID if missing, based on index or timestamp
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
