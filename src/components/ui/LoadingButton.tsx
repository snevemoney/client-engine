"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonProps } from "@/components/ui/button";

export type LoadingButtonProps = ButtonProps & {
  pending?: boolean;
  pendingText?: string;
  preventDoubleClick?: boolean;
};

/**
 * Phase 2.6: Button with pending state and double-click protection.
 */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      pending = false,
      pendingText,
      preventDoubleClick = true,
      disabled,
      children,
      className,
      variant,
      size,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled ?? (preventDoubleClick && pending);
    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-busy={pending}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {pendingText ?? children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
LoadingButton.displayName = "LoadingButton";
