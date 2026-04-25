import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApprovalChainSettingsDocument = ApprovalChainSettings & Document;

export interface DefaultChainStep {
  approverId: string;
  approverName: string;
  approverPosition: string;
  order: number;
}

@Schema({ collection: 'approval_chain_settings' })
export class ApprovalChainSettings {
  @Prop({
    type: [
      {
        approverId: { type: String, required: true },
        approverName: { type: String, required: true },
        approverPosition: { type: String, default: '' },
        order: { type: Number, required: true },
        _id: false,
      },
    ],
    default: [],
  })
  chain: DefaultChainStep[];
}

export const ApprovalChainSettingsSchema = SchemaFactory.createForClass(ApprovalChainSettings);
