import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import { PersonaProvider } from "./context/PersonaContext";

export const metadata: Metadata = {
  title: "Hydronyx - Physics-Informed Groundwater Monitoring",
  description: "Leveraging Physics-Informed AI for Sustainable Groundwater Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <AuthProvider>
          <PersonaProvider>{children}</PersonaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
