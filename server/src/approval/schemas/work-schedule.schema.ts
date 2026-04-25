import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WorkScheduleDocument = WorkSchedule & Document;

// 회사 기본 근무시간 및 반차 시간대 (싱글톤)
@Schema({ timestamps: true })
export class WorkSchedule {
  @Prop({ type: String, default: '09:00' })
  halfDayMorningStart: string;

  @Prop({ type: String, default: '13:00' })
  halfDayMorningEnd: string;

  @Prop({ type: String, default: '14:00' })
  halfDayAfternoonStart: string;

  @Prop({ type: String, default: '18:00' })
  halfDayAfternoonEnd: string;

  createdAt: Date;
  updatedAt: Date;
}

export const WorkScheduleSchema = SchemaFactory.createForClass(WorkSchedule);

export const DEFAULT_WORK_SCHEDULE = {
  halfDayMorningStart: '09:00',
  halfDayMorningEnd: '13:00',
  halfDayAfternoonStart: '14:00',
  halfDayAfternoonEnd: '18:00',
};
