import { Body, Controller, Get, Patch, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkScheduleService } from './work-schedule.service';
import { UserRole } from '../users/schemas/user.schema';

interface AuthUser {
  _id: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('work-schedule')
export class WorkScheduleController {
  constructor(private readonly scheduleService: WorkScheduleService) {}

  // 조회 (폼에서 반차 기본 시간 채우기용) — 인증자 누구나
  @Get()
  get() {
    return this.scheduleService.get();
  }

  // 관리자 전용 수정
  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Body()
    body: Partial<{
      halfDayMorningStart: string;
      halfDayMorningEnd: string;
      halfDayAfternoonStart: string;
      halfDayAfternoonEnd: string;
    }>,
  ) {
    if (user.role !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('관리자만 수정할 수 있습니다.');
    }
    return this.scheduleService.update(body);
  }
}
