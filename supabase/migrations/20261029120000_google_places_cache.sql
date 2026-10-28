-- Shared cache of Google Places search responses (see src/lib/places/google-cache.server.ts).
-- Written and read only by the server with the service role: RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.google_places_cache (
  cache_key text PRIMARY KEY,
  endpoint text NOT NULL,
  response jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_places_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.google_places_cache TO service_role;
CREATE INDEX IF NOT EXISTS google_places_cache_fetched_at_idx ON public.google_places_cache (fetched_at);
