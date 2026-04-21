import Link from 'next/link';
import pagesData from '@/data/pages.json';

const FEATURE_SLUGS = [
  'what-we-believe',
  'photo-gallery',
  'home/movies',
  'movies',
  'who-we-are',
  'shevchenko2011',
  'contact-us',
];

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  'what-we-believe': 'Ukraine Tour 2011 — our return journey to the homeland',
  'photo-gallery': 'Concert photography and candid moments',
  'home/movies': 'Video recordings of performances',
  'movies': 'Video recordings of performances',
  'who-we-are': 'Meet the choir members and conductors',
  'shevchenko2011': 'Shevchenko Festival 2011 concert',
  'contact-us': 'Get in touch with the choir',
};

export default function HomePage() {
  const pages = pagesData.pages as Array<{ slug: string; title: string; html: string }>;

  const homePage = pages.find(p => p.slug === 'home');
  const features = FEATURE_SLUGS
    .map(slug => pages.find(p => p.slug === slug))
    .filter(Boolean) as Array<{ slug: string; title: string; html: string }>;

  if (features.length < 4) {
    const existing = new Set(features.map(f => f.slug));
    const topLevel = pages.filter(p => !p.slug.includes('/') && p.slug !== 'home' && !existing.has(p.slug));
    features.push(...topLevel.slice(0, 6 - features.length));
  }

  return (
    <>
      <section className="border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-[var(--color-accent)] mb-4">
            Melbourne · Est. 1975
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Cheremosh
          </h1>
          <p className="text-2xl sm:text-3xl text-[var(--color-muted)] mt-2 font-light" style={{ fontFamily: 'var(--font-serif)' }}>
            Хор Черемош · Melbourne
          </p>
          <p className="mt-6 text-lg text-[var(--color-muted)] max-w-xl leading-relaxed">
            An archive of the Cheremosh Ukrainian Choir of Melbourne — concerts, the 2011 tour of Ukraine, choir history, and community.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/who-we-are"
              className="inline-flex items-center px-5 py-2.5 bg-[var(--color-accent)] text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
            >
              About the choir
            </Link>
            <Link
              href="/photo-gallery"
              className="inline-flex items-center px-5 py-2.5 border border-[var(--color-border)] text-[var(--color-ink)] text-sm font-medium rounded hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
            >
              Photo gallery
            </Link>
          </div>
        </div>
      </section>

      {features.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-muted)] mb-8">
            Explore the archive
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(page => (
              <Link
                key={page.slug}
                href={`/${page.slug}`}
                className="group block p-5 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:shadow-sm transition-all"
              >
                <h3 className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                  {page.title}
                </h3>
                {FEATURE_DESCRIPTIONS[page.slug] && (
                  <p className="mt-1.5 text-sm text-[var(--color-muted)] leading-snug">
                    {FEATURE_DESCRIPTIONS[page.slug]}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center text-xs text-[var(--color-accent)] font-medium gap-1">
                  View
                  <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {homePage?.html && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <div className="border-t border-[var(--color-border)] pt-12">
            <div
              className="prose-scraped"
              dangerouslySetInnerHTML={{ __html: homePage.html }}
            />
          </div>
        </section>
      )}
    </>
  );
}
