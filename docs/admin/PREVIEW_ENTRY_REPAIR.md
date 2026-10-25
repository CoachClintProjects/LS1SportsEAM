# Preview entry repair — 2026-10-25

Reported deployment: `685a4f5`, `ls1sportseam-4yd2v2lwj-pieify.vercel.app`, server exception digest `3227098399`.

The root page previously queried Supabase marketing data in both metadata generation and rendering. That helper throws on missing configuration, failed requests or backend errors. The Admin Preview entry now redirects to `/login` before those reads, and its metadata does not depend on marketing. Production's published website behavior is unchanged.

Verification: isolated regression check confirms redirect and metadata succeed without any marketing query even when its backend throws; production still renders its published data. TypeScript passes.

Diagnostic limitation: the Vercel connector denied runtime logs and authenticated deployment fetch with 403. No Vercel CLI is installed in this workspace. Direct HTTP requests reached Vercel Authentication, not the application. The exact cause of the reported digest and the deployed signed-in experience are therefore not verified. This change removes the homepage dependency; it does not certify every server route.
