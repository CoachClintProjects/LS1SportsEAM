# Corporate site and sign-in recovery — 2026-10-25

The earlier Preview redirect (`c3f200e`) hid the corporate homepage without resolving the backend outage. It has been removed. Preview and Production both render the saved corporate website at `/`; sign-in remains at `/login`.

## Confirmed cause
Supabase Management API reported project `xedfstgwotzxnztpembv` (LS1SportsEAM) as `INACTIVE`. SQL requests failed with “Database is possibly not accessible at the moment.” The project restore request succeeded and its status transitioned to `COMING_UP`. No account passwords, data or authentication permissions were changed.

## Repair
- Restore the existing Supabase project.
- Restore corporate content at the root URL in every environment.
- Catch marketing-read failures in metadata and page rendering. An unavailable-content recovery screen is distinct from an unpublished site and provides retry/sign-in links.
- Only show a credential rejection when Supabase returns `invalid_credentials`; distinguish service/network failures, rate limits and email confirmation.
- Reset the sign-in form after exceptions and report failed backend access checks as service failures rather than incorrect authorization.

## Verification
TypeScript and isolated homepage/login error checks pass. Tests prove both environments render the corporate site, unavailable marketing does not escape as a server exception, and service errors are not labeled bad passwords.

Vercel still denies runtime-log and protected-page access through the connector. A successful Preview build is not signed-in acceptance. Verify restored project health and published content independently; the owner tests their existing password in the deployed application.
