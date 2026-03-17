'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Persona = 'farmers' | 'planners' | 'researchers';

type PersonaContextValue = {
  persona: Persona | null;
  setPersona: (p: Persona | null) => void;
};

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);

const STORAGE_KEY = 'hydroai_persona';

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'farmers' || raw === 'planners' || raw === 'researchers') {
        setPersonaState(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  const setPersona = (p: Persona | null) => {
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
  };

  const value = useMemo(() => ({ persona, setPersona }), [persona]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return ctx;
}
