import { NextResponse } from 'next/server';
import { getDishwashers } from '@/lib/bosch';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dishwashers = await getDishwashers();
    console.log(`API: Found ${dishwashers.length} dishwashers`);
    return NextResponse.json({ dishwashers });
  } catch (error) {
    console.error('Failed to fetch dishwashers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
