import { ObjectId, Document } from "mongodb";

export interface Spot extends Document {
    _id?: ObjectId;
    name: string;
    webcam: string;
    hasKiters: boolean;
    lastKiterSeen: Date;
    nextCheck: Date;
}

export interface Observation extends Document {
    _id?: ObjectId;
    file: string;
    matches: {label: string, confidence: number}[];
}

