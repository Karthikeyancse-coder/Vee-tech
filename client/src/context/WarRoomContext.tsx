/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface Article {
  id: string;
  correlation_id?: string;
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
  briefed_at?: string;
  alerted_at?: string;
  dispatched_at?: string;
}

export interface WarRoomContextValue {
  articles: Article[];
  loading: boolean;
  error: string | null;
  isRealtimeActive: boolean;
  isSimulating: boolean;
  isFetchingLive: boolean;
  fetchArticles: (isInitial?: boolean) => Promise<void>;
  acknowledgeArticle: (id: string) => Promise<void>;
  fetchLiveNews: () => Promise<void>;
  simulateCrisis: () => Promise<void>;
  triggerVoiceCallAlert: (article: Article) => Promise<void>;
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

/**
 * Exponential backoff retry wrapper to handle transient Supabase network blips (ERR_CONNECTION_RESET)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 400,
  factor = 2
): Promise<T> {
  let attempt = 0;
  let currentDelay = delayMs;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) throw err;
      console.warn(`[Supabase Retry] Attempt ${attempt} failed (${err.message}). Retrying in ${currentDelay}ms...`);
      await new Promise((res) => setTimeout(res, currentDelay));
      currentDelay *= factor;
    }
  }
  throw new Error('All retry attempts failed');
}

export const WarRoomContext = createContext<WarRoomContextValue | null>(null);

export const WarRoomProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);

  // 1. Fetch initial load of articles with exponential backoff
  const fetchArticles = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);

      if (isSupabaseConfigured && supabase) {
        let simFailureCount = 0;
        const data = await retryWithBackoff(async () => {
          // Test hook for Bug 5 verification: if triggered, simulate a network reset on attempt 1 then recover
          if (typeof window !== 'undefined' && (window as any).__simulateSupabaseFailOnce && simFailureCount === 0) {
            simFailureCount++;
            throw new Error('TypeError: Failed to fetch (net::ERR_CONNECTION_RESET)');
          }
          const { data: resData, error: sbError } = await supabase!
            .from('articles')
            .select('*')
            .order('ingested_at', { ascending: false, nullsFirst: false });

          if (sbError) throw sbError;
          return resData;
        }, 3, 400);

        if (data && data.length > 0) {
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
      console.warn('[WarRoomProvider] Fetch notice:', err.message);
      setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // 2. Singleton Supabase Realtime Subscription
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).simulateSupabaseRetry = async () => {
        (window as any).__simulateSupabaseFailOnce = true;
        console.log('[Test Harness] Triggering simulated Supabase network failure to test retryWithBackoff...');
        await fetchArticles(false);
        (window as any).__simulateSupabaseFailOnce = false;
      };

      const params = new URLSearchParams(window.location.search);
      if (params.get('simulateRetry') === 'true') {
        setTimeout(() => {
          (window as any).simulateSupabaseRetry();
        }, 100);
      }
    }

    fetchArticles(true);

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let channel: any = null;

    const startFallbackPolling = () => {
      if (!pollingInterval) {
        console.log('[WarRoomProvider] Engaging 10s fallback polling check...');
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
      console.warn('[WarRoomProvider] Supabase client not direct; running fallback polling.');
      startFallbackPolling();
      return () => stopFallbackPolling();
    }

    try {
      // Connect to singleton Realtime channel
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
              if (currentArticles.some((article) => article.id === payload.new.id)) {
                return currentArticles;
              }
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
      console.error('[WarRoomProvider] Failed to initialize Realtime channel:', channelErr.message);
      startFallbackPolling();
    }

    return () => {
      stopFallbackPolling();
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchArticles]);

  // 3. Acknowledge Article
  const acknowledgeArticle = useCallback(
    async (id: string) => {
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'ACKNOWLEDGED' as const } : a))
      );

      try {
        if (isSupabaseConfigured && supabase) {
          const { error: sbErr } = await supabase
            .from('articles')
            .update({ status: 'ACKNOWLEDGED' })
            .eq('id', id);
          if (sbErr) throw sbErr;
        } else {
          await axios.patch(`${API_BASE_URL}/api/articles/${id}/acknowledge`);
        }
      } catch (err: any) {
        console.error('[WarRoomProvider] Failed to acknowledge article:', err);
        fetchArticles(false);
      }
    },
    [fetchArticles]
  );

  // 4. Fetch Live Authentic News
  const fetchLiveNews = useCallback(async () => {
    setIsFetchingLive(true);
    try {
      const resp = await axios.post(`${API_BASE_URL}/api/fetch-live`);
      console.log('[WarRoomProvider] Live authentic news fetched:', resp.data);
      await fetchArticles(false);
    } catch (err: any) {
      console.error('[WarRoomProvider] Fetch live news failed:', err.message);
    } finally {
      setIsFetchingLive(false);
    }
  }, [fetchArticles]);

  // 5. Simulate Crisis Ingestion Trigger
  const simulateCrisis = useCallback(async () => {
    setIsSimulating(true);
    try {
      await fetchLiveNews();
    } catch (err: any) {
      console.error('[WarRoomProvider] Ingestion trigger failed:', err.message);
    } finally {
      setIsSimulating(false);
    }
  }, [fetchLiveNews]);

  // 6. Voice Call Telephony Trigger
  const triggerVoiceCallAlert = useCallback(async (article: Article) => {
    try {
      console.log('🚨 Dispatching emergency voice alert for article:', article.id);
      await axios.post(`${API_BASE_URL}/api/simulate-voice-call`, {
        articleId: article.id,
        title: article.title,
        bullets: article.five_bullet_summary
      });
    } catch (err) {
      console.error('[WarRoomProvider] Voice call dispatch notice:', err);
    }
  }, []);

  return (
    <WarRoomContext.Provider
      value={{
        articles,
        loading,
        error,
        isRealtimeActive,
        isSimulating,
        isFetchingLive,
        fetchArticles,
        acknowledgeArticle,
        fetchLiveNews,
        simulateCrisis,
        triggerVoiceCallAlert
      }}
    >
      {children}
    </WarRoomContext.Provider>
  );
};
