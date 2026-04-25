import { Body, Controller, Get, Param, Patch, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeavePolicyService } from './leave-policy.service';
import { LeaveCategory } from './schemas/leave-policy.schema';
import { UserRole } from '../users/schemas/user.schema';

interface AuthUser {
  _id: string;
  role: string;
}

@UseGuards(JwtAuthGuard)
@Controller('leave-policies')
export class LeavePolicyController {
  constructor(private readonly policyService: LeavePolicyService) {}

  // 전체 조회 (인증된 유저 누구나 - 폼에서 상한 안내용)
  @Get()
  findAll() {
    return this.policyService.findAll();
  }

  // 관리자 전용 수정
  @Patch(':category')
  update(
    @CurrentUser() user: AuthUser,
    @Param('category') category: LeaveCategory,
    @Body()
    body: {
      maxDaysPerRequest?: number;
      annualCap?: number;
      requiresEvidence?: boolean;
      deductFromAnnualLeave?: boolean;
      active?: boolean;
      description?: string;
    },
  ) {
    if (user.role !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('관리자만 정책을 수정할 수 있습니다.');
    }
    return this.policyService.update(category, body);
  }
}
