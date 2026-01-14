
import { Track } from "./types";

/**
 * Parsea el contenido de los TXT.
 * Limpieza inteligente de rutas:
 * 1. Elimina IPs y recursos compartidos (\\10.12.5.2\Musica1\...)
 * 2. Elimina el nombre del archivo si aparece en la ruta.
 * 3. Prepone el contexto de la pestaña (Música X).
 */
export const parseTxtDatabase = (text: string, rootContext: string = 'Importado'): Track[] => {
  const tracks: Track[] = [];
  const normalizedText = text.replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  
  let currentTitle = "";
  let currentAuthor = "";
  let currentPerformer = "";
  let currentAlbum = ""; // Carpeta
  let currentOriginalPath = ""; // Ruta
  
  const saveTrack = () => {
      if (currentTitle) {
          const cleanTitle = currentTitle.trim();
          
          // --- LOGICA DE LIMPIEZA DE RUTA ---
          let rawPath = currentOriginalPath || currentAlbum || 'Desconocido';
          
          // 1. Normalizar barras
          let cleanSegment = rawPath.replace(/\\/g, '/'); 
          
          // 2. Eliminar letras de unidad (C:, D:)
          cleanSegment = cleanSegment.replace(/^[a-zA-Z]:/, '');
          
          // 3. Eliminar IPs o rutas de red (ej: //10.12.5.2/Musica1/...)
          // Busca patrón //IP/Share/ y lo quita, o simplemente el inicio de red
          cleanSegment = cleanSegment.replace(/^\/+\d+\.\d+\.\d+\.\d+(\/[^\/]+)?/, '');
          
          // 4. Eliminar el propio nombre de la "Raíz" si viene en el TXT (ej: eliminar "Musica1" si ya estamos en tab Música 1)
          // Esto ayuda a que empiece por "Cubana I" directamente.
          const rootSimple = rootContext.replace(/\s/g, '').toLowerCase(); // musica1
          const segmentLower = cleanSegment.toLowerCase();
          
          // Si la ruta empieza con /musica1/ o musica1/, lo quitamos
          // Intentamos ser flexibles con "Música 1", "Musica1", etc.
          const parts = cleanSegment.split('/').filter(p => p.trim() !== '');
          
          if (parts.length > 0) {
             const firstPart = parts[0].toLowerCase().replace(/\s/g, ''); // musica1
             // Comparar difuso (ignorar acentos básicos si es necesario, pero simple replace basta para este caso)
             if (firstPart.includes("musica") || firstPart === rootSimple) {
                 parts.shift(); // Quitamos el primer segmento (la carpeta raíz de red)
             }
          }
          
          // 5. Verificar si el último segmento es el mismo nombre del archivo .mp3 y quitarlo
          // A veces la ruta en el TXT incluye el archivo.
          if (parts.length > 0) {
              const lastPart = parts[parts.length - 1];
              if (lastPart.toLowerCase().endsWith('.mp3') || lastPart.toLowerCase() === cleanTitle.toLowerCase() + '.mp3') {
                  parts.pop();
              }
          }

          cleanSegment = parts.join('/');
          
          // 6. Construir ruta final: Música X / Resto
          const finalPath = `${rootContext}/${cleanSegment}`;

          tracks.push({
              id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filename: `${cleanTitle}.mp3`,
              path: finalPath, // Esto es SOLO la carpeta, sin el archivo
              size: '---',
              isVerified: true,
              metadata: {
                  title: cleanTitle,
                  author: currentAuthor || "Desconocido",
                  authorCountry: "", 
                  performer: currentPerformer || "Desconocido",
                  performerCountry: "",
                  album: currentAlbum || cleanSegment || "Desconocido", // Usar el segmento limpio como álbum si no hay dato
                  year: "", 
                  genre: ""
              }
          });
      }
      // Reset variables
      currentTitle = "";
      currentAuthor = "";
      currentPerformer = "";
      currentAlbum = "";
      currentOriginalPath = "";
  };

  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const lowerLine = line.toLowerCase();

      if (lowerLine.startsWith('archivo #') || lowerLine.startsWith('archivo n')) {
          if (currentTitle) saveTrack();
          continue;
      }

      if (lowerLine.startsWith('titulo:') || lowerLine.startsWith('título:')) {
          currentTitle = line.substring(line.indexOf(':') + 1).trim();
      } 
      else if (lowerLine.startsWith('compositor:') || lowerLine.startsWith('autor:')) {
          currentAuthor = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('interprete:') || lowerLine.startsWith('intérprete:')) {
          currentPerformer = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('carpeta:') || lowerLine.startsWith('album:')) {
          currentAlbum = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('ruta:')) {
          currentOriginalPath = line.substring(line.indexOf(':') + 1).trim();
      }
  }

  if (currentTitle) saveTrack(); 

  return tracks;
};

export const INITIAL_DB_TXT = ``;
