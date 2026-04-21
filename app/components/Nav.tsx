'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface NavNode {
  title: string;
  slug: string;
  children: NavNode[];
}

interface NavProps {
  items: NavNode[];
}

function DropdownItem({ item }: { item: NavNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const href = item.slug === 'home' ? '/' : `/${item.slug}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (item.children.length === 0) {
    return (
      <li>
        <Link
          href={href}
          className="block px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors whitespace-nowrap"
        >
          {item.title}
        </Link>
      </li>
    );
  }

  return (
    <li ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors whitespace-nowrap"
        aria-expanded={open}
      >
        <Link href={href} className="hover:underline" onClick={e => e.stopPropagation()}>
          {item.title}
        </Link>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul
          onMouseLeave={() => setOpen(false)}
          className="absolute top-full left-0 mt-1 bg-white border border-[var(--color-border)] rounded shadow-lg py-1 min-w-[180px] z-50"
        >
          {item.children.map(child => (
            <li key={child.slug}>
              <Link
                href={child.slug === 'home' ? '/' : `/${child.slug}`}
                className="block px-4 py-2 text-sm text-[var(--color-ink)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-colors"
                onClick={() => setOpen(false)}
              >
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Nav({ items }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav aria-label="Main navigation">
      {/* Desktop nav */}
      <ul className="hidden md:flex items-center flex-wrap gap-0">
        {items.map(item => (
          <DropdownItem key={item.slug} item={item} />
        ))}
      </ul>

      {/* Mobile nav */}
      <div className="md:hidden">
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="p-2 text-[var(--color-ink)] hover:text-[var(--color-accent)]"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            }
          </svg>
        </button>
        {mobileOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-[var(--color-border)] shadow-lg z-50 p-4">
            <ul className="space-y-1">
              {items.map(item => (
                <li key={item.slug}>
                  <Link
                    href={item.slug === 'home' ? '/' : `/${item.slug}`}
                    className="block px-3 py-2 text-sm font-medium hover:text-[var(--color-accent)] transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.title}
                  </Link>
                  {item.children.length > 0 && (
                    <ul className="ml-4 mt-1 space-y-1">
                      {item.children.map(child => (
                        <li key={child.slug}>
                          <Link
                            href={child.slug === 'home' ? '/' : `/${child.slug}`}
                            className="block px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors"
                            onClick={() => setMobileOpen(false)}
                          >
                            {child.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
