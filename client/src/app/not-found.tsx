import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <p className="text-8xl font-bold text-gray-200">404</p>
        <h1 className="text-xl font-bold text-gray-700">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-gray-400">요청하신 페이지가 존재하지 않거나 이동되었습니다.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition"
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  );
}
