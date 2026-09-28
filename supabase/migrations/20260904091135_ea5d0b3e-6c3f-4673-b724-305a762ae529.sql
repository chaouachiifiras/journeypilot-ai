ALTER TABLE public.saved_places DROP CONSTRAINT IF EXISTS saved_places_kind_check;
ALTER TABLE public.saved_places ADD CONSTRAINT saved_places_kind_check CHECK (kind IN ('restaurant','hotel','activity'));

CREATE TABLE public.trip_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  provider_place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  day INTEGER,
  time_slot TEXT,
  duration_minutes INTEGER,
  note TEXT,
  activity_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, trip_id, provider, provider_place_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_activities TO authenticated;
GRANT ALL ON public.trip_activities TO service_role;

ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own trip activities"
ON public.trip_activities FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX trip_activities_user_trip_idx ON public.trip_activities (user_id, trip_id);