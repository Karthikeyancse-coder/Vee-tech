/// <reference types="vite/client" />
import { useContext } from 'react';
import { WarRoomContext, Article, WarRoomContextValue } from '../context/WarRoomContext';

export type { Article, WarRoomContextValue };

export function useWarRoom(): WarRoomContextValue {
  const context = useContext(WarRoomContext);
  if (!context) {
    throw new Error('useWarRoom must be used within a WarRoomProvider');
  }
  return context;
}
