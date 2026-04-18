import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private readonly bucket: string;

  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = configService.get<string>('R2_BUCKET', 'company-portal');
    this.publicUrl = configService.get<string>('R2_PUBLIC_URL', '');

    const endpoint = configService.get<string>('R2_ENDPOINT');
    const accessKeyId = configService.get<string>('R2_ACCESS_KEY');
    const secretAccessKey = configService.get<string>('R2_SECRET_KEY');

    // R2 환경변수가 실제로 설정된 경우에만 클라이언트 초기화
    if (endpoint && accessKeyId && secretAccessKey &&
        !endpoint.includes('<account-id>') &&
        accessKeyId !== 'your-r2-access-key') {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('R2 환경변수 미설정 — 파일 삭제 기능 비활성화');
    }
  }

  /** 오브젝트 업로드 → 공개 URL 반환 */
  async uploadObject(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client) throw new Error('R2 클라이언트가 초기화되지 않았습니다.');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`R2 업로드 완료: ${key}`);
    return `${this.publicUrl}/${key}`;
  }

  /** 단일 오브젝트 삭제 */
  async deleteObject(key: string): Promise<void> {
    if (!this.client || !key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`R2 삭제 완료: ${key}`);
    } catch (err) {
      this.logger.error(`R2 삭제 실패: ${key}`, err);
    }
  }

  /** 복수 오브젝트 일괄 삭제 (최대 1000개) */
  async deleteObjects(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      this.logger.log(`R2 일괄 삭제 완료: ${keys.length}개`);
    } catch (err) {
      this.logger.error('R2 일괄 삭제 실패', err);
    }
  }
}
