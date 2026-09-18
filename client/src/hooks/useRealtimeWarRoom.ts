import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import axios from 'axios';

export interface RealtimeArticle {
  id: string;
  source_name: string;
  title: string;
  url?: string;
  raw_content: string;
  entity_mentioned: string;
  sentiment: string;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  five_bullet_summary: string[] | { [key: string]: string };
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  published_at: string;
  ingested_at: string;
  triaged_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export function useRealtimeWarRoom(onCriticalAlert?: (article: RealtimeArticle) => void) {
  const [articles, setArticles] = useState<RealtimeArticle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<'CONNECTING' | 'SUBSCRIBED' | 'STANDBY'>('CONNECTING');

  // 1. Fetch initial articles from Supabase or Express API
  const fetchInitialArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Attempt Supabase fetch first if configured
      if (isSupabaseConfigured && supabase) {
        const { data, error: sbError } = await supabase
          .from('articles')
          .select('*')
          .eq('status', 'ACTIVE')
          .order('ingested_at', { ascending: false });

        if (!sbError && data && data.length > 0) {
          setArticles(data as RealtimeArticle[]);
          setLoading(false);
          return;
        }
      }

      // Direct fallback to Node.js backend port 5000
      const response = await axios.get(`${API_BASE_URL}/api/articles`);
      if (response.data && response.data.articles) {
        // Map backend articles to unified schema
        const mapped = response.data.articles.map((item: any) => ({
          id: item.id,
          source_name: item.source_name || item.metadata?.newspaperOrSource || 'Verified News Wire',
          title: item.title || item.metadata?.headline || 'Breaking Alert',
          url: item.url || item.metadata?.url || '',
          raw_content: item.raw_content || item.metadata?.shortDescription || '',
          entity_mentioned: item.entity_mentioned || item.entity || 'Infosys',
          sentiment: item.sentiment || 'Neutral',
          risk_score: item.risk_score || item.riskScore || 5.0,
          risk_level: item.risk_level || item.riskLevel || 'Medium',
          five_bullet_summary: Array.isArray(item.five_bullet_summary)
            ? item.five_bullet_summary
            : item.summary
            ? [
                item.summary.whatHappened,
                item.summary.whyItMatters,
                item.summary.riskJustification,
                item.summary.competitorImpact,
                item.summary.recommendedAction
              ]
            : ['Critical event registered by Vee-Alert.'],
          status: item.status ? item.status.toUpperCase() : 'ACTIVE',
          published_at: item.published_at || item.sla?.publishedAt || new Date().toISOString(),
          ingested_at: item.ingested_at || item.sla?.ingestedAt || new Date().toISOString(),
          triaged_at: item.triaged_at || item.sla?.triagedAt || new Date().toISOString()
        }));
        setArticles(mapped);
      }
    } catch (err: any) {
      console.warn('[WarRoom Hook] Fetch error, preserving existing state:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Set up Supabase Realtime Subscription
  useEffect(() => {
    fetchInitialArticles();

    if (!isSupabaseConfigured || !supabase) {
      setRealtimeStatus('STANDBY');
      // Polling fallback every 4s when running without live Supabase credentials
      const interval = setInterval(fetchInitialArticles, 4000);
      return () => clearInterval(interval);
    }

    const realtimeClient = supabase;
    // Subscribe to Postgres Changes via Supabase Realtime
    const channel = realtimeClient
      .channel('public:articles')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'articles' },
        (payload) => {
          const newArticle = payload.new as RealtimeArticle;
          console.log('[Supabase Realtime INSERT]', newArticle.title);

          // Prepend newly triaged incoming card instantly
          setArticles((prev) => [newArticle, ...prev.filter((a) => a.id !== newArticle.id)]);

          if (newArticle.risk_level === 'Critical' && onCriticalAlert) {
            onCriticalAlert(newArticle);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'articles' },
        (payload) => {
          const updatedArticle = payload.new as RealtimeArticle;
          console.log('[Supabase Realtime UPDATE]', updatedArticle.id, updatedArticle.status);

          setArticles((prev) =>
            prev.map((a) => (a.id === updatedArticle.id ? { ...a, ...updatedArticle } : a))
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Connected to public:articles channel');
          setRealtimeStatus('SUBSCRIBED');
        }
      });

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [fetchInitialArticles, onCriticalAlert]);

  // 3. Action: Simulate Crisis (Triggers POST /api/simulate-crisis)
  const simulateCrisis = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/simulate-crisis`);
      if (response.data && response.data.article) {
        const incoming = response.data.article as RealtimeArticle;
        setArticles((prev) => [incoming, ...prev.filter((a) => a.id !== incoming.id)]);
        if (onCriticalAlert) {
          onCriticalAlert(incoming);
        }
      }
      return response.data;
    } catch (err: any) {
      console.error('[Simulate Crisis Error]:', err.message);
      throw err;
    }
  }, [onCriticalAlert]);

  // 4. Action: Acknowledge Article (Triggers PATCH /api/articles/:id/acknowledge)
  const acknowledgeArticle = useCallback(async (articleId: string) => {
    // Optimistic UI update
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, status: 'ACKNOWLEDGED' } : a))
    );

    try {
      const response = await axios.patch(`${API_BASE_URL}/api/articles/${articleId}/acknowledge`);
      return response.data;
    } catch (err: any) {
      console.error('[Acknowledge Error]:', err.message);
      // Revert if request fails
      fetchInitialArticles();
    }
  }, [fetchInitialArticles]);

  // 5. Action: Test Voice Call Escalation
  const testVoiceCall = useCallback(async (title: string, summary: string[]) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/trigger-voice-call`, {
        title,
        five_bullet_summary: summary
      });
      return response.data;
    } catch (err: any) {
      console.error('[Voice Call Error]:', err.message);
      throw err;
    }
  }, []);

  return {
    articles,
    loading,
    error,
    realtimeStatus,
    simulateCrisis,
    acknowledgeArticle,
    testVoiceCall,
    refetch: fetchInitialArticles
  };
}
