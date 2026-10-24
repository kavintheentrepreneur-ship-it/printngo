import { NextResponse } from 'next/server';
import { saveFileForSession } from '../../../../../../lib/mock-store';

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    const fileName = file ? file.name : 'uploaded_document.pdf';
    const fileSize = file ? file.size : 1024 * 50;

    // Estimate page count based on file size or mock 3 pages
    let pageCount = 3;
    if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.png')) {
      pageCount = 1;
    }

    const data = saveFileForSession(params.token, {
      name: fileName,
      size: fileSize,
      pageCount,
      mimeType: file?.type || 'application/pdf',
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'UPLOAD_FAILED', message: err?.message || 'Upload failed' } },
      { status: 500 },
    );
  }
}
