"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-accent/35 bg-nav text-white shadow-[0_12px_28px_rgba(17,17,17,0.18)] hover:border-accent hover:bg-black",
  secondary: "bg-white text-ink shadow-insetline hover:bg-accent-soft/70",
  ghost: "bg-transparent text-muted hover:bg-white/70 hover:text-ink",
  danger: "bg-danger text-white hover:bg-[#991B1B]"
};

export function Button({
  className,
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
