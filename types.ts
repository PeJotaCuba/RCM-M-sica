
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
  role: 'admin' | 'guest'; // 'guest' en código, 'Usuario' en UI
  fullName: string;
  phone: string;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  LIST = 'LIST',
  SETTINGS = 'SETTINGS',
  RESULTS = 'RESULTS',
  RECENT = 'RECENT',
  PRODUCTIONS = 'PRODUCTIONS'
}

export type FilterType = 'title' | 'author' | 'performer' | 'folder';

export interface SearchFilters {
  query: string;
  type: FilterType;
}

export type AuthMode = 'guest' | 'admin' | null;

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
