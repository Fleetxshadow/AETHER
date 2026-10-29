'use client';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { flushSync } from 'react-dom';
import { Check, Palette, X } from 'lucide-react';
import { useDialogFocus } from '@/lib/hooks';
import { spring, transition, useReducedMotion } from '@/lib/motion';
import { defaultTheme, themeIds, themes, type ThemeId } from '@/lib/themes';
const ThemeContext = createContext({ theme: defaultTheme, open: false, show: () => {} });
export function useTheme() {
  return useContext(ThemeContext);
}
export function ThemeButton() {
  const { theme, open, show } = useTheme();
  return (
    <button
      className="icon-button theme-launch"
      aria-label="Open theme configurator"
      aria-expanded={open}
      title={`Theme: ${themes[theme].name}`}
      onClick={show}
    >
      <Palette size={18} />
    </button>
  );
}
export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ThemeId;
}) {
  const [theme, setTheme] = useState(initialTheme);
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const activeTransition = useRef<ViewTransition | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(open, root, close);
  const apply = (id: ThemeId) => {
    const update = () => {
      document.documentElement.dataset.theme = id;
      document.cookie = `nexus-theme=${id}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      setTheme(id);
    };
    if (reduced || !document.startViewTransition) {
      update();
      return;
    }
    activeTransition.current?.skipTransition();
    activeTransition.current = document.startViewTransition(() => flushSync(update));
    void activeTransition.current.ready.catch(() => {});
    void activeTransition.current.updateCallbackDone.catch(() => {});
    void activeTransition.current.finished.catch(() => {});
  };
  return (
    <ThemeContext.Provider value={{ theme, open, show: () => setOpen(true) }}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="theme-backdrop"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : transition}
            onClick={close}
          >
            <motion.div
              ref={root}
              role="dialog"
              aria-modal="true"
              aria-labelledby="theme-title"
              className="theme-configurator"
              initial={reduced ? false : { y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={reduced ? undefined : { y: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header>
                <div>
                  <p className="eyebrow">ATH / VISUAL CONFIGURATOR</p>
                  <h2 id="theme-title">Choose your atmosphere.</h2>
                  <p>Five atmospheres. One connected city. Your saved preference stays yours.</p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close theme configurator"
                  onClick={close}
                >
                  <X size={20} />
                </button>
              </header>
              <div className="theme-preview-grid">
                {themeIds.map((id, index) => {
                  const config = themes[id];
                  return (
                    <motion.button
                      key={id}
                      className={`theme-preview ${theme === id ? 'selected' : ''}`}
                      aria-pressed={theme === id}
                      onClick={() => apply(id)}
                      style={
                        {
                          '--preview-bg': config.background,
                          '--preview-surface': config.surface,
                          '--preview-ink': config.text,
                          '--preview-accent': config.primary,
                          '--preview-border': config.border,
                        } as CSSProperties
                      }
                      whileTap={reduced ? undefined : { scale: 0.98 }}
                    >
                      <div className="theme-mini" aria-hidden="true">
                        <div className="mini-nav">
                          <i />
                          <i />
                          <i />
                        </div>
                        <div className="mini-scene">
                          <span>AETHER</span>
                          <svg viewBox="0 0 200 80">
                            <path d="M0 70L40 55L65 62L105 20L140 35L200 3" />
                            <path d="M0 79H200" />
                          </svg>
                          <i />
                        </div>
                        <div className="mini-cards">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                      <div className="theme-preview-name">
                        <span className="mono">0{index + 1}</span>
                        <strong>{config.name}</strong>
                        {theme === id && <Check size={18} />}
                      </div>
                      <p>{config.subtitle}</p>
                      <div className="theme-swatches">
                        {config.swatches.map((color) => (
                          <span key={color} title={color} style={{ background: color }}>
                            <span className="sr-only">{color}</span>
                          </span>
                        ))}
                      </div>
                      {theme === id && (
                        <motion.i
                          className="theme-selected"
                          layoutId="theme-selection"
                          transition={reduced ? { duration: 0 } : spring}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
              <footer>
                <span>
                  Applied across navigation, instruments, maps, and scenes. Saved on this browser.
                </span>
                <button className="button primary" onClick={close}>
                  Return to the city
                </button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeContext.Provider>
  );
}
