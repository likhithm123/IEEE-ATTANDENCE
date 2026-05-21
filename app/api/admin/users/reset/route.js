import { createClient as createSSRClient } from '../../../../../utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient as createJSClient } from '@supabase/supabase-js';

const ADMINS = ["liki123456m@gmail.com"];

async function getAdminContext() {
  const cookieStore = await cookies();
  const supabase = createSSRClient(cookieStore);
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const userEmail = user.email.toLowerCase().trim();
  if (!ADMINS.includes(userEmail)) {
    return { response: NextResponse.json({ error: "Forbidden: Only Admins can reset passwords." }, { status: 403 }) };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { response: NextResponse.json({ error: "Server Error: SUPABASE_SERVICE_ROLE_KEY missing." }, { status: 500 }) };
  }

  const supabaseAdmin = createJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { user, supabaseAdmin };
}

export async function POST(request) {
  try {
    const context = await getAdminContext();
    if (context.response) return context.response;
    const { supabaseAdmin } = context;

    const { id, name } = await request.json();
    if (!id || !name) {
      return NextResponse.json({ error: "Missing id or name." }, { status: 400 });
    }

    const newPassword = `${name.trim()}@123`;
    const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, { password: newPassword });
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 });
    }

    console.log(`[ADMIN] ${context.user.email} reset password for ${name}`);
    return NextResponse.json({ message: "Password reset successfully.", temporary: true });
  } catch (err) {
    console.error('Password Reset Error:', err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
