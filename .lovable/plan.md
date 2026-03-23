

## Audit Trail: Login History and Change Tracking

### Overview

Create an audit log system that tracks two things:
1. **Login events** -- when each user signs in
2. **Deal changes** -- when a user creates, updates, duplicates, or deletes a saved calculation

The admin will see this in a new "Audit Log" section on the Settings page.

### Database Changes

**New table: `audit_logs`**
```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,           -- 'login', 'create_deal', 'update_deal', 'delete_deal', 'duplicate_deal'
  resource_type text,             -- 'session', 'saved_calculation'
  resource_id text,               -- the deal id (null for logins)
  metadata jsonb DEFAULT '{}',    -- extra info (deal name, merchant name, what changed)
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
CREATE POLICY "Admins can read audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert their own log entry
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

### Frontend Changes

**1. Log login events (`src/contexts/AuthContext.tsx`)**
- After successful `signInWithPassword`, insert an audit log entry with action `'login'`

**2. Log deal changes (`src/hooks/useCalculations.ts`)**
- In `saveMutation.onSuccess`: insert `'create_deal'` with deal name in metadata
- In `updateMutation.onSuccess`: insert `'update_deal'`
- In `deleteMutation.onSuccess`: insert `'delete_deal'`
- In `duplicateMutation.onSuccess`: insert `'duplicate_deal'`

**3. Audit Log viewer on Settings page (`src/pages/Settings.tsx`)**
- New card section: "Audit Log" (admin-only)
- Table showing: Date/Time, User, Action, Details
- Filter by user and action type
- Paginated, most recent first
- Uses `useProfiles` hook to map user IDs to names

### Technical Details

- No edge function needed -- direct client inserts via RLS
- Audit inserts are fire-and-forget (don't block the main operation)
- Metadata JSONB stores contextual info like deal name, merchant name
- The `login_attempts` table already exists but tracks IP-based rate limiting, not user-specific login history -- the new `audit_logs` table serves a different purpose

