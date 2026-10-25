import { wikiPages } from '@mortein/wiki-content/pages';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, BookOpen, Search, Workflow } from 'lucide-react';
import MiniSearch from 'minisearch';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function WikiPage() {
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState<string>(wikiPages[0].slug);
  const search = useMemo(() => {
    const index = new MiniSearch({
      fields: ['title', 'category', 'markdown'],
      storeFields: ['slug'],
    });
    index.addAll(wikiPages.map((page, id) => ({ id, ...page })));
    return index;
  }, []);
  const results = query.trim()
    ? new Set(search.search(query).map((result) => String(result.slug)))
    : new Set(wikiPages.map((page) => page.slug));
  const current = wikiPages.find((page) => page.slug === activeSlug) ?? wikiPages[0];

  return (
    <div className="wiki-shell">
      <header className="wiki-topbar">
        <Link to="/app" className="back-link">
          <ArrowLeft size={15} /> Back to editor
        </Link>
        <Link to="/" className="brand-lockup">
          <span className="brand-mark">
            <Workflow size={15} />
          </span>
          <span>Mortein</span>
        </Link>
        <span className="wiki-topbar-label">Help center</span>
      </header>
      <div className="wiki-layout">
        <aside className="wiki-sidebar">
          <div className="wiki-title">
            <BookOpen size={18} />
            <div>
              <strong>Workflow wiki</strong>
              <small>Guides and reference</small>
            </div>
          </div>
          <label className="wiki-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the wiki"
            />
            <kbd>⌘ K</kbd>
          </label>
          <nav aria-label="Wiki pages">
            {wikiPages.map((page) => (
              <button
                type="button"
                className={`wiki-nav-item ${activeSlug === page.slug ? 'is-current' : ''}`}
                key={page.slug}
                onClick={() => setActiveSlug(page.slug)}
                hidden={!results.has(page.slug)}
              >
                <span>{page.category}</span>
                {page.title}
              </button>
            ))}
            {results.size === 0 && <p className="wiki-no-results">No pages match “{query}”.</p>}
          </nav>
          <div className="wiki-sidebar-bottom">
            <span>Need a place to start?</span>
            <Link to="/app">
              Build a workflow <span>↗</span>
            </Link>
          </div>
        </aside>
        <main className="wiki-article-wrap">
          <div className="wiki-breadcrumb">
            Wiki <span>/</span> {current.category}
          </div>
          <article className="wiki-article" key={current.slug}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.markdown}</ReactMarkdown>
          </article>
          <footer className="wiki-article-footer">
            <span>Was this page useful?</span>
            <span>Wiki pages ship with the app.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
