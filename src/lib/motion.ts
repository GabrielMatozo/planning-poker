/**
 * Leitura segura de prefers-reduced-motion.
 *
 * jsdom (ambiente de teste) não implementa window.matchMedia, então a leitura
 * nunca pode acontecer no caminho feliz do component. O helper devolve false
 * quando o media query não está disponível — o que é o comportamento seguro:
 * sem restrição, as animações rodem normalmente.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const mm = (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
  if (!mm) return false;
  try {
    return mm("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}