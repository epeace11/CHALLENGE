'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

/** Runs in <head> before first paint, so the page never flashes the wrong theme. A saved choice wins; otherwise it follows the system and keeps following it. */
export const themeScript = `(function(){var p;try{p=localStorage.getItem('theme')}catch(e){}var m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=p==='light'||p==='dark'?p:(m.matches?'dark':'light');document.documentElement.dataset.theme=t;var c=document.querySelector('meta[name=theme-color]');if(c)c.setAttribute('content',t==='dark'?'#0d0b14':'#f6f8fb')}a();m.addEventListener('change',function(){try{p=localStorage.getItem('theme')}catch(e){}if(p!=='light'&&p!=='dark')a()})})()`;

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name=theme-color]')
    ?.setAttribute('content', t === 'dark' ? '#0d0b14' : '#f6f8fb');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const read = () =>
      setTheme(
        document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
      );
    read();
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => watch.disconnect();
  }, []);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        apply(next);
        try {
          localStorage.setItem('theme', next);
        } catch {}
      }}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
