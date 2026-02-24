

## Fix: Login Page Always Shows "Create Admin Account"

### Root Cause

The `checkNeedsSetup` function queries the `profiles` table to see if any users exist. However, the RLS policy on `profiles` only allows `authenticated` users to read rows. When you are on the login page, you are **not authenticated** (anon), so the query returns zero rows. The code interprets this as "no users exist" and shows the setup form.

### The Fix

Update the RLS SELECT policy on the `profiles` table to allow the `anon` role (unauthenticated users) to read profiles. This is safe because the profiles table only contains usernames and display names -- no sensitive data.

**Database migration:**
```sql
DROP POLICY "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Anyone can read profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);
```

No frontend code changes needed. Once the `anon` role can read from `profiles`, the existing `checkNeedsSetup` logic will correctly find your profile and show the "Sign In" form.

