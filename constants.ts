
import { Track } from "./types";

export const parseTxtDatabase = (text: string): Track[] => {
  const tracks: Track[] = [];
  // Normalizar saltos de línea y separar por líneas
  const normalizedText = text.replace(/\r\n/g, '\n');
  const lines = normalizedText.split('\n');
  
  let currentTitle = "";
  let currentAuthor = "";
  let currentAuthorCountry = "";
  let currentPerformer = "";
  let currentPerformerCountry = "";
  let currentGenre = "";
  let currentAlbum = "";
  let currentYear = "";

  const saveTrack = () => {
      if (currentTitle) {
          const cleanTitle = currentTitle.trim();
          // Normalizar ruta: Reemplazar backslash por slash y quitar slashes finales/iniciales
          let normalizedPath = (currentAlbum || 'Importado/Txt').replace(/\\/g, '/');
          normalizedPath = normalizedPath.replace(/\/+$/, '').replace(/^\/+/, '');

          tracks.push({
              id: `txt-${Date.now()}-${tracks.length}`,
              filename: `${cleanTitle}.mp3`,
              path: normalizedPath,
              size: '---',
              isVerified: true,
              metadata: {
                  title: cleanTitle,
                  author: currentAuthor,
                  authorCountry: currentAuthorCountry,
                  performer: currentPerformer,
                  performerCountry: currentPerformerCountry,
                  album: normalizedPath.split('/').pop() || 'Desconocido', // El nombre de la carpeta final
                  year: currentYear,
                  genre: currentGenre
              }
          });
      }
      // Reset
      currentTitle = "";
      currentAuthor = "";
      currentAuthorCountry = "";
      currentPerformer = "";
      currentPerformerCountry = "";
      currentGenre = "";
      currentAlbum = "";
      currentYear = "";
  };

  for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const lowerLine = line.toLowerCase();

      if (lowerLine.startsWith('título:') || lowerLine.startsWith('titulo:')) {
          if (currentTitle) saveTrack(); 
          currentTitle = line.substring(line.indexOf(':') + 1).trim();
      } 
      else if (lowerLine.startsWith('autor:') || lowerLine.startsWith('compositor:')) {
          currentAuthor = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('intérprete:') || lowerLine.startsWith('interprete:')) {
          currentPerformer = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('país:') || lowerLine.startsWith('pais:')) {
          const val = line.substring(line.indexOf(':') + 1).trim();
          if (currentPerformer && !currentPerformerCountry) {
              currentPerformerCountry = val;
          } 
          else if (currentAuthor && !currentAuthorCountry) {
              currentAuthorCountry = val;
          }
          else {
               if (!currentAuthorCountry) currentAuthorCountry = val;
               else currentPerformerCountry = val;
          }
      }
      else if (lowerLine.startsWith('país autor:')) {
          currentAuthorCountry = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('país intérprete:') || lowerLine.startsWith('pais intérprete:') || lowerLine.startsWith('pais interprete:')) {
          currentPerformerCountry = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('género:') || lowerLine.startsWith('genero:')) {
          currentGenre = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('álbum:') || lowerLine.startsWith('album:') || lowerLine.startsWith('carpeta:') || lowerLine.startsWith('ruta:')) {
          currentAlbum = line.substring(line.indexOf(':') + 1).trim();
      }
      else if (lowerLine.startsWith('año:') || lowerLine.startsWith('ano:') || lowerLine.startsWith('fecha:')) {
          currentYear = line.substring(line.indexOf(':') + 1).trim();
      }
  }

  saveTrack(); 

  return tracks;
};

// Base de datos inicial vacía para forzar actualización
export const INITIAL_DB_TXT = ``;
