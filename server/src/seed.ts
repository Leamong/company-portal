/**
 * 테스트 계정 시드 스크립트
 * 실행: npx ts-node -r tsconfig-paths/register src/seed.ts
 * 또는: pnpm seed
 */
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/company-portal';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    position: { type: String, default: '' },
    department: { type: String, default: 'design' },
    role: { type: String, default: 'employee' },
    isActive: { type: Boolean, default: true },
    profileImage: { type: String, default: null },
    allowedIps: { type: [String], default: [] },
  },
  { timestamps: true },
);

async function seed() {
  console.log('🌱 MongoDB에 연결 중...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 연결 성공:', MONGODB_URI);

  const User = mongoose.model('User', UserSchema);

  const testUsers = [
    {
      email: 'admin@company.com',
      password: 'admin1234!',
      name: '헤드 어드민',
      position: '대표',
      department: 'management',
      role: 'head-admin',
    },
    {
      email: 'marketing@company.com',
      password: 'test1234!',
      name: '김마케팅',
      position: '대리',
      department: 'marketing',
      role: 'employee',
    },
    {
      email: 'design@company.com',
      password: 'test1234!',
      name: '이디자인',
      position: '사원',
      department: 'design',
      role: 'employee',
    },
  ];

  for (const userData of testUsers) {
    const existing = await User.findOne({ email: userData.email });
    if (existing) {
      console.log(`⚠️  이미 존재: ${userData.email} (건너뜀)`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    await User.create({ ...userData, password: hashedPassword });
    console.log(`✅ 생성: ${userData.email} / ${userData.password} (${userData.role})`);
  }

  console.log('\n🎉 시드 완료! 아래 계정으로 로그인하세요:\n');
  console.log('  헤드 어드민: admin@company.com / admin1234!');
  console.log('  마케팅팀:    marketing@company.com / test1234!');
  console.log('  디자인팀:    design@company.com / test1234!');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ 시드 실패:', err);
  process.exit(1);
});
