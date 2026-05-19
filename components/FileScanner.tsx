'use client';

import { useRef, useState } from 'react';
import { Upload, FolderOpen, Loader2 } from 'lucide-react';
import { UploadedFile } from '@/lib/types';

interface Props {
  onFilesReady: (files: UploadedFile[]) => void;
  isAnalyzing: boolean;
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB per file
const MAX_CONTENT_LENGTH = 100 * 1024; // 100KB content limit for analysis

// Directories to skip before even reading file content
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.cache', 'coverage', '.nyc_output', '.tox',
  'target', 'vendor', 'Pods', '.gradle', '.idea', '.vs',
  'DerivedData', 'xcuserdata', 'xcassets', 'appiconset', 'imageset',
  'colorset', 'symbolset', 'Assets.xcassets',
]);

// Extensions that are always binary — skip immediately
const SKIP_EXTENSIONS = new Set([
  '', // git objects (no extension)
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.sum', '.pyc', '.pyo', '.class', '.o', '.obj',
  '.exe', '.dll', '.so', '.dylib', '.a', '.lib',
  '.xcuserstate', '.pbxproj',
]);

function shouldSkip(relPath: string, name: string): boolean {
  const parts = relPath.replace(/\\/g, '/').split('/');
  if (parts.some(p => SKIP_DIRS.has(p))) return true;
  const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : '';
  if (SKIP_EXTENSIONS.has(ext)) return true;
  return false;
}

export default function FileScanner({ onFilesReady, isAnalyzing }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  async function processFiles(fileList: FileList) {
    setLoadingMsg('ファイルを読み込み中...');
    const files: UploadedFile[] = [];

    let readCount = 0;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

      // Skip binary/irrelevant files before reading (fast path — no I/O)
      if (shouldSkip(relPath, file.name)) continue;
      if (file.size > MAX_FILE_SIZE) continue;

      readCount++;
      if (readCount % 5 === 0) setLoadingMsg(`読み込み中 ${readCount} ファイル目...`);

      try {
        const content = await file.text();
        files.push({
          path: relPath.replace(/\\/g, '/'),
          name: file.name,
          content: content.slice(0, MAX_CONTENT_LENGTH),
          size: file.size,
        });
      } catch {
        // Skip unreadable files
      }
    }

    setLoadingMsg('');
    onFilesReady(files);
  }

  // Drag-and-drop using DataTransfer Items API to preserve directory structure.
  // e.dataTransfer.files loses webkitRelativePath for dropped folders in most browsers.
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    // Try to read as directory entries to get full paths
    const entries: FileSystemFileEntry[] = [];
    const promises: Promise<void>[] = [];

    function readEntry(entry: FileSystemEntry, pathPrefix: string) {
      if (entry.isFile) {
        const fileEntry = entry as FileSystemFileEntry;
        promises.push(new Promise<void>(resolve => {
          fileEntry.file(f => {
            // Attach the full relative path manually
            Object.defineProperty(f, 'webkitRelativePath', {
              value: pathPrefix + f.name,
              writable: false,
            });
            entries.push(fileEntry);
            // Store path on the entry object for later
            (fileEntry as any).__path = pathPrefix + f.name;
            resolve();
          }, () => resolve());
        }));
      } else if (entry.isDirectory) {
        const dirEntry = entry as FileSystemDirectoryEntry;
        const reader = dirEntry.createReader();
        promises.push(new Promise<void>(resolve => {
          reader.readEntries(subEntries => {
            for (const sub of subEntries) {
              readEntry(sub, pathPrefix + dirEntry.name + '/');
            }
            resolve();
          }, () => resolve());
        }));
      }
    }

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) readEntry(entry, '');
    }

    // Wait for all readEntries to complete
    await Promise.all(promises);

    // Read all collected file entries
    setLoadingMsg('ファイルを読み込み中...');
    const files: UploadedFile[] = [];
    let readCount = 0;

    for (const entry of entries) {
      const relPath = (entry as any).__path as string || entry.name;
      if (shouldSkip(relPath, entry.name)) continue;

      await new Promise<void>(resolve => {
        entry.file(async (f) => {
          if (f.size > MAX_FILE_SIZE) { resolve(); return; }
          readCount++;
          if (readCount % 5 === 0) setLoadingMsg(`読み込み中 ${readCount} ファイル目...`);
          try {
            const content = await f.text();
            files.push({
              path: relPath.replace(/\\/g, '/'),
              name: f.name,
              content: content.slice(0, MAX_CONTENT_LENGTH),
              size: f.size,
            });
          } catch { /* skip */ }
          resolve();
        }, () => resolve());
      });
    }

    // Fallback: if no entries were found via Items API, use files directly
    if (files.length === 0 && e.dataTransfer.files.length > 0) {
      setLoadingMsg('');
      processFiles(e.dataTransfer.files);
      return;
    }

    setLoadingMsg('');
    onFilesReady(files);
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3
          border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200
          ${isDragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-[#1e293b] hover:border-indigo-500/50 bg-[#111118]'}
        `}
        onClick={() => folderInputRef.current?.click()}
      >
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          {...({ webkitdirectory: 'true', directory: 'true', multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />

        {isAnalyzing || loadingMsg ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-slate-400 text-center max-w-[200px]">
              {loadingMsg || '解析中...'}
            </p>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">
                フォルダをドロップ
              </p>
              <p className="text-xs text-slate-500 mt-1">
                またはクリックして選択
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">対応コード</p>
        <div className="flex flex-wrap gap-1.5">
          {['TypeScript', 'JavaScript', 'Python', 'C/C++', 'Go', 'Ruby', 'Java', 'Rust'].map(lang => (
            <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-[#1e1e2e] text-slate-400 border border-[#2d2d3e]">
              {lang}
            </span>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          <span className="font-semibold text-amber-400">解析対象:</span>{' '}
          ソースファイルのみ。node_modules・.git・dist は自動スキップ。500KB超ファイルは除外。
        </p>
      </div>
    </div>
  );
}
