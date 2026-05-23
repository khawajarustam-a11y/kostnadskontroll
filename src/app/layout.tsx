import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getActiveSession, isAuthRequired } from "@/lib/auth";
import { isFeedbackAdmin } from "@/lib/admin";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://duekeeper.com"),
  title: {
    default: "DueKeeper",
    template: "%s | DueKeeper",
  },
  description:
    "DueKeeper helps freelancers and small teams track subscription renewals, contract deadlines, cancellation dates, and reminders.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "DueKeeper",
    description:
      "Never miss subscription and contract renewals again. Track deadlines, cancellation dates, and reminders in one place.",
    url: "/",
    siteName: "DueKeeper",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DueKeeper",
    description:
      "Track subscription renewals, contract deadlines, cancellation dates, and reminders in one place.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getActiveSession();
  const authRequired = isAuthRequired();
  const canViewFeedback = await isFeedbackAdmin(session);

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <AppShell hasSession={Boolean(session)} authRequired={authRequired} canViewFeedback={canViewFeedback}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
