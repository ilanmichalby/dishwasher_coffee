import { NextResponse } from 'next/server';
import { parseText } from '@/lib/nlpParser';

export async function POST(request) {
  try {
    const { text, coffeeMode } = await request.json();
    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter' }, { status: 400 });
    }

    const result = parseText(text, coffeeMode);
    return NextResponse.json(result);
  } catch (error) {
    console.error('NLP Parse API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
