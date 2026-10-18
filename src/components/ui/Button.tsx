"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary: cor da barbearia · secondary: escuro (tinta) · outline: branco com borda
   * ghost: sem fundo · danger: ação destrutiva
   */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

// Visual do redesign: raio 10px, peso 600, alvo de toque ≥ 40px (lg = 48px no celular).
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-1.5 font-semibold rounded-[10px] transition-colors " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ground " +
      "disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-primary hover:bg-primary/90 text-white focus-visible:ring-primary",
      secondary: "bg-ink hover:bg-ink/90 text-white focus-visible:ring-ink",
      outline: "bg-surface border border-control hover:bg-surface-3 text-ink focus-visible:ring-ink-3",
      ghost: "bg-transparent hover:bg-surface-2 text-ink-2 focus-visible:ring-ink-3",
      danger: "bg-danger-strong hover:bg-danger text-white focus-visible:ring-danger-strong",
    };
    const sizes = {
      sm: "h-9 px-3 text-[13px]",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-[15px]",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
