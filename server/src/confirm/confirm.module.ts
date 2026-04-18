import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfirmController } from './confirm.controller';
import { ConfirmService } from './confirm.service';
import { Confirm, ConfirmSchema } from './schemas/confirm.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Confirm.name, schema: ConfirmSchema }])],
  controllers: [ConfirmController],
  providers: [ConfirmService],
  exports: [ConfirmService],
})
export class ConfirmModule {}
