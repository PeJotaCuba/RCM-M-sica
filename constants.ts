
import { Track } from "./types";

/**
 * Parsea el contenido de los TXT y asigna la ruta basándose en el "rootContext" (Música 1, Música 2...).
 * Formato esperado en TXT:
 * Archivo #...
 * Titulo: ...
 * Compositor: ... (o Autor)
 * Interprete: ...
 * Carpeta: ...
 * Ruta: ...
 */
export const parseTxtDatabase = (text: string, rootContext: string = 'Importado'): Track[] => {
  const tracks: Track[] = [];
  // Normalizar saltos de línea
  const normalizedText = text.replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  
  let currentTitle = "";
  let currentAuthor = "";
  let currentPerformer = "";
  let currentAlbum = ""; // Mapped from "Carpeta"
  let currentOriginalPath = ""; // Mapped from "Ruta"
  
  const saveTrack = () => {
      if (currentTitle) {
          const cleanTitle = currentTitle.trim();
          
          // Lógica de Ruta:
          // 1. Tomamos "Ruta" del TXT o "Carpeta" si Ruta no existe.
          // 2. Limpiamos letras de unidad (D:\...)
          // 3. Preponemos el rootContext (Ej: "Música 1")
          
          let rawPathSegment = currentOriginalPath || currentAlbum || 'Desconocido';
          
          // Limpieza básica de la ruta original del TXT
          let cleanSegment = rawPathSegment.replace(/\\/g, '/'); // Backslash a Slash
          cleanSegment = cleanSegment.replace(/^[a-zA-Z]:/, ''); // Quitar C: D:
          cleanSegment = cleanSegment.replace(/\/+$/, '').replace(/^\/+/, ''); // Trim slashes
          
          // Si la ruta original ya incluye el rootContext, tratamos de no duplicarlo, 
          // pero asumiremos que el usuario carga en la pestaña correcta.
          // Forzamos la estructura: Música X / Ruta del Txt
          const finalPath = `${rootContext}/${cleanSegment}`;

          tracks.push({
              id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filename: `${cleanTitle}.mp3`,
              path: finalPath,
              size: '---',
              isVerified: true,
              metadata: {
                  title: cleanTitle,
                  author: currentAuthor || "Desconocido",
                  authorCountry: "", // El formato TXT dado no especifica país explícito, se deja vacío
                  performer: currentPerformer || "Desconocido",
                  performerCountry: "",
                  album: currentAlbum || "Desconocido",
                  year: "", // El formato dado no tiene año
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

      // Detección de nuevo bloque (Archivo #)
      if (lowerLine.startsWith('archivo #') || lowerLine.startsWith('archivo n')) {
          // Si ya teníamos datos acumulados, guardamos el anterior
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

  // Guardar el último track si quedó pendiente
  if (currentTitle) saveTrack(); 

  return tracks;
};

export const INITIAL_DB_TXT = ``;
