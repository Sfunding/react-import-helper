

## Fix: Login Page Stuck on Loading Spinner

### Root Cause

The `AuthContext` useEffect has a deadlock between `onAuthStateChange` and `getSession()`:

1. `onAuthStateChange` is registered with an **async callback** that awaits database queries
2. `getSession()` internally waits for the `INITIAL_SESSION` event from `onAuthStateChange` to finish processing
3. But `onAuthStateChange`'s async callback awaits `checkNeedsSetup()` (a network call) before completing
4. This creates a circular dependency where both paths block each other, so `setIsLoading(false)` is never called

This explains why there are **zero network requests** -- the auth system deadlocks before any REST calls can be made.

### The Fix

**File: `src/contexts/AuthContext.tsx`**

Rewrite the `useEffect` to:
1. **Not use async callbacks** in `onAuthStateChange` -- fire-and-forget the async work instead
2. Add **try/catch** around all async operations so `setIsLoading(false)` is always called
3. Use a single `initializeAuth` function called from `getSession()` only (not duplicated in `onAuthStateChange`)
4. Let `onAuthStateChange` handle only subsequent session changes (not initial load)

```typescript
useEffect(() => {
  let initialized = false;

  const initialize = async (session: any) => {
    try {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const admin = await checkAdminRole(currentUser.id);
        setIsAdmin(admin);
        setNeedsSetup(false);
      } else {
        setIsAdmin(false);
        const setup = await checkNeedsSetup();
        setNeedsSetup(setup);
      }
    } catch (err) {
      console.error('Auth init error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (initialized) {
        // Only handle subsequent changes, not initial
        initialize(session);
      }
    }
  );

  supabase.auth.getSession().then(({ data: { session } }) => {
    initialized = true;
    initialize(session);
  });

  return () => subscription.unsubscribe();
}, []);
```

Key changes:
- `onAuthStateChange` callback is **no longer async** -- avoids the deadlock
- Only `getSession()` drives the initial load
- Subsequent auth changes (login/logout) are handled by `onAuthStateChange` after initialization
- `try/catch/finally` guarantees `setIsLoading(false)` always runs

### Technical Details

The deadlock happens because supabase-js v2.39+ changed `getSession()` to wait for `INITIAL_SESSION`. When the `onAuthStateChange` callback is async, the library tracks the promise. If that promise awaits I/O, `getSession()` hangs waiting for it, and both code paths stall indefinitely. Making the callback synchronous (fire-and-forget) breaks the cycle.

