

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
  author: string;
  authorCountry?: string;
  performer: string;
  performerCountry?: string;
  album: string;
  year: string;
  genre?: string;
}

export interface ExportItem {
  id: string;
  title: string;
  author: string;
  authorCountry: string;
  performer: string;
  performerCountry: string;
  genre: string;
  source: string;
  path: string;
}

export type SavedSelection = Track[];

export interface User {
  username: string;
  password: string;
  role: 'admin' | 'director' | 'user'; 
  fullName: string;
  phone: string;
  uniqueId?: string;
}

export interface ReportStatus {
    downloaded: boolean;
    sent: boolean;
    cloudUploaded?: boolean;
}

export interface Report {
    id: string;
    date: string;
    program: string;
    generatedBy: string;
    fileName: string;
    pdfBlob: Blob; 
    items?: ExportItem[];
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

export interface CustomRoot {
  id: string;
  name: string;
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