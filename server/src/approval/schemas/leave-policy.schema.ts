import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeavePolicyDocument = LeavePolicy & Document;

export enum LeaveCategory {
  ANNUAL = '연차',
  HALFDAY = '반차',
  SICK = '병가',
  COMPASSION = '경조사',
  OFFICIAL = '공가',
  OTHER = '기타',
}

// 증빙 서류 제출 시점
// - none: 증빙 불필요 (연차/반차)
// - pre : 신청 시점에 필수 (공가 등 — 소집 통지서를 미리 받아서 제출 가능)
// - post: 사후 제출 (병가/경조사 등 — 사건 발생 후 증빙이 나오므로 승인 후 데드라인까지 업로드)
export type EvidenceTiming = 'none' | 'pre' | 'post';

@Schema({ timestamps: true })
export class LeavePolicy {
  @Prop({ type: String, enum: LeaveCategory, required: true, unique: true })
  category: LeaveCategory;

  // 휴가 1건당 최대 일수 (0 = 무제한)
  @Prop({ type: Number, default: 0 })
  maxDaysPerRequest: number;

  // 연간 누적 상한 (0 = 무제한)
  @Prop({ type: Number, default: 0 })
  annualCap: number;

  // 증빙 제출 시점
  @Prop({ type: String, enum: ['none', 'pre', 'post'], default: 'none' })
  evidenceTiming: EvidenceTiming;

  // post timing일 때 휴가 종료 후 며칠 내 제출 (기본 7일)
  @Prop({ type: Number, default: 7 })
  postEvidenceDays: number;

  // [deprecated] 하위 호환: evidenceTiming 이 'pre' | 'post' 면 true 로 간주
  @Prop({ type: Boolean, default: false })
  requiresEvidence: boolean;

  // 연차에서 차감되는지 여부 (연차/반차만 true)
  @Prop({ type: Boolean, default: false })
  deductFromAnnualLeave: boolean;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: String, default: '' })
  description: string;

  createdAt: Date;
  updatedAt: Date;
}

export const LeavePolicySchema = SchemaFactory.createForClass(LeavePolicy);

// 초기 시드 (서버 기동 시 없으면 생성)
export const DEFAULT_LEAVE_POLICIES: Omit<LeavePolicy, 'createdAt' | 'updatedAt'>[] = [
  {
    category: LeaveCategory.ANNUAL,
    maxDaysPerRequest: 0,
    annualCap: 0,
    evidenceTiming: 'none',
    postEvidenceDays: 7,
    requiresEvidence: false,
    deductFromAnnualLeave: true,
    active: true,
    description: '법정 연차 유급휴가. 입사 기념일 기준 회계연도로 집계되며 사용자별 잔여 일수로 제한됩니다.',
  },
  {
    category: LeaveCategory.HALFDAY,
    maxDaysPerRequest: 0.5,
    annualCap: 0,
    evidenceTiming: 'none',
    postEvidenceDays: 7,
    requiresEvidence: false,
    deductFromAnnualLeave: true,
    active: true,
    description: '반차(오전/오후). 연차에서 0.5일씩 차감됩니다.',
  },
  {
    category: LeaveCategory.SICK,
    maxDaysPerRequest: 3,
    annualCap: 10,
    evidenceTiming: 'post',
    postEvidenceDays: 7,
    requiresEvidence: true,
    deductFromAnnualLeave: false,
    active: true,
    description: '질병으로 인한 단기 휴가. 진단서·영수증 등 증빙은 복귀 후 7일 이내 업로드하세요.',
  },
  {
    category: LeaveCategory.COMPASSION,
    maxDaysPerRequest: 5,
    annualCap: 0,
    evidenceTiming: 'post',
    postEvidenceDays: 14,
    requiresEvidence: true,
    deductFromAnnualLeave: false,
    active: true,
    description: '경조 휴가(본인 결혼, 직계 가족 사망 등). 청첩장·부고장 등 증빙은 사건 이후 14일 이내 제출.',
  },
  {
    category: LeaveCategory.OFFICIAL,
    maxDaysPerRequest: 0,
    annualCap: 0,
    evidenceTiming: 'pre',
    postEvidenceDays: 7,
    requiresEvidence: true,
    deductFromAnnualLeave: false,
    active: true,
    description: '예비군 훈련, 법원 출석, 투표 등 법정 공가. 소집 통지서 사전 첨부 필수.',
  },
  {
    category: LeaveCategory.OTHER,
    maxDaysPerRequest: 0,
    annualCap: 0,
    evidenceTiming: 'post',
    postEvidenceDays: 7,
    requiresEvidence: true,
    deductFromAnnualLeave: false,
    active: true,
    description: '기타 사유. 관리자 재량으로 승인되며 승인 후 증빙을 제출하세요.',
  },
];
