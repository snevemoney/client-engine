"use client";

import { useState, useCallback, useRef } from "react";
import type { ConfirmDialogProps } from "@/components/ui/ConfirmDialog";

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

/**
 * Imperative confirm dialog hook.
 * Usage:
 *   const { confirm, dialogProps } = useConfirmDialog();
 *   // in handler: if (!(await confirm({ title: "Delete?", variant: "destructive" }))) return;
 *   // in JSX:   <ConfirmDialog {...dialogProps} />
 */
export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ title: "" });
  const [pending, setPending] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setOpen(true);
    setPending(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
    title: options.title,
    body: options.body,
    confirmLabel: options.confirmLabel,
    cancelLabel: options.cancelLabel,
    variant: options.variant,
    pending,
  };

  return { confirm, dialogProps, setPending };
}
