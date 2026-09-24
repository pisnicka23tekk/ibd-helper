# Migration assessment: ibd-helper -> external backend xmdzdwhyhmijgirgxeln

Diagnostic only. No code or data changes are part of this plan.

## Key constraint (blocking)

This project runs on Lovable Cloud (ref gyoakvtzhbokdpkdamjj). Once Cloud is enabled on a project it cannot be disconnected or swapped for another backend — not by me, and not by restoring an earlier version. So this project cannot be re-pointed to xmdzdwhyhmijgirgxeln in place.

## What is required (user actions)

1. Create a new Lovable project with Cloud turned off for it (Connectors -> Lovable Cloud -> Disable Cloud affects future projects only).
2. In that new project, connect the external Supabase project through the Supabase connector. This is an OAuth authorization you must do yourself as owner of the account holding xmdzdwhyhmijgirgxeln — I cannot authorize it for you.
3. Bring the app code into the new project (copy source; `src/integrations/supabase/*` will be regenerated for the new ref).
4. Add secrets in the new project: an AI key for chat/report/extract (Lovable AI Gateway key is managed only on Cloud; on an external backend you need LOVABLE_API_KEY or another provider key set manually).
5. In the external project: enable email/password auth and decide on email confirmation.

## What must be preserved (inventory)

Database (single migration):
- Tables: profiles, health_profile, threads, messages, daily_logs, lab_results — all with `user_id`/`id` FK to auth.users ON DELETE CASCADE.
- RLS: one "own rows" policy per table (`auth.uid() = user_id`, for authenticated).
- Function + triggers: `update_updated_at_column()` on profiles, health_profile, threads, daily_logs.
- Grants to authenticated/service_role must be recreated.

Auth: email + password only (signUp / signInWithPassword in the auth page). No OAuth providers, no admin API use.

Storage: none. Attachments are sent as inline data in chat, not stored in buckets.

Edge functions: none. Server logic lives in app server routes: /api/chat, /api/report, /api/extract-labs (use per-request user token verification).

Realtime: none used.

## Data migration risks

- Health data rows in the 6 tables can be exported via read queries and re-imported.
- User accounts: password hashes cannot be exported from Cloud (no service role / DB password access). Users would need to re-register or reset passwords, and their user IDs change — so data rows must be remapped to new user IDs by email.
- Sensitive health data: transfer should be done deliberately, ideally with user consent.

## Proposed next steps (after approval, in the new project)

1. Apply the schema migration to xmdzdwhyhmijgirgxeln.
2. Export current table data as SQL/CSV for you to keep.
3. Remap and import data once users re-register.
4. Verify auth, RLS isolation and the three AI routes end to end.
