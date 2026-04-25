/**
 * 근로기준법 제60조에 따른 연차 유급휴가 발생 일수 계산
 *
 * - 입사 1년 미만: 한 달 개근 시 1일 (최대 11일)
 * - 입사 1년 이상, 출근율 80% 이상: 15일 기본
 * - 3년 이상 근속 시 매 2년마다 +1일 (최대 25일)
 *   ex) 3년차=16일, 5년차=17일, 7년차=18일, ... 21년차=25일
 *
 * 출근율 체크는 본 포털의 MVP 범위 밖이므로 1년 이상 근속자는
 * 80% 이상 출근을 충족한 것으로 가정한다.
 */
export function calculateAnnualLeaveEntitlement(
  hireDate: Date | null | undefined,
  asOf: Date = new Date(),
): number {
  if (!hireDate) return 0;

  const hire = new Date(hireDate);
  if (Number.isNaN(hire.getTime())) return 0;

  // 근속 일수
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((asOf.getTime() - hire.getTime()) / msPerDay);
  if (days < 0) return 0;

  // 근속 개월수 (입사 후 달력상 경과 개월 수)
  const completedMonths =
    (asOf.getFullYear() - hire.getFullYear()) * 12 +
    (asOf.getMonth() - hire.getMonth()) -
    (asOf.getDate() < hire.getDate() ? 1 : 0);

  // 1년 미만 구간: 월 단위 발생, 최대 11일
  if (days < 365) {
    return Math.max(0, Math.min(completedMonths, 11));
  }

  // 1년 이상: 15일 기본 + 3년 이상 근속분
  const tenureYears = Math.floor(completedMonths / 12);
  const bonus = Math.floor((tenureYears - 1) / 2);
  return Math.min(15 + Math.max(0, bonus), 25);
}

/**
 * 현재 연차 회계연도의 시작일 (직전 입사 기념일)
 * - 입사 1년 미만자는 hireDate 그대로 반환
 */
export function getCurrentLeavePeriodStart(
  hireDate: Date,
  asOf: Date = new Date(),
): Date {
  const hire = new Date(hireDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((asOf.getTime() - hire.getTime()) / msPerDay);
  if (days < 365) return hire;

  const anniversary = new Date(hire);
  anniversary.setFullYear(asOf.getFullYear());
  if (anniversary.getTime() > asOf.getTime()) {
    anniversary.setFullYear(asOf.getFullYear() - 1);
  }
  return anniversary;
}

/**
 * 휴가 신청 문서 1건의 '연차 차감 일수' 계산
 * - 연차: (endDate - startDate + 1)일
 * - 반차(오전/오후): 0.5일
 * - 병가·경조사·공가 등 연차 외 유형: 0일 (연차에서 차감하지 않음)
 */
export function leaveDaysFromFormData(formData: Record<string, any>): number {
  const vacationType: string | undefined =
    formData?.vacationType || formData?.leaveType;
  if (!vacationType) return 0;

  if (vacationType.includes('반차')) return 0.5;
  if (vacationType !== '연차') return 0;

  const start = formData?.startDate;
  const end = formData?.endDate || formData?.startDate;
  if (!start) return 0;

  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((e.getTime() - s.getTime()) / msPerDay) + 1;
  return Math.max(1, diff);
}
