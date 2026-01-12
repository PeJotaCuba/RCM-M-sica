
import { Track } from "./types";

// Base de datos inicial vacía
export const INITIAL_DB_CONTENT = ``;

export const parseTxtDatabase = (txt: string): Track[] => {
  if (!txt || txt.trim() === '') return [];

  const lines = txt.split('\n');
  const tracks: Track[] = [];
  
  let currentTrack: Partial<Track> = { metadata: { title: '', author: '', performer: '', album: '', year: '' } };
  let hasData = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
        // Empty line usually separates blocks, save if we have data
        if (hasData && currentTrack.metadata?.title) {
            tracks.push(finalizeTrack(currentTrack, index));
            currentTrack = { metadata: { title: '', author: '', performer: '', album: '', year: '' } };
            hasData = false;
        }
        return;
    }

    // Key: Value parsing
    // Format 1 (General): Título, Compositor, Intérprete, Carpeta, Ruta
    // Format 2 (Producciones): Título, Autor, País, Intérprete, País, Género
    
    if (trimmed.toLowerCase().startsWith('título:')) {
        currentTrack.metadata!.title = trimmed.substring(7).trim();
        hasData = true;
    } else if (trimmed.toLowerCase().startsWith('compositor:') || trimmed.toLowerCase().startsWith('autor:')) {
        currentTrack.metadata!.author = trimmed.split(':')[1].trim();
    } else if (trimmed.toLowerCase().startsWith('intérprete:')) {
        currentTrack.metadata!.performer = trimmed.split(':')[1].trim();
    } else if (trimmed.toLowerCase().startsWith('carpeta:')) {
        currentTrack.metadata!.album = trimmed.split(':')[1].trim(); // Map Carpeta to Album/Group
    } else if (trimmed.toLowerCase().startsWith('ruta:')) {
        currentTrack.path = trimmed.split(':')[1].trim();
    } else if (trimmed.toLowerCase().startsWith('país:') || trimmed.toLowerCase().startsWith('pais:')) {
        // Heuristic: If author is filled but performer isn't, assign country to author. Else to performer.
        // Or strictly follow order. Assuming standard block order.
        if (currentTrack.metadata!.performer) {
            currentTrack.metadata!.performerCountry = trimmed.split(':')[1].trim();
        } else {
             currentTrack.metadata!.authorCountry = trimmed.split(':')[1].trim();
        }
    } else if (trimmed.toLowerCase().startsWith('género:') || trimmed.toLowerCase().startsWith('genero:')) {
        currentTrack.metadata!.genre = trimmed.split(':')[1].trim();
    }
  });

  // Push last track if exists
  if (hasData && currentTrack.metadata?.title) {
      tracks.push(finalizeTrack(currentTrack, lines.length));
  }

  return tracks;
};

const finalizeTrack = (partial: Partial<Track>, index: number): Track => {
    const title = partial.metadata?.title || "Desconocido";
    // If no path/filename provided, generate dummy ones based on title
    const filename = partial.filename || `${title}.mp3`;
    const path = partial.path || partial.metadata?.album || "/Importado/Txt";

    return {
        id: `txt-${Date.now()}-${index}`,
        filename: filename,
        path: path,
        size: '---',
        isVerified: true, // Manually imported via TXT usually implies verified info
        metadata: {
            title: title,
            author: partial.metadata?.author || "",
            authorCountry: partial.metadata?.authorCountry || "",
            performer: partial.metadata?.performer || "",
            performerCountry: partial.metadata?.performerCountry || "",
            album: partial.metadata?.album || "Carpeta General",
            year: partial.metadata?.year || "",
            genre: partial.metadata?.genre || ""
        }
    };
}
