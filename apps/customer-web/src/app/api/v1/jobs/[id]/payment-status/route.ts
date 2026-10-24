import { NextResponse } from 'next/server';
import { confirmPaymentForJob, getPaymentLinksForJob } from '../../../../../../lib/mock-store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  // If payment status is polled, return status
  const links = getPaymentLinksForJob(params.id);
  return NextResponse.json({
    data: {
      isPaid: false,
      status: 'awaiting_payment',
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  // Confirm/simulate payment
  const result = confirmPaymentForJob(params.id);
  return NextResponse.json({ data: result });
}
