import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ConsultationType } from '../schemas/consultation.schema';

export class CreateConsultationDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsEnum(ConsultationType)
  type: ConsultationType;

  @IsString()
  @IsNotEmpty()
  memo: string;
}
