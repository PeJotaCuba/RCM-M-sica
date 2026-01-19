
import { Track } from "./types";

/**
 * Parsea el contenido de los TXT con lógica robusta para rutas de red y locales.
 * 
 * LÓGICA ACTUALIZADA:
 * 1. Normaliza barras a '/'.
 * 2. Elimina prefijos de red (\\IP\ o //IP/).
 * 3. Elimina letras de unidad (C:, D:).
 * 4. "Aterriza" la ruta: Si estamos en la pestaña "Música 3" y la ruta trae "Musica3/Afrocubana",
 *    elimina el "Musica3" redundante para que visualmente empiece en "Afrocubana".
 * 5. Reconstruye la ruta final como: "Música 3/Afrocubana/...".
 */
export const parseTxtDatabase = (text: string, rootContext: string = 'Importado'): Track[] => {
  const tracks: Track[] = [];
  
  // Limpieza inicial del texto
  const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n');
  
  // Variables temporales
  let currentTitle = "";
  let currentAuthor = "";
  let currentPerformer = "";
  let currentGenre = "";
  let currentAlbum = "";       // Mapea a 'Carpeta'
  let currentOriginalPath = ""; // Mapea a 'Ruta'
  
  const normalizeKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Variaciones comunes de los nombres de carpeta raíz para detectarlos y eliminarlos de la ruta visual
  // Ej: Si el contexto es "Música 3", queremos borrar "Musica3", "Musica 3", "Música3" del inicio de la ruta física.
  const getRootVariations = (ctx: string) => {
      const norm = normalizeKey(ctx); // musica 3
      const noSpace = norm.replace(/\s+/g, ''); // musica3
      return [norm, noSpace];
  };

  const saveTrack = () => {
      if (currentTitle) {
          const cleanTitle = currentTitle.trim();
          
          // 1. Obtener ruta cruda (Prioridad: Ruta > Carpeta)
          let rawPath = currentOriginalPath || currentAlbum;
          let finalPath = "";

          if (rawPath) {
              // A. Normalizar barras
              let cleanSegment = rawPath.replace(/\\/g, '/');
              
              // B. Eliminar prefijos de red (UNC) -> \\10.12.5.2\ o //10.12.5.2/
              // Regex busca // o \\ seguido de caracteres que no son barras, seguido de una barra
              cleanSegment = cleanSegment.replace(/^[\/\\]{2}[^\/\\]+[\/\\]/, '');

              // C. Eliminar letra de unidad (C:, D:)
              cleanSegment = cleanSegment.replace(/^[a-zA-Z]:/, '');
              
              // D. Eliminar slashes iniciales residuales
              cleanSegment = cleanSegment.replace(/^[\/\s]+/, '');

              // E. Limpieza de Nombre de Archivo al final
              // Si la ruta termina con el nombre del archivo (ej: .../cancion.mp3), lo quitamos para dejar solo la carpeta
              const parts = cleanSegment.split('/');
              if (parts.length > 0) {
                  const lastPart = parts[parts.length - 1];
                  const lowerLast = lastPart.toLowerCase();
                  if (lowerLast.endsWith('.mp3') || lowerLast.endsWith('.wav') || lowerLast.includes(cleanTitle.toLowerCase())) {
                      parts.pop(); 
                  }
              }
              cleanSegment = parts.join('/');

              // F. LÓGICA DE NIVEL 3 (Eliminar carpeta raíz redundante)
              // Si rootContext es "Música 3", y cleanSegment es "Musica3/Afrocubana/...",
              // queremos que quede solo "Afrocubana/...".
              // Luego le anteponemos el rootContext oficial.
              
              const variations = getRootVariations(rootContext);
              // Buscamos si el primer segmento de la ruta coincide con alguna variación de la raíz
              const firstSlashIndex = cleanSegment.indexOf('/');
              
              let pathBody = cleanSegment; // Por defecto todo
              
              if (firstSlashIndex !== -1) {
                  const firstSegment = cleanSegment.substring(0, firstSlashIndex);
                  const normFirst = normalizeKey(firstSegment);
                  
                  // Si el primer segmento es "Musica3" (o similar), lo cortamos.
                  if (variations.includes(normFirst)) {
                      pathBody = cleanSegment.substring(firstSlashIndex + 1);
                  }
              } else {
                  // Caso borde: la ruta es solo "Musica3"
                  if (variations.includes(normalizeKey(cleanSegment))) {
                      pathBody = ""; // Es la raíz misma
                  }
              }

              // G. Construcción Final
              // Siempre forzamos el rootContext al inicio para que el sistema de pestañas lo reconozca.
              // Resultado: "Música 3/Afrocubana/..."
              if (pathBody.trim()) {
                  finalPath = `${rootContext}/${pathBody}`;
              } else {
                  finalPath = rootContext; // Está en la raíz de la pestaña
              }

          } else {
              finalPath = `${rootContext}/Desconocido`;
          }

          // Limpieza final cosmética
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
      
      // Reset
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

      if (lowerLine.startsWith('archivo #') || lowerLine.startsWith('archivo n')) {
          saveTrack(); 
          continue;
      }

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
  saveTrack(); 

  return tracks;
};

export const INITIAL_DB_TXT = ``;
