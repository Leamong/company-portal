'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useRef, useState } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function TipTapEditor({ value, onChange, placeholder = '내용을 입력하세요...' }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none px-4 py-4 min-h-[320px]',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!editor || !files || files.length === 0) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/')) continue;
          const form = new FormData();
          form.append('file', file);
          const res = await api.post<{ url: string }>('/api/board/upload', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          editor.chain().focus().setImage({ src: res.data.url }).run();
        }
      } catch {
        alert('이미지 업로드에 실패했습니다.');
      } finally {
        setUploading(false);
      }
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className='border border-gray-200 rounded-md bg-gray-50 min-h-[320px]' />
    );
  }

  return (
    <div className='border border-gray-200 rounded-md bg-white overflow-hidden'>
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} />
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*'
        multiple
        className='hidden'
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        onPaste={(e) => {
          const items = e.clipboardData?.files;
          if (items && items.length > 0) {
            handleFiles(items);
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (e.dataTransfer?.files?.length) {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <EditorContent editor={editor} />
      </div>
      {uploading && (
        <div className='px-4 py-2 text-xs text-blue-600 border-t border-gray-100 bg-blue-50/50 flex items-center gap-2'>
          <span className='w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
          이미지 업로드 중...
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  const Btn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type='button'
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'w-8 h-8 inline-flex items-center justify-center rounded-md text-sm transition-colors',
        active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100',
      )}
    >
      {children}
    </button>
  );

  const Sep = () => <span className='mx-1 w-px h-5 bg-gray-200 self-center' />;

  return (
    <div className='flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50/60'>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title='제목 1'
      >
        <span className='font-bold'>H1</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title='제목 2'
      >
        <span className='font-bold'>H2</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title='제목 3'
      >
        <span className='font-bold'>H3</span>
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title='굵게'
      >
        <span className='font-bold'>B</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title='기울임'
      >
        <span className='italic'>I</span>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title='취소선'
      >
        <span className='line-through'>S</span>
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title='글머리 기호'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
        </svg>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title='번호 매기기'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 6h13M7 12h13M7 18h13M3 6h.01M3 12h.01M3 18h.01' />
        </svg>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title='인용'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 12h6v6H3v-6zm0-6h6v4H3V6zm12 6h6v6h-6v-6zm0-6h6v4h-6V6z' />
        </svg>
      </Btn>
      <Sep />
      <Btn onClick={onPickImage} title='이미지 삽입'>
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
        </svg>
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        title='되돌리기'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' />
        </svg>
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        title='다시 실행'
      >
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6' />
        </svg>
      </Btn>
    </div>
  );
}
