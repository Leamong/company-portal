import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { Client, ClientSchema } from './schemas/client.schema';
import { Consultation, ConsultationSchema } from './schemas/consultation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
