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

  // 비상연락처
  @Prop({
    type: { name: String, phone: String, relation: String },
    default: { name: '', phone: '', relation: '' },
    _id: false,
  })
  emergencyContact: { name: string; phone: string; relation: string };

  // timestamps: true 가 자동 생성하는 필드 — TypeScript 타입 인식을 위해 반드시 명시
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
