"use client";

import { useEffect, useRef } from "react";

interface AccessibleDialogProps {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: React.ReactNode;
  className: string;
  closeOnBackdrop?: boolean;
  onClose: () => void;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AccessibleDialog({ ariaLabel, ariaLabelledBy, children, className, closeOnBackdrop = false, onClose }: AccessibleDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = backdropRef.current;
    const dialog = dialogRef.current;
    if (!backdrop || !dialog) return;

    const siblings = Array.from(backdrop.parentElement?.children ?? []).filter((element) => element !== backdrop && element instanceof HTMLElement) as HTMLElement[];
    const previousInert = siblings.map((element) => element.hasAttribute("inert"));
    const previousAriaHidden = siblings.map((element) => element.getAttribute("aria-hidden"));
    siblings.forEach((element) => { element.setAttribute("inert", ""); element.setAttribute("aria-hidden", "true"); });
    dialog.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      siblings.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute("inert");
        if (previousAriaHidden[index] === null) element.removeAttribute("aria-hidden"); else element.setAttribute("aria-hidden", previousAriaHidden[index]);
      });
      returnFocusRef.current?.focus();
    };
  }, []);

  return <div ref={backdropRef} className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (closeOnBackdrop && event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={className} role="dialog" aria-modal="true" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} tabIndex={-1}>{children}</div>
  </div>;
}
