import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApprovalStatus, ApprovalType } from './schemas/approval.schema';

interface AuthUser {
  _id: string;
  name: string;
  role: string;
  canApprove?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  // 결재 가능한 사용자 목록 (기안 작성 시 결재자 선택용)
  @Get('approvers')
  getApprovers() {
    return this.approvalService.getApprovers();
  }

  // 내 상신함
  @Get('mine')
  getMyApprovals(@CurrentUser() user: AuthUser) {
    return this.approvalService.getMyApprovals(user._id.toString());
  }

  // 수신함 (head-admin은 전체, canApprove 직원은 본인 지정 건)
  @Get('inbox')
  getInbox(@CurrentUser() user: AuthUser) {
    return this.approvalService.getInbox({
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    });
  }

  // 완료함
  @Get('done')
  getDone(@CurrentUser() user: AuthUser) {
    return this.approvalService.getDone({
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    });
  }

  // 기안 작성
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      type: ApprovalType;
      title: string;
      reason: string;
      startDate?: string;
      endDate?: string;
      amount?: number;
      approverId?: string;
      approverName?: string;
      vacationType?: string;
      overtimeDate?: string;
      overtimeStartTime?: string;
      overtimeEndTime?: string;
    },
  ) {
    return this.approvalService.create(user._id.toString(), user.name, body);
  }

  // 결재 처리 (승인/반려)
  @Patch(':id/decide')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED;
      comment?: string;
    },
  ) {
    return this.approvalService.decide(id, {
      _id: user._id.toString(),
      role: user.role,
      canApprove: user.canApprove,
    }, body);
  }

  // 기안 취소
  @Delete(':id')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.approvalService.cancel(id, user._id.toString());
  }
}
