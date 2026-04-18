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
import { CrmService } from './crm.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ── 고객사 목록 ─────────────────────────────────────────────────────────────
  @Get('clients')
  findAllClients(@Query('search') search?: string) {
    return this.crmService.findAllClients(search);
  }

  // ── 고객사 단건 ─────────────────────────────────────────────────────────────
  @Get('clients/:id')
  findOneClient(@Param('id') id: string) {
    return this.crmService.findOneClient(id);
  }

  // ── 고객사 생성 ─────────────────────────────────────────────────────────────
  @Post('clients')
  @HttpCode(HttpStatus.CREATED)
  createClient(@Body() dto: CreateClientDto) {
    return this.crmService.createClient(dto);
  }

  // ── 고객사 수정 ─────────────────────────────────────────────────────────────
  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.crmService.updateClient(id, dto);
  }

  // ── 고객사 삭제 (어드민 전용) ───────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  @Delete('clients/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeClient(@Param('id') id: string) {
    return this.crmService.removeClient(id);
  }

  // ── 상담 히스토리 조회 ──────────────────────────────────────────────────────
  @Get('clients/:id/consultations')
  findConsultations(@Param('id') id: string) {
    return this.crmService.findConsultations(id);
  }

  // ── 상담 기록 추가 ──────────────────────────────────────────────────────────
  @Post('consultations')
  @HttpCode(HttpStatus.CREATED)
  createConsultation(@Body() dto: CreateConsultationDto) {
    return this.crmService.createConsultation(dto);
  }

  // ── 상담 기록 삭제 ──────────────────────────────────────────────────────────
  @Delete('consultations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeConsultation(@Param('id') id: string) {
    return this.crmService.removeConsultation(id);
  }
}
