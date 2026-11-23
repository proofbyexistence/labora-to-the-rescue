/**
 * Hook managing pause/play state for the daydream footer strip across user toggle, reduced-motion, visibility, and viewport intersection.
 */
import { useEffect, useState, type RefObject } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Tracks effective animation pause state and provides a user play/pause toggle handler.
 *
 * @param stripRef - Ref attached to the daydream container element for intersection observation.
 * @returns Effective `isPaused`, `userPaused` preference, and `toggleUserPaused` handler.
 */
export function useDaydreamPause(stripRef: RefObject<HTMLDivElement | null>) {
  const [userPaused, setUserPaused] = useState<boolean>(prefersReducedMotion);
  const [tabHidden, setTabHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [inView, setInView] = useState<boolean>(true);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisChange = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisChange);
    return () => document.removeEventListener('visibilitychange', onVisChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => { if (event.matches) setUserPaused(true); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = stripRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]) setInView(entries[0].isIntersecting); },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [stripRef]);

  return {
    isPaused: userPaused || tabHidden || !inView,
    userPaused,
    toggleUserPaused: () => setUserPaused((prev) => !prev),
  };
}
