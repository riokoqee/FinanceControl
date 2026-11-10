import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";

export default function Modal({
  children,
  onClose,
  className = "",
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label?: string;
}) {
  const { tr } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusContent = () => {
      if (!ref.current) return;
      if (
        document.activeElement !== ref.current &&
        ref.current.contains(document.activeElement)
      ) {
        observer.disconnect();
        return;
      }
      const target =
        ref.current.querySelector<HTMLElement>("input:not([disabled])") ??
        ref.current.querySelector<HTMLElement>("button:not([disabled])");
      if (target) {
        target.focus();
        observer.disconnect();
      }
    };
    // Optional dialog content may arrive after its loading fallback.
    const observer = new MutationObserver(focusContent);
    if (ref.current)
      observer.observe(ref.current, { childList: true, subtree: true });
    ref.current?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(focusContent);
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) ?? [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (!items.length) {
          event.preventDefault();
          ref.current?.focus();
        } else if (
          document.activeElement === ref.current ||
          !ref.current?.contains(document.activeElement)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handle);
      before?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={label ?? tr("ui.manageExpenses")}
        ref={ref}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
