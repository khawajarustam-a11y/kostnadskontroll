import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <Link href="/">DueKeeper</Link>
      <nav aria-label="Legal and contact">
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
        <Link href="/contact">Contact</Link>
      </nav>
    </footer>
  );
}
