/// <reference types="vite/client" />
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Article {
  id: string;
  api_source?: string;
  source_name: string;
  title: string;
  url: string | null;
  image_url?: string | null;
  raw_content: string;
  entity_mentioned: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  five_bullet_summary: string[];
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  published_at: string;
  ingested_at: string;
  triaged_at?: string;
  dispatched_at?: string;
}

const getApiBaseUrl = () => {
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
  if (globalObj?.process?.env?.NEXT_PUBLIC_API_BASE_URL) {
    return globalObj.process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) {
    return (import.meta as any).env.VITE_API_BASE_URL;
  }
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

export function useWarRoom() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // 1. Fetch initial load of articles from Supabase (or fallback Express API)
  const fetchArticles = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);

      if (isSupabaseConfigured && supabase) {
        const { data, error: sbError } = await supabase
          .from('articles')
          .select('*')
          .order('ingested_at', { ascending: false, nullsFirst: false });

        if (!sbError && data && data.length > 0) {
          setArticles(data as Article[]);
          if (isInitial) setLoading(false);
          return;
        }
      }

      // Backend API fallback
      const resp = await axios.get(`${API_BASE_URL}/api/articles`);
      if (resp.data && Array.isArray(resp.data.articles)) {
        setArticles(resp.data.articles);
      }
    } catch (err: any) {
      console.warn('[useWarRoom] Fetch notice:', err.message);
      setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // 2. Realtime WebSocket Subscription with Failover Polling
  useEffect(() => {
    fetchArticles(true);

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let channel: any = null;

    const startFallbackPolling = () => {
      if (!pollingInterval) {
        console.log('[useWarRoom] Engaging 10s fallback polling check...');
        pollingInterval = setInterval(() => {
          fetchArticles(false);
        }, 10000);
      }
    };

    const stopFallbackPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    if (!isSupabaseConfigured || !supabase) {
      console.warn('[useWarRoom] Supabase client not direct; running fallback polling.');
      startFallbackPolling();
      return () => stopFallbackPolling();
    }

    // Connect to Supabase Realtime Channel
    try {
      channel = supabase
        .channel('public:articles')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'articles'
          },
          (payload) => {
            console.log('🔥 LIVE ARTICLE RECEIVED:', payload.new.title);
            setArticles((currentArticles) => {
              // Prevent duplicate keys
              if (currentArticles.some((article) => article.id === payload.new.id)) {
                return currentArticles;
              }
              // Prepend to the very top
              return [payload.new as Article, ...currentArticles];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'articles'
          },
          (payload) => {
            const updated = payload.new as Article;
            console.log('🔄 [Supabase Realtime UPDATE Received]:', updated.id, updated.status);

            // Update status in place
            setArticles((prev) =>
              prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
            );
          }
        )
        .subscribe((status) => {
          console.log(`[Supabase Realtime Status]: ${status}`);
          if (status === 'SUBSCRIBED') {
            setIsRealtimeActive(true);
            stopFallbackPolling();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setIsRealtimeActive(false);
            console.warn(`[Supabase Realtime] Status is ${status}. Activating fallback polling.`);
            startFallbackPolling();
          }
        });
    } catch (channelErr: any) {
      console.error('[useWarRoom] Failed to initialize Realtime channel:', channelErr.message);
      startFallbackPolling();
    }

    return () => {
      stopFallbackPolling();
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchArticles]);

  // 3. Acknowledge Action
  const acknowledgeArticle = async (id: string) => {
    setArticles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'ACKNOWLEDGED' } : item))
    );

    try {
      await axios.patch(`${API_BASE_URL}/api/articles/${id}/acknowledge`);
    } catch (err) {
      console.error('[useWarRoom] Failed to acknowledge article:', err);
    }
  };

  // 4. Fetch Live News Action (Instant real-world news scraper trigger)
  const fetchLiveNews = async () => {
    try {
      setIsSimulating(true);
      await axios.post(`${API_BASE_URL}/api/fetch-live`);
      // Immediately refresh articles list to reflect newly scraped & triaged events
      await fetchArticles(false);
    } catch (err: any) {
      console.error('[useWarRoom] Fetch live news failed:', err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Backward compatibility alias for any component still calling simulateCrisis
  const simulateCrisis = fetchLiveNews;

  // 5. Escalate Voice Call Action
  const triggerVoiceCall = async (article: Article) => {
    try {
      await axios.post(`${API_BASE_URL}/api/trigger-voice-call`, {
        title: article.title,
        five_bullet_summary: article.five_bullet_summary
      });
      return true;
    } catch (err) {
      console.error('[useWarRoom] Voice call dispatch failed:', err);
      return false;
    }
  };

  return {
    articles,
    loading,
    error,
    isRealtimeActive,
    isSimulating,
    isFetchingLive: isSimulating,
    fetchArticles,
    acknowledgeArticle,
    simulateCrisis,
    fetchLiveNews,
    triggerVoiceCall
  };
}
