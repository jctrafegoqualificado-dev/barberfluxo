"use client";
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>}
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400",
          "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent",
          "disabled:bg-zinc-50 disabled:cursor-not-allowed",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
export default Input;
