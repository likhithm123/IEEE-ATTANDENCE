import { createClient as createSSRClient } from '../../../utils/supabase/server';
import { createClient as createJSClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const cookieStore = await cookies();
  const supabase = createSSRClient(cookieStore);
  
  // Verify user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // The 'profiles' table has RLS enabled but NO read policy in schema.sql.
  // We use the admin client to fetch profiles securely on the backend.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
  }

  const supabaseAdmin = createJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey
  );

  const { data, error } = await supabaseAdmin.from('profiles').select('*').order('name', { ascending: true });
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ profiles: data });
}
