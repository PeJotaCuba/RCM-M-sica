
import { Track } from "./types";

/**
 * Parsea el contenido de los TXT.
 * Limpieza inteligente de rutas:
 * 1. Normaliza barras a /.
 * 2. Respeta la ruta del TXT para garantizar reproducción.
 * 3. Si no hay ruta, usa el contexto (Música X).
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
          // Prioridad: Ruta explícita -> Carpeta/Album -> Contexto
          let rawPath = currentOriginalPath || currentAlbum;
          
          let finalPath = "";

          if (rawPath) {
              // 1. Normalizar barras
              let cleanSegment = rawPath.replace(/\\/g, '/'); 
              
              // 2. Eliminar letras de unidad (C:, D:)
              cleanSegment = cleanSegment.replace(/^[a-zA-Z]:/, '');
              
              // 3. Eliminar IPs o rutas de red al inicio si es necesario, pero manteniendo estructura de carpetas
              // (Opcional: Si el usuario usa rutas relativas locales, esto ayuda a limpiar basura de red)
              cleanSegment = cleanSegment.replace(/^\/+\d+\.\d+\.\d+\.\d+(\/[^\/]+)?/, '');
              
              // 4. Limpieza de filename al final de la ruta si existe
              const parts = cleanSegment.split('/').filter(p => p.trim() !== '');
              if (parts.length > 0) {
                  const lastPart = parts[parts.length - 1];
                  if (lastPart.toLowerCase().endsWith('.mp3') || lastPart.toLowerCase() === cleanTitle.toLowerCase() + '.mp3') {
                      parts.pop();
                  }
              }

              // Reconstruir
              cleanSegment = parts.join('/');
              
              // Asegurar que no empiece con / para ser relativa limpia
              finalPath = cleanSegment.replace(/^\//, '');
          } else {
              // Fallback si no hay ruta en el TXT: Usar contexto
              finalPath = `${rootContext}/Desconocido`;
          }

          tracks.push({
              id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filename: `${cleanTitle}.mp3`,
              path: finalPath, // Ruta exacta normalizada
              size: '---',
              isVerified: true,
              metadata: {
                  title: cleanTitle,
                  author: currentAuthor || "Desconocido",
                  authorCountry: "", 
                  performer: currentPerformer || "Desconocido",
                  performerCountry: "",
                  album: currentAlbum || (finalPath.split('/').pop() || "Desconocido"), 
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
