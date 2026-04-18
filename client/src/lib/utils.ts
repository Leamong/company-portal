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

export function fromNow(date: string | Date) {
  return dayjs(date).fromNow();
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
