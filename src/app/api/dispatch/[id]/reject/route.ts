import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { declineDispatch } from '@/lib/dispatch-service';

/**
 * POST /api/dispatch/[id]/reject
 * Technician rejects a dispatch job.
 * Body: { dispatchId }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { dispatchId } = await req.json();
  if (!dispatchId) {
    return NextResponse.json(
      { error: 'dispatchId required' },
      { status: 400 },
    );
  }

  await declineDispatch(dispatchId);
  return NextResponse.json({ ok: true });
}
