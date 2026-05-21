POLISHED SPREADSHEET ATTENDANCE WEB APP ASSEMBLY GUIDE
======================================================
This production code leverages Next.js App Router and Supabase server-side validation.

Deployment Steps:
1. Create a free project on Supabase (https://supabase.com).
2. Go to the SQL Editor inside Supabase, paste the contents of 'schema.sql', and hit 'Run'.
3. Unzip this codebase locally. Run 'npm install' to bind dependencies.
4. Populate your environmental variables (.env.local) with your Supabase keys:
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
5. Execute 'npm run dev' to boot the polished interface at http://localhost:3000!
