
import { Track } from "./types";

// Base de datos inicial vacía
export const INITIAL_DB_CONTENT = ``;

export const parseTxtDatabase = (txt: string): Track[] => {
  if (!txt || txt.trim() === '') return [];

  // Limpiar BOM (Byte Order Mark) si existe al principio del archivo para evitar errores en la primera línea
  const cleanTxt = txt.replace(/^\uFEFF/, '');
  
  const lines = cleanTxt.split('\n');
  const tracks: Track[] = [];
  
  let currentTrack: Partial<Track> = { metadata: { title: '', author: '', performer: '', album: '', year: '' } };
  let hasData = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Detectar separadores: líneas vacías o líneas de guiones
    if (!trimmed || trimmed.startsWith('-----')) {
        // Si tenemos datos acumulados, guardamos la pista
        if (hasData && (currentTrack.metadata?.title || currentTrack.filename)) {
            tracks.push(finalizeTrack(currentTrack, tracks.length));
            // Reiniciar para la siguiente pista
            currentTrack = { metadata: { title: '', author: '', performer: '', album: '', year: '' } };
            hasData = false;
        }
        return;
    }

    // Key: Value parsing
    // Normalizamos a minúsculas para comparar keys
    const lowerLine = trimmed.toLowerCase();

    if (lowerLine.startsWith('título:')) {
        currentTrack.metadata!.title = trimmed.substring(7).trim();
        hasData = true;
    } else if (lowerLine.startsWith('compositor:') || lowerLine.startsWith('autor:')) {
        currentTrack.metadata!.author = trimmed.split(':')[1].trim();
    } else if (lowerLine.startsWith('intérprete:')) {
        currentTrack.metadata!.performer = trimmed.split(':')[1].trim();
    } else if (lowerLine.startsWith('carpeta:')) {
        currentTrack.metadata!.album = trimmed.split(':')[1].trim();
    } else if (lowerLine.startsWith('ruta:')) {
        currentTrack.path = trimmed.split(':')[1].trim();
        // Intentar extraer nombre de archivo de la ruta si no hay título
        if (!currentTrack.metadata?.title) {
             const parts = currentTrack.path?.split(/[\\/]/);
             if (parts) currentTrack.filename = parts[parts.length - 1];
        }
    } else if (lowerLine.startsWith('país:') || lowerLine.startsWith('pais:')) {
        if (currentTrack.metadata!.performer) {
            currentTrack.metadata!.performerCountry = trimmed.split(':')[1].trim();
        } else {
             currentTrack.metadata!.authorCountry = trimmed.split(':')[1].trim();
        }
    } else if (lowerLine.startsWith('género:') || lowerLine.startsWith('genero:')) {
        currentTrack.metadata!.genre = trimmed.split(':')[1].trim();
    }
  });

  // Asegurar que la última pista se guarde si no termina con separador
  if (hasData && (currentTrack.metadata?.title || currentTrack.filename)) {
      tracks.push(finalizeTrack(currentTrack, tracks.length));
  }

  return tracks;
};

const finalizeTrack = (partial: Partial<Track>, index: number): Track => {
    const title = partial.metadata?.title || "Desconocido";
    
    // Generar nombre de archivo si no vino en la ruta
    let filename = partial.filename;
    if (!filename && partial.path) {
        const parts = partial.path.split(/[\\/]/);
        filename = parts[parts.length - 1];
    }
    if (!filename) {
        filename = `${title}.mp3`;
    }

    const path = partial.path || partial.metadata?.album || "/Importado/Txt";

    return {
        id: `txt-${Date.now()}-${index}`,
        filename: filename,
        path: path,
        size: '---',
        isVerified: true, 
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
