

## Fix: "Failed to create user" Error

### Root Cause

The `manage-users` edge function uses `anonClient.auth.getClaims(token)` on line 28 to verify the caller's identity. This method is not reliably available in the version of `@supabase/supabase-js` loaded via `esm.sh`. When `getClaims` fails or returns an unexpected shape, the function either throws (caught as a 500 error) or returns a 401, which the frontend interprets as "Failed to create user".

Note: The user `jackr1` was likely created on a retry (the network logs show a successful 200 response for that attempt), but the initial attempt failed due to this `getClaims` issue.

### The Fix

**File: `supabase/functions/manage-users/index.ts`**

Replace the unreliable `getClaims` call with the standard `getUser()` method, which is well-supported across all supabase-js v2 versions:

```typescript
// BEFORE (line 27-32):
const token = authHeader.replace('Bearer ', '')
const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
if (claimsError || !claimsData?.claims) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
}
const callerId = claimsData.claims.sub

// AFTER:
const { data: { user }, error: userError } = await anonClient.auth.getUser()
if (userError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
}
const callerId = user.id
```

`getUser()` uses the Authorization header already set on the client to verify the token server-side and return the user object. This is the standard, documented approach.

