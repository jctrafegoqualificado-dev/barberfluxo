"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// Visual do redesign: altura 44px (toque), borda #E2DCD1, raio 10px.
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helpId = error || hint ? `${inputId}-help` : undefined;
    return (
      <div className="w-full">
        {label && <label htmlFor={inputId} className="block text-[13px] font-semibold text-ink-2 mb-1.5">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={helpId}
          className={cn(
            "w-full h-11 rounded-[10px] border border-control bg-surface px-3.5 text-sm text-ink placeholder:text-ink-4",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
            "disabled:bg-surface-3 disabled:cursor-not-allowed",
            error && "border-danger-strong focus:border-danger-strong focus:ring-danger-strong/20",
            className
          )}
          {...props}
        />
        {(error || hint) && (
          <p id={helpId} className={cn("mt-1.5 text-xs", error ? "text-danger" : "text-ink-3")}>{error || hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
export default Input;
