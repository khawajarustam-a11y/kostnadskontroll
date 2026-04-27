import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { getSession, isAuthRequired } from "@/lib/auth";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Kostnadskontroll",
  description: "Kontroll over kostnader og kontrakter",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const authRequired = isAuthRequired();

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <div className="app-shell">
          <aside className="app-nav">
            <div className="brand">Kostnadskontroll</div>
            <nav className="nav-links">
              {!session ? (
                <Link className="nav-action" href="/login" prefetch={false}>
                  Logg inn
                </Link>
              ) : (
                <>
                  <Link className="nav-link" href="/dashboard">
                    Dashboard
                  </Link>
                  <Link className="nav-link" href="/costs">
                    Costs
                  </Link>
                  <Link className="nav-link" href="/contracts">
                    Contracts
                  </Link>
                  <Link className="nav-link" href="/ledger">
                    Regnskap
                  </Link>
                  <Link className="nav-link" href="/settings">
                    Settings
                  </Link>
                  {authRequired ? (
                    <Link className="nav-action" href="/api/logout" prefetch={false}>
                      Logg ut
                    </Link>
                  ) : (
                    <Link className="nav-action" href="/api/clear-company" prefetch={false}>
                      Bytt bedrift
                    </Link>
                  )}
                </>
              )}
            </nav>
          </aside>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}

