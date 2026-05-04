import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <label className="block space-y-2" htmlFor={inputId}>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-12 w-full rounded-md border border-line bg-white px-3 text-sm text-ink shadow-insetline transition placeholder:text-muted/70 focus:focus-ring",
            error && "border-danger/60 ring-2 ring-danger/10",
            className
          )}
          {...props}
        />
        {error ? <span className="block text-xs font-medium text-danger">{error}</span> : null}
      </label>
    );
  }
);

Input.displayName = "Input";
