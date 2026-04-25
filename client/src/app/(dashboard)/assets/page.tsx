'use client';

import { useState } from 'react';

type AssetTab = '로고' | '색상' | '폰트' | '용어사전';

const BRAND_COLORS = [
  { name: 'Primary Blue', hex: '#2563EB', usage: '주요 버튼, 링크, 강조' },
  { name: 'Dark Navy', hex: '#1E3A5F', usage: '헤더, 제목 텍스트' },
  { name: 'Light Gray', hex: '#F3F4F6', usage: '배경, 카드 배경' },
  { name: 'Text Gray', hex: '#6B7280', usage: '본문 텍스트, 부제목' },
  { name: 'Success Green', hex: '#16A34A', usage: '성공 상태, 완료 배지' },
  { name: 'Warning Yellow', hex: '#D97706', usage: '경고, 대기 상태' },
  { name: 'Error Red', hex: '#DC2626', usage: '오류, 반려 상태' },
  { name: 'White', hex: '#FFFFFF', usage: '카드 배경, 텍스트 반전' },
];

const FONTS = [
  { name: 'Pretendard', weight: 'Regular (400)', sample: '안녕하세요. Hello World.', usage: '본문 텍스트' },
  { name: 'Pretendard', weight: 'SemiBold (600)', sample: '안녕하세요. Hello World.', usage: '소제목, 버튼' },
  { name: 'Pretendard', weight: 'Bold (700)', sample: '안녕하세요. Hello World.', usage: '제목, 강조' },
  { name: 'Pretendard', weight: 'ExtraBold (800)', sample: '안녕하세요. Hello World.', usage: '히어로 타이틀' },
];

const GLOSSARY = [
  { term: '컨펌', category: '제작', desc: '디자인 결과물에 대한 고객 또는 어드민의 최종 승인 행위.' },
  { term: '칸반(Kanban)', category: '업무', desc: '업무의 진행 상태를 시각적 보드로 관리하는 방법론.' },
  { term: 'SSOT', category: '운영', desc: 'Single Source of Truth — 데이터를 단일 출처에서 관리하는 원칙.' },
  { term: '바통터치', category: '자동화', desc: '한 단계 작업 완료 시 다음 담당자에게 자동으로 알림이 전달되는 인수인계 플로우.' },
  { term: '기안', category: '결재', desc: '전자결재에서 결재 문서를 작성하여 상신하는 행위.' },
  { term: 'R2', category: '인프라', desc: 'Cloudflare R2 — 이미지 및 파일 저장소. S3 호환 API 제공.' },
];

export default function AssetsPage() {
  const [tab, setTab] = useState<AssetTab>('로고');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">브랜드 에셋 라이브러리</h1>
        <p className="text-sm text-gray-500 mt-1">로고, 색상, 폰트 등 공식 브랜드 자산을 관리합니다 (SSOT)</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-md w-fit">
        {(['로고', '색상', '폰트', '용어사전'] as AssetTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* 로고 */}
      {tab === '로고' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: '메인 로고 (컬러)', bg: 'bg-white border', textColor: 'text-blue-600' },
            { name: '메인 로고 (화이트)', bg: 'bg-blue-700', textColor: 'text-white' },
            { name: '심볼 마크', bg: 'bg-gray-50 border', textColor: 'text-gray-800' },
          ].map((logo) => (
            <div key={logo.name} className="bg-white rounded-md border border-gray-100 overflow-hidden">
              <div className={`h-44 ${logo.bg} flex items-center justify-center`}>
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-md ${logo.bg.includes('blue') ? 'bg-white/20' : 'bg-blue-600'} flex items-center justify-center`}>
                    <span className={`${logo.bg.includes('blue') ? 'text-white' : 'text-white'} font-bold text-lg`}>C</span>
                  </div>
                  <span className={`font-bold text-xl ${logo.textColor}`}>Company</span>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{logo.name}</p>
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">다운로드</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 색상 */}
      {tab === '색상' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {BRAND_COLORS.map((color) => (
            <div key={color.hex} className="bg-white rounded-md border border-gray-100 overflow-hidden">
              <div className="h-24 w-full" style={{ backgroundColor: color.hex, border: color.hex === '#FFFFFF' ? '1px solid #E5E7EB' : 'none' }} />
              <div className="p-3">
                <p className="text-sm font-semibold text-gray-800">{color.name}</p>
                <button
                  onClick={() => copyToClipboard(color.hex)}
                  className="flex items-center gap-1.5 mt-1 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <code className="font-mono">{color.hex}</code>
                  {copied === color.hex
                    ? <span className="text-green-500">✓ 복사됨</span>
                    : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  }
                </button>
                <p className="text-xs text-gray-400 mt-1">{color.usage}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 폰트 */}
      {tab === '폰트' && (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-md p-4 text-sm text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            공식 서체: <strong>Pretendard</strong> — 모든 UI 및 인쇄물에 사용
          </div>
          {FONTS.map((font) => (
            <div key={font.weight} className="bg-white rounded-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{font.name} {font.weight}</p>
                  <p className="text-xs text-gray-400 mt-0.5">사용처: {font.usage}</p>
                </div>
              </div>
              <p className="text-2xl text-gray-900" style={{ fontWeight: parseInt(font.weight.match(/\d+/)?.[0] || '400') }}>
                {font.sample}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 용어사전 */}
      {tab === '용어사전' && (
        <div className="space-y-3">
          {GLOSSARY.map((item) => (
            <div key={item.term} className="bg-white rounded-md border border-gray-100 p-5 flex gap-4">
              <div className="shrink-0">
                <span className="inline-block bg-blue-100 text-blue-600 text-xs font-semibold px-2.5 py-1 rounded-md">{item.category}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">{item.term}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
