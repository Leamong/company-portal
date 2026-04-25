import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';
import { LeavePolicyService } from './leave-policy.service';
import { LeavePolicyController } from './leave-policy.controller';
import { WorkScheduleService } from './work-schedule.service';
import { WorkScheduleController } from './work-schedule.controller';
import { Approval, ApprovalSchema } from './schemas/approval.schema';
import {
  ApprovalChainSettings,
  ApprovalChainSettingsSchema,
} from './schemas/approval-chain-settings.schema';
import {
  LeavePolicy,
  LeavePolicySchema,
} from './schemas/leave-policy.schema';
import {
  WorkSchedule,
  WorkScheduleSchema,
} from './schemas/work-schedule.schema';
import { UsersModule } from '../users/users.module';
import { MessengerModule } from '../messenger/messenger.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Approval.name, schema: ApprovalSchema },
      { name: ApprovalChainSettings.name, schema: ApprovalChainSettingsSchema },
      { name: LeavePolicy.name, schema: LeavePolicySchema },
      { name: WorkSchedule.name, schema: WorkScheduleSchema },
    ]),
    UsersModule,
    MessengerModule,
    StorageModule,
  ],
  controllers: [ApprovalController, LeavePolicyController, WorkScheduleController],
  providers: [ApprovalService, LeavePolicyService, WorkScheduleService],
})
export class ApprovalModule {}
