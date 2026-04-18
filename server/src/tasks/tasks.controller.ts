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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, TaskDepartment } from './schemas/task.schema';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, type UserDocument } from '../users/schemas/user.schema';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // 전체 목록 조회 (필터: 부서, 담당자, 상태) — 보관 항목 제외
  @Get()
  findAll(
    @Query('department') department?: TaskDepartment,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: string,
  ) {
    return this.tasksService.findAll({ department, assigneeId, status, priority });
  }

  // 보관함 목록 조회 (전달완료만)
  @Get('archive')
  findArchived(
    @Query('department') department?: TaskDepartment,
    @Query('assigneeId') assigneeId?: string,
    @Query('designType') designType?: string,
  ) {
    return this.tasksService.findArchived({ department, assigneeId, designType });
  }

  // 단건 조회
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // 새 주문 등록
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: UserDocument) {
    return this.tasksService.create(dto, (user as any)._id.toString());
  }

  // 상태(컬럼) 변경 — 드래그앤드롭
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: TaskStatus,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.updateStatus(
      id,
      status,
      (user as any)._id.toString(),
      (user as any).role,
    );
  }

  // 카드 내용 수정
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.update(
      id,
      dto,
      (user as any)._id.toString(),
      (user as any).role,
    );
  }

  // 삭제 — 어드민 전용
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
