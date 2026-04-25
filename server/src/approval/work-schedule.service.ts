import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WorkSchedule,
  WorkScheduleDocument,
  DEFAULT_WORK_SCHEDULE,
} from './schemas/work-schedule.schema';

@Injectable()
export class WorkScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(WorkSchedule.name)
    private scheduleModel: Model<WorkScheduleDocument>,
  ) {}

  // 서버 기동 시 싱글톤 없으면 기본값으로 생성
  async onModuleInit() {
    const existing = await this.scheduleModel.findOne();
    if (!existing) {
      await this.scheduleModel.create(DEFAULT_WORK_SCHEDULE);
    }
  }

  async get() {
    const doc = await this.scheduleModel.findOne().lean();
    return doc ?? DEFAULT_WORK_SCHEDULE;
  }

  async update(dto: Partial<typeof DEFAULT_WORK_SCHEDULE>) {
    // 유효성: HH:MM 형식만 허용
    const isValidTime = (t: string | undefined) =>
      typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const patch: Record<string, string> = {};
    for (const k of Object.keys(DEFAULT_WORK_SCHEDULE) as Array<
      keyof typeof DEFAULT_WORK_SCHEDULE
    >) {
      const v = dto[k];
      if (v !== undefined && isValidTime(v)) patch[k] = v;
    }
    return this.scheduleModel
      .findOneAndUpdate({}, patch, { upsert: true, new: true })
      .lean();
  }
}
