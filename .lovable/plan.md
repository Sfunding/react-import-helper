

## Fix: Settings Page Stuck on Loading Spinner

### What I Found

I tested the backend function directly and it works perfectly -- it returns your two users (Elazar and JackR1) correctly. The problem is on the browser side.

There are two issues:

### Issue 1: Incomplete CORS Headers

The `manage-users` function's CORS `Access-Control-Allow-Headers` only lists `authorization, x-client-info, apikey, content-type`. The browser client sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.) that are not listed. When the browser's preflight OPTIONS check sees unlisted headers, it silently blocks the request entirely. This causes the `fetchUsers` call to fail with no response, leaving the page stuck on the loading spinner.

**Fix:** Update the CORS headers in `supabase/functions/manage-users/index.ts`:
```
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
```

Same fix needed in `supabase/functions/setup-admin/index.ts` for consistency.

### Issue 2: RLS Policy Type Mismatch on `profiles`

The RLS policies on `profiles` use `RESTRICTIVE` mode (shown as "Permissive: No" in the schema). The SELECT policy grants access to `true` but was applied as restrictive. With restrictive policies, ALL policies must pass. If there's no explicit grant for the `anon` role, the query still fails silently. The migration needs to ensure the policy is `PERMISSIVE` so the `anon` role can actually read profiles.

**Fix:** Database migration to recreate the policy as permissive:
```sql
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);
```

### Summary of Changes

1. **`supabase/functions/manage-users/index.ts`** -- Update CORS `Access-Control-Allow-Headers` to include all required headers
2. **`supabase/functions/setup-admin/index.ts`** -- Same CORS fix
3. **Database migration** -- Recreate profiles SELECT policy as permissive

