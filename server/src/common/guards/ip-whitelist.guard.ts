import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // @Public() 데코레이터가 붙은 라우트는 IP 체크 건너뜀
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const clientIp = this.getClientIp(request);

    const allowedIpsEnv = this.configService.get<string>('ALLOWED_IPS', '');
    const allowedIps = allowedIpsEnv
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);

    // 개발 환경에서는 IP 체크 건너뜀
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'development') return true;

    if (!allowedIps.includes(clientIp)) {
      throw new ForbiddenException(`접근이 허용되지 않은 IP 주소입니다: ${clientIp}`);
    }

    return true;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      ''
    );
  }
}
