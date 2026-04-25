/* eslint-disable @typescript-eslint/no-require-imports */
// 일회성 스크립트: 가입된 직원(employee)의 입사일을 한 달 전으로 설정
// 사용: cd server && node scripts/set-employee-hire-date.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI 환경변수가 없습니다.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const User = mongoose.model(
    'User',
    new mongoose.Schema({}, { strict: false, collection: 'users' }),
  );

  // 한 달 전 날짜
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const before = await User.find({ role: 'employee' }).select('name email hireDate').lean();
  console.log('\n── 업데이트 전 ──');
  before.forEach((u) => console.log(`  ${u.name} (${u.email}): hireDate=${u.hireDate ?? 'null'}`));

  const result = await User.updateMany(
    { role: 'employee' },
    { $set: { hireDate: oneMonthAgo } },
  );
  console.log(`\n✓ ${result.modifiedCount}명의 입사일을 ${oneMonthAgo.toISOString().split('T')[0]}로 설정`);

  const after = await User.find({ role: 'employee' }).select('name email hireDate').lean();
  console.log('\n── 업데이트 후 ──');
  after.forEach((u) => console.log(`  ${u.name} (${u.email}): hireDate=${u.hireDate?.toISOString?.().split('T')[0] ?? u.hireDate}`));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
