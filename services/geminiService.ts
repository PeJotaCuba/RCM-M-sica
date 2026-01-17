
import { GoogleGenAI, Type } from "@google/genai";
import { CreditInfo } from "../types";

export const fetchCreditsFromGemini = async (filename: string, path: string): Promise<CreditInfo> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prompt translated to Spanish to maintain consistency and context for "RCM Música"
  const prompt = `
    Tengo un archivo musical ubicado en el archivo de una emisora de radio (Radio Ciudad Monumento).
    Nombre del archivo: "${filename}"
    Ruta de la carpeta: "${path}"

    Basándote en este nombre de archivo y ruta (y en tu conocimiento de la historia musical, especialmente música cubana y latinoamericana dado el contexto de 'Radio Ciudad Monumento'), por favor deduce o encuentra los metadatos más probables.

    Si el archivo parece ser una grabación histórica o una entrevista, intenta inferir el contexto.

    Devuelve un objeto JSON con:
    - title (Título de la canción o pista)
    - author (Compositor o Autor)
    - performer (Intérprete, Banda o Locutor)
    - album (Nombre del álbum si aplica)
    - year (Año de lanzamiento o grabación)

    Si no estás seguro de un campo específico, haz una suposición educada basada en la catalogación estándar, o déjalo como "Desconocido".
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            author: { type: Type.STRING },
            performer: { type: Type.STRING },
            album: { type: Type.STRING },
            year: { type: Type.STRING },
          },
          required: ["title", "author", "performer", "album", "year"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sin respuesta de la IA");

    const data = JSON.parse(text) as CreditInfo;
    return data;

  } catch (error) {
    console.error("Error de Gemini API:", error);
    // Fallback for demo purposes if API fails
    return {
      title: "Error consultando IA",
      author: "Verificar conexión",
      performer: "---",
      album: "---",
      year: "---"
    };
  }
};
