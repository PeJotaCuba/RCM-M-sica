
export interface Track {
  id: string;
  filename: string;
  path: string;
  size?: string;
  metadata: CreditInfo;
  isVerified: boolean;
}

export interface CreditInfo {
  title: string;
  author: string; // Composer/Writer
  authorCountry?: string;
  performer: string; // Artist/Band
  performerCountry?: string;
  album: string; // Used as "Folder Name" in some contexts
  year: string;
  genre?: string;
}

export interface User {
  username: string;
  password: string;
  role: 'admin' | 'director' | 'user'; 
  fullName: string;
  phone: string;
  uniqueId?: string; // Código único de firma digital
}

export interface ReportStatus {
    downloaded: boolean;
    sent: boolean;
}

export interface Report {
    id: string;
    date: string;
    program: string;
    generatedBy: string;
    fileName: string;
    pdfBlob: Blob; // Almacenado en IndexedDB
    items?: any[]; // Guardamos los items para poder re-editar el reporte
    status?: ReportStatus;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  LIST = 'LIST',
  SETTINGS = 'SETTINGS',
  RESULTS = 'RESULTS',
  SELECTION = 'SELECTION',
  PRODUCTIONS = 'PRODUCTIONS',
  REPORTS = 'REPORTS',
  GUIDE = 'GUIDE'
}

export type FilterType = 'title' | 'author' | 'performer' | 'folder';

export interface SearchFilters {
  query: string;
  type: FilterType;
}

export type AuthMode = 'user' | 'director' | 'admin' | null;

export const PROGRAMS_LIST = [
  "Buenos Días, Bayamo",
  "Todos en Casa",
  "Arte Bayamo",
  "Parada Joven",
  "Hablando con Juana",
  "Sigue a tu ritmo",
  "Al son de la radio",
  "Cómplices",
  "Coloreando Melodías",
  "Alba y crisol",
  "Estación 95.3",
  "Palco de Domingo"
];
