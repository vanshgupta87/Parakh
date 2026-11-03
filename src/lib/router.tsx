import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

interface RouterContextType {
  path: string;
  search: string;
  navigate: (to: string, replace?: boolean) => void;
  query: Record<string, string>;
}

const RouterContext = createContext<RouterContextType | null>(null);

function parseQuery(search: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!search) return params;
  const cleaned = search.startsWith('?') ? search.slice(1) : search;
  const pairs = cleaned.split('&');
  for (const pair of pairs) {
    if (!pair) continue;
    const [key, val] = pair.split('=');
    params[decodeURIComponent(key)] = decodeURIComponent(val || '');
  }
  return params;
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [currentSearch, setCurrentSearch] = useState(() => window.location.search || '');

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
      setCurrentSearch(window.location.search || '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, replace = false) => {
    const [pathPart, searchPart] = to.split('?');
    const newPath = pathPart || '/';
    const newSearch = searchPart ? `?${searchPart}` : '';

    if (replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }

    setCurrentPath(newPath);
    setCurrentSearch(newSearch);
    window.scrollTo(0, 0);
  };

  const query = useMemo(() => parseQuery(currentSearch), [currentSearch]);

  return (
    <RouterContext.Provider value={{ path: currentPath, search: currentSearch, navigate, query }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}

export function Link({
  to,
  children,
  className,
  style,
  onClick
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style}>
      {children}
    </a>
  );
}
