## Problem

When clicking a saved deal from Saved Calculations, the deal loads briefly, then the app reverts to an empty/new calculation page.

## Root cause

In `src/pages/Index.tsx` there is a startup race between two effects:

- `useDraftOnMount` reads the local-storage draft inside a `useEffect`, so `pendingDraft` becomes available only on the *next* render.
- A separate `useEffect` reads `sessionStorage.loadCalculation` and immediately removes it.

The draft-banner effect that decides whether to offer "Unsaved draft recovered" checks `sessionStorage.getItem('loadCalculation')` to detect an incoming load. But because it runs after `pendingDraft` is set — i.e. after the load effect already cleared the key — `incomingLoad` is always `false` on a deal load. The banner shows up, the user (or any restore action) then overwrites the freshly-loaded deal with the previous "new calculation" draft.

## Fix

Capture the incoming-load signal synchronously at module/mount time, before any effect can clear it.

1. In `src/pages/Index.tsx`, add a top-of-component ref:
   ```ts
   const hadIncomingLoadRef = useRef<boolean>(
     typeof window !== 'undefined' && !!sessionStorage.getItem('loadCalculation')
   );
   ```
   This is evaluated during the very first render, before any `useEffect` runs.

2. Replace the existing check inside the draft-banner effect (around line 156):
   ```ts
   const incomingLoad = !!sessionStorage.getItem('loadCalculation');
   ```
   with:
   ```ts
   const incomingLoad = hadIncomingLoadRef.current;
   ```

3. When an incoming load is detected, also clear the stored draft so a stale draft can't reappear later:
   ```ts
   if (hasContent && !incomingLoad) {
     setDraftBannerDraft(pendingDraft);
   } else {
     if (incomingLoad) clearDraft();
     dismissDraft();
   }
   ```

That's the only change required. The load-from-sessionStorage effect, auto-save logic, and draft backup logic stay as-is.

## Verification

- Open a saved deal from `/saved` → deal stays loaded; no "Unsaved draft recovered" banner appears.
- Refresh `/` after editing without saving → draft banner still appears as before.
- Discard / Restore on the banner still behave correctly when there is no incoming load.

## Out of scope

- Excel/PDF math, factor rates, schedules, RLS, auth.
