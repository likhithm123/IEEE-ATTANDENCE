import { createClient as createSSRClient } from '../../../../utils/supabase/server';
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
    return { response: NextResponse.json({ error: "Forbidden: Only Admins can manage users." }, { status: 403 }) };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      response: NextResponse.json({
        error: "Server Error: SUPABASE_SERVICE_ROLE_KEY is missing from .env.local. The Service Role Key is required to manage backend authentication accounts."
      }, { status: 500 })
    };
  }

  const supabaseAdmin = createJSClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return { user, supabaseAdmin };
}

export async function POST(request) {
  try {
    const context = await getAdminContext();
    if (context.response) return context.response;
    const { supabaseAdmin } = context;

    const body = await request.json();
    const { users } = body; // Array of { name, email, reg_no, role }
    
    if (!users || !Array.isArray(users)) {
      return NextResponse.json({ error: "Invalid data payload." }, { status: 400 });
    }

    let successCount = 0;
    const errors = [];

    // 3. Process each user
    for (const u of users) {
      // a. Create Auth Account
      // We use a default temporary password since they are being imported
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: `${u.name.trim()}@123`,
        email_confirm: true // Auto confirm since admin is adding them
      });

      if (authError) {
        // If user already exists in auth, we can just try to insert/update their profile
        if (authError.message.includes("already exists")) {
          // Find their UUID
          const { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('email', u.email).single();
          if (!existingUser) {
             errors.push(`Auth user exists but profile missing for ${u.email}`);
             continue;
          }
          // We could update them here, but we'll skip for now
          errors.push(`${u.email} already exists`);
          continue;
        } else {
          errors.push(`Failed to create auth for ${u.email}: ${authError.message}`);
          continue;
        }
      }

      // b. Insert into Profiles Table
      const { error: profileError } = await supabaseAdmin.from('profiles').insert({
        id: authData.user.id,
        name: u.name,
        email: u.email,
        reg_no: u.reg_no || null,
        role: u.role || 'participant'
      });

      if (profileError) {
        errors.push(`Failed to create profile for ${u.email}: ${profileError.message}`);
        // Optionally delete the auth user here to rollback, but we'll leave it
      } else {
        successCount++;
      }
    }

    return NextResponse.json({ 
      message: `Import complete. Successfully added ${successCount} users.`,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (err) {
    console.error("Admin Import Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const context = await getAdminContext();
    if (context.response) return context.response;
    const { supabaseAdmin } = context;
    const { id, name, email, reg_no, role } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json({ error: "User id, name, and email are required." }, { status: 400 });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, { email });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ name, email, reg_no: reg_no || null, role: role || 'participant' })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: "User updated." });
  } catch (err) {
    console.error("Admin Update Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const context = await getAdminContext();
    if (context.response) return context.response;
    const { user, supabaseAdmin } = context;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: "User id is required." }, { status: 400 });
    if (id === user.id) return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ message: "User deleted." });
  } catch (err) {
    console.error("Admin Delete Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
