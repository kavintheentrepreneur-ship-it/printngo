import { NextResponse } from 'next/server';
import { getPaymentLinksForJob } from '../../../../../../lib/mock-store';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const links = getPaymentLinksForJob(params.id);
  return NextResponse.json({ data: links });
}
