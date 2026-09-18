import { useState, useRef, useEffect, useCallback } from 'react';
import { IntelligenceItem } from '../types';

export function useVoiceCall() {
  const [activeCallArticle, setActiveCallArticle] = useState<IntelligenceItem | null>(null);
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'connected' | 'speaking' | 'acknowledged' | 'pr_bridged'>('idle');
  const [ivrMessage, setIvrMessage] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  
  const ringAudioCtx = useRef<AudioContext | null>(null);
  const ringInterval = useRef<any>(null);
  const animFrame = useRef<any>(null);

  // Play synthetic telephone ring tone (440Hz + 480Hz US dual-tone)
  const startRingtone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ringAudioCtx.current = ctx;

      const playBurst = () => {
        if (ctx.state === 'suspended') ctx.resume();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.8);
        osc2.stop(ctx.currentTime + 1.8);
      };

      playBurst();
      ringInterval.current = setInterval(playBurst, 3500);
    } catch (err) {
      console.warn('AudioContext not allowed without user gesture yet', err);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringInterval.current) {
      clearInterval(ringInterval.current);
      ringInterval.current = null;
    }
    if (ringAudioCtx.current) {
      try {
        ringAudioCtx.current.close();
      } catch (e) {}
      ringAudioCtx.current = null;
    }
  }, []);

  // Play synthetic DTMF tone on keypad press
  const playDTMFTone = useCallback((key: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freqMap: Record<string, number> = {
        '1': 697, '2': 770, '3': 852,
        '4': 770, '5': 852, '6': 941,
        '7': 852, '8': 941, '9': 1209,
        '0': 941, '*': 1336, '#': 1477
      };

      osc.frequency.value = freqMap[key] || 800;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }, []);

  // Trigger an emergency voice call for a critical article
  const triggerVoiceCall = useCallback((article: IntelligenceItem) => {
    setActiveCallArticle(article);
    setCallState('ringing');
    setIvrMessage('Incoming Emergency Alert from Vee-Alert Automated Dispatch System...');
    startRingtone();
  }, [startRingtone]);

  // Answer call
  const answerCall = useCallback(() => {
    stopRingtone();
    setCallState('connected');
    setIvrMessage('Call Connected. Initializing Emergency AI Briefing...');

    if (!activeCallArticle) return;

    // Build synthesized spoken speech
    const speechText = `Emergency priority crisis alert for Infosys leadership. Subject: ${activeCallArticle.metadata.headline}. Reported in ${activeCallArticle.metadata.newspaperOrSource}. AI risk score is ${activeCallArticle.riskScore} out of 10. Summary: ${activeCallArticle.summary.whatHappened} Recommended action: ${activeCallArticle.summary.recommendedAction}. Press 1 to acknowledge and suppress alerts. Press 2 to bridge directly to the Corporate PR and Legal response team.`;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      utterance.onstart = () => {
        setCallState('speaking');
        setIvrMessage('AI Voice Agent Speaking: Delivering 5-Bullet Briefing...');
      };

      utterance.onend = () => {
        setCallState('connected');
        setIvrMessage('Awaiting your input. Press 1 to Acknowledge. Press 2 to Bridge PR team.');
      };

      utterance.onerror = () => {
        setCallState('connected');
        setIvrMessage('Briefing delivered. Press 1 to Acknowledge, Press 2 to Bridge PR.');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setCallState('connected');
        setIvrMessage('Voice briefing ready. Press 1 to Acknowledge, Press 2 to Bridge PR.');
      }, 1500);
    }
  }, [activeCallArticle, stopRingtone]);

  // Handle DTMF Keypad Press
  const handleKeypadPress = useCallback((key: string) => {
    playDTMFTone(key);

    if (key === '1') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setCallState('acknowledged');
      setIvrMessage('Key 1 Received: Alert acknowledged and logged. Crisis War Room updated.');
      setTimeout(() => {
        closeCall();
      }, 3500);
    } else if (key === '2') {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setCallState('pr_bridged');
      setIvrMessage('Key 2 Received: Dialing Global PR & Legal Emergency Bridge Line now...');
      setTimeout(() => {
        closeCall();
      }, 4500);
    }
  }, [playDTMFTone]);

  // Terminate call
  const closeCall = useCallback(() => {
    stopRingtone();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCallState('idle');
    setActiveCallArticle(null);
    setIvrMessage('');
  }, [stopRingtone]);

  // Audio wave animation simulator
  useEffect(() => {
    if (callState === 'speaking' || callState === 'ringing') {
      const interval = setInterval(() => {
        setAudioLevel(Math.random() * 0.8 + 0.2);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setAudioLevel(0);
    }
  }, [callState]);

  return {
    activeCallArticle,
    callState,
    ivrMessage,
    audioLevel,
    triggerVoiceCall,
    answerCall,
    handleKeypadPress,
    closeCall
  };
}
