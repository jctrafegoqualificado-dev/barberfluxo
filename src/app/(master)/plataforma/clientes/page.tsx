"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import BarbeariasLista, { type ShopRow } from "@/components/plataforma/BarbeariasLista";

/** Barbearias da plataforma: a lista completa (a mesma do Painel), com filtros. */
export default function PlataformaBarbearias() {
  const { token } = useAuthStore();
  const [shops, setShops] = useState<ShopRow[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/plataforma/painel", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      setShops((await r.json()).shops ?? []);
    } catch {
      setError(true);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Barbearias</h1>
        <span className="text-sm text-ink-3">{shops ? `${shops.length} cadastradas` : "Carregando…"} · clique numa barbearia para ver assinatura, pagamentos e uso</span>
      </header>
      {error && <p role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">Não foi possível carregar as barbearias. <button type="button" className="font-semibold underline" onClick={() => { setError(false); load(); }}>Tentar de novo</button></p>}
      {!shops && !error && <div className="h-96 rounded-2xl bg-surface border border-line animate-pulse" />}
      {shops && <BarbeariasLista shops={shops} />}
    </div>
  );
}
