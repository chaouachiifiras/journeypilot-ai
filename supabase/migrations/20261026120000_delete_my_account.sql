-- In-app account deletion (App Store guideline 5.1.1(v)). Applied on Lovable Cloud on 2026-10-26.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: sign in to delete your account.';
  END IF;

  DELETE FROM public.chat_messages WHERE user_id = auth.uid();
  DELETE FROM public.chat_threads WHERE user_id = auth.uid();
  DELETE FROM public.trip_activities WHERE user_id = auth.uid();
  DELETE FROM public.saved_places WHERE user_id = auth.uid();
  DELETE FROM public.generated_itineraries WHERE user_id = auth.uid();
  DELETE FROM public.itinerary_drafts WHERE user_id = auth.uid();
  DELETE FROM public.ai_runs WHERE user_id = auth.uid();
  DELETE FROM public.copilot_requests WHERE user_id = auth.uid();
  DELETE FROM public.trips WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
