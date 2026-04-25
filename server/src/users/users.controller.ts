import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService, UpdateUserDto } from './users.service';
import type { CreateUserDto } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from './schemas/user.schema';

interface AuthUser {
  _id: string;
  name: string;
  role: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 본인 연차 잔여량 조회 (근로기준법 기준 자동 계산)
  @Get('me/annual-leave')
  getMyAnnualLeave(@CurrentUser() user: AuthUser) {
    return this.usersService.getAnnualLeaveBalance(user._id);
  }

  // 대표 전용: 부재 상태 직접 토글 (결재 절차 없음)
  @Patch('me/absence-status')
  updateMyAbsenceStatus(
    @CurrentUser() user: AuthUser,
    @Body() body: { absenceStatus: string | null },
  ) {
    return this.usersService.updateAbsenceStatus(user._id, body.absenceStatus);
  }

  // 대시보드 커스텀 레이아웃 저장
  @Patch('me/dashboard-layout')
  updateMyDashboardLayout(
    @CurrentUser() user: AuthUser,
    @Body() body: { layout: Array<{ i: string; x: number; y: number; w: number; h: number; hidden?: boolean }> },
  ) {
    return this.usersService.updateDashboardLayout(user._id, body.layout);
  }

  // 어드민 전용: 전체 상세 정보
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // 어드민 전용: 직원 직접 생성 (조직도에서 사용)
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  createUser(
    @Body()
    dto: {
      email: string;
      password: string;
      name: string;
      position?: string;
      department?: string;
      phone?: string;
      birthDate?: string;
      emergencyContact?: { name: string; phone: string; relation: string };
    },
  ) {
    return this.usersService.create(dto as CreateUserDto);
  }

  // 조직도용: 로그인한 모든 직원 (공개 필드만)
  @Get('org')
  findOrgChart() {
    return this.usersService.findOrgChart();
  }

  // 로그인한 모든 직원: 메신저 DM 선택용 (이름/부서/직급만)
  @Get('directory')
  findDirectory() {
    return this.usersService.findDirectory();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }
}
