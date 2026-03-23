

## Admin User-Filter Toggle for Viewing Other Users' Deals

### What You Want
As an admin, you want a dropdown/toggle on both the **Saved Calculations** page and the **main Calculator page** that lets you filter deals by user -- see all deals, only your deals, or a specific user's deals.

### How It Works

Since RLS already returns all deals to admin users, we just need frontend filtering.

### Changes

**1. New component: `src/components/UserFilter.tsx`**
- A dropdown select showing: "All Users", "My Deals", and each individual user
- Fetches the list of users from the `profiles` table
- Only renders if the current user is an admin
- Emits a `selectedUserId` (or `null` for "all")

**2. Update `src/hooks/useCalculations.ts`**
- Accept an optional `filterUserId` parameter
- When set, add `.eq('user_id', filterUserId)` to the query
- When "My Deals" is selected, filter by `auth.uid()`
- When "All Users" is selected, no filter (admin RLS returns everything)
- Update query key to include the filter so React Query refetches on change

**3. Update `src/pages/SavedCalculations.tsx`**
- Add `UserFilter` component next to the page header
- Pass the selected user ID to `useCalculations`
- Show the creator's name on each deal card (join with profiles data)

**4. Update `src/pages/Index.tsx` (main calculator)**
- Add `UserFilter` in the navbar area or top of page
- When a user is selected, show that user's most recent loaded deal context
- This primarily affects which deals appear when loading from saved

**5. Fetch profiles for display**
- Create a small `useProfiles` hook that queries `profiles` table
- Used by UserFilter for the dropdown and by SavedCalculations to show deal owner names
- Map `user_id` on each calculation to a username for display

### Technical Details

- No database changes needed -- RLS already gives admin access to all deals
- The `profiles` table is already readable by authenticated users
- The filter is purely client-side query parameter passed to the Supabase `.eq()` filter
- Regular (non-admin) users won't see the filter at all

