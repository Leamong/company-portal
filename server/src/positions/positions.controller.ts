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
import { PositionsService } from './positions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  findAll() {
    return this.positionsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  create(@Body() body: { title: string; level?: number; description?: string }) {
    return this.positionsService.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: { title?: string; level?: number; description?: string },
  ) {
    return this.positionsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  remove(@Param('id') id: string) {
    return this.positionsService.remove(id);
  }
}
