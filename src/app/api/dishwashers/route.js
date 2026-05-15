import { NextResponse } from 'next/server';
import { getDishwashers, getDishwasherStatus, getAvailablePrograms } from '@/lib/bosch';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dishwashers = await getDishwashers();
    
    // Fetch status and programs for each dishwasher
    const dishwashersWithStatus = await Promise.all(
      dishwashers.map(async (d) => {
        const status = await getDishwasherStatus(d.haId);
        const programs = await getAvailablePrograms(d.haId);
        return { ...d, status, programs };
      })
    );

    return NextResponse.json({ dishwashers: dishwashersWithStatus });
  } catch (error) {
    console.error('Failed to fetch dishwashers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
