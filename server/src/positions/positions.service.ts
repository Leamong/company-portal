import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Position, PositionDocument } from './schemas/position.schema';

@Injectable()
export class PositionsService {
  constructor(
    @InjectModel(Position.name) private positionModel: Model<PositionDocument>,
  ) {}

  findAll() {
    return this.positionModel.find().sort({ level: 1 }).lean();
  }

  create(dto: { title: string; level?: number; description?: string; color?: string }) {
    return this.positionModel.create(dto);
  }

  async update(id: string, dto: { title?: string; level?: number; description?: string; color?: string }) {
    const doc = await this.positionModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('직급을 찾을 수 없습니다.');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.positionModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('직급을 찾을 수 없습니다.');
    return { message: '삭제되었습니다.' };
  }
}
