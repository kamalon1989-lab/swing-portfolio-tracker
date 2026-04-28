// Firebase 클라이언트 초기화.
// legacy HTML과 동일한 프로젝트·키·DB 경로를 사용해 데이터 호환성을 보장.
//
// 이 키들은 Firebase 보안 규칙(users/{uid}만 자기 데이터 read/write)으로 보호되므로
// 클라이언트 노출이 안전. NEXT_PUBLIC_* 으로 두는 게 표준 패턴.

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'AIzaSyBqKYEmVbvt4lYr_9JuatPGaabF5WsLlfg',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'swing-dh.firebaseapp.com',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL ?? 'https://swing-dh-default-rtdb.firebaseio.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'swing-dh',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'swing-dh.firebasestorage.app',
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Database | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getFirebaseApp());
  return _auth;
}

export function getFirebaseDb(): Database {
  if (_db) return _db;
  _db = getDatabase(getFirebaseApp());
  return _db;
}

export const googleProvider = new GoogleAuthProvider();

// legacy와 동일한 RTDB 경로 — 절대 변경 금지. 친구들 데이터 호환성의 근간.
export const userPtfPath = (uid: string) => `users/${uid}/ptf`;

// legacy 데이터 스키마 (단축 키). 새 코드도 이 모양 그대로 read/write.
export interface LegacyPortfolio {
  h?: HoldingItem[];      // holdings
  w?: WatchItem[];        // watchlist
  j?: JournalItem[];      // journal (매매기록)
  hi?: HistoryEntry[];    // history (일별 기록)
  c?: number;             // cash
  k?: string | null;      // (Phase 3에서 제거 예정) finnhub api key
}

export interface HoldingItem {
  ticker: string;
  name?: string;
  shares: number;
  avgCost: number;
  targetPrice?: number;
  stopLoss?: number;
  note?: string;
  buyDate?: string | null;
  lastBuyDate?: string | null;
}

export interface WatchItem {
  ticker: string;
  name?: string;
  targetBuy?: number;
  note?: string;
}

export interface JournalItem {
  id: string;
  date: string;
  action: 'buy' | 'sell';
  ticker: string;
  shares: number;
  price: number;
  fee?: number;
  note?: string;
}

export interface HistoryEntry {
  date: string;
  totalVal: number;
  totalCost: number;
  // legacy 구조에 따라 추가 필드 가능
  [key: string]: unknown;
}
