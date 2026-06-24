import { NextResponse } from 'next/server';
import { WAIFUS, EMOTIONS } from '@/lib/waifus';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ waifus: WAIFUS, emotions: EMOTIONS });
}
