# Company Portal - CLAUDE.md
> 이 파일은 세션 간 컨텍스트 유지를 위한 프로젝트 전체 명세서입니다.
> 새 세션 시작 시 반드시 이 파일을 먼저 읽어 프로젝트 상태를 파악하세요.

---

## 1. 프로젝트 개요
마케팅/디자인 회사를 위한 맞춤형 사내 인트라넷 포털.
투트랙 구조: **마케팅팀(장기 계약 관리)** + **디자인팀(단기 스프린트)**.
참고 서비스: FLEX, 네이버웍스, 다우오피스, FLOW, 가비아하이웍스.

---

## 2. 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| 프론트엔드 | Next.js (App Router) | 16.2.3 |
| UI 프레임워크 | React | 19.2.4 |
| 스타일링 | Tailwind CSS | v4 |
| 백엔드 | NestJS | 11.0.1 |
| 언어 | TypeScript | 5.x |
| 데이터베이스 | MongoDB Atlas (NoSQL) | - |
| ODM | Mongoose (@nestjs/mongoose) | - |
| 파일 스토리지 | Cloudflare R2 (S3 호환) | - |
| 인증 | JWT + Passport | - |
| 실시간 통신 | Socket.io (WebSocket) | - |
| 패키지 매니저 | pnpm | - |
| 도메인 | 가비아 | - |
| 배포 | AWS Lightsail (Ubuntu) | - |
| 웹 서버 | Nginx (리버스 프록시) | - |
| 프로세스 관리 | PM2 | - |

---

## 3. 프로젝트 구조

```
company-portal/
├── CLAUDE.md              ← 이 파일 (컨텍스트 유지용)
├── client/                ← Next.js 프론트엔드
│   └── src/
│       ├── app/
│       │   ├── (auth)/           # 로그인 페이지 (비인증 영역)
│       │   └── (dashboard)/      # 인증 후 영역
│       │       ├── layout.tsx    # 사이드바 + 헤더 공통 레이아웃
│       │       ├── page.tsx      # 대시보드 홈
│       │       ├── attendance/   # 출퇴근 관리
│       │       ├── tasks/        # 칸반 보드 (주문/업무)
│       │       ├── confirm/      # 컨펌 시스템 (이미지 핀 피드백)
│       │       ├── finance/      # 재무/급여 관리
│       │       ├── crm/          # CRM 고객 관리
│       │       ├── board/        # 사내 게시판
│       │       ├── approval/     # 전자결재
│       │       ├── messenger/    # 실시간 메신저
│       │       ├── assets/       # 브랜드 에셋 라이브러리 (SSOT)
│       │       └── admin/        # 헤드 어드민 전용
│       ├── components/
│       │   ├── ui/               # 공통 UI 컴포넌트
│       │   ├── layout/           # Sidebar, Header, FloatingChat
│       │   ├── kanban/           # 칸반 보드 컴포넌트
│       │   ├── confirm/          # 핀 피드백 컴포넌트
│       │   └── charts/           # recharts 래퍼 컴포넌트
│       ├── lib/
│       │   ├── api.ts            # axios 인스턴스 + interceptor
│       │   └── utils.ts          # 공통 유틸리티
│       └── store/                # zustand 전역 상태
│           ├── auth.store.ts     # 인증 상태
│           └── ui.store.ts       # UI 상태 (사이드바 등)
│
└── server/                ← NestJS 백엔드
    └── src/
        ├── auth/                 # JWT 인증 모듈
        ├── users/                # 직원 관리
        ├── attendance/           # 출퇴근
        ├── tasks/                # 주문/업무 칸반
        ├── confirm/              # 컨펌 시스템
        ├── finance/              # 재무/급여
        ├── crm/                  # CRM
        ├── board/                # 게시판
        ├── approval/             # 전자결재
        ├── messenger/            # WebSocket 채팅
        ├── assets/               # 브랜드 에셋
        ├── automation/           # 자동화 파이프라인
        ├── storage/              # Cloudflare R2 서비스
        └── common/
            ├── guards/           # IpWhitelistGuard, JwtAuthGuard
            └── decorators/       # @CurrentUser 등
```

---

## 4. 사용자 권한

| 역할 | 설명 | 접속 제한 |
|------|------|-----------|
| `head-admin` | 전체 데이터 열람, 매출/급여 관리, 인력 배치, 컨펌 | 없음 |
| `employee` | 출퇴근 기록, 부서 업무, 소통, 결재 상신 | 사내 고정 IP만 허용 |

---

## 5. 핵심 기능 명세 (A~K)

### A. 인사 및 근태 관리
- 출/퇴근 토글 버튼 → 서버 시간 기준 DB 기록
- 헤드 어드민 전용 직원 직급/권한 세팅 페이지
- 필요 패키지: `dayjs`

### B. 부서별 업무 및 주문 관리 (칸반)
- 상태 플로우: `상담중` → `결재완료` → `제작중` → `컨펌대기` → `고객사전달완료`
  - `상담중`에서 `주문취소`로 분기 가능 (종착 상태, 복구는 어드민만)
  - `제작중` ↔ `결재완료` 역방향 허용 (수정 재작업)
  - `컨펌대기` → `제작중` 역방향 허용 (반려 시)
- 데이터 필드: 주문일, 담당자(assigneeId+assigneeName), 마감일, 수량(장수), 디자인 종류, 우선순위(긴급/일반), 특이사항
- 드래그앤드롭 상태 변경 (@dnd-kit/core useDraggable + useDroppable)
- 권한: 어드민=전체 조작, 직원=본인 담당 카드만 (전환 규칙 적용)
- 카드 표시: D-day 색상 (D-3 이하 주황, D-0 빨강, 초과 빨강 볼드), 긴급 뱃지
- 필터: 부서 탭(전체/마케팅/디자인), 담당자, 디자인종류, 긴급만, 마감임박순
- 필요 패키지: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

### C. 컨펌 시스템
- 직원: 완성 이미지 → Cloudflare R2 업로드 → 상태 '컨펌대기'로 변경
- 헤드 어드민: 썸네일 확인 → [승인] 또는 [반려]
- 이미지 위 클릭 → 핀 번호 꽂기 → 피드백 댓글 작성
- 필요 패키지: `@aws-sdk/client-s3`, `multer`, `framer-motion`

### D. 재무 및 급여 관리
- 매출 관리: 주문 데이터 연동, 차트
- 급여 관리: 직원별 급여/수당 산정, PDF 명세서 생성
- 급여 명세서 → 하이웍스 메일 API로 일괄 발송
- 필요 패키지: `recharts`, `jspdf`, `html2canvas`

### E. CRM 및 고객 관리
- 고객사 정보 관리
- 상담 히스토리 타임라인 기록
- 필요 패키지: `react-hook-form`, `zod`, `@hookform/resolvers`

### F. 사내 소통 및 전자결재
- 메신저: 플로팅 버튼 형태의 실시간 채팅 (Socket.io)
- 게시판: 부서별 소식 + 전사 공지 (TipTap 에디터)
- 전자결재: 휴가/지출결의 기안 → 승인/반려 시스템
- 필요 패키지: `@nestjs/websockets`, `socket.io-client`, `@tiptap/react`, `@tiptap/starter-kit`

### G. 외부 API 연동
- 가비아 하이웍스: 사내 메일 송수신, 급여 명세서 자동 발송
- 필요 패키지: `nodemailer`, `@nestjs/axios`

### H. 시각적 피드백 시스템
- 상태 인디케이터 컬러 배지 (검토중/수정요청/승인완료)
- 이미지 핀 클릭 → 번호표 + 우측 피드백 댓글
- 필요 패키지: `framer-motion`

### I. 투트랙 대시보드
- 헤드 어드민: CEO 요약 위젯 (계약건수, 단기작업 차트, 파이프라인 그래프)
- 마케팅팀(장기): 월단위 Gantt 타임라인 뷰
- 디자인팀(단기): 마감 임박 순 스프린트 칸반 보드
- 디자인 Sub-task: 마케팅팀 뷰에서 버튼 클릭 → 디자인팀 칸반에 하위 태스크 자동 발행
- 필요 패키지: `gantt-task-react`

### J. SSOT 및 자산화 라운지
- 디자인 요청서: 고정 양식 게시판 (타겟, 레퍼런스 등)
- 브랜드 에셋: 로고 원본, 폰트, 지정 색상값 라이브러리
- 사내 용어 사전: 마케팅/디자인 실무 용어 통합 사전
- 명예의 전당: A/B 테스트 결과, 성공/실패 사례 아카이브
- 재사용: TipTap 에디터 (F항목과 공유)

### K. 업무 자동화 파이프라인
- 외부→내부 연동: 고객 폼 제출 → 칸반 카드 자동 생성
- 바통터치 자동화: 상태 변경(예: 기획완료) → 담당자에게 메신저 자동 알림
- 마감독촉 봇: 마감 1일 전 담당자에게 진행 상황 업데이트 요청
- NestJS 내장 `@nestjs/schedule` 활용 (별도 패키지 불필요)

---

## 6. 패키지 설치 목록

### client/ (pnpm install)
```bash
# 상태관리 & HTTP
dayjs zustand axios

# 칸반 드래그앤드롭
@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# 폼 유효성 검사
react-hook-form zod @hookform/resolvers

# 차트 & PDF
recharts jspdf html2canvas

# 실시간 통신
socket.io-client

# 에디터
@tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-placeholder

# 애니메이션
framer-motion

# Gantt 차트
gantt-task-react
```

### server/ (pnpm install)
```bash
# 인증
@nestjs/passport passport passport-jwt passport-local
@nestjs/jwt

# WebSocket
@nestjs/websockets @nestjs/platform-socket.io socket.io

# 데이터베이스
@nestjs/mongoose mongoose

# 환경변수
@nestjs/config

# 스케줄러 (자동화)
@nestjs/schedule

# 파일 업로드
@aws-sdk/client-s3 multer

# 이메일
nodemailer @nestjs/axios

# 암호화
bcrypt

# 유효성 검사
class-validator class-transformer

# 타입 정의 (dev)
@types/multer @types/bcrypt @types/passport-jwt @types/nodemailer
```

---

## 7. 환경변수 키 목록 (.env)

```env
# 서버
PORT=4000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# Cloudflare R2 (S3 호환)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=company-portal

# 가비아 하이웍스
HIWORKS_API_KEY=...
HIWORKS_MAIL_FROM=...

# IP 화이트리스트 (콤마 구분)
ALLOWED_IPS=127.0.0.1,::1

# 클라이언트
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

## 8. 코딩 컨벤션

- **인용부호**: 작은따옴표 (`'`) 사용 (prettier: `singleQuote: true`)
- **트레일링 콤마**: 항상 사용 (`trailingComma: 'all'`)
- **파일명**: kebab-case (예: `ip-whitelist.guard.ts`)
- **컴포넌트명**: PascalCase
- **API 응답**: `{ data, message, statusCode }` 형태로 통일
- **NestJS 모듈**: 기능별 독립 모듈 (`feature.module.ts`, `feature.service.ts`, `feature.controller.ts`)
- **MongoDB Schema**: `schemas/` 폴더에 분리 (`feature.schema.ts`)

---

## 9. 보안 아키텍처

```
[클라이언트 브라우저]
       ↓ HTTPS (443)
[Nginx - 리버스 프록시 + SSL]
       ↓
[Next.js :3000] ←→ [NestJS :4000]
                          ↓
                    [IP 화이트리스트 가드]  ← 1단계: 코드 레벨
                    [JWT Auth 가드]
                          ↓
                    [MongoDB Atlas]
                    [Cloudflare R2]
```

**IP 화이트리스트 2단계 계획:**
- 1단계 (현재): `IpWhitelistGuard`로 `.env`의 `ALLOWED_IPS` 값과 비교
- 2단계 (헤드 어드민 기능): 어드민 페이지에서 허용 IP 목록을 DB에서 동적 관리

---

## 10. 구현 진행 상황 체크리스트

### Phase 1 - 인증 & 기반
- [x] MongoDB Atlas 연결 (`@nestjs/mongoose`) ← .env 설정 후 자동 연결
- [x] JWT 인증 모듈 (`auth/`)
- [x] IP 화이트리스트 가드 (`common/guards/`) ← 개발모드 자동 비활성화
- [x] User 스키마 및 모듈 (`users/`)
- [x] 로그인 페이지 (`app/(auth)/login/`)
- [x] zustand auth store (`store/auth.store.ts`)
- [x] axios 인스턴스 + interceptor (`lib/api.ts`)
- [x] (dashboard) 레이아웃 + 사이드바 (`app/(dashboard)/layout.tsx`)
- [x] 대시보드 홈 (`app/(dashboard)/dashboard/page.tsx` → URL: `/dashboard`)

### Phase 2 - 출퇴근 & 사용자 관리
- [ ] 출퇴근 API (`attendance/`)
- [ ] 근태 현황 페이지 (`app/(dashboard)/attendance/`)
- [ ] 헤드 어드민 직원 관리 (`app/(dashboard)/admin/`)

### Phase 3 - 칸반 & 주문 관리
- [x] Task 스키마 (`tasks/schemas/task.schema.ts`) ← 상태/전환규칙 포함
- [x] Task CRUD API (`tasks/`) ← 상태변경, 권한체크 포함
- [x] 칸반 보드 컴포넌트 (`components/kanban/`) ← KanbanCard, KanbanColumn, TaskModal, types
- [x] 칸반 보드 페이지 (`app/(dashboard)/tasks/page.tsx`) ← DnD, 필터바, API 연동
- [ ] 투트랙 대시보드 Gantt 뷰 (마케팅팀 월단위)

### Phase 4 - 컨펌 시스템
- [ ] R2 업로드 서비스 (`storage/storage.service.ts`)
- [ ] 컨펌 API (`confirm/`)
- [ ] 핀 피드백 UI (`components/confirm/`)

### Phase 5 - 소통 & 결재
- [ ] WebSocket 게이트웨이 (`messenger/messenger.gateway.ts`)
- [ ] 플로팅 메신저 UI (`components/layout/FloatingChat.tsx`)
- [ ] 게시판 API + UI (`board/`)
- [ ] 전자결재 API + UI (`approval/`)

### Phase 6 - 재무 & CRM
- [ ] 매출 관리 (`finance/`)
- [ ] 급여 명세서 생성 + 발송
- [ ] CRM (`crm/`)

### Phase 7 - SSOT & 자동화
- [x] 일정 관리 캘린더 (`app/(dashboard)/calendar/page.tsx`) ← 월/주/일/목록 뷰, 이벤트 CRUD (로컬 상태)
- [ ] 디자인 요청서 양식
- [ ] 자동화 파이프라인 (`automation/`)

---

## 11. 크리티컬 파일 경로

| 파일 | 역할 |
|------|------|
| `client/src/app/(dashboard)/layout.tsx` | 전체 앱 레이아웃 (사이드바/헤더) |
| `client/src/store/auth.store.ts` | zustand 인증 상태 |
| `client/src/lib/api.ts` | axios 인스턴스 + JWT interceptor |
| `server/src/app.module.ts` | 루트 모듈 (모든 모듈 등록) |
| `server/src/auth/auth.module.ts` | JWT + Passport 설정 |
| `server/src/common/guards/ip-whitelist.guard.ts` | IP 접속 통제 |
| `server/src/common/guards/jwt-auth.guard.ts` | JWT 인증 가드 |
| `server/src/users/schemas/user.schema.ts` | 직원 MongoDB 스키마 |
| `server/src/tasks/schemas/task.schema.ts` | 주문/업무 MongoDB 스키마 |
| `server/src/storage/storage.service.ts` | R2 파일 업로드 서비스 |
| `server/src/messenger/messenger.gateway.ts` | WebSocket 게이트웨이 |
