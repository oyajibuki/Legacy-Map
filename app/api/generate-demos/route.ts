/**
 * One-time endpoint: GET /api/generate-demos
 * Reads every folder under /demo, runs the analyzer, writes JSON to /public/demos/.
 * Call this once in development; commit the resulting JSON files.
 */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { analyzeFiles } from '@/lib/analyzer';
import { UploadedFile } from '@/lib/types';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '__pycache__', '.venv', 'venv',
  'dist', 'build', '.cache', 'coverage', 'target', 'vendor',
  'Pods', '.gradle', '.idea', '.vs', 'DerivedData', 'xcuserdata',
  'CVS', '.svn', 'obj', 'bin',
]);

const SKIP_EXTS = new Set([
  '', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.mp4', '.mp3', '.wav', '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.sum', '.pyc', '.pyo', '.class', '.o', '.obj',
  '.exe', '.dll', '.so', '.dylib', '.a', '.lib',
  '.xcuserstate', '.pbxproj', '.idx', '.pack', '.rev',
]);

const MAX_FILE_BYTES = 300 * 1024;

function readDemoFiles(demoDir: string): UploadedFile[] {
  const files: UploadedFile[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      } else {
        const ext = entry.name.includes('.')
          ? ('.' + entry.name.split('.').pop()!.toLowerCase())
          : '';
        if (SKIP_EXTS.has(ext)) continue;

        let stat: fs.Stats;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (stat.size > MAX_FILE_BYTES) continue;

        let content: string;
        try { content = fs.readFileSync(fullPath, 'utf-8'); }
        catch { continue; } // skip binary files

        const relativePath = path.relative(demoDir, fullPath).replace(/\\/g, '/');
        const name = entry.name;
        files.push({ path: relativePath, name, content, size: stat.size });
      }
    }
  }

  walk(demoDir);
  return files;
}

export async function GET() {
  const demoRoot = path.join(process.cwd(), 'demo');
  const outDir   = path.join(process.cwd(), 'public', 'demos');

  if (!fs.existsSync(demoRoot)) {
    return NextResponse.json({ error: `demo/ folder not found at ${demoRoot}` }, { status: 404 });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const folders = fs.readdirSync(demoRoot, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();

  const results: Record<string, { files: number; nodes: number; edges: number; ms: number }> = {};

  for (const folder of folders) {
    const t0 = Date.now();
    const demoDir = path.join(demoRoot, folder);
    const uploadedFiles = readDemoFiles(demoDir);

    if (uploadedFiles.length === 0) {
      results[folder] = { files: 0, nodes: 0, edges: 0, ms: 0 };
      continue;
    }

    try {
      const graph = analyzeFiles(uploadedFiles);
      const outPath = path.join(outDir, `${folder}.json`);
      fs.writeFileSync(outPath, JSON.stringify(graph));
      results[folder] = {
        files: uploadedFiles.length,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        ms: Date.now() - t0,
      };
      console.log(`[generate-demos] ${folder}: ${graph.nodes.length} nodes, ${graph.edges.length} edges (${Date.now() - t0}ms)`);
    } catch (err) {
      console.error(`[generate-demos] ${folder} failed:`, err);
      results[folder] = { files: uploadedFiles.length, nodes: -1, edges: -1, ms: Date.now() - t0 };
    }
  }

  return NextResponse.json({ done: true, results });
}
