import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ko');

export function formatDate(date: string | Date, format = 'YYYY년 MM월 DD일') {
  return dayjs(date).format(format);
}

export function formatDateTime(date: string | Date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

// 표시용 짧은 날짜 포맷 — '26/04/24' (공간 제한 있는 셀/목록에서 사용)
// 값이 비어있거나 유효하지 않으면 '-' 반환
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.format('YY/MM/DD');
}

// 표시용 짧은 날짜+시간 — '26/04/24 14:30'
export function formatDateTimeShort(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.format('YY/MM/DD HH:mm');
}

export function fromNow(date: string | Date) {
  return dayjs(date).fromNow();
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
