import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateConfirmDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  designType: string;
}
