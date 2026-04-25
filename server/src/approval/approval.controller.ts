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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApprovalStatus, ApprovalFormType } from './schemas/approval.schema';
import { StorageService } from '../storage/storage.service';

interface AuthUser {
  _id: string;
  name: string;
  role: string;
  department?: string;
  position?: string;
  canApprove?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('approval')
export class ApprovalController {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly storageService: StorageService,
  ) {}

  // ─── 증빙 파일 업로드 ────────────────────────────────────────
  // R2가 구성돼 있으면 R2에 저장, 아니면 개발용 base64 data URL 반환
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEvidence(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');
    const ALLOWED = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다. (이미지 또는 PDF)');
    }

    if (this.storageService.isConfigured()) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `approval/${user._id}/${Date.now()}-${safeName}`;
      const url = await this.storageService.uploadObject(
        key,
        file.buffer,
        file.mimetype,
      );
      return { url, name: file.originalname, size: file.size, mime: file.mimetype };
    }

    // R2 미구성 — 개발 편의를 위해 base64 data URL로 대체
    const base64 = file.buffer.toString('base64');
    return {
      url: `data:${file.mimetype};base64,${base64}`,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
    };
  }

  // ─── 결재 체인 설정 조회 ─────────────────────────────────────
  @Get('chain-settings')
  getChainSettings() {
    return this.approvalService.getChainSettings();
  }

  // ─── 결재 체인 설정 저장 (어드민 전용) ───────────────────────
  @Patch('chain-settings')
  saveChainSettings(@Body() body: { chain: any[] }) {
    return this.approvalService.saveChainSettings(body.chain ?? []);
  }

  // ─── 결재 가능한 사용자 목록 ──────────────────────────────────
  @Get('approvers')
  getApprovers() {
    return this.approvalService.getApprovers();
  }

  // ─── 통계 (어드민) ────────────────────────────────────────────
  @Get('stats')
  getStats() {
    return this.approvalService.getStats();
  }

  // ─── 관리자용: 직원별 기안 대기 건수 ──────────────────────────
  @Get('pending-by-applicant')
  getPendingCountByApplicant() {
    return this.approvalService.getPendingCountByApplicant();
  }

  // ─── 증빙 미제출 목록 ─────────────────────────────────────────
  // 관리자는 scope=all 사용 시 전체, 일반 직원은 무조건 본인 것만
  @Get('missing-evidence')
  getMissingEvidence(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope?: string,
  ) {
    return this.approvalService.getMissingEvidence(
      { _id: user._id.toString(), role: user.role, canApprove: user.canApprove },
      scope === 'all' ? 'all' : 'mine',
    );
  }

  // ─── 내 임시저장함 ────────────────────────────────────────────
  @Get('drafts')
  getMyDrafts(@CurrentUser() user: AuthUser) {
    return this.approvalService.getMyDrafts(user._id.toString());
  }

  // ─── 내 기안 문서함 (검토중) ──────────────────────────────────
  @Get('mine-pending')
  getMyPending(@CurrentUser() user: AuthUser) {
    return this.approvalService.getMyPending(user._id.toString());
  }

  // ─── 내 결재 완료함 (승인/반려/취소) ─────────────────────────
  @Get('mine-done')
  getMyDone(@CurrentUser() user: AuthUser) {
    return this.approvalService.getMyDone(user._id.toString());
  }

  // ─── 기존: 내 상신함 전체 (하위 호환) ────────────────────────
  @Get('mine')
  getMyApprovals(@CurrentUser() user: AuthUser) {
    return this.approvalService.getMyApprovals(user._id.toString());
  }

  // ─── 결재 대기 수신함 ─────────────────────────────────────────
  @Get('inbox')
  getInbox(@CurrentUser() user: AuthUser) {
    return this.approvalService.getInbox({
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    });
  }

  // ─── 결재 수신 완료함 ─────────────────────────────────────────
  @Get('inbox-done')
  getInboxDone(@CurrentUser() user: AuthUser) {
    return this.approvalService.getInboxDone({
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    });
  }

  // ─── 완료함 (기존 호환) ───────────────────────────────────────
  @Get('done')
  getDone(@CurrentUser() user: AuthUser) {
    return this.approvalService.getDone({
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    });
  }

  // ─── 부서 문서함 (어드민) ─────────────────────────────────────
  @Get('dept/:dept')
  getDeptDocs(@Param('dept') dept: string) {
    return this.approvalService.getDeptDocs(dept);
  }

  // ─── 전체 검색 (어드민) ───────────────────────────────────────
  @Get('search')
  searchAll(@Query('q') keyword: string) {
    return this.approvalService.searchAll(keyword ?? '');
  }

  // ─── 단건 조회 ────────────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.approvalService.findOne(id);
  }

  // ─── 임시저장 ─────────────────────────────────────────────────
  @Post('draft')
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      formType: ApprovalFormType;
      title: string;
      formData: Record<string, any>;
      approverId?: string;
      deptLabel?: string;
    },
  ) {
    return this.approvalService.saveDraft(
      user._id.toString(),
      user.name,
      body.deptLabel ?? user.department ?? '',
      user.position ?? '',
      body,
    );
  }

  // ─── 기안 작성 (바로 상신) ────────────────────────────────────
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      formType?: ApprovalFormType;
      title: string;
      reason?: string;
      formData?: Record<string, any>;
      startDate?: string;
      endDate?: string;
      amount?: number;
      approverId?: string;
      vacationType?: string;
      overtimeDate?: string;
      overtimeStartTime?: string;
      overtimeEndTime?: string;
      deptLabel?: string;
      applicantStampData?: {
        svg: string;
        color: string;
        applicantName: string;
        submittedAt: string;
      } | null;
    },
  ) {
    return this.approvalService.create(
      user._id.toString(),
      user.name,
      body.deptLabel ?? user.department ?? '',
      user.position ?? '',
      body,
    );
  }

  // ─── 임시저장 → 상신 ─────────────────────────────────────────
  @Patch(':id/submit')
  submitDraft(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.approvalService.submitDraft(id, user._id.toString());
  }

  // ─── 임시저장 수정 ────────────────────────────────────────────
  @Patch(':id/draft')
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { title?: string; formData?: Record<string, any>; approverId?: string },
  ) {
    return this.approvalService.updateDraft(id, user._id.toString(), body);
  }

  // ─── 읽음 처리 ────────────────────────────────────────────────
  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.approvalService.markAsRead(id, user._id.toString());
  }

  // ─── 사후 증빙 추가 (기안자 본인만) ─────────────────────────
  @Patch(':id/evidence')
  addEvidence(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { urls: string[] },
  ) {
    return this.approvalService.addEvidence(id, user._id.toString(), body.urls ?? []);
  }

  // ─── 결재 처리 (승인/반려) ────────────────────────────────────
  @Patch(':id/decide')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
      comment?: string;
      stampData?: { svg: string; color: string; approverName: string } | null;
    },
  ) {
    return this.approvalService.decide(id, {
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    }, body);
  }

  // ─── 어드민 전용 영구 삭제 (라우트 순서상 :id 앞에 위치) ────
  @Delete('admin/:id')
  adminDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.approvalService.adminDelete(id, user.role);
  }

  // ─── 기안 취소 ────────────────────────────────────────────────
  @Delete(':id')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.approvalService.cancel(id, user._id.toString());
  }
}
