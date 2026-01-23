
import { Track } from "./types";

export const GENRES_LIST = [
    "Afrobeats", "Axé", "Bachata", "Bhangra", "Blues", "Bolero", "Bossa nova", "Canción popular", "Chachachá", 
    "Clásica", "Country", "C-Pop", "Cumbia", "Danzón", "Fado", "Flamenco", "Folk", "Forró", "Funk", "Gospel", 
    "Highlife", "Hip-Hop/Rap", "Indie/Alternativo", "J-Pop", "Jazz", "K-Pop", "Mambo", "Mbaqanga", "Merengue", 
    "Metal", "Música árabe", "Música electrónica", "Música india (clásica)", "Ópera", "Pop", "Punk", 
    "R&B (Rhythm & Blues)", "Raï", "Reggae", "Reguetón", "Rock", "Salsa", "Samba", "Ska", "Soul", "Son", 
    "Tango", "Timba", "Trova", "World Music"
];

export const COUNTRIES_LIST = [
    "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyán", "Bahamas", "Bangladés", "Barbados", "Baréin", "Bélgica", "Belice", "Benín", "Bielorrusia", "Birmania", "Bolivia", "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Bután", "Cabo Verde", "Camboya", "Camerún", "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Ciudad del Vaticano", "Colombia", "Comoras", "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba", "Dinamarca", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía", "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guyana", "Guinea", "Guinea ecuatorial", "Guinea-Bisáu", "Haití", "Honduras", "Hungría", "India", "Indonesia", "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Israel", "Italia", "Jamaica", "Japón", "Jordania", "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo", "Madagascar", "Malasia", "Malaui", "Maldivas", "Malí", "Malta", "Marruecos", "Mauricio", "Mauritania", "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique", "Namibia", "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos", "Pakistán", "Palaos", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Polonia", "Portugal", "Reino Unido", "República Centroafricana", "República Checa", "República del Congo", "República Democrática del Congo", "República Dominicana", "Ruanda", "Rumanía", "Rusia", "Samoa", "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucía", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Suazilandia", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam", "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue"
];

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
