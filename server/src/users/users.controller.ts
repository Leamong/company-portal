import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService, UpdateUserDto } from './users.service';
import type { CreateUserDto } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
