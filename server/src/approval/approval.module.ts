import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { Approval, ApprovalSchema } from './schemas/approval.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Approval.name, schema: ApprovalSchema }]),
    UsersModule,
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}
