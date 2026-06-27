// Registry of on-screen positions ("anchors") used by the GSAP flight layer
// to fly card clones between seats, piles, and the hand.
const anchors = new Map<string, HTMLElement>();

export function anchorRef(key: string) {
  return (element: HTMLElement | null) => {
    if (element) {
      anchors.set(key, element);
    } else {
      anchors.delete(key);
    }
  };
}

export function anchorRect(key: string): DOMRect | null {
  const element = anchors.get(key);
  return element && element.isConnected ? element.getBoundingClientRect() : null;
}
