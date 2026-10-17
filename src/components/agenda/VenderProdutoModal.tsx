"use client";
import { useEffect, useState } from "react";
import { Minus, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface Product { id: string; name: string; price: number; stock: number; active?: boolean }
const METHODS: [string, string][] = [["PIX", "Pix"], ["CASH", "Dinheiro"], ["DEBIT_CARD", "Débito"], ["CREDIT_CARD", "Crédito"]];

/** Venda de produto fora de um atendimento (o cliente só passou para comprar). Conta para quem vendeu. */
export default function VenderProdutoModal({ onClose, onSold }: { onClose: () => void; onSold?: () => void }) {
  const { token } = useAuthStore();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("PIX");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/barbershop/products", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProducts((d.products || []).filter((p: Product) => p.active !== false)))
      .catch(() => setProducts([]));
  }, [token]);

  const change = (p: Product, delta: number) => setQtys((q) => {
    const next = Math.max(0, (q[p.id] ?? 0) + delta);
    const rest = { ...q };
    if (next === 0) delete rest[p.id]; else rest[p.id] = next;
    return rest;
  });
  const items = Object.entries(qtys).filter(([, q]) => q > 0);
  const total = items.reduce((s, [id, q]) => s + (products?.find((p) => p.id === id)?.price ?? 0) * q, 0);

  async function sell() {
    setSaving(true);
    const results = await Promise.all(items.map(([pid, quantity]) =>
      fetch(`/api/barbershop/products/${pid}/sell`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity, paymentMethod: method }),
      }).then((r) => r.ok)));
    setSaving(false);
    if (results.some((ok) => !ok)) { toast.error("Parte da venda não foi registrada. Confira o estoque."); return; }
    toast.success(`Venda de ${formatCurrency(total)} registrada`);
    onSold?.();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Vender produto" description="Para quando o cliente só passou para comprar" className="max-w-sm">
      <div className="flex flex-col gap-4">
        {!products ? <div className="h-32 rounded-xl bg-surface-3/60 animate-pulse" /> : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-ink-3"><Package className="w-8 h-8" aria-hidden /><p className="text-sm">Nenhum produto cadastrado.</p></div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto">
            {products.map((p) => {
              const q = qtys[p.id] ?? 0;
              return (
                <div key={p.id} className={cn("flex items-center gap-2 p-2.5 rounded-xl border", q > 0 ? "border-ink bg-ground" : "border-line-2")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-ink-3">{formatCurrency(p.price)}{p.stock > 0 ? ` · ${p.stock} no estoque` : ""}</p>
                  </div>
                  <div className="flex items-center rounded-[9px] border border-control">
                    <button type="button" onClick={() => change(p, -1)} disabled={q === 0} aria-label={`Menos ${p.name}`} className="w-9 h-9 flex items-center justify-center disabled:opacity-30"><Minus className="w-4 h-4" aria-hidden /></button>
                    <span className="w-6 text-center text-sm font-semibold">{q}</span>
                    <button type="button" onClick={() => change(p, 1)} aria-label={`Mais ${p.name}`} className="w-9 h-9 flex items-center justify-center"><Plus className="w-4 h-4" aria-hidden /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {items.length > 0 && (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Como pagou?</span>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setMethod(k)} aria-pressed={method === k}
                    className={cn("h-11 rounded-[10px] border text-sm font-semibold", method === k ? "border-ink bg-ink text-white" : "border-control bg-surface")}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-baseline border-t border-line-2 pt-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-display text-2xl font-bold">{formatCurrency(total)}</span>
            </div>
          </>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" disabled={items.length === 0} loading={saving} onClick={sell}>Registrar venda</Button>
        </div>
      </div>
    </Modal>
  );
}
