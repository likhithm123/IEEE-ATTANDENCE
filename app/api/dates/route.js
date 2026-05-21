import { createClient as createSSRClient } from '../../../utils/supabase/server';
import { createClient as createJSClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const ADMINS = ['liki123456m@gmail.com'];
const DEFAULT_DATES = [
  { value: '07-05-26', label: '07-05-26', helper: 'Active Track' },
  { value: '08-05-26', label: '08-05-26', helper: 'Backup Window' },
];

async function getContext() {
  const cookieStore = await cookies();
  const supabase = createSSRClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { response: NextResponse.json({ error: 'Missing Service Role Key' }, { status: 500 }) };
  }

  const supabaseAdmin = createJSClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);
  return {
    user,
    isAdmin: ADMINS.includes(user.email.toLowerCase().trim()),
    supabaseAdmin,
  };
}

function toDateOption(dateString, helper = 'Added Date') {
  return { value: dateString, label: dateString, helper };
}

function parseDateString(dateString) {
  const [day, month, year] = dateString.split('-').map(Number);
  if (!day || !month || Number.isNaN(year)) return 0;
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day).getTime();
}

async function getAnchorProfileId(supabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .order('name', { ascending: true })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0]?.id || null;
}

async function seedDefaultDatesIfEmpty(supabaseAdmin) {
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('attendance')
    .select('id')
    .limit(1);

  if (existingError) throw new Error(existingError.message);
  if (existingRows?.length) return;

  const profileId = await getAnchorProfileId(supabaseAdmin);
  if (!profileId) return;

  const { error } = await supabaseAdmin.from('attendance').insert(
    DEFAULT_DATES.map((date) => ({
      profile_id: profileId,
      date_string: date.value,
      coming: null,
      request: null,
      attendance_1: null,
      attendance_2: null,
    }))
  );

  if (error) throw new Error(error.message);
}

export async function GET() {
  const context = await getContext();
  if (context.response) return context.response;

  try {
    await seedDefaultDatesIfEmpty(context.supabaseAdmin);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data, error } = await context.supabaseAdmin
    .from('attendance')
    .select('date_string')
    .order('date_string', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const defaultMap = new Map(DEFAULT_DATES.map((date) => [date.value, date]));
  const dateMap = new Map();
  (data || []).forEach((row) => {
    if (row.date_string && !dateMap.has(row.date_string)) {
      dateMap.set(row.date_string, defaultMap.get(row.date_string) || toDateOption(row.date_string));
    }
  });

  const dates = Array.from(dateMap.values()).sort((a, b) => parseDateString(b.value) - parseDateString(a.value));

  return NextResponse.json({ dates });
}

export async function POST(request) {
  const context = await getContext();
  if (context.response) return context.response;
  if (!context.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { dateString } = await request.json();
  if (!dateString) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

  const { data: existingDate, error: existingError } = await context.supabaseAdmin
    .from('attendance')
    .select('id')
    .eq('date_string', dateString)
    .limit(1);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existingDate?.length) return NextResponse.json({ message: 'Date already exists.' });

  let profileId;
  try {
    profileId = await getAnchorProfileId(context.supabaseAdmin);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (!profileId) {
    return NextResponse.json({ error: 'Add at least one user before creating dates.' }, { status: 400 });
  }

  const { error } = await context.supabaseAdmin.from('attendance').insert({
    profile_id: profileId,
    date_string: dateString,
    coming: null,
    request: null,
    attendance_1: null,
    attendance_2: null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Date saved.' });
}

export async function DELETE(request) {
  const context = await getContext();
  if (context.response) return context.response;
  if (!context.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const dateString = searchParams.get('date');
  if (!dateString) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

  const { error } = await context.supabaseAdmin
    .from('attendance')
    .delete()
    .eq('date_string', dateString);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: 'Date deleted.' });
}
