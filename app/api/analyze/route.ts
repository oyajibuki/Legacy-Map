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
    return NextResponse.json(graph);
  } catch (err) {
    console.error('analyze error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
