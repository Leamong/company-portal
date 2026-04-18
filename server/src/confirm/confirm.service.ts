import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Confirm, ConfirmDocument, ConfirmStatus } from './schemas/confirm.schema';
import { CreateConfirmDto } from './dto/create-confirm.dto';
import { AddPinDto } from './dto/add-pin.dto';
import { RejectConfirmDto } from './dto/reject-confirm.dto';
import { UserRole } from '../users/schemas/user.schema';

@Injectable()
export class ConfirmService {
  constructor(
    @InjectModel(Confirm.name) private confirmModel: Model<ConfirmDocument>,
  ) {}

  async findAll(filters: { status?: ConfirmStatus; uploaderId?: string }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.uploaderId) query.uploaderId = new Types.ObjectId(filters.uploaderId);
    return this.confirmModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<ConfirmDocument> {
    const item = await this.confirmModel.findById(id).exec();
    if (!item) throw new NotFoundException('컨펌 항목을 찾을 수 없습니다.');
    return item;
  }

  async create(
    dto: CreateConfirmDto,
    uploaderId: string,
    uploaderName: string,
    imageUrl: string,
    imageKey: string,
  ): Promise<ConfirmDocument> {
    const item = new this.confirmModel({
      ...dto,
      taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : null,
      uploaderId: new Types.ObjectId(uploaderId),
      uploader: uploaderName,
      imageUrl,
      imageKey,
      status: ConfirmStatus.PENDING,
      round: 1,
    });
    return item.save();
  }

  async approve(id: string, userRole: UserRole): Promise<ConfirmDocument> {
    if (userRole !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('어드민만 승인할 수 있습니다.');
    }
    const item = await this.confirmModel.findById(id);
    if (!item) throw new NotFoundException('컨펌 항목을 찾을 수 없습니다.');
    if (item.status !== ConfirmStatus.PENDING) {
      throw new BadRequestException('컨펌 대기 상태인 항목만 승인할 수 있습니다.');
    }
    item.status = ConfirmStatus.APPROVED;
    return item.save();
  }

  async reject(
    id: string,
    dto: RejectConfirmDto,
    userRole: UserRole,
  ): Promise<ConfirmDocument> {
    if (userRole !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('어드민만 반려할 수 있습니다.');
    }
    const item = await this.confirmModel.findById(id);
    if (!item) throw new NotFoundException('컨펌 항목을 찾을 수 없습니다.');
    if (item.status !== ConfirmStatus.PENDING) {
      throw new BadRequestException('컨펌 대기 상태인 항목만 반려할 수 있습니다.');
    }
    item.status = ConfirmStatus.REJECTED;
    item.rejectionNote = dto.rejectionNote;
    return item.save();
  }

  async addPin(
    id: string,
    dto: AddPinDto,
    authorId: string,
    authorName: string,
    userRole: UserRole,
  ): Promise<ConfirmDocument> {
    if (userRole !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('어드민만 핀을 추가할 수 있습니다.');
    }
    const item = await this.confirmModel.findById(id);
    if (!item) throw new NotFoundException('컨펌 항목을 찾을 수 없습니다.');
    if (item.status !== ConfirmStatus.PENDING) {
      throw new BadRequestException('컨펌 대기 상태인 항목에만 핀을 추가할 수 있습니다.');
    }
    item.pins.push({
      _id: new Types.ObjectId(),
      x: dto.x,
      y: dto.y,
      comment: dto.comment,
      author: authorName,
      authorId: new Types.ObjectId(authorId),
      resolved: false,
      createdAt: new Date().toISOString(),
    });
    return item.save();
  }

  async resolvePin(
    id: string,
    pinId: string,
    userRole: UserRole,
  ): Promise<ConfirmDocument> {
    if (userRole !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('어드민만 핀을 해결 처리할 수 있습니다.');
    }
    const item = await this.confirmModel.findById(id);
    if (!item) throw new NotFoundException('컨펌 항목을 찾을 수 없습니다.');
    const pin = item.pins.find((p) => p._id.toString() === pinId);
    if (!pin) throw new NotFoundException('핀을 찾을 수 없습니다.');
    pin.resolved = true;
    return item.save();
  }
}
