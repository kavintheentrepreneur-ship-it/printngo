import { NextResponse } from 'next/server';
import { getOrCreateSession } from '../../../../../lib/mock-store';

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token || 'demo';
  const data = getOrCreateSession(token);
  return NextResponse.json({ data });
}
