-- Vee-Alert Supabase schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    raw_content TEXT NOT NULL,
    entity_mentioned TEXT NOT NULL,
    sentiment TEXT NOT NULL CHECK (sentiment IN ('Positive', 'Neutral', 'Negative')),
    risk_score NUMERIC(4, 2) NOT NULL CHECK (risk_score >= 1 AND risk_score <= 10),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    five_bullet_summary JSONB NOT NULL CHECK (jsonb_typeof(five_bullet_summary) = 'array'),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED')),
    published_at TIMESTAMPTZ NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    triaged_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.alert_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('WhatsApp', 'Email', 'Telegram', 'Slack', 'Voice')),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sla_seconds NUMERIC(8, 2) NOT NULL CHECK (sla_seconds >= 0),
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.alert_logs DROP CONSTRAINT IF EXISTS alert_logs_channel_check;
ALTER TABLE public.alert_logs ADD CONSTRAINT alert_logs_channel_check
    CHECK (channel IN ('WhatsApp', 'Email', 'Telegram', 'Slack', 'Voice'));

CREATE INDEX IF NOT EXISTS idx_articles_ingested_at ON public.articles (ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_active ON public.articles (status, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_article_id ON public.alert_logs (article_id);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read articles" ON public.articles;
CREATE POLICY "Public can read articles" ON public.articles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can read alert logs" ON public.alert_logs;
CREATE POLICY "Public can read alert logs" ON public.alert_logs FOR SELECT USING (true);

ALTER TABLE public.articles REPLICA IDENTITY FULL;
ALTER TABLE public.alert_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'articles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'alert_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_logs;
    END IF;
END
$$;
