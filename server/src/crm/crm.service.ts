import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { Consultation, ConsultationDocument } from './schemas/consultation.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateConsultationDto } from './dto/create-consultation.dto';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(Client.name) private clientModel: Model<ClientDocument>,
    @InjectModel(Consultation.name) private consultationModel: Model<ConsultationDocument>,
  ) {}

  // ── 고객사 목록 조회 ────────────────────────────────────────────────────────
  async findAllClients(search?: string) {
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contact: { $regex: search, $options: 'i' } },
        { industry: { $regex: search, $options: 'i' } },
      ];
    }
    return this.clientModel.find(query).sort({ updatedAt: -1 }).exec();
  }

  // ── 고객사 단건 조회 ────────────────────────────────────────────────────────
  async findOneClient(id: string) {
    const client = await this.clientModel.findById(id).exec();
    if (!client) throw new NotFoundException('고객사를 찾을 수 없습니다.');
    return client;
  }

  // ── 고객사 생성 ─────────────────────────────────────────────────────────────
  async createClient(dto: CreateClientDto): Promise<ClientDocument> {
    const client = new this.clientModel(dto);
    return client.save();
  }

  // ── 고객사 수정 ─────────────────────────────────────────────────────────────
  async updateClient(id: string, dto: UpdateClientDto): Promise<ClientDocument> {
    const client = await this.clientModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!client) throw new NotFoundException('고객사를 찾을 수 없습니다.');
    return client;
  }

  // ── 고객사 삭제 (연결된 상담 히스토리도 함께 삭제) ──────────────────────────
  async removeClient(id: string): Promise<void> {
    const client = await this.clientModel.findByIdAndDelete(id).exec();
    if (!client) throw new NotFoundException('고객사를 찾을 수 없습니다.');
    await this.consultationModel.deleteMany({ clientId: new Types.ObjectId(id) }).exec();
  }

  // ── 상담 히스토리 조회 ──────────────────────────────────────────────────────
  async findConsultations(clientId: string) {
    return this.consultationModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  // ── 상담 기록 추가 ──────────────────────────────────────────────────────────
  async createConsultation(dto: CreateConsultationDto): Promise<ConsultationDocument> {
    const consultation = new this.consultationModel({
      ...dto,
      clientId: new Types.ObjectId(dto.clientId),
    });
    const saved = await consultation.save();

    // 고객사 최근 연락일 갱신
    await this.clientModel.findByIdAndUpdate(dto.clientId, {
      $set: { updatedAt: new Date() },
    });

    return saved;
  }

  // ── 상담 기록 삭제 ──────────────────────────────────────────────────────────
  async removeConsultation(id: string): Promise<void> {
    const result = await this.consultationModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('상담 기록을 찾을 수 없습니다.');
  }
}
