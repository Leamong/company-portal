import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task, TaskDocument, TaskStatus, TaskDepartment, ALLOWED_TRANSITIONS } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UserRole } from '../users/schemas/user.schema';
import { Confirm, ConfirmDocument } from '../confirm/schemas/confirm.schema';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Confirm.name) private confirmModel: Model<ConfirmDocument>,
    private readonly storageService: StorageService,
  ) {}

  // ── 기본 목록 조회 (보관된 항목 제외) ─────────────────────────────────────
  async findAll(filters: {
    department?: TaskDepartment;
    assigneeId?: string;
    status?: TaskStatus;
    priority?: string;
  }) {
    const query: Record<string, unknown> = { archivedAt: null }; // 보관 항목 제외
    if (filters.department) query.department = filters.department;
    if (filters.assigneeId) query.assigneeId = new Types.ObjectId(filters.assigneeId);
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    return this.taskModel.find(query).sort({ dueDate: 1 }).exec();
  }

  // ── 보관함 목록 조회 (전달완료만) ────────────────────────────────────────────
  async findArchived(filters: {
    department?: TaskDepartment;
    assigneeId?: string;
    designType?: string;
  }) {
    const query: Record<string, unknown> = {
      archivedAt: { $ne: null },
      status: TaskStatus.DELIVERED,
    };
    if (filters.department) query.department = filters.department;
    if (filters.assigneeId) query.assigneeId = new Types.ObjectId(filters.assigneeId);
    if (filters.designType) query.designType = filters.designType;
    return this.taskModel.find(query).sort({ archivedAt: -1 }).exec();
  }

  // ── 단건 조회 ────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const task = await this.taskModel.findById(id).exec();
    if (!task) throw new NotFoundException('태스크를 찾을 수 없습니다.');
    return task;
  }

  // ── 생성 ─────────────────────────────────────────────────────────────────
  async create(dto: CreateTaskDto, _userId: string): Promise<TaskDocument> {
    const task = new this.taskModel({
      ...dto,
      assigneeId: dto.assigneeId ? new Types.ObjectId(dto.assigneeId) : null,
      orderDate: dto.orderDate || new Date().toISOString().split('T')[0],
    });
    return task.save();
  }

  // ── 상태 변경 ─────────────────────────────────────────────────────────────
  async updateStatus(
    id: string,
    newStatus: TaskStatus,
    userId: string,
    userRole: UserRole,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('태스크를 찾을 수 없습니다.');

    // 직원은 본인 담당 카드만 이동 가능
    if (userRole !== UserRole.HEAD_ADMIN) {
      const assigneeStr = task.assigneeId?.toString();
      if (assigneeStr !== userId) {
        throw new ForbiddenException('본인이 담당한 카드만 이동할 수 있습니다.');
      }
      const allowed = ALLOWED_TRANSITIONS[task.status];
      if (!allowed.includes(newStatus)) {
        throw new BadRequestException(
          `'${task.status}' 상태에서 '${newStatus}'로 이동할 수 없습니다.`,
        );
      }
    }

    task.status = newStatus;

    // 전달완료 → 즉시 보관함으로 이동
    if (newStatus === TaskStatus.DELIVERED) {
      task.archivedAt = new Date();
    }

    return task.save();
  }

  // ── 내용 수정 ─────────────────────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateTaskDto,
    userId: string,
    userRole: UserRole,
  ): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id);
    if (!task) throw new NotFoundException('태스크를 찾을 수 없습니다.');

    if (userRole !== UserRole.HEAD_ADMIN) {
      if (task.assigneeId?.toString() !== userId) {
        throw new ForbiddenException('본인이 담당한 카드만 수정할 수 있습니다.');
      }
      if (dto.status) {
        throw new ForbiddenException('상태 변경은 별도 API를 사용하세요.');
      }
    }

    if (dto.assigneeId !== undefined) {
      task.assigneeId = dto.assigneeId ? new Types.ObjectId(dto.assigneeId) : null;
    }
    if (dto.assigneeName !== undefined) task.assigneeName = dto.assigneeName;
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.client !== undefined) task.client = dto.client;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    if (dto.quantity !== undefined) task.quantity = dto.quantity;
    if (dto.designType !== undefined) task.designType = dto.designType;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.notes !== undefined) task.notes = dto.notes;

    return task.save();
  }

  // ── 삭제 ─────────────────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const result = await this.taskModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('태스크를 찾을 수 없습니다.');
  }

  // ── [크론] 매일 새벽 3시: 보관 30일 경과 이미지 자동 삭제 ─────────────────
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupArchivedImages(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // 보관된 지 30일 이상 + 이미지 미삭제 태스크
    const tasks = await this.taskModel.find({
      archivedAt: { $ne: null, $lt: cutoff },
      imagesDeletedAt: null,
      status: TaskStatus.DELIVERED,
    });

    if (tasks.length === 0) return;

    const taskIds = tasks.map((t) => t._id);

    // 해당 태스크에 연결된 Confirm 이미지 키 수집
    const confirms = await this.confirmModel.find({
      taskId: { $in: taskIds },
      imageKey: { $ne: '' },
    });

    const keys = confirms.map((c) => c.imageKey).filter(Boolean);

    if (keys.length > 0) {
      await this.storageService.deleteObjects(keys);
      // Confirm 문서에서 URL 초기화
      await this.confirmModel.updateMany(
        { taskId: { $in: taskIds } },
        { $set: { imageUrl: '', imageKey: '' } },
      );
    }

    // 태스크에 이미지 삭제 시각 기록
    await this.taskModel.updateMany(
      { _id: { $in: taskIds } },
      { $set: { imagesDeletedAt: new Date() } },
    );

    this.logger.log(
      `이미지 정리: 태스크 ${tasks.length}건, R2 오브젝트 ${keys.length}개 삭제`,
    );
  }
}
