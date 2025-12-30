import { useCallback, useLayoutEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

type PipPosition = {
  x: number;
  y: number;
};

export function usePipDrag(
  containerRef: RefObject<HTMLDivElement>,
  pipRef: RefObject<HTMLDivElement>,
  enabled: boolean
) {
  const [pipPosition, setPipPosition] = useState<PipPosition | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !containerRef.current || !pipRef.current || pipPosition) {
      return;
    }
    const { clientWidth, clientHeight } = containerRef.current;
    const pipWidth = pipRef.current.clientWidth;
    const pipHeight = pipRef.current.clientHeight;
    setPipPosition({
      x: Math.max(8, clientWidth - pipWidth - 14),
      y: Math.max(8, clientHeight - pipHeight - 14),
    });
  }, [enabled, pipPosition, containerRef, pipRef]);

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !containerRef.current || !pipRef.current) return;
      pipRef.current.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startY = event.clientY;
      const startPos = pipPosition ?? { x: 0, y: 0 };
      const bounds = containerRef.current.getBoundingClientRect();
      const pipBounds = pipRef.current.getBoundingClientRect();

      const onMove = (e: PointerEvent) => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const nextX = Math.min(
          Math.max(0, startPos.x + deltaX),
          bounds.width - pipBounds.width
        );
        const nextY = Math.min(
          Math.max(0, startPos.y + deltaY),
          bounds.height - pipBounds.height
        );
        setPipPosition({ x: nextX, y: nextY });
      };

      const onUp = () => {
        pipRef.current?.releasePointerCapture(event.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [containerRef, enabled, pipPosition, pipRef]
  );

  return { pipPosition, beginDrag };
}
