"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/AppNav";

type AppShellProps = {
  authRequired: boolean;
  children: React.ReactNode;
  hasSession: boolean;
};

const publicPaths = new Set(["/", "/contact", "/feedback", "/login", "/privacy", "/signup", "/terms"]);

export function AppShell({ authRequired, children, hasSession }: AppShellProps) {
  const pathname = usePathname();
  const isPublicPage = publicPaths.has(pathname);

  if (isPublicPage) {
    return <main className="public-main">{children}</main>;
  }

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div className="brand">DueKeeper</div>
        <AppNav hasSession={hasSession} authRequired={authRequired} />
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
