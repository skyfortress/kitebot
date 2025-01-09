import { ObjectId } from 'mongodb';

export interface Spot {
  _id?: ObjectId;
  name: string;
  webcam: string;
  forecast: string;
  isOcean: boolean;
  ignoreNight: boolean;
  hasKiters: boolean;
  hasKiteableForecast: boolean;
  lastKiterSeen: Date;
  nextCheck: Date;
}

export interface Observation {
  _id?: ObjectId;
  file: string;
  analyzedFile: string;
  matches: { label: string; confidence: number }[];
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export interface Task {
  _id?: ObjectId;
  spot: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  error?: Error;
  results: Observation[];
}

export interface ForecastItem {
  date: Date;
  speed: number;
  gusts: number;
  temperature: number;
  wave: number;
}

export interface Forecast {
  _id?: ObjectId;
  spot: string;
  createdAt: Date;
  isKitebable: boolean;
  items: ForecastItem[];
}
