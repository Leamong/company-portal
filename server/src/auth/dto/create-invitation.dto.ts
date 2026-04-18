import { IsEmail, IsEnum, IsString } from 'class-validator';
import { UserRole } from '../../users/schemas/user.schema';

export class CreateInvitationDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsEnum(UserRole, { message: '올바른 권한 값이 아닙니다.' })
  role: UserRole;

  @IsString({ message: '부서 값이 올바르지 않습니다.' })
  department: string;
}
