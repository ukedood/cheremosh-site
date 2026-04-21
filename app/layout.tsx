import type { Metadata } from 'next';
import Link from 'next/link';
import Nav from '@/app/components/Nav';
import './globals.css';
import pagesData from '@/data/pages.json';

export const metadata: Metadata = {
  title: {
    default: 'Cheremosh · Хор Черемош · Melbourne',
    template: '%s · Cheremosh Melbourne',
  },
  description: 'Cheremosh Ukrainian Choir of Melbourne — archive of concerts, the 2011 Ukraine tour, and choir history since 1975.',
  openGraph: {
    siteName: 'Cheremosh Melbourne',
    locale: 'en_AU',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = pagesData.nav as Array<{ title: string; slug: string; children: Array<{ title: string; slug: string; children: [] }> }>;

  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 relative">
            <Link
              href="/"
              className="font-semibold text-sm tracking-wide text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors shrink-0"
            >
              Cheremosh&ensp;<span className="text-[var(--color-muted)] font-normal">·</span>&ensp;Хор Черемош
            </Link>
            <Nav items={nav} />
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>

        <footer className="border-t border-[var(--color-border)] mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-[var(--color-muted)]">
            <p>
              &copy; {new Date().getFullYear()} Cheremosh Ukrainian Choir of Melbourne. Archive site.
            </p>
            <p>
              <a
                href="mailto:ukrainetour2011@gmail.com"
                className="hover:text-[var(--color-accent)] transition-colors underline underline-offset-2"
              >
                ukrainetour2011@gmail.com
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
