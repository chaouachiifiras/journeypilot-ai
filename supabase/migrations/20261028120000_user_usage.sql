-- Lifetime free-tier counters per user: trips generated and assistant questions asked.
-- Kept apart from trips / chat_messages because users can delete those rows through RLS
-- (and messages cascade-delete with their thread), which would reset a quota computed
-- from them. Users can only read their own row; the only write path is increment_usage().
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trips_created integer NOT NULL DEFAULT 0,
  chat_questions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own usage" ON public.user_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Existing users keep the trips they already generated on their counter.
INSERT INTO public.user_usage (user_id, trips_created)
SELECT user_id, count(*)::int FROM public.trips WHERE status <> 'error' GROUP BY user_id
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.increment_usage(kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF kind = 'trip' THEN
    INSERT INTO public.user_usage (user_id, trips_created) VALUES (auth.uid(), 1)
    ON CONFLICT (user_id) DO UPDATE
      SET trips_created = public.user_usage.trips_created + 1, updated_at = now()
    RETURNING trips_created INTO n;
  ELSIF kind = 'chat' THEN
    INSERT INTO public.user_usage (user_id, chat_questions) VALUES (auth.uid(), 1)
    ON CONFLICT (user_id) DO UPDATE
      SET chat_questions = public.user_usage.chat_questions + 1, updated_at = now()
    RETURNING chat_questions INTO n;
  ELSE
    RAISE EXCEPTION 'Unknown usage kind: %', kind;
  END IF;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_usage(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(text) TO authenticated;
