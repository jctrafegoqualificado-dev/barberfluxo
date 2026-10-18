import { cn } from "@/lib/utils";
import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

/*
 * Tabela do redesign (Clientes, Profissionais, Comissões…): cabeçalho em caixa-alta
 * pequena, linhas separadas por #EFEBE3, números alinhados à direita (use `numeric`).
 * Envolva em <TableWrap> para rolar na horizontal no celular sem estourar a página.
 */
export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-line", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line-2", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-surface-3/60 transition-colors", className)} {...props} />;
}

export function TH({ className, numeric, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-4 whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        className
      )}
      {...props}
    />
  );
}

export function TD({ className, numeric, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("px-3 py-3 text-ink align-middle", numeric && "text-right", className)} {...props} />;
}
