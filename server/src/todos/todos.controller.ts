import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

interface AuthUser {
  _id: string;
  name: string;
}

@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.todosService.findAllByUser(user._id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: { content: string },
  ) {
    return this.todosService.create(user._id, body.content);
  }

  @Patch('clear-completed')
  clearCompleted(@CurrentUser() user: AuthUser) {
    return this.todosService.clearCompleted(user._id);
  }

  @Patch('reorder')
  reorder(
    @CurrentUser() user: AuthUser,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.todosService.reorder(user._id, body.orderedIds || []);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { content?: string; isDone?: boolean; order?: number },
  ) {
    return this.todosService.update(id, user._id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.todosService.remove(id, user._id);
  }
}
