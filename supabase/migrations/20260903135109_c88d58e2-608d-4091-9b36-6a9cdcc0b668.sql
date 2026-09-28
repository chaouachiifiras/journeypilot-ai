CREATE TABLE public.saved_places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('restaurant','hotel')),
  provider TEXT NOT NULL DEFAULT 'osm',
  provider_place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  place_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, trip_id, provider, provider_place_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;

ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own saved places"
ON public.saved_places FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX saved_places_user_trip_idx ON public.saved_places (user_id, trip_id);