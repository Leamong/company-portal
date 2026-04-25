import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StorageService } from '../storage/storage.service';
import type { ChannelScope } from './schemas/channel.schema';

interface AuthUser {
  _id: string;
  name: string;
  role: string;
  department?: string;
}

function ctxOf(user: AuthUser) {
  return {
    userId: user._id.toString(),
    role: user.role,
    department: user.department,
  };
}

@UseGuards(JwtAuthGuard)
@Controller('board')
export class BoardController {
  constructor(
    private readonly boardService: BoardService,
    private readonly storageService: StorageService,
  ) {}

  // ─── 본문 이미지 업로드 (TipTap에서 호출) ──────────────────────────
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException('이미지 파일만 업로드할 수 있습니다.');
    }
    if (this.storageService.isConfigured()) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `board/${user._id}/${Date.now()}-${safeName}`;
      const url = await this.storageService.uploadObject(key, file.buffer, file.mimetype);
      return { url, name: file.originalname, size: file.size, mime: file.mimetype };
    }
    const base64 = file.buffer.toString('base64');
    return {
      url: `data:${file.mimetype};base64,${base64}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
  }

  // ─── 채널 (게시판) ──────────────────────────────────────────────
  @Get('channels')
  listChannels(@CurrentUser() user: AuthUser) {
    return this.boardService.listChannels(ctxOf(user));
  }

  @Get('channels/all')
  listAllForAdmin(@CurrentUser() user: AuthUser) {
    if (user.role !== 'head-admin') return this.boardService.listChannels(ctxOf(user));
    return this.boardService.listAllChannelsForAdmin();
  }

  @Post('channels')
  createChannel(
    @CurrentUser() user: AuthUser,
    @Body() body: { name: string; scope?: ChannelScope; deptKey?: string; noticeOnly?: boolean },
  ) {
    return this.boardService.createChannel(ctxOf(user), body);
  }

  @Patch('channels/:id')
  updateChannel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: { name?: string; noticeOnly?: boolean; order?: number; archived?: boolean },
  ) {
    return this.boardService.updateChannel(ctxOf(user), id, body);
  }

  @Delete('channels/:id')
  removeChannel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.removeChannel(ctxOf(user), id);
  }

  // ─── 미열람 / 읽음 처리 ────────────────────────────────────────────
  @Get('unread')
  getUnread(@CurrentUser() user: AuthUser) {
    return this.boardService.getUnreadSummary(ctxOf(user));
  }

  @Post('channels/:id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.markChannelRead(ctxOf(user), id);
  }

  // ─── 게시글 ─────────────────────────────────────────────────────
  @Get('posts/recent')
  listRecent(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.boardService.listRecent(ctxOf(user), Number(limit) || 5);
  }

  @Get('posts')
  listPosts(@CurrentUser() user: AuthUser, @Query('channelId') channelId: string) {
    if (!channelId) throw new BadRequestException('channelId 가 필요합니다.');
    return this.boardService.listPosts(ctxOf(user), channelId);
  }

  @Post('posts')
  createPost(
    @CurrentUser() user: AuthUser,
    @Body() body: { channelId: string; title: string; content: string },
  ) {
    return this.boardService.createPost(ctxOf(user), user.name, body);
  }

  @Get('posts/:id')
  findPost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.findPost(ctxOf(user), id);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; content: string; channelId: string }>,
  ) {
    return this.boardService.updatePost(ctxOf(user), id, body);
  }

  @Delete('posts/:id')
  removePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.removePost(ctxOf(user), id);
  }
}
