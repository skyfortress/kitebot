import { ObjectId } from 'mongodb';

export interface Settings {
  _id?: ObjectId;
  ownerId: number;
  subscribedChats: number[];
  enabled: boolean;
}
