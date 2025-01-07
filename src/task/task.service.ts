import { Spot, Task, TaskStatus } from '@app/mongodb/types';
import { Inject, Injectable } from '@nestjs/common';
import { Collection, Db, MongoClient } from 'mongodb';

@Injectable()
export class TaskService {
  private db: Db;
  private collection: Collection<Task>;

  constructor(
    @Inject('MONGODB_CONNECTION') private readonly client: MongoClient,
  ) {
    this.db = this.client.db();
    this.collection = this.db.collection<Task>('tasks');
  }

  async getActiveTasks(): Promise<Task[]> {
    return this.collection.find({ status: TaskStatus.IN_PROGRESS }).toArray();
  }

  async getAllTasks(): Promise<Task[]> {
    return this.collection.find().toArray();
  }

  async createTask(spot: Spot): Promise<Task> {
    const task = {
      spot: spot.name,
      status: TaskStatus.IN_PROGRESS, // skip PENDING as we create and start the task in one go
      createdAt: new Date(),
      updatedAt: new Date(),
      results: [],
    };
    const record = await this.collection.insertOne(task);
    return { _id: record.insertedId, ...task };
  }

  async failTask(task: Partial<Task>, e: Error): Promise<void> {
    await this.collection.updateOne(
      { _id: task._id },
      {
        $set: {
          status: TaskStatus.FAILED,
          error: {
            message: e.message,
            name: e.name,
            stack: e.stack,
          },
          updatedAt: new Date(),
        },
      },
    );
  }

  async completeTask(
    task: Partial<Task>,
    results: Task['results'],
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: task._id },
      {
        $set: {
          status: TaskStatus.DONE,
          results: results,
          updatedAt: new Date(),
        },
      },
    );
  }
}
