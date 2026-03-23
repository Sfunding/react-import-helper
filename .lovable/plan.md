

## Deal Sharing and Role-Based Permissions

### Overview

Two new capabilities:
1. **Deal sharing** -- Admin (or managers) can share deals with other users, giving them read-only or edit access without transferring ownership
2. **Expanded roles and permissions** -- Add a "Manager" role and granular per-user permissions (can export, can delete, can view others' deals)

### Database Changes

**1. New table: `deal_shares`**
Tracks which deals are shared with which users and at what access level.

```sql
CREATE TABLE public.deal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES public.saved_calculations(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL,
  access_level text NOT NULL DEFAULT 'view', -- 'view' or 'edit'
  shared_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(calculation_id, shared_with)
);

ALTER TABLE public.deal_shares ENABLE ROW LEVEL SECURITY;

-- Users can see shares where they are the recipient, owner, or admin
CREATE POLICY "Users can see their shares" ON public.deal_shares
FOR SELECT TO authenticated
USING (shared_with = auth.uid() OR shared_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Admins and managers can create shares
CREATE POLICY "Admins/managers can share" ON public.deal_shares
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Admins and the sharer can delete shares
CREATE POLICY "Can revoke shares" ON public.deal_shares
FOR DELETE TO authenticated
USING (shared_by = auth.uid() OR has_role(auth.uid(), 'admin'));
```

**2. Add 'manager' to the `app_role` enum**
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
```

**3. New table: `user_permissions`**
Granular per-user permission flags.

```sql
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_export boolean NOT NULL DEFAULT true,
  can_delete_deals boolean NOT NULL DEFAULT true,
  can_view_others boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Users can read their own permissions
CREATE POLICY "Users read own permissions" ON public.user_permissions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Only admins can manage permissions
CREATE POLICY "Admins manage permissions" ON public.user_permissions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));
```

**4. Update `saved_calculations` SELECT RLS to include shared deals**
```sql
DROP POLICY "Users see own deals, admin sees all" ON public.saved_calculations;
CREATE POLICY "Users see own deals, shared deals, admin sees all"
ON public.saved_calculations FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.deal_shares
    WHERE deal_shares.calculation_id = saved_calculations.id
    AND deal_shares.shared_with = auth.uid()
  )
);
```

Same pattern for UPDATE policy (but only for 'edit' access shares).

### Frontend Changes

**1. Settings page -- Enhanced user management**
- Add a **role selector** (Admin / Manager / User) next to each user, with ability to change roles via the `manage-users` edge function
- Add a **permissions panel** that expands per user, showing toggles for: Can Export, Can Delete Deals, Can View Others' Deals
- When creating a user, allow selecting their initial role

**2. Deal sharing UI (`src/pages/SavedCalculations.tsx`)**
- Add a **Share button** on each deal card (visible to admins/managers)
- Opens a dialog to select a user and access level (View / Edit)
- Show a small "Shared" badge on deals that are shared with the current user
- Show who shared it and the access level

**3. Update `manage-users` edge function**
- Add `update-role` action to change a user's role
- Add `update-permissions` action to set granular permissions

**4. Auth context updates**
- Fetch the current user's permissions from `user_permissions` on login
- Expose `permissions` object and a `hasPermission(key)` helper
- Components check permissions before showing export buttons, delete buttons, etc.

**5. Permission enforcement in components**
- Hide/disable Export buttons if `can_export` is false
- Hide/disable Delete buttons if `can_delete_deals` is false
- Show the UserFilter on SavedCalculations if user is admin, manager, or has `can_view_others`

### Technical Details

- The `deal_shares` table uses a foreign key to `saved_calculations` with CASCADE delete, so shares are cleaned up automatically
- Manager role gets the ability to share deals and view their team's deals, but not full admin access (no user creation/deletion)
- Permissions default to sensible values (can export: yes, can delete: yes, can view others: no) so existing users work without migration
- The edge function validates admin role before allowing role/permission changes

