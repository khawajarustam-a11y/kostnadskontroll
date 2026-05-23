"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type AppNavProps = {
  hasSession: boolean;
  authRequired: boolean;
  canViewFeedback: boolean;
};

type NavItem = {
  href: string;
  label: string;
  marker: string;
};

const mainItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", marker: "D" },
  { href: "/action-required", label: "Action Required", marker: "!" },
  { href: "/costs", label: "Costs", marker: "$" },
  { href: "/contracts", label: "Contracts", marker: "C" },
  { href: "/ledger", label: "Accounting", marker: "A" },
];

const toolItems: NavItem[] = [
  { href: "/import", label: "Import", marker: "+" },
  { href: "/settings", label: "Settings", marker: "S" },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const router = useRouter();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const prefetch = () => router.prefetch(item.href);

  return (
    <Link
      className={active ? "nav-link nav-link-active" : "nav-link"}
      href={item.href}
      prefetch
      onFocus={prefetch}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
    >
      <span className="nav-marker" aria-hidden="true">{item.marker}</span>
      <span>{item.label}</span>
    </Link>
  );
}

export function AppNav({ hasSession, authRequired, canViewFeedback }: AppNavProps) {
  const pathname = usePathname();
  const visibleToolItems = canViewFeedback
    ? [...toolItems.slice(0, 1), { href: "/feedback-inbox", label: "Feedback", marker: "F" }, ...toolItems.slice(1)]
    : toolItems;

  if (!hasSession) {
    return (
      <nav className="nav-links">
        <Link className="nav-action" href="/login" prefetch={false}>
          Log in
        </Link>
      </nav>
    );
  }

  return (
    <nav className="nav-links" aria-label="Main navigation">
      <div className="nav-section">
        <div className="nav-section-label">Protect</div>
        {mainItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </div>
      <div className="nav-section">
        <div className="nav-section-label">Tools</div>
        {visibleToolItems.map((item) => <NavLink key={item.href} item={item} pathname={pathname} />)}
      </div>
      {authRequired ? (
        <Link className="nav-action" href="/api/logout" prefetch={false}>
          Log out
        </Link>
      ) : (
        <Link className="nav-action" href="/api/clear-company" prefetch={false}>
          Switch company
        </Link>
      )}
    </nav>
  );
}
