import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { UserDocument, UserRole } from '../users/schemas/user.schema';
import { Invitation, InvitationDocument } from './schemas/invitation.schema';
import { LoginDto } from './dto/login.dto';
import { InitHeadAdminDto } from './dto/init-head-admin.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { RegisterByInvitationDto } from './dto/register-by-invitation.dto';

export { LoginDto, InitHeadAdminDto, CreateInvitationDto, RegisterByInvitationDto };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(Invitation.name) private invitationModel: Model<InvitationDocument>,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    console.log('[LOGIN] user found:', !!user);
    if (!user) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    console.log('[LOGIN] stored hash:', user.password);
    console.log('[LOGIN] input password:', loginDto.password);
    const isPasswordValid = await this.usersService.validatePassword(user, loginDto.password);
    console.log('[LOGIN] password valid:', isPasswordValid);
    if (!isPasswordValid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    if (!user.isActive) throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');

    return this.generateToken(user);
  }

  // 최초 헤드 어드민 계정 생성 (head-admin이 없을 때만 허용)
  async initHeadAdmin(dto: InitHeadAdminDto) {
    const existingAdmin = await this.usersService.findHeadAdmin();
    if (existingAdmin) {
      throw new ForbiddenException('헤드 어드민 계정이 이미 존재합니다. 초기화는 1회만 가능합니다.');
    }

    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      name: dto.name,
      role: UserRole.HEAD_ADMIN,
      department: 'management',
    });

    return this.generateToken(user);
  }

  // 헤드 어드민이 직원 초대 토큰 발급
  async createInvitation(dto: CreateInvitationDto, invitedBy: UserDocument) {
    if (invitedBy.role !== UserRole.HEAD_ADMIN) {
      throw new ForbiddenException('초대 권한이 없습니다.');
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('이미 가입된 이메일입니다.');

    // 기존 미사용 초대 토큰 무효화
    await this.invitationModel.updateMany({ email: dto.email, used: false }, { used: true });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    await this.invitationModel.create({
      token,
      email: dto.email,
      role: dto.role,
      department: dto.department,
      expiresAt,
    });

    return {
      token,
      email: dto.email,
      expiresAt,
      registerUrl: `/register?token=${token}`,
    };
  }

  // 초대 토큰으로 회원가입
  async registerByInvitation(dto: RegisterByInvitationDto) {
    const invitation = await this.invitationModel.findOne({ token: dto.token, used: false });

    if (!invitation) throw new BadRequestException('유효하지 않은 초대 토큰입니다.');
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('만료된 초대 토큰입니다. 관리자에게 재초대를 요청하세요.');
    }

    const existing = await this.usersService.findByEmail(invitation.email);
    if (existing) throw new ConflictException('이미 가입된 이메일입니다.');

    const user = await this.usersService.create({
      email: invitation.email,
      password: dto.password,
      name: dto.name,
      role: invitation.role,
      department: invitation.department,
    });

    invitation.used = true;
    await invitation.save();

    return this.generateToken(user);
  }

  generateToken(user: UserDocument) {
    const payload = { sub: user._id.toString(), email: user.email, name: user.name };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.usersService.toProfileDto(user),
    };
  }

  async getProfile(userId: string) {
    return this.usersService.findById(userId);
  }
}
