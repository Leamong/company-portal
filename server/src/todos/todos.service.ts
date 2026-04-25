import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Todo, TodoDocument } from './schemas/todo.schema';

@Injectable()
export class TodosService {
  constructor(
    @InjectModel(Todo.name) private todoModel: Model<TodoDocument>,
  ) {}

  async findAllByUser(userId: string) {
    return this.todoModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ order: 1, createdAt: 1 })
      .lean()
      .exec();
  }

  async create(userId: string, content: string) {
    // 새 항목은 맨 아래로 (order = 현재 최대값 + 1)
    const existing = await this.todoModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ order: -1 })
      .limit(1)
      .lean();
    const maxOrder = existing[0]?.order ?? 0;
    return this.todoModel.create({
      userId: new Types.ObjectId(userId),
      content: content.trim(),
      isDone: false,
      order: maxOrder + 1,
    });
  }

  // 드래그앤드롭 순서 변경: 본인 소유 항목들에 대해 idx 순으로 order 재할당
  async reorder(userId: string, orderedIds: string[]) {
    const userTodos = await this.todoModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('_id')
      .lean();
    const allowed = new Set(userTodos.map((t) => String(t._id)));

    const ops = orderedIds
      .filter((id) => allowed.has(id))
      .map((id, idx) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $set: { order: idx } },
        },
      }));

    if (ops.length > 0) {
      await this.todoModel.bulkWrite(ops);
    }
    return { ok: true };
  }

  async update(
    id: string,
    userId: string,
    dto: { content?: string; isDone?: boolean; order?: number },
  ) {
    const todo = await this.todoModel.findById(id);
    if (!todo) throw new NotFoundException('할 일을 찾을 수 없습니다.');
    if (todo.userId.toString() !== String(userId)) {
      throw new ForbiddenException('본인의 할 일만 수정할 수 있습니다.');
    }
    if (dto.content !== undefined) todo.content = dto.content.trim();
    if (dto.isDone !== undefined) todo.isDone = dto.isDone;
    if (dto.order !== undefined) todo.order = dto.order;
    await todo.save();
    return todo.toObject();
  }

  async remove(id: string, userId: string) {
    const todo = await this.todoModel.findById(id);
    if (!todo) throw new NotFoundException('할 일을 찾을 수 없습니다.');
    if (todo.userId.toString() !== String(userId)) {
      throw new ForbiddenException('본인의 할 일만 삭제할 수 있습니다.');
    }
    await this.todoModel.deleteOne({ _id: todo._id });
    return { ok: true };
  }

  // 완료된 항목 일괄 삭제
  async clearCompleted(userId: string) {
    const res = await this.todoModel.deleteMany({
      userId: new Types.ObjectId(userId),
      isDone: true,
    });
    return { deletedCount: res.deletedCount ?? 0 };
  }
}
