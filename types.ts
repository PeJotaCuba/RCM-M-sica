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
  performer: string; // Artist/Band
  album: string;
  year: string;
}

export enum ViewState {
  LOGIN = 'LOGIN',
  LIST = 'LIST',
  SETTINGS = 'SETTINGS',
  RESULTS = 'RESULTS',
  RECENT = 'RECENT'
}

export type FilterType = 'title' | 'author' | 'performer';

export interface SearchFilters {
  query: string;
  type: FilterType;
}

export type AuthMode = 'guest' | 'admin' | null;