import { NextRequest, NextResponse } from 'next/server';
import { analyzeFiles } from '@/lib/analyzer';
import { UploadedFile } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: UploadedFile[] = body.files;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const graph = analyzeFiles(files);
    // Debug: log what we got
    console.log(`[analyze] files=${files.length} nodes=${graph.nodes.length} edges=${graph.edges.length}`);
    if (graph.edges.length === 0 && graph.nodes.length > 0) {
      // Log sample imports to help diagnose
      const sample = files.slice(0, 3).map(f => ({
        path: f.path,
        ext: '.' + f.name.split('.').pop(),
        contentStart: f.content.slice(0, 200),
      }));
      console.log('[analyze] 0 edges - sample files:', JSON.stringify(sample, null, 2));
    }
    return NextResponse.json(graph);
  } catch (err) {
    console.error('analyze error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
