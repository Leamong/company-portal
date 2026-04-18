import { IsString, IsNotEmpty } from 'class-validator';

export class RejectConfirmDto {
  @IsNotEmpty()
  @IsString()
  rejectionNote: string;
}
