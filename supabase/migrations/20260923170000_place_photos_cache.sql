-- Global, cross-trip cache of resolved real place photos, keyed by place name
-- (+ city, to disambiguate same-named places in different cities). Shared
-- read/write across all users since it holds no user data — only public
-- photo URLs/credits already resolved via Google Places / Wikimedia Commons.
CREATE TABLE public.place_photos (
  place_key text PRIMARY KEY,
  place_name text NOT NULL,
  city text,
  url text,
  source text,
  credit text,
  credit_url text,
  width int,
  height int,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.place_photos TO anon, authenticated;
GRANT ALL ON public.place_photos TO service_role;
ALTER TABLE public.place_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_photos shared read" ON public.place_photos
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "place_photos shared insert" ON public.place_photos
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "place_photos shared update" ON public.place_photos
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
