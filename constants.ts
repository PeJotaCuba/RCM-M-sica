
import { Track } from "./types";

/**
 * Parsea el contenido de los TXT con lógica robusta para rutas.
 * 
 * MEJORAS CRÍTICAS:
 * 1. Forzado de Raíz: Si cargamos en "Música 3", y el TXT dice "Ruta: D:\Salsa", 
 *    la ruta final será "Música 3/Salsa". Esto asegura que el archivo SEA VISIBLE.
 * 2. Limpieza de basura: Elimina letras de unidad (C:, D:) y caracteres extraños.
 * 3. Detección flexible: Reconoce "Titulo:", "Título:", "TITULO", etc.
 */
export const parseTxtDatabase = (text: string, rootContext: string = 'Importado'): Track[] => {
  const tracks: Track[] = [];
  
  // Normalizar saltos de línea y limpiar caracteres invisibles al inicio (BOM)
  const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');
  
  // Variables temporales para el track actual
  let currentTitle = "";
  let currentAuthor = "";
  let currentPerformer = "";
  let currentGenre = "";
  let currentAlbum = "";       // Mapea a 'Carpeta'
  let currentOriginalPath = ""; // Mapea a 'Ruta'
  
  // Función auxiliar para normalizar cadenas (quitar acentos y lowercase) para comparaciones
  const normalizeKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const saveTrack = () => {
      if (currentTitle) {
          const cleanTitle = currentTitle.trim();
          
          // --- LÓGICA CRÍTICA DE RUTA ---
          // 1. Determinar qué ruta usar (Ruta tiene prioridad sobre Carpeta/Album)
          let rawPath = currentOriginalPath || currentAlbum;
          
          let finalPath = "";

          if (rawPath) {
              // Limpiar barras invertidas de Windows
              let cleanSegment = rawPath.replace(/\\/g, '/');
              
              // Eliminar letra de unidad (ej: "D:", "C:")
              cleanSegment = cleanSegment.replace(/^[a-zA-Z]:/, '');
              
              // Eliminar slashes iniciales múltiples
              cleanSegment = cleanSegment.replace(/^[\/\s]+/, '');

              // Eliminar el nombre del archivo si está incluido al final de la ruta
              // (Detecta si el final de la ruta se parece al título + .mp3)
              const parts = cleanSegment.split('/');
              if (parts.length > 0) {
                  const lastPart = parts[parts.length - 1];
                  if (lastPart.toLowerCase().endsWith('.mp3') || lastPart.toLowerCase().includes(cleanTitle.toLowerCase())) {
                      parts.pop(); // Quitamos el nombre del archivo para dejar solo la carpeta
                  }
              }
              cleanSegment = parts.join('/');

              // --- FORZADO DE CONTEXTO (Música 1, Música 3, etc.) ---
              // Verificamos si la ruta extraída YA empieza con el rootContext (ej. "Música 3")
              const normalizedContext = normalizeKey(rootContext);
              const normalizedSegment = normalizeKey(cleanSegment);

              if (normalizedSegment.startsWith(normalizedContext)) {
                  // Si ya tiene "Música 3/Salsa", lo dejamos tal cual (respetando mayúsculas originales si es posible)
                  finalPath = cleanSegment;
              } else {
                  // Si no tiene el contexto, LO PREFIJAMOS.
                  // Ej: "Salsa/Casino" -> "Música 3/Salsa/Casino"
                  // Esto garantiza que aparezca en la pestaña correcta.
                  finalPath = `${rootContext}/${cleanSegment}`;
              }
          } else {
              // Si no hay ruta ni carpeta, lo metemos en una genérica dentro del contexto
              finalPath = `${rootContext}/Desconocido`;
          }

          // Limpieza final de ruta: quitar slashes dobles y espacios en los bordes de los segmentos
          finalPath = finalPath.split('/').map(p => p.trim()).filter(p => p).join('/');

          tracks.push({
              id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              filename: `${cleanTitle}.mp3`,
              path: finalPath,
              size: '---',
              isVerified: true,
              metadata: {
                  title: cleanTitle,
                  author: currentAuthor || "Desconocido",
                  authorCountry: "", 
                  performer: currentPerformer || "Desconocido",
                  performerCountry: "",
                  album: currentAlbum || (finalPath.split('/').pop() || "Carpeta General"), 
                  year: "", 
                  genre: currentGenre || ""
              }
          });
      }
      // Reset variables para el siguiente track
      currentTitle = "";
      currentAuthor = "";
      currentPerformer = "";
      currentGenre = "";
      currentAlbum = "";
      currentOriginalPath = "";
  };

  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const lowerLine = normalizeKey(line);

      // Detectar inicio de nuevo registro
      if (lowerLine.startsWith('archivo #') || lowerLine.startsWith('archivo n')) {
          // Si ya teníamos datos capturados, guardamos el anterior antes de empezar el nuevo
          saveTrack(); 
          continue;
      }

      // Extracción de campos (Flexible con los dos puntos y espacios)
      if (lowerLine.startsWith('titulo')) {
          currentTitle = line.substring(line.indexOf(':') + 1).trim();
      } 
      else if (lowerLine.startsWith('compositor') || lowerLine.startsWith('autor')) {
          currentAuthor = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('interprete')) {
          currentPerformer = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('genero')) {
          currentGenre = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('carpeta') || lowerLine.startsWith('album')) {
          currentAlbum = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('ruta')) {
          currentOriginalPath = line.substring(line.indexOf(':') + 1).trim();
      }
  }

  // Guardar el último track procesado al terminar el archivo
  saveTrack(); 

  return tracks;
};

export const INITIAL_DB_TXT = ``;
