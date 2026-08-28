import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export const IMAGE_DISPLAY_WIDTH_MIN = 120;
export const IMAGE_DISPLAY_WIDTH_MAX = 720;
export const IMAGE_DISPLAY_WIDTH_DEFAULT = 200;

type UseImageCornerResizeOptions = {
  width: number;
  onWidthChange: (width: number) => void;
  min?: number;
  max?: number;
};

/**
 * Drag the bottom-right corner to change display width (keeps pointer capture).
 */
export function useImageCornerResize({
  width,
  onWidthChange,
  min = IMAGE_DISPLAY_WIDTH_MIN,
  max = IMAGE_DISPLAY_WIDTH_MAX,
}: UseImageCornerResizeOptions) {
  const [resizing, setResizing] = useState(false);
  const startRef = useRef({ x: 0, width });

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, startWidth?: number) => {
      event.preventDefault();
      event.stopPropagation();
      startRef.current = {
        x: event.clientX,
        width: startWidth ?? width,
      };
      setResizing(true);

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startRef.current.x;
        const next = Math.round(
          Math.min(max, Math.max(min, startRef.current.width + delta)),
        );
        onWidthChange(next);
      };

      const onUp = (upEvent: PointerEvent) => {
        try {
          target.releasePointerCapture(upEvent.pointerId);
        } catch {
          // already released
        }
        target.removeEventListener('pointermove', onMove);
        target.removeEventListener('pointerup', onUp);
        target.removeEventListener('pointercancel', onUp);
        setResizing(false);
      };

      target.addEventListener('pointermove', onMove);
      target.addEventListener('pointerup', onUp);
      target.addEventListener('pointercancel', onUp);
    },
    [max, min, onWidthChange, width],
  );

  return { resizing, onResizePointerDown };
}
