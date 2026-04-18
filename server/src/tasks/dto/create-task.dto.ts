import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { DesignType, Priority, TaskDepartment } from '../schemas/task.schema';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  client: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  assigneeName?: string;

  @IsEnum(TaskDepartment)
  department: TaskDepartment;

  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @IsString()
  @IsNotEmpty()
  orderDate: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsEnum(DesignType)
  designType: DesignType;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  notes?: string;
}
