import { MongoClient } from 'mongodb';


export async function connectToMongoDB() {
  const client = new MongoClient(process.env.MONGODB_DSN!);
  await client.connect();
  console.log('Connected to MongoDB');
  
  return client;
}