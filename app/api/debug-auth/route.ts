import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    return NextResponse.json({
      user: user ? { email: user.email, id: user.id } : null,
      error: error?.message ?? null,
      adminEmail: process.env.ADMIN_EMAIL ?? '(not set)',
      match: user?.email === process.env.ADMIN_EMAIL,
    });
  } catch (e) {
    return NextResponse.json({ crash: String(e) });
  }
}
