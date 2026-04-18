/**
 * 헤드 어드민 비밀번호 리셋 스크립트
 * 실행: pnpm ts-node -r tsconfig-paths/register src/reset-admin.ts
 */
import mongoose, { Schema, model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const NEW_PASSWORD = 'admin123';
const ADMIN_EMAIL = 'admin@gmail.com';

const UserSchema = new Schema({ email: String, password: String, role: String }, { strict: false });
const UserModel = model('User', UserSchema);

async function resetAdminPassword() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI가 .env에 없습니다.');
    process.exit(1);
  }

  console.log('🔌 MongoDB 연결 중...');
  await mongoose.connect(uri);
  console.log('✅ MongoDB 연결 성공');

  const user = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    console.error(`❌ ${ADMIN_EMAIL} 계정을 찾을 수 없습니다.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`✅ 계정 찾음: ${user.email} (role: ${user.role})`);
  console.log(`🔑 기존 해시: ${user.password}`);

  const newHash = await bcrypt.hash(NEW_PASSWORD, 10);
  const verify = await bcrypt.compare(NEW_PASSWORD, newHash);
  console.log(`✅ 해시 검증: ${verify}`);

  await UserModel.updateOne({ email: ADMIN_EMAIL }, { $set: { password: newHash } });

  console.log(`\n✅ 비밀번호 리셋 완료!`);
  console.log(`   이메일: ${ADMIN_EMAIL}`);
  console.log(`   비밀번호: ${NEW_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

resetAdminPassword().catch((err) => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
