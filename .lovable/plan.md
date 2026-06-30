## Goal

Let admins capture a real email address for each user and email them a secure "reset your password" link. The user clicks it, lands on a new page, and sets their own password. Adding users, role/permission management, and the login audit log already exist and stay as-is.

## How the reset link works (important constraint)

Logins are username-based — each account's real auth identity is a synthetic `username@app.internal` address, and login must keep working that way. So we do **not** change the auth email. Instead:

- Store a real email on each user's profile (e.g. `jake@gmail.com`).
- When you click "Send reset email", the backend generates a Supabase recovery link for that account and emails it to the real address. The link carries the secure token, so it works regardless of which inbox receives it.
- The link opens a new `/reset-password` page where the user chooses a new password.

## Prerequisite: email sending domain

The project has no email-sending domain yet, so reset emails can't go out until one is set up. This is a one-time step you complete in a dialog:

<presentation-actions>
<presentation-open-email-setup>Set up email domain</presentation-open-email-setup>
</presentation-actions>

After the domain is added (DNS can finish verifying in the background), I'll wire up the email infrastructure and the reset flow.

## What I'll build

**1. Database**
- Add an `email` column to the `profiles` table (text, optional, stores each user's real email).

**2. Email infrastructure + template**
- Set up Lovable's app-email infrastructure.
- Create a branded "Reset your password" email template (matching the Avion navy/teal styling) containing the reset button/link.

**3. Backend (`manage-users` edge function)** — admin-only, as today
- `create`: also accept and save a real `email` on the profile.
- `update-email`: set/change a user's email (for the 5 existing users and future edits).
- `send-reset-email`: look up the user's real email, generate a recovery link pointing at `/reset-password`, and send it via the reset-password email template. Errors clearly if the user has no email on file.

**4. New page: `/reset-password`** (public route)
- Reads the recovery token from the URL, shows a "set new password" form, calls `supabase.auth.updateUser({ password })`, then redirects to login. Includes the existing 8+ char validation.

**5. Settings UI (`src/pages/Settings.tsx`)**
- Add an **Email** field to the Create New User form.
- Show each user's email in the list, with an inline edit to add/change it.
- Add a **"Send reset email"** button per user (mail icon) next to the existing key/delete actions. The current admin "set password directly" reset stays as a fallback.

## Out of scope (already working, untouched)
- Adding users, roles, granular permissions, delete user, and the login audit log all already exist on the admin Settings page.

## Technical notes
- The recovery link is created with the service-role admin client via `generateLink({ type: 'recovery', email: '<username>@app.internal', options: { redirectTo: <app-origin>/reset-password } })`; only the link is emailed, to the real address.
- `/reset-password` must be a public route (added above the catch-all in `App.tsx`), outside `AuthGuard`.
- After setting the password, the temporary recovery session is signed out and the user is sent to `/login`.
- No change to the username→synthetic-email login mapping.
