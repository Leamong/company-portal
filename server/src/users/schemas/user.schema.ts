import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  HEAD_ADMIN = 'head-admin',
  EMPLOYEE = 'employee',
}

export enum AttendanceStatus {
  IN = '출근',
  OUT = '퇴근',
}

// 대표(head-admin) 전용 부재 상태 — 결재 절차 없이 직접 설정
export enum AbsenceStatus {
  VACATION = '휴가',
  ABSENT = '부재',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  position: string; // 직급 (예: 대리, 과장, 팀장)

  @Prop({ type: String, default: 'design' })
  department: string; // 부서 키 (departments 컬렉션의 key 값 참조)

  @Prop({ type: String, enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Prop({ type: String, enum: AttendanceStatus, default: AttendanceStatus.OUT })
  status: AttendanceStatus; // 출퇴근 상태

  // 대표 전용 부재 표시 (head-admin은 법적 근로자가 아니므로 결재 없이 직접 토글)
  @Prop({ type: String, enum: [...Object.values(AbsenceStatus), null], default: null })
  absenceStatus: AbsenceStatus | null;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, default: null })
  profileImage: string | null;

  @Prop({ type: [String], default: [] })
  allowedIps: string[]; // 개인별 허용 IP (어드민이 설정)

  @Prop({ type: [String], default: ['attendance', 'tasks', 'confirm', 'board', 'approval'] })
  pagePermissions: string[]; // 접근 가능한 페이지 키 목록 (헤드 어드민은 무시, 직원에게만 적용)

  @Prop({ type: Boolean, default: false })
  canApprove: boolean; // 결재 대리 권한 (head-admin이 특정 직원에게 부여)

  @Prop({ type: Boolean, default: false })
  canManageAttendance: boolean; // 근태 관리 대리 권한

  // 연락처
  @Prop({ type: String, default: '' })
  phone: string;

  // 생년월일
  @Prop({ type: Date, default: null })
  birthDate: Date | null;

  // 입사일 — 근로기준법 60조에 따른 연차 자동 계산 기준
  @Prop({ type: Date, default: null })
  hireDate: Date | null;

  // 연차 수동 보정 (관리자만 조정 가능; 이월·특별휴가·기존 사용분 반영용)
  @Prop({ type: Number, default: 0 })
  annualLeaveAdjustment: number;

  // 비상연락처
  @Prop({
    type: { name: String, phone: String, relation: String },
    default: { name: '', phone: '', relation: '' },
    _id: false,
  })
  emergencyContact: { name: string; phone: string; relation: string };

  // 대시보드 커스텀 레이아웃 — react-grid-layout 형식
  // [{ i: 'widgetId', x, y, w, h, hidden? }]
  @Prop({ type: [Object], default: [] })
  dashboardLayout: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
    hidden?: boolean;
  }>;

  // 온라인 결재 도장
  @Prop({ type: String, default: null })
  stampSvg: string | null; // SVG 문자열 또는 data URL

  @Prop({ type: String, default: '#e11d48' })
  stampColor: string; // 도장 글자 색 (빨강/파랑/검정)

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
