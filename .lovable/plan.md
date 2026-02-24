

## Multi-User System with Admin Controls

This is a significant architectural change from a shared-password gate to a proper multi-user system with role-based access.

### Current State
- Single shared password stored in `app_config` table
- Custom edge functions for password verification (no Supabase Auth)
- All deals share a fixed `user_id` (`00000000-...`)
- Everyone sees everything

### New Architecture

**Authentication**: Supabase Auth with email/password (username stored as display name since Supabase Auth requires email -- we'll use a pattern like `username@app.local` internally so users only type a username).

**Roles**: `user_roles` table with `admin` and `user` roles. You (first user) are the admin.

**Data isolation**: Each user's deals are tied to their `auth.users.id`. RLS policies enforce visibility -- users see only their own deals, admin sees all.

---

### Database Changes

**1. Create `user_roles` table**
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
```

**2. Create `profiles` table** (stores username/display name)
```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

**3. Security definer function for role checks**
```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
```

**4. Update `saved_calculations` RLS policies**
- Replace the current permissive "allow all" policies with:
  - SELECT: `auth.uid() = user_id OR has_role(auth.uid(), 'admin')`
  - INSERT: `auth.uid() = user_id`
  - UPDATE: `auth.uid() = user_id OR has_role(auth.uid(), 'admin')`
  - DELETE: `auth.uid() = user_id OR has_role(auth.uid(), 'admin')`

**5. RLS on profiles and user_roles**
- Profiles: users can read all (to see names), update only their own
- User_roles: only admin can read/modify

---

### Edge Functions

**1. `manage-users`** (new) -- Admin-only operations:
- **Create user**: accepts `{ action: "create", username, password, fullName }`. Creates user in Supabase Auth (email = `username@app.internal`), creates profile row, assigns `user` role.
- **List users**: returns all profiles with roles.
- **Reset password**: accepts `{ action: "reset-password", userId, newPassword }`. Uses admin API to update user password.
- **Delete user**: accepts `{ action: "delete", userId }`. Removes user from Auth (cascade deletes profile + roles).
- All actions verify the caller has `admin` role using `getClaims()`.

**2. Update `verify-password`** -- Will be deprecated/removed since login moves to Supabase Auth `signInWithPassword`.

---

### Frontend Changes

**1. `src/contexts/AuthContext.tsx`** -- Complete rewrite:
- Use Supabase Auth (`supabase.auth.signInWithPassword`, `onAuthStateChange`)
- Login with username (converted to `username@app.internal` email internally)
- Track `user`, `role`, `isAdmin` in context
- Remove localStorage-based auth

**2. `src/pages/Login.tsx`** -- Update:
- Change from password-only to username + password fields
- Call `supabase.auth.signInWithPassword({ email: username + '@app.internal', password })`

**3. `src/hooks/useCalculations.ts`** -- Update:
- Remove `SHARED_USER_ID` constant
- Use `auth.uid()` from the Supabase session for `user_id` on inserts
- No query filtering needed -- RLS handles visibility

**4. `src/pages/Settings.tsx`** (new) -- Admin settings page:
- **User Management section**: List all users, create new user form (username + password + full name), reset password button, delete user button
- Only accessible to admin role
- Route: `/settings`

**5. `src/components/Navbar.tsx`** -- Update:
- Add "Settings" link (gear icon) visible only to admin
- Show logged-in username

**6. `src/components/AuthGuard.tsx`** -- Update:
- Use Supabase Auth session instead of localStorage check

**7. `src/pages/Admin.tsx`** -- Remove or merge into Settings:
- The old change-password page becomes unnecessary (admin resets passwords from Settings)

**8. `src/App.tsx`** -- Update routes:
- Add `/settings` route protected by AuthGuard + admin check
- Remove `/admin` route

---

### Migration Strategy for Existing Data

- Existing saved calculations have `user_id = '00000000-...'`. After you create your admin account, we'll update those rows to your new user ID via an edge function or manual step so you retain all existing deals.

---

### Technical Details

- **Username format**: Stored in `profiles.username`. For Supabase Auth (which requires email), we use `{username}@app.internal` as a synthetic email. Users never see this email.
- **Auto-confirm**: Email auto-confirm will be enabled since there are no real emails -- accounts are created by admin.
- **First admin setup**: On first launch (no users exist), show a one-time admin setup screen to create your account. Or we can seed your admin account via the edge function.
- **Session management**: Supabase Auth handles JWT tokens, refresh, and session persistence automatically.

