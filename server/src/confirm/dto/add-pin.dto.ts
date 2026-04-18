import { IsNumber, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class AddPinDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  @IsNotEmpty()
  @IsString()
  comment: string;
}
