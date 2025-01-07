import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { MongodbModule } from '@app/mongodb/mongodb.module';

@Module({
  imports: [MongodbModule],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
