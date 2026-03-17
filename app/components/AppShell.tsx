'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Home,
  LogOut,
  MapPin,
  Menu,
  Settings2,
  Sprout,
  TrendingUp,
  UserCircle2,
  X,
} from 'lucide-react';
import Footer from '@/app/components/Footer';
import { useAuth } from '@/app/context/AuthContext';
import { usePersona, type Persona } from '@/app/context/PersonaContext';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function personaLabel(p: Persona | null) {
  if (p === 'farmers') return 'Farmers';
  if (p === 'planners') return 'Planners';
  if (p === 'researchers') return 'Researchers';
  return 'Choose role';
}

function navForPersona(p: Persona | null): NavItem[] {
  if (p === 'farmers') {
    return [
      { href: '/my-farm', label: 'My Farm', icon: <Sprout size={20} /> },
      { href: '/location-gw', label: 'Location Insight', icon: <MapPin size={20} /> },
      { href: '/alerts', label: 'Alerts', icon: <AlertCircle size={20} /> },
      { href: '/forecast', label: 'Forecast', icon: <BarChart3 size={20} /> },
    ];
  }
  if (p === 'researchers') {
    return [
      { href: '/validation', label: 'Validation', icon: <CheckCircle size={20} /> },
      { href: '/drivers', label: 'Drivers', icon: <BarChart3 size={20} /> },
      { href: '/forecast', label: 'Forecast', icon: <BarChart3 size={20} /> },
      { href: '/location-gw', label: 'Location Insight', icon: <MapPin size={20} /> },
    ];
  }
  if (p === 'planners') {
    return [
      { href: '/dashboard', label: 'Dashboard', icon: <Home size={20} /> },
      { href: '/forecast', label: 'Forecast', icon: <BarChart3 size={20} /> },
      { href: '/policy', label: 'Policy', icon: <Settings2 size={20} /> },
      { href: '/optimizer', label: 'Optimizer', icon: <TrendingUp size={20} /> },
      { href: '/validation', label: 'Validation', icon: <CheckCircle size={20} /> },
      { href: '/alerts', label: 'Alerts', icon: <AlertCircle size={20} /> },
      { href: '/drivers', label: 'Drivers', icon: <BarChart3 size={20} /> },
    ];
  }
  return [{ href: '/personas', label: 'Choose role', icon: <UserCircle2 size={20} /> }];
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { persona, setPersona } = usePersona();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = useMemo(() => navForPersona(persona), [persona]);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handlePersonaClick = () => {
    setPersona(null);
    router.push('/personas');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#0d1b3d] to-[#0a1428] flex">
      <div
        className={`fixed left-0 top-0 h-full bg-[#0f1b35]/95 backdrop-blur-md border-r border-cyan-500/20 transition-all duration-300 z-40 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="flex items-center justify-between h-20 px-4 border-b border-cyan-500/20">
          {sidebarOpen && <span className="text-xl font-bold text-cyan-400">HydroAI</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-cyan-400 hover:bg-cyan-500/20 p-2 rounded-lg transition"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <div className="px-4 pt-5">
          <button
            type="button"
            onClick={handlePersonaClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition border border-cyan-500/20 hover:border-cyan-400/40 hover:bg-slate-800/40 ${
              pathname === '/personas' ? 'bg-cyan-500/15 text-cyan-300' : 'text-gray-300'
            }`}
          >
            <UserCircle2 size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="text-xs text-gray-400">Workspace</div>
                <div className="text-sm font-semibold">{personaLabel(persona)}</div>
              </div>
            )}
          </button>
        </div>

        <nav className="mt-5 space-y-2 px-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'text-gray-400 hover:bg-slate-800/50'
                }`}
              >
                {item.icon}
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        className={`flex-1 flex flex-col min-h-screen ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}
      >
        <div className="sticky top-0 z-30 bg-[#0a1428]/95 backdrop-blur-md border-b border-cyan-500/20 px-8 py-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">{title}</h1>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-400">{user?.email || ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition border border-red-500/50"
            >
              <LogOut size={18} />
              <span className="text-sm">Log Out</span>
            </button>
          </div>
        </div>

        {children}

        <Footer />
      </div>
    </div>
  );
}
