import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
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
  title: "RenewalGuard",
  description: "Never miss a renewal or cancellation deadline.",
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
            <div className="brand">RenewalGuard</div>
            <AppNav hasSession={Boolean(session)} authRequired={authRequired} />
          </aside>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
