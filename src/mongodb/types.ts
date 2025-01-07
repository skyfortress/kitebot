import { ObjectId } from 'mongodb';

export interface Spot {
  _id?: ObjectId;
  name: string;
  webcam: string;
  hasKiters: boolean;
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
