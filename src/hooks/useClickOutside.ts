import { useEffect, RefObject } from 'react';

// Every click-toggled dropdown/popover in this app (notification bell, role
// menu, TLD/source filter dropdowns, export menu...) used to only close via
// its own toggle button being clicked again — clicking anywhere else on the
// page left it open, forcing the user to hunt down the exact button a
// second time. This is the shared fix: attach `ref` to the dropdown's
// outermost wrapper (the element containing BOTH the toggle button and the
// panel itself, so a click on the toggle button doesn't immediately
// re-trigger this and close-then-reopen in the same tick — see each call
// site), and it closes on any click outside that wrapper.
//
// Listens on 'mousedown' rather than 'click' so it fires before a
// simultaneous onClick handler elsewhere on the page (e.g. clicking a
// different dropdown's own toggle button) — using 'click' would race
// against React's own click handlers in an order that isn't guaranteed.
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideClick();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [ref, onOutsideClick, enabled]);
}
