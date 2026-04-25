import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LeavePolicy,
  LeavePolicyDocument,
  LeaveCategory,
  DEFAULT_LEAVE_POLICIES,
} from './schemas/leave-policy.schema';

@Injectable()
export class LeavePolicyService implements OnModuleInit {
  constructor(
    @InjectModel(LeavePolicy.name)
    private policyModel: Model<LeavePolicyDocument>,
  ) {}

  // 서버 기동 시 기본 정책이 없으면 시드. 있으면 새로 추가된 필드만 백필
  async onModuleInit() {
    for (const preset of DEFAULT_LEAVE_POLICIES) {
      const existing = await this.policyModel.findOne({ category: preset.category });
      if (!existing) {
        await this.policyModel.create(preset);
        continue;
      }
      const updates: Record<string, any> = {};
      const doc = existing.toObject() as any;
      if (doc.evidenceTiming === undefined) updates.evidenceTiming = preset.evidenceTiming;
      if (doc.postEvidenceDays === undefined) updates.postEvidenceDays = preset.postEvidenceDays;
      if (Object.keys(updates).length > 0) {
        await this.policyModel.updateOne({ _id: existing._id }, { $set: updates });
      }
    }
  }

  async findAll() {
    return this.policyModel.find().sort({ category: 1 }).lean();
  }

  async findByCategory(category: LeaveCategory) {
    return this.policyModel.findOne({ category }).lean();
  }

  async update(
    category: LeaveCategory,
    dto: Partial<Omit<LeavePolicy, 'category' | 'createdAt' | 'updatedAt'>>,
  ) {
    const updated = await this.policyModel
      .findOneAndUpdate({ category }, dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('해당 정책을 찾을 수 없습니다.');
    return updated;
  }

  // 요청한 vacationType 문자열을 LeaveCategory 로 매핑
  static resolveCategory(vacationType: string | undefined | null): LeaveCategory | null {
    if (!vacationType) return null;
    if (vacationType === LeaveCategory.ANNUAL) return LeaveCategory.ANNUAL;
    if (vacationType.startsWith('반차')) return LeaveCategory.HALFDAY;
    if (vacationType === LeaveCategory.SICK) return LeaveCategory.SICK;
    if (vacationType === LeaveCategory.COMPASSION) return LeaveCategory.COMPASSION;
    if (vacationType === LeaveCategory.OFFICIAL) return LeaveCategory.OFFICIAL;
    if (vacationType === LeaveCategory.OTHER) return LeaveCategory.OTHER;
    return null;
  }
}
