// 부서 · 직급 색상 팔레트
// 이 파일의 클래스 문자열은 Tailwind가 트리쉐이킹하지 않도록 전체 문자열로 유지합니다.

export interface ColorMeta {
  key: string;
  label: string;
  /** 카드/섹션 배경 */
  bg: string;
  /** 텍스트 */
  text: string;
  /** 아바타/원형 배경 */
  avatar: string;
  /** 작은 점 */
  dot: string;
  /** 캘린더 이벤트 배경 (진한 버전) */
  calBg: string;
  /** 배지 배경 (연한 버전) */
  badgeBg: string;
  /** 배지 텍스트 */
  badgeText: string;
}

// ─── 부서 전용 색상 (6가지, 선명한 계열) ──────────────────────────────────────
// 직급 색상과 완전히 겹치지 않는 세트
export const DEPT_COLORS: ColorMeta[] = [
  { key: 'blue',   label: '파랑', bg: 'bg-blue-50',   text: 'text-blue-700',   avatar: 'bg-blue-500',   dot: 'bg-blue-400',   calBg: 'bg-blue-500',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-700'   },
  { key: 'green',  label: '초록', bg: 'bg-green-50',  text: 'text-green-700',  avatar: 'bg-green-500',  dot: 'bg-green-400',  calBg: 'bg-green-500',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700'  },
  { key: 'teal',   label: '청록', bg: 'bg-teal-50',   text: 'text-teal-700',   avatar: 'bg-teal-500',   dot: 'bg-teal-400',   calBg: 'bg-teal-500',   badgeBg: 'bg-teal-100',   badgeText: 'text-teal-700'   },
  { key: 'orange', label: '주황', bg: 'bg-orange-50', text: 'text-orange-700', avatar: 'bg-orange-500', dot: 'bg-orange-400', calBg: 'bg-orange-400', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700' },
  { key: 'pink',   label: '분홍', bg: 'bg-pink-50',   text: 'text-pink-700',   avatar: 'bg-pink-500',   dot: 'bg-pink-400',   calBg: 'bg-pink-400',   badgeBg: 'bg-pink-100',   badgeText: 'text-pink-700'   },
  { key: 'red',    label: '빨강', bg: 'bg-red-50',    text: 'text-red-700',    avatar: 'bg-red-500',    dot: 'bg-red-400',    calBg: 'bg-red-500',    badgeBg: 'bg-red-100',    badgeText: 'text-red-700'    },
];

// ─── 직급 전용 색상 (6가지, 차분한 계열) ──────────────────────────────────────
// 부서 색상과 완전히 겹치지 않는 세트
export const POSITION_COLORS: ColorMeta[] = [
  { key: 'violet', label: '보라',   bg: 'bg-violet-50', text: 'text-violet-700', avatar: 'bg-violet-500', dot: 'bg-violet-400', calBg: 'bg-violet-500', badgeBg: 'bg-violet-100', badgeText: 'text-violet-700' },
  { key: 'purple', label: '자주',   bg: 'bg-purple-50', text: 'text-purple-700', avatar: 'bg-purple-500', dot: 'bg-purple-400', calBg: 'bg-purple-500', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700' },
  { key: 'indigo', label: '인디고', bg: 'bg-indigo-50', text: 'text-indigo-700', avatar: 'bg-indigo-500', dot: 'bg-indigo-400', calBg: 'bg-indigo-500', badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700' },
  { key: 'amber',  label: '황금',   bg: 'bg-amber-50',  text: 'text-amber-700',  avatar: 'bg-amber-500',  dot: 'bg-amber-400',  calBg: 'bg-amber-400',  badgeBg: 'bg-amber-100',  badgeText: 'text-amber-700'  },
  { key: 'cyan',   label: '하늘',   bg: 'bg-cyan-50',   text: 'text-cyan-700',   avatar: 'bg-cyan-500',   dot: 'bg-cyan-400',   calBg: 'bg-cyan-500',   badgeBg: 'bg-cyan-100',   badgeText: 'text-cyan-700'   },
  { key: 'gray',   label: '회색',   bg: 'bg-gray-50',   text: 'text-gray-700',   avatar: 'bg-gray-400',   dot: 'bg-gray-400',   calBg: 'bg-gray-400',   badgeBg: 'bg-gray-100',   badgeText: 'text-gray-600'   },
];

// 전체 (getColorMeta 조회용)
const ALL_COLORS: ColorMeta[] = [...DEPT_COLORS, ...POSITION_COLORS];

/** color key → ColorMeta (없으면 blue 반환) */
export function getColorMeta(key: string): ColorMeta {
  return ALL_COLORS.find((c) => c.key === key) ?? DEPT_COLORS[0];
}
