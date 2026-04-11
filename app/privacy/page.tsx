import Link from 'next/link';
import { Droplet } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#060b16] text-white px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-10">
          <Droplet className="w-7 h-7 text-cyan-400 fill-cyan-400/20" />
          <span className="text-xl font-bold text-cyan-400">Hydronyx</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: April 2026</p>

        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>We collect the following information when you use Hydronyx:</p>
            <ul className="list-disc list-inside mt-3 space-y-1 text-gray-400">
              <li>Account information: email address and display name</li>
              <li>Usage data: forecast parameters, simulation inputs, and query history</li>
              <li>Authentication tokens stored as httpOnly cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. How We Use Your Data</h2>
            <p>Your data is used to:</p>
            <ul className="list-disc list-inside mt-3 space-y-1 text-gray-400">
              <li>Provide and improve the Service</li>
              <li>Store your forecast and simulation history for later retrieval</li>
              <li>Send verification and password reset emails</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data Storage</h2>
            <p>
              Your account data and usage history are stored in a MongoDB Atlas database hosted on
              secure cloud infrastructure. Passwords are hashed using Argon2 and never stored in plain text.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Cookies</h2>
            <p>
              Hydronyx uses httpOnly cookies to store authentication tokens. These cookies cannot be
              accessed by JavaScript and are used solely for session management.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>
              We use Render (backend hosting) and Vercel (frontend hosting). Your data may transit
              through these services but is not shared with third parties for advertising or analytics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights</h2>
            <p>
              You may request deletion of your account and associated data by contacting us.
              You may also update your profile name at any time from the Settings page.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-cyan-500/20 flex gap-6 text-sm text-gray-400">
          <Link href="/terms" className="hover:text-cyan-400 transition">Terms of Service</Link>
          <Link href="/login" className="hover:text-cyan-400 transition">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
