import { NextResponse } from 'next/server';
import { proceedJob } from '../../../../../../lib/mock-store';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const job = proceedJob(params.id);
  return NextResponse.json({ data: job });
}
