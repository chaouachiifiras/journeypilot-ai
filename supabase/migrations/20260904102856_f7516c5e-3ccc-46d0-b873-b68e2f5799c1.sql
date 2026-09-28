CREATE TABLE public.copilot_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.copilot_requests TO authenticated;
GRANT ALL ON public.copilot_requests TO service_role;
ALTER TABLE public.copilot_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own copilot requests" ON public.copilot_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own copilot requests" ON public.copilot_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_copilot_requests_user_created ON public.copilot_requests (user_id, created_at DESC);