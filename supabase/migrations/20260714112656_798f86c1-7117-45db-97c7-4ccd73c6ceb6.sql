
DROP POLICY IF EXISTS "own trips" ON public.trips;
DROP POLICY IF EXISTS "own threads" ON public.chat_threads;
DROP POLICY IF EXISTS "own messages" ON public.chat_messages;

CREATE POLICY "own trips" ON public.trips FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own threads" ON public.chat_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
