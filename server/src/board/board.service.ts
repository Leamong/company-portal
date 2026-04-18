import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument, PostCategory } from './schemas/post.schema';

@Injectable()
export class BoardService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
  ) {}

  async findAll(category?: string) {
    const query: Record<string, unknown> = {};
    if (category && category !== '전체') {
      query.category = category;
    }
    return this.postModel
      .find(query)
      .sort({ isNotice: -1, createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const post = await this.postModel.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    ).lean();
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    return post;
  }

  async create(
    authorId: string,
    authorName: string,
    role: string,
    dto: { title: string; content: string; category: PostCategory },
  ) {
    const isNotice = dto.category === PostCategory.NOTICE;
    if (isNotice && role !== 'head-admin') {
      throw new ForbiddenException('공지 카테고리는 헤드 어드민만 작성할 수 있습니다.');
    }
    return this.postModel.create({
      ...dto,
      authorId: new Types.ObjectId(authorId),
      authorName,
      isNotice,
    });
  }

  async update(
    id: string,
    userId: string,
    role: string,
    dto: Partial<{ title: string; content: string; category: PostCategory }>,
  ) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    const isOwner = post.authorId.toString() === userId;
    if (!isOwner && role !== 'head-admin') {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    return this.postModel.findByIdAndUpdate(id, dto, { new: true }).lean();
  }

  async remove(id: string, userId: string, role: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    const isOwner = post.authorId.toString() === userId;
    if (!isOwner && role !== 'head-admin') {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    await this.postModel.findByIdAndDelete(id);
    return { message: '게시글이 삭제되었습니다.' };
  }
}
