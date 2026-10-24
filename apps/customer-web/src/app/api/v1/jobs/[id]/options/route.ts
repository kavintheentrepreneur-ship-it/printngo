import { NextResponse } from 'next/server';
import { updateOptionsForJob } from '../../../../../../lib/mock-store';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const updated = updateOptionsForJob(params.id, body);
    return NextResponse.json({ data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: 'OPTION_UPDATE_FAILED', message: err?.message || 'Failed' } },
      { status: 400 },
    );
  }
}
