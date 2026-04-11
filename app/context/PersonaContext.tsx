'use client';

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { apiPatch } from '@/lib/api';

export type Persona = 'farmers' | 'planners' | 'researchers';

type PersonaContextValue = {
  persona: Persona | null;
  setPersona: (p: Persona | null) => void;
  ready: boolean;
};

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);

const STORAGE_KEY = 'hydroai_persona';

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'farmers' || raw === 'planners' || raw === 'researchers') {
        setPersonaState(raw);
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setPersona = useCallback((p: Persona | null) => {
    setPersonaState(p);
    try {
      if (!p) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, p);
      }
    } catch {
      // ignore
    }
    // Sync to backend (fire-and-forget — local state is authoritative)
    if (p) {
      apiPatch('/api/auth/me', { persona: p }).catch(() => {});
    }
  }, []);

  const value = useMemo(() => ({ persona, setPersona, ready }), [persona, setPersona, ready]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return ctx;
}
