

## Fix: Audit Log Not Recording Events

### Root Cause

`logAuditEvent` relies on `supabase.auth.getSession()` to get the current user. After `signInWithPassword`, the internal session state may not be updated by the time the fire-and-forget `getSession()` runs, so `session?.user` is `null` and the function silently exits without inserting anything.

This affects login events most obviously, but could also affect deal operations if there's any session refresh timing issue.

### Fix

**1. Update `src/lib/auditLog.ts`** -- Accept an optional `userId` parameter so callers can pass it directly instead of relying on `getSession()`:

```typescript
export function logAuditEvent(params: {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  userId?: string;  // Allow passing directly
}) {
  if (params.userId) {
    // Insert directly with provided userId
    insertAuditLog(params.userId, params);
  } else {
    // Fall back to getSession
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      insertAuditLog(session.user.id, params);
    });
  }
}
```

**2. Update `src/contexts/AuthContext.tsx`** -- After `signInWithPassword` succeeds, extract the user from the sign-in response and pass the userId directly:

```typescript
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return { success: false, error: '...' };
logAuditEvent({ 
  action: 'login', 
  userId: data.session?.user.id,  // Pass directly
  resourceType: 'session',
  metadata: { username } 
});
```

### Summary

Two small changes -- no database or migration changes needed. The audit log function gets an optional `userId` param, and the login call passes it explicitly.

