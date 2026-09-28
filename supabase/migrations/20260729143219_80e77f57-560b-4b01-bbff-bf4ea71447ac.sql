-- Remove overly permissive guest policies
DROP POLICY IF EXISTS "trips guest access" ON public.trips;
DROP POLICY IF EXISTS "trip_skeleton guest access" ON public.trip_skeleton;
DROP POLICY IF EXISTS "trip_enrichment guest access" ON public.trip_enrichment;

-- Purge legacy ownerless rows (no longer attributable to any session)
DELETE FROM public.trip_enrichment e WHERE EXISTS (SELECT 1 FROM public.trips t WHERE t.id = e.trip_id AND t.user_id IS NULL);
DELETE FROM public.trip_skeleton s WHERE EXISTS (SELECT 1 FROM public.trips t WHERE t.id = s.trip_id AND t.user_id IS NULL);
DELETE FROM public.trips WHERE user_id IS NULL;

-- Ownership is mandatory (anonymous sessions still have a real auth.uid())
ALTER TABLE public.trips ALTER COLUMN user_id SET NOT NULL;

-- Anonymous role no longer needs any access
REVOKE ALL ON public.trips FROM anon;
REVOKE ALL ON public.trip_skeleton FROM anon;
REVOKE ALL ON public.trip_enrichment FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_skeleton TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_enrichment TO authenticated;
GRANT ALL ON public.trips TO service_role;
GRANT ALL ON public.trip_skeleton TO service_role;
GRANT ALL ON public.trip_enrichment TO service_role;