import { notFound } from 'next/navigation';
import Link from 'next/link';
import pagesData from '@/data/pages.json';
import type { Metadata } from 'next';

interface NavNode {
  title: string;
  slug: string;
  children: NavNode[];
}

interface PageData {
  url: string;
  slug: string;
  title: string;
  html: string;
}

type Props = {
  params: Promise<{ slug: string[] }>;
};

function findNode(nav: NavNode[], slug: string): NavNode | undefined {
  for (const node of nav) {
    if (node.slug === slug) return node;
    if (node.children.length > 0) {
      const found = findNode(node.children, slug);
      if (found) return found;
    }
  }
  return undefined;
}

export async function generateStaticParams() {
  const pages = pagesData.pages as PageData[];
  return pages
    .filter(p => p.slug !== 'home')
    .map(p => ({ slug: p.slug.split('/') }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: slugParts } = await params;
  const slug = slugParts.join('/');
  const pages = pagesData.pages as PageData[];
  const page = pages.find(p => p.slug === slug);
  if (!page) return {};
  return { title: page.title };
}

export default async function SlugPage({ params }: Props) {
  const { slug: slugParts } = await params;
  const slug = slugParts.join('/');
  const pages = pagesData.pages as PageData[];
  const nav = pagesData.nav as NavNode[];

  const page = pages.find(p => p.slug === slug);
  if (!page) notFound();

  const navNode = findNode(nav, slug);
  const children = navNode?.children ?? [];

  const parentSlug = slug.includes('/')
    ? slug.split('/').slice(0, -1).join('/')
    : null;
  const parent = parentSlug ? pages.find(p => p.slug === parentSlug) : null;

  return (
    <article className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">Home</Link>
        {parent && (
          <>
            <span>/</span>
            <Link href={`/${parent.slug}`} className="hover:text-[var(--color-accent)] transition-colors">
              {parent.title}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[var(--color-ink)]">{page.title}</span>
      </nav>

      <h1
        className="text-3xl sm:text-4xl font-bold text-[var(--color-ink)] mb-8"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {page.title}
      </h1>

      <div
        className="prose-scraped"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />

      {children.length > 0 && (
        <aside className="mt-16 border-t border-[var(--color-border)] pt-8">
          <h2 className="text-xs font-semibold tracking-[0.15em] uppercase text-[var(--color-muted)] mb-4">
            In this section
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {children.map(child => (
              <li key={child.slug}>
                <Link
                  href={`/${child.slug}`}
                  className="group flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:shadow-sm transition-all"
                >
                  <span className="font-medium text-sm text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                    {child.title}
                  </span>
                  <svg className="w-4 h-4 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </article>
  );
}
