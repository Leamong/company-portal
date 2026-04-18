import {
  Controller, Post, Get, Patch, Body, UseGuards,
  HttpCode, HttpStatus, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { InitHeadAdminDto } from './dto/init-head-admin.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RegisterByInvitationDto } from './dto/register-by-invitation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole, type UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // 최초 헤드 어드민 계정 생성 (head-admin이 없을 때만 허용)
  @Public()
  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  initHeadAdmin(@Body() dto: InitHeadAdminDto) {
    return this.authService.initHeadAdmin(dto);
  }

  // 헤드 어드민이 직원 초대 토큰 발급
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  createInvitation(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.authService.createInvitation(dto, user);
  }

  // 초대 토큰으로 회원가입
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  registerByInvitation(@Body() dto: RegisterByInvitationDto) {
    return this.authService.registerByInvitation(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: UserDocument) {
    const fresh = await this.usersService.findById(user._id.toString());
    return this.usersService.toProfileDto(fresh);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: UserDocument,
    @Body() body: { name?: string; phone?: string; birthDate?: string | null; profileImage?: string | null },
  ) {
    const updated = await this.usersService.updateOwnProfile(
      user._id.toString(),
      body,
    );
    return this.usersService.toProfileDto(updated);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser() user: UserDocument,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const updated = await this.usersService.updateAvatar(
      user._id.toString(),
      file,
    );
    return this.usersService.toProfileDto(updated);
  }
}
