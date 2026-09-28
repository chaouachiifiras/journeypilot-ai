-- 1. trips: personalization fields + guest ownership
ALTER TABLE public.trips ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS traveling_with text,
  ADD COLUMN IF NOT EXISTS walking_preference text,
  ADD COLUMN IF NOT EXISTS activity_intensity text,
  ADD COLUMN IF NOT EXISTS has_children boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS food_preferences text,
  ADD COLUMN IF NOT EXISTS accessibility_needs text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO anon;

DROP POLICY IF EXISTS "own trips" ON public.trips;
CREATE POLICY "trips owner access" ON public.trips
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trips guest access" ON public.trips
  FOR ALL TO anon, authenticated
  USING (user_id IS NULL) WITH CHECK (user_id IS NULL);

-- 2. trip_skeleton
CREATE TABLE public.trip_skeleton (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  tagline text NOT NULL DEFAULT '',
  overview text NOT NULL DEFAULT '',
  best_time_to_visit text,
  budget_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_skeleton_trip_id_idx ON public.trip_skeleton(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_skeleton TO anon, authenticated;
GRANT ALL ON public.trip_skeleton TO service_role;
ALTER TABLE public.trip_skeleton ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_skeleton owner access" ON public.trip_skeleton
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE POLICY "trip_skeleton guest access" ON public.trip_skeleton
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id IS NULL));

-- 3. trip_enrichment (structure only for now)
CREATE TABLE public.trip_enrichment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category text NOT NULL,
  day_number int,
  slot text,
  source_query text NOT NULL,
  place_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trip_enrichment_trip_id_idx ON public.trip_enrichment(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_enrichment TO anon, authenticated;
GRANT ALL ON public.trip_enrichment TO service_role;
ALTER TABLE public.trip_enrichment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trip_enrichment owner access" ON public.trip_enrichment
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE POLICY "trip_enrichment guest access" ON public.trip_enrichment
  FOR ALL TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id IS NULL));