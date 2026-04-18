export interface Task {
  _id: string;
  title: string;
  client: string;
  assigneeId: string | null;
  assigneeName: string;
  department: 'marketing' | 'design';
  dueDate: string;
  orderDate: string;
  quantity: number;
  designType: string;
  status: TaskStatus;
  priority: '긴급' | '일반';
  notes: string;
  createdAt?: string;
  archivedAt?: string | null;
  imagesDeletedAt?: string | null;
}

export type TaskStatus =
  | '상담중'
  | '결재완료'
  | '제작중'
  | '컨펌대기'
  | '고객사전달완료';

// 직원 기준 허용 전환 규칙 (어드민은 제한 없음)
export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  '상담중': ['결재완료'],
  '결재완료': ['제작중'],
  '제작중': ['컨펌대기', '결재완료'],
  '컨펌대기': ['고객사전달완료', '제작중'],
  '고객사전달완료': [],
};

export interface Column {
  key: TaskStatus;
  label: string;
  color: string;     // 헤더 배경
  dot: string;       // 상태 도트 색
  tagColor: string;  // 카드 내 태그 색
  border: string;    // 컬럼 상단 보더
}

export const COLUMNS: Column[] = [
  {
    key: '상담중',
    label: '상담중',
    color: 'bg-gray-50 text-gray-600',
    dot: 'bg-gray-400',
    tagColor: 'bg-gray-100 text-gray-600',
    border: 'border-t-gray-300',
  },
  {
    key: '결재완료',
    label: '결재완료',
    color: 'bg-blue-50 text-blue-600',
    dot: 'bg-blue-500',
    tagColor: 'bg-blue-100 text-blue-700',
    border: 'border-t-blue-400',
  },
  {
    key: '제작중',
    label: '제작중',
    color: 'bg-indigo-50 text-indigo-600',
    dot: 'bg-indigo-500',
    tagColor: 'bg-indigo-100 text-indigo-700',
    border: 'border-t-indigo-400',
  },
  {
    key: '컨펌대기',
    label: '컨펌대기',
    color: 'bg-purple-50 text-purple-600',
    dot: 'bg-purple-500',
    tagColor: 'bg-purple-100 text-purple-700',
    border: 'border-t-purple-400',
  },
  {
    key: '고객사전달완료',
    label: '전달완료',
    color: 'bg-emerald-50 text-emerald-600',
    dot: 'bg-emerald-500',
    tagColor: 'bg-emerald-100 text-emerald-700',
    border: 'border-t-emerald-400',
  },
];
