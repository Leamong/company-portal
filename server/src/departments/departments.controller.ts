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
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  create(
    @Body() body: { key?: string; label: string; color?: string; description?: string },
  ) {
    return this.departmentsService.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: { key?: string; label?: string; color?: string; description?: string },
  ) {
    return this.departmentsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.HEAD_ADMIN)
  remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }
}
