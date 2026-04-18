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
} from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostCategory } from './schemas/post.schema';

interface AuthUser {
  _id: string;
  name: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Get()
  findAll(@Query('category') category?: string) {
    return this.boardService.findAll(category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boardService.findOne(id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title: string; content: string; category: PostCategory },
  ) {
    return this.boardService.create(
      user._id.toString(),
      user.name,
      user.role,
      body,
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; content: string; category: PostCategory }>,
  ) {
    return this.boardService.update(id, user._id.toString(), user.role, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.remove(id, user._id.toString(), user.role);
  }
}
