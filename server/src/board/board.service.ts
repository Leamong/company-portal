import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import {
  Channel,
  ChannelDocument,
  ChannelScope,
} from './schemas/channel.schema';
import {
  Department,
  DepartmentDocument,
} from '../departments/schemas/department.schema';
import {
  BoardReadState,
  BoardReadStateDocument,
} from './schemas/board-read-state.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MessengerGateway } from '../messenger/messenger.gateway';

interface AuthCtx {
  userId: string;
  role: string;
  department?: string; // dept key
}

@Injectable()
export class BoardService implements OnModuleInit {
  private readonly logger = new Logger(BoardService.name);

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Channel.name) private readonly channelModel: Model<ChannelDocument>,
    @InjectModel(Department.name) private readonly deptModel: Model<DepartmentDocument>,
    @InjectModel(BoardReadState.name)
    private readonly readStateModel: Model<BoardReadStateDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(forwardRef(() => MessengerGateway))
    private readonly messengerGateway: MessengerGateway,
  ) {}

  async onModuleInit() {
    await this.seedDefaultChannels();
    await this.syncDepartmentChannels();
    await this.migrateLegacyPosts();
  }

  // ─── 시드/싱크 ───────────────────────────────────────────────────────────
  private async seedDefaultChannels() {
    const RENAMES: Array<{ from: string; to: string }> = [
      { from: '전사 공지', to: '공지사항' },
      { from: '전사 알림', to: '자유게시판' },
    ];
    for (const r of RENAMES) {
      const found = await this.channelModel.findOne({ name: r.from, scope: 'company' });
      if (found) {
        const conflict = await this.channelModel.findOne({ name: r.to, scope: 'company' });
        if (!conflict) {
          found.name = r.to;
          await found.save();
          this.logger.log(`기본 채널 리네임: ${r.from} → ${r.to}`);
        }
      }
    }

    const defaults: Array<Partial<Channel>> = [
      { name: '공지사항', scope: 'company', noticeOnly: true, order: 0, systemManaged: true },
      { name: '자유게시판', scope: 'company', noticeOnly: false, order: 1, systemManaged: true },
    ];
    for (const def of defaults) {
      const exists = await this.channelModel.findOne({ name: def.name, scope: 'company' }).lean();
      if (!exists) {
        await this.channelModel.create(def);
        this.logger.log(`기본 채널 생성: ${def.name}`);
      }
    }
  }

  private async syncDepartmentChannels() {
    const depts = await this.deptModel.find().lean();
    for (const dept of depts) {
      const exists = await this.channelModel.findOne({
        scope: 'department',
        deptKey: dept.key,
      });
      if (!exists) {
        await this.channelModel.create({
          name: dept.label,
          scope: 'department',
          deptKey: dept.key,
          systemManaged: true,
          order: 100,
        });
        this.logger.log(`부서 채널 생성: ${dept.label}`);
      } else if (exists.archived) {
        exists.archived = false;
        if (exists.name !== dept.label) exists.name = dept.label;
        await exists.save();
      }
    }
  }

  // 옛 category 기반 게시글 마이그레이션
  private async migrateLegacyPosts() {
    const legacy = await this.postModel
      .find({ channelId: { $exists: false } })
      .lean();
    if (legacy.length === 0) return;

    const fallbackFree =
      (await this.channelModel.findOne({ name: '자유게시판', scope: 'company' })) ||
      (await this.channelModel.findOne({ name: '전사 알림', scope: 'company' })) ||
      (await this.channelModel.findOne({ scope: 'company' }));

    let recovered = 0;
    let absorbed = 0;
    for (const p of legacy) {
      const oldCategory = (p as unknown as { category?: string }).category;
      let target = null as Awaited<ReturnType<typeof this.channelModel.findOne>>;
      if (oldCategory) {
        target = await this.channelModel.findOne({ name: oldCategory });
      }
      if (!target) {
        target = fallbackFree;
        if (target) absorbed++;
      } else {
        recovered++;
      }
      if (target) {
        await this.postModel.updateOne(
          { _id: p._id },
          { $set: { channelId: target._id } },
        );
      }
    }
    if (recovered > 0) {
      this.logger.log(`옛 카테고리로 ${recovered}건의 게시글을 원래 채널로 복구했습니다.`);
    }
    if (absorbed > 0) {
      this.logger.log(`매칭 실패한 ${absorbed}건의 게시글을 '자유게시판'으로 흡수했습니다.`);
    }
  }

  // ─── 부서 lifecycle ─────────────────────────────────────────────────────
  async onDepartmentCreated(dept: { key: string; label: string }) {
    const existing = await this.channelModel.findOne({ scope: 'department', deptKey: dept.key });
    if (existing) {
      existing.archived = false;
      existing.name = dept.label;
      await existing.save();
      return existing.toObject();
    }
    return this.channelModel.create({
      name: dept.label,
      scope: 'department',
      deptKey: dept.key,
      systemManaged: true,
      order: 100,
    });
  }

  async onDepartmentUpdated(deptKey: string, dept: { label?: string; key?: string }) {
    const channel = await this.channelModel.findOne({ scope: 'department', deptKey });
    if (!channel) return;
    if (dept.label) channel.name = dept.label;
    if (dept.key && dept.key !== deptKey) channel.deptKey = dept.key;
    await channel.save();
  }

  async onDepartmentRemoved(deptKey: string) {
    await this.channelModel.updateMany(
      { scope: 'department', deptKey },
      { $set: { archived: true } },
    );
  }

  // ─── 권한 ───────────────────────────────────────────────────────────────
  private canRead(channel: ChannelDocument | Channel, ctx: AuthCtx): boolean {
    if (ctx.role === 'head-admin') return true;
    if (channel.scope === 'company') return true;
    if (channel.scope === 'department' && channel.deptKey === ctx.department) return true;
    return false;
  }

  private canWrite(channel: ChannelDocument | Channel, ctx: AuthCtx): boolean {
    if (!this.canRead(channel, ctx)) return false;
    if (channel.noticeOnly && ctx.role !== 'head-admin') return false;
    return true;
  }

  // 해당 채널의 게시글 알림을 받아야 하는 사용자 ID 목록
  private async getEligibleUserIdsForChannel(channel: Channel | ChannelDocument): Promise<string[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (channel.scope === 'department') {
      // 부서 채널: 같은 부서 직원 + head-admin 전원
      filter.$or = [{ department: channel.deptKey }, { role: 'head-admin' }];
    }
    // company 채널은 전 직원
    const users = await this.userModel.find(filter).select('_id').lean();
    return users.map((u) => u._id.toString());
  }

  // ─── 채널 CRUD ───────────────────────────────────────────────────────────
  async listChannels(ctx: AuthCtx) {
    try {
      await this.seedDefaultChannels();
      await this.syncDepartmentChannels();
    } catch (err) {
      this.logger.error('채널 시드/싱크 실패', err);
    }
    const filter = ctx.role === 'head-admin' ? {} : { archived: false };
    const all = await this.channelModel
      .find(filter)
      .sort({ scope: 1, order: 1, createdAt: 1 })
      .lean();
    return all.filter((c) => this.canRead(c, ctx));
  }

  async listAllChannelsForAdmin() {
    return this.channelModel.find().sort({ archived: 1, scope: 1, order: 1, createdAt: 1 }).lean();
  }

  async createChannel(
    ctx: AuthCtx,
    dto: { name: string; scope?: ChannelScope; deptKey?: string; noticeOnly?: boolean },
  ) {
    if (ctx.role !== 'head-admin') {
      throw new ForbiddenException('게시판 생성 권한이 없습니다.');
    }
    if (!dto.name?.trim()) throw new BadRequestException('게시판 이름이 필요합니다.');
    const scope: ChannelScope = dto.scope ?? 'company';
    if (scope === 'department' && !dto.deptKey) {
      throw new BadRequestException('부서 게시판은 deptKey가 필요합니다.');
    }
    return this.channelModel.create({
      name: dto.name.trim(),
      scope,
      deptKey: scope === 'department' ? dto.deptKey : null,
      noticeOnly: !!dto.noticeOnly,
      order: 50,
    });
  }

  async updateChannel(
    ctx: AuthCtx,
    id: string,
    dto: { name?: string; noticeOnly?: boolean; order?: number; archived?: boolean },
  ) {
    if (ctx.role !== 'head-admin') {
      throw new ForbiddenException('게시판 수정 권한이 없습니다.');
    }
    const channel = await this.channelModel.findById(id);
    if (!channel) throw new NotFoundException('게시판을 찾을 수 없습니다.');
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.noticeOnly !== undefined) channel.noticeOnly = dto.noticeOnly;
    if (dto.order !== undefined) channel.order = dto.order;
    if (dto.archived !== undefined) channel.archived = dto.archived;
    await channel.save();
    return channel.toObject();
  }

  async removeChannel(ctx: AuthCtx, id: string) {
    if (ctx.role !== 'head-admin') {
      throw new ForbiddenException('게시판 삭제 권한이 없습니다.');
    }
    const channel = await this.channelModel.findById(id);
    if (!channel) throw new NotFoundException('게시판을 찾을 수 없습니다.');
    if (channel.systemManaged) {
      throw new BadRequestException('시스템 자동 관리 게시판은 삭제할 수 없습니다.');
    }
    await this.postModel.deleteMany({ channelId: channel._id });
    await this.readStateModel.deleteMany({ channelId: channel._id });
    await this.channelModel.deleteOne({ _id: channel._id });
    return { ok: true };
  }

  // ─── 미열람 카운트 / 읽음 처리 ───────────────────────────────────────────
  async getUnreadSummary(ctx: AuthCtx) {
    const channels = await this.listChannels(ctx);
    if (channels.length === 0) return { total: 0, byChannel: {} as Record<string, number> };

    const states = await this.readStateModel
      .find({ userId: new Types.ObjectId(ctx.userId) })
      .lean();
    const stateMap = new Map(states.map((s) => [String(s.channelId), s.lastReadAt]));

    // 채널별 createdAt > lastReadAt 인 게시글 수 카운트
    const epoch = new Date(0);
    const counts = await Promise.all(
      channels.map(async (c) => {
        const since = stateMap.get(String(c._id)) ?? epoch;
        const count = await this.postModel.countDocuments({
          channelId: c._id,
          createdAt: { $gt: since },
          // 본인 글은 제외
          authorId: { $ne: new Types.ObjectId(ctx.userId) },
        });
        return [String(c._id), count] as const;
      }),
    );

    const byChannel: Record<string, number> = {};
    let total = 0;
    for (const [cid, n] of counts) {
      if (n > 0) {
        byChannel[cid] = n;
        total += n;
      }
    }
    return { total, byChannel };
  }

  async markChannelRead(ctx: AuthCtx, channelId: string) {
    const channel = await this.channelModel.findById(channelId).lean();
    if (!channel) throw new NotFoundException('게시판을 찾을 수 없습니다.');
    if (!this.canRead(channel, ctx)) throw new ForbiddenException('접근 권한이 없습니다.');
    await this.readStateModel.updateOne(
      {
        userId: new Types.ObjectId(ctx.userId),
        channelId: new Types.ObjectId(channelId),
      },
      { $set: { lastReadAt: new Date() } },
      { upsert: true },
    );
    return { ok: true };
  }

  // ─── Post CRUD ───────────────────────────────────────────────────────────
  async listRecent(ctx: AuthCtx, limit = 5) {
    const channels = await this.listChannels(ctx);
    if (channels.length === 0) return [];
    const ids = channels.map((c) => c._id);
    const posts = await this.postModel
      .find({ channelId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(limit, 50)))
      .lean();
    const channelMap = new Map(channels.map((c) => [String(c._id), c]));
    return posts.map((p) => ({
      ...p,
      channel: channelMap.get(String(p.channelId)) ?? null,
    }));
  }

  async listPosts(ctx: AuthCtx, channelId: string) {
    const channel = await this.channelModel.findById(channelId).lean();
    if (!channel) throw new NotFoundException('게시판을 찾을 수 없습니다.');
    if (!this.canRead(channel, ctx)) throw new ForbiddenException('접근 권한이 없습니다.');
    return this.postModel
      .find({ channelId: new Types.ObjectId(channelId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async findPost(ctx: AuthCtx, id: string) {
    const post = await this.postModel.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    );
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const channel = await this.channelModel.findById(post.channelId).lean();
    if (channel && !this.canRead(channel, ctx)) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }
    const obj = post.toObject() as unknown as Record<string, unknown>;
    return {
      ...obj,
      channel: channel
        ? {
            _id: channel._id,
            name: channel.name,
            scope: channel.scope,
            deptKey: channel.deptKey,
            archived: channel.archived,
          }
        : null,
    };
  }

  async createPost(
    ctx: AuthCtx,
    authorName: string,
    dto: { channelId: string; title: string; content: string },
  ) {
    if (!dto.channelId) throw new BadRequestException('게시판이 지정되지 않았습니다.');
    const channel = await this.channelModel.findById(dto.channelId);
    if (!channel) throw new NotFoundException('게시판을 찾을 수 없습니다.');
    if (channel.archived) throw new BadRequestException('보관된 게시판에는 작성할 수 없습니다.');
    if (!this.canWrite(channel, ctx)) {
      throw new ForbiddenException('이 게시판에 작성할 권한이 없습니다.');
    }
    if (!dto.title?.trim()) throw new BadRequestException('제목을 입력해주세요.');
    if (!dto.content?.trim()) throw new BadRequestException('내용을 입력해주세요.');
    const post = await this.postModel.create({
      title: dto.title.trim(),
      content: dto.content,
      authorId: new Types.ObjectId(ctx.userId),
      authorName,
      channelId: channel._id,
    });

    // 작성자는 자동으로 read 처리
    await this.readStateModel.updateOne(
      { userId: new Types.ObjectId(ctx.userId), channelId: channel._id },
      { $set: { lastReadAt: new Date() } },
      { upsert: true },
    );

    // 실시간 알림 발송 (작성자 제외)
    try {
      const recipientIds = await this.getEligibleUserIdsForChannel(channel);
      const targets = recipientIds.filter((uid) => uid !== ctx.userId);
      if (targets.length > 0) {
        this.messengerGateway.emitToUsers(targets, 'boardChanged', {
          kind: 'newPost',
          postId: post._id.toString(),
          channelId: channel._id.toString(),
          channelName: channel.name,
          title: post.title,
          authorName,
        });
      }
    } catch (err) {
      this.logger.error('게시판 실시간 알림 발송 실패', err);
    }

    return post;
  }

  async updatePost(
    ctx: AuthCtx,
    id: string,
    dto: Partial<{ title: string; content: string; channelId: string }>,
  ) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const isOwner = post.authorId.toString() === ctx.userId;
    if (!isOwner && ctx.role !== 'head-admin') {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }
    if (dto.channelId) {
      const targetChannel = await this.channelModel.findById(dto.channelId);
      if (!targetChannel) throw new NotFoundException('이동할 게시판을 찾을 수 없습니다.');
      if (!this.canWrite(targetChannel, ctx)) {
        throw new ForbiddenException('해당 게시판에 작성 권한이 없습니다.');
      }
      post.channelId = targetChannel._id as Types.ObjectId;
    }
    if (dto.title !== undefined) post.title = dto.title.trim();
    if (dto.content !== undefined) post.content = dto.content;
    await post.save();
    return post.toObject();
  }

  async removePost(ctx: AuthCtx, id: string) {
    const post = await this.postModel.findById(id);
    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');
    const isOwner = post.authorId.toString() === ctx.userId;
    if (!isOwner && ctx.role !== 'head-admin') {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }
    await this.postModel.deleteOne({ _id: post._id });
    return { ok: true };
  }
}
