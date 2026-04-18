import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<DepartmentDocument>,
  ) {}

  findAll() {
    return this.departmentModel.find().sort({ createdAt: 1 }).lean();
  }

  private generateKey(label: string): string {
    // 영문 변환 시도 → 실패하면 타임스탬프 기반 키 사용
    const ascii = label
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    const base = ascii.length >= 2 ? ascii : 'dept';
    return `${base}_${Date.now()}`;
  }

  async create(dto: { key?: string; label: string; color?: string; description?: string }) {
    const key = dto.key?.trim() || this.generateKey(dto.label);
    const existing = await this.departmentModel.findOne({ key });
    if (existing) throw new ConflictException('이미 사용 중인 부서 키입니다.');
    return this.departmentModel.create({ ...dto, key });
  }

  async update(
    id: string,
    dto: { key?: string; label?: string; color?: string; description?: string },
  ) {
    if (dto.key) {
      const conflict = await this.departmentModel.findOne({ key: dto.key, _id: { $ne: id } });
      if (conflict) throw new ConflictException('이미 사용 중인 부서 키입니다.');
    }
    const doc = await this.departmentModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('부서를 찾을 수 없습니다.');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.departmentModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('부서를 찾을 수 없습니다.');
    return { message: '삭제되었습니다.' };
  }
}
