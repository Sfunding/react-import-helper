## Fix: position "Weeks Left" can skip values (e.g. 22 weeks unreachable)

### Root cause
The Days/Weeks Left controls in the Positions table do a lossy round-trip:
- Weeks input writes `balance = weeks * 5 * dailyPayment` (line ~1932).
- Days left is then re-derived with `Math.ceil(balance / dailyPayment)` (lines ~1762 and ~398).
- Floating-point division turns an exact `110` into `110.0000000001`, and `Math.ceil` rounds it up to `111`, so the field redisplays `ceil(111/5) = 23` instead of `22`. For certain daily-payment amounts (like the Fox position's), specific week counts become impossible to land on.

### Changes (all in `src/pages/Index.tsx`)
1. Make the days-left derivation tolerant of float error by subtracting a tiny epsilon before ceiling. Apply to both spots that compute it:
   - The memoized positions map (line ~398).
   - The per-row `daysLeft` used by the table inputs (line ~1762).
   ```text
   daysLeft = Math.ceil(balance / dailyPayment - 1e-6)
   ```
   This keeps genuine partial days rounding up while killing the spurious +1 from floating-point noise.

2. Verify the weeks input (line ~1929) now round-trips cleanly: typing/stepping to 22 stores `110 * dailyPayment` and redisplays exactly `22`. No change needed there once the ceil is corrected, but confirm by testing decrement/increment across 21 → 22 → 23.

### Out of scope
- The reverse-deal Term (Weeks) field and Excel export math are unaffected by this bug and won't be touched.

### Verification
- Load a deal with the Fox position, step the weeks field down to 21 and up to 23, and confirm 22 is now reachable both by typing and via the spinner arrows.
