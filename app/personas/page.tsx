'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, Landmark, FlaskConical, ArrowRight, Droplet } from 'lucide-react';
import Footer from '@/app/components/Footer';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { usePersona, type Persona } from '@/app/context/PersonaContext';

function PersonasContent() {
  const router = useRouter();
  const { setPersona } = usePersona();

  const pick = (p: Persona) => {
    setPersona(p);
    if (p === 'farmers') router.push('/location-gw');
    if (p === 'planners') router.push('/dashboard');
    if (p === 'researchers') router.push('/validation');
  };

  return (
    <div className="min-h-screen bg-[#060b16] text-white selection:bg-cyan-500/30 flex flex-col">
      <nav className="sticky top-0 z-40 bg-[#0a1428]/80 backdrop-blur-md border-b border-cyan-500/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
            <Droplet className="w-8 h-8 text-cyan-400 fill-cyan-400/20" />
            <span className="text-xl font-bold tracking-wide">HydroAI</span>
          </Link>
          <div className="text-sm text-gray-300">Choose your workspace</div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#0a1428] to-[#060b16]" />
          <div className="relative max-w-7xl mx-auto px-6 py-14">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Start with your role
              </h1>
              <p className="mt-4 text-cyan-100/70 leading-relaxed">
                HydroAI organizes tools by what you need to do. Pick a workspace to get the most relevant insights and actions.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <button
                type="button"
                onClick={() => pick('farmers')}
                className="text-left glass-panel p-8 rounded-2xl hover:bg-cyan-900/20 transition-colors group border border-cyan-500/20"
              >
                <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="text-teal-300" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">For Farmers</h3>
                <p className="text-sm text-cyan-100/60 leading-relaxed">
                  Check groundwater at your farm location, see nearby wells used, and get simple risk & trend summaries.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-cyan-300 font-semibold">
                  Continue <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => pick('planners')}
                className="text-left glass-panel p-8 rounded-2xl hover:bg-cyan-900/20 transition-colors group border border-cyan-500/20"
              >
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Landmark className="text-cyan-300" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">For Planners</h3>
                <p className="text-sm text-cyan-100/60 leading-relaxed">
                  District/state dashboards, intervention simulation, and recharge siting to plan programs.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-cyan-300 font-semibold">
                  Continue <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => pick('researchers')}
                className="text-left glass-panel p-8 rounded-2xl hover:bg-cyan-900/20 transition-colors group border border-cyan-500/20"
              >
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FlaskConical className="text-blue-300" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">For Researchers</h3>
                <p className="text-sm text-cyan-100/60 leading-relaxed">
                  Validation, drivers, and model performance views for transparency and experimentation.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 text-cyan-300 font-semibold">
                  Continue <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function Personas() {
  return (
    <ProtectedRoute>
      <PersonasContent />
    </ProtectedRoute>
  );
}