import { createClient } from '../../../utils/supabase/server';
import { createClient as createJSClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const MANAGERS = ["xyz@gmail.com", "aa@vitstudent.ac.in", "abc@gmail.com"];
const ADMINS = ["liki123456m@gmail.com"]; // Replace with your main admin accounts

export async function PATCH(request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  
  // Validate active session session token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized access token" }, { status: 401 });
  
  const userEmail = session.user.email.toLowerCase().trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
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

  const body = await request.json();
  const { recordId, targetProfileId, dateString, updates } = body; 
  
  const payload = {
    profile_id: targetProfileId,
    date_string: dateString,
    ...updates
  };
  
  // Role Evaluation Hierarchy
  const isAdmin = ADMINS.includes(userEmail);
  const isManager = MANAGERS.includes(userEmail);
  const isSelf = session.user.id === targetProfileId;

  // 1. TIER 1: Admin bypasses validations
  if (isAdmin) {
    const { data, error } = await supabaseAdmin.from('attendance').upsert(payload, { onConflict: 'profile_id,date_string' }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, error });
  }

  // 2. TIER 2: Attendance Managers validation
  if (isManager) {
    const filteredUpdates = {};
    if ('coming' in updates) filteredUpdates.coming = updates.coming;
    if ('request' in updates) filteredUpdates.request = updates.request;
    if ('attendance_1' in updates) filteredUpdates.attendance_1 = updates.attendance_1;
    if ('attendance_2' in updates) filteredUpdates.attendance_2 = updates.attendance_2;

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "Access Denied: Managers can only edit attendance fields." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.from('attendance').upsert({ profile_id: targetProfileId, date_string: dateString, ...filteredUpdates }, { onConflict: 'profile_id,date_string' }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, error });
  }

  // 3. TIER 3: Participant dynamic checking
  if (isSelf) {
    // Participants can ONLY edit coming and request fields inside their own row record
    const filteredUpdates = {};
    if ('coming' in updates) filteredUpdates.coming = updates.coming;
    if ('request' in updates) filteredUpdates.request = updates.request;

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: "Access Denied: Participants can only update Coming/Request." }, { status: 403 });
    }

    const { data: existingRecord, error: existingError } = await supabaseAdmin
      .from('attendance')
      .select('coming, request')
      .eq('profile_id', targetProfileId)
      .eq('date_string', dateString)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingRecord?.coming && 'coming' in filteredUpdates && filteredUpdates.coming !== existingRecord.coming) {
      return NextResponse.json({ error: "Coming is already saved. Ask a manager or admin to change it." }, { status: 403 });
    }

    if (existingRecord?.request && 'request' in filteredUpdates && filteredUpdates.request !== existingRecord.request) {
      return NextResponse.json({ error: "Request is already saved. Ask a manager or admin to change it." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.from('attendance').upsert({ profile_id: targetProfileId, date_string: dateString, ...filteredUpdates }, { onConflict: 'profile_id,date_string' }).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data, error });
  }

  return NextResponse.json({ error: "Forbidden: Row security context mismatch." }, { status: 403 });
}
