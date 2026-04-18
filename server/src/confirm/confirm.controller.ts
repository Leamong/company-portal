import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfirmService } from './confirm.service';
import { CreateConfirmDto } from './dto/create-confirm.dto';
import { AddPinDto } from './dto/add-pin.dto';
import { RejectConfirmDto } from './dto/reject-confirm.dto';
import { ConfirmStatus } from './schemas/confirm.schema';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('confirm')
export class ConfirmController {
  constructor(private readonly confirmService: ConfirmService) {}

  @Get()
  async findAll(
    @Query('status') status?: ConfirmStatus,
    @Query('uploaderId') uploaderId?: string,
  ) {
    const items = await this.confirmService.findAll({ status, uploaderId });
    return { data: items, statusCode: 200, message: 'ok' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const item = await this.confirmService.findOne(id);
    return { data: item, statusCode: 200, message: 'ok' };
  }

  // 파일 업로드 + 컨펌 항목 생성 (직원용)
  // 실제 R2 업로드는 StorageService 연동 후 활성화 예정
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateConfirmDto,
    @CurrentUser() user: { userId: string; name: string; role: string },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|pdf)$/ }),
        ],
        fileIsRequired: false, // 개발 중 파일 없이도 허용
      }),
    )
    file?: Express.Multer.File,
  ) {
    // TODO: file이 있으면 StorageService.upload(file) 호출 후 imageUrl, imageKey 획득
    const imageUrl = file ? `https://placeholder.r2.dev/${file.originalname}` : '';
    const imageKey = file ? `confirm/${Date.now()}_${file.originalname}` : '';

    const item = await this.confirmService.create(
      dto,
      user.userId,
      user.name,
      imageUrl,
      imageKey,
    );
    return { data: item, statusCode: 201, message: '컨펌 항목이 생성되었습니다.' };
  }

  // 승인 (어드민 전용)
  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const item = await this.confirmService.approve(id, user.role as any);
    return { data: item, statusCode: 200, message: '승인되었습니다.' };
  }

  // 반려 (어드민 전용)
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectConfirmDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const item = await this.confirmService.reject(id, dto, user.role as any);
    return { data: item, statusCode: 200, message: '반려되었습니다.' };
  }

  // 핀 추가 (어드민 전용)
  @Post(':id/pins')
  async addPin(
    @Param('id') id: string,
    @Body() dto: AddPinDto,
    @CurrentUser() user: { userId: string; name: string; role: string },
  ) {
    const item = await this.confirmService.addPin(id, dto, user.userId, user.name, user.role as any);
    return { data: item, statusCode: 201, message: '핀이 추가되었습니다.' };
  }

  // 핀 해결 처리 (어드민 전용)
  @Patch(':id/pins/:pinId/resolve')
  async resolvePin(
    @Param('id') id: string,
    @Param('pinId') pinId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const item = await this.confirmService.resolvePin(id, pinId, user.role as any);
    return { data: item, statusCode: 200, message: '핀이 해결됨으로 처리되었습니다.' };
  }
}
