"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseMoney } from "@/lib/finance";
import { Field, Section, Segmented, SidePanel, Switch, fieldCls, useWide } from "@/components/catalogo/SidePanel";

interface Product {
  id: string; name: string; description: string | null; price: number; costPrice: number; stock: number; barcode: string | null;
  category: string; commissionType: string; commissionValue: number; active: boolean; imageUrl: string | null;
}
interface Sale {
  id: string; quantity: number; unitPrice: number; total: number; createdAt: string;
  product: { id: string; name: string; costPrice: number };
  barber: { nickname: string | null; user: { name: string } } | null;
  client: { name: string } | null;
}
interface Barber { id: string; nickname: string | null; active: boolean; user: { name: string } }

const CATS: [string, string][] = [["CABELO", "Cabelo"], ["BARBA", "Barba"], ["SKINCARE", "Skincare"], ["GERAL", "Geral"]];
const catLabel = (k: string) => CATS.find((c) => c[0] === k)?.[1] ?? "Geral";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const LOW = 3;
const brl = (v: number) => formatCurrency(v).replace(",00", "");
const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const spNow = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
const commissionOf = (p: Product, qty: number) => (p.commissionType === "FIXED" ? p.commissionValue * qty : p.price * qty * (p.commissionValue / 100));
const tracked = (p: Product) => p.stock > 0;

export default function ProdutosPage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tab, setTab] = useState<"estoque" | "vendas">("estoque");
  const [cat, setCat] = useState("all");
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [startMode, setStartMode] = useState<"edit" | "sell">("edit");

  const load = useCallback(async () => {
    const h = { Authorization: `Bearer ${token}` };
    const [p, s] = await Promise.all([
      fetch("/api/barbershop/products?admin=1", { headers: h }).then((r) => r.json()),
      fetch("/api/barbershop/products/sales", { headers: h }).then((r) => (r.ok ? r.json() : { sales: [] })),
    ]);
    setProducts(p.products || []);
    setSales(s.sales || []);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((d) => setBarbers(d.barbers || [])).catch(() => {});
  }, [token]);

  const today = spNow();
  const day = Number(today.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const month = MONTHS[Number(today.slice(5, 7)) - 1];

  const soldBy = useMemo(() => {
    const m: Record<string, { qty: number; value: number }> = {};
    for (const s of sales) { const c = (m[s.product.id] ??= { qty: 0, value: 0 }); c.qty += s.quantity; c.value += s.total; }
    return m;
  }, [sales]);

  const list = products ?? [];
  const k = useMemo(() => {
    const salesTotal = sales.reduce((a, s) => a + s.total, 0);
    const units = sales.reduce((a, s) => a + s.quantity, 0);
    const gross = sales.reduce((a, s) => a + (s.unitPrice - s.product.costPrice) * s.quantity, 0);
    const com = sales.reduce((a, s) => {
      const p = list.find((x) => x.id === s.product.id);
      return a + (p && s.barber ? commissionOf({ ...p, price: s.unitPrice }, s.quantity) : 0);
    }, 0);
    const shelf = list.filter((p) => p.active && tracked(p));
    return {
      salesTotal, units, gross, com,
      shelfUnits: shelf.reduce((a, p) => a + p.stock, 0),
      shelfCost: shelf.reduce((a, p) => a + p.stock * p.costPrice, 0),
      low: list.filter((p) => p.active && p.stock > 0 && p.stock <= LOW),
    };
  }, [sales, list]);

  // Precisa repor: ritmo de vendas do mês até o fim do mês
  const reorder = useMemo(() => list.filter((p) => p.active && tracked(p)).map((p) => {
    const sold = soldBy[p.id]?.qty ?? 0;
    const pace = sold / Math.max(1, day);
    const need = Math.ceil(pace * (daysInMonth - day) - p.stock + (p.stock <= LOW ? LOW : 0));
    return { p, sold, pace, buy: Math.max(0, need) };
  }).filter((x) => x.buy > 0).sort((a, b) => b.buy - a.buy), [list, soldBy, day, daysInMonth]);

  const visible = list.filter((p) => cat === "all" || p.category === cat).sort((a, b) => Number(b.active) - Number(a.active));
  const sel = list.find((p) => p.id === selected);

  useEffect(() => {
    if (wide && products?.length && selected === null) setSelected(products.find((p) => p.active)?.id ?? products[0].id);
  }, [wide, products, selected]);

  function supplierList() {
    const text = [`Pedido de reposição`, ...reorder.map((r) => `- ${r.buy}× ${r.p.name}`)].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const barberName = (b: Sale["barber"]) => (b ? b.nickname || b.user.name.split(" ")[0] : "balcão");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Produtos</h1>
          <span className="text-sm text-ink-3">{products ? `${list.filter((p) => p.active).length} à venda · ${k.units} vendidos em ${month}` : " "}</span>
        </div>
        <button type="button" onClick={() => { setStartMode("edit"); setSelected("new"); }} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
          <Plus className="w-4 h-4" aria-hidden /> Novo produto
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [`Vendas em ${month}`, brl(k.salesTotal), `${k.units} ${k.units === 1 ? "unidade" : "unidades"}`],
          ["Lucro com produtos", brl(k.gross - k.com), k.com > 0 ? `depois de ${brl(k.com)} de comissão` : "venda menos o custo"],
          ["Na prateleira", `${k.shelfUnits} un.`, `${brl(k.shelfCost)} pelo preço de custo`],
          ["Estoque baixo", String(k.low.length), k.low.length ? k.low.map((p) => p.name).join(", ") : `nada com ${LOW} ou menos`],
        ].map(([l, v, sub]) => (
          <div key={l} className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-1 min-w-0">
            <span className="text-[13px] text-ink-3">{l}</span>
            <span className={cn("font-display text-2xl font-bold", l === "Estoque baixo" && k.low.length > 0 && "text-warning")}>{v}</span>
            <span className="text-xs text-ink-3 truncate">{sub}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
              <Segmented value={tab} onChange={setTab} label="Ver" options={[["estoque", "Estoque"], ["vendas", "Vendas do mês"]]} />
              {tab === "estoque" && (
                <div role="group" aria-label="Categoria" className="flex gap-1.5 flex-wrap">
                  {[["all", "Todas"] as [string, string], ...CATS].map(([key, l]) => (
                    <button key={key} type="button" aria-pressed={cat === key} onClick={() => setCat(key)}
                      className={cn("h-8 px-3 rounded-full text-[13px] font-semibold", cat === key ? "bg-ink text-white" : "bg-surface border border-control text-ink-2")}>{l}</button>
                  ))}
                </div>
              )}
            </div>

            {!products ? <div className="h-48 animate-pulse bg-surface-3/50" aria-busy /> : tab === "estoque" ? (
              visible.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nenhum produto aqui.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead>
                      <tr className="text-xs text-ink-3 border-b border-line-2">
                        <th scope="col" className="text-left font-semibold px-4 py-2.5">Produto</th>
                        <th scope="col" className="text-right font-semibold px-3">Estoque</th>
                        <th scope="col" className="text-right font-semibold px-3">Preço</th>
                        <th scope="col" className="text-right font-semibold px-3">Lucro</th>
                        <th scope="col" className="text-right font-semibold px-3">Vendidos</th>
                        <th scope="col" className="px-3 pr-4"><span className="sr-only">Vender</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-3">
                      {visible.map((p) => {
                        const on = selected === p.id;
                        const low = p.active && p.stock > 0 && p.stock <= LOW;
                        const sold = soldBy[p.id];
                        return (
                          <tr key={p.id} onClick={() => { setStartMode("edit"); setSelected(p.id); }} aria-current={on || undefined}
                            className={cn("cursor-pointer", on ? "bg-primary/[0.07]" : "hover:bg-surface-3/50", !p.active && "opacity-60")}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0", on ? "bg-primary text-white" : "bg-ground text-ink-2")}><Package className="w-4 h-4" aria-hidden /></div>
                                <div className="min-w-0">
                                  <p className="font-semibold flex items-center gap-1.5"><span className="truncate">{p.name}</span>
                                    {low && <span className="h-5 px-2 rounded-full text-[11px] font-semibold inline-flex items-center bg-warning-soft text-warning shrink-0">Estoque baixo</span>}
                                  </p>
                                  <p className="text-xs text-ink-3 truncate">{catLabel(p.category)}{p.description ? ` · ${p.description}` : ""}</p>
                                </div>
                              </div>
                            </td>
                            <td className={cn("px-3 text-right", low && "text-warning font-semibold")}>{tracked(p) ? `${p.stock} un.` : <span className="text-ink-4" title="Sem controle de estoque">—</span>}</td>
                            <td className="px-3 text-right">{brl(p.price)}</td>
                            <td className="px-3 text-right"><p>{brl(p.price - p.costPrice)}</p><p className="text-xs text-ink-3">custo {brl(p.costPrice)}</p></td>
                            <td className="px-3 text-right"><p>{sold?.qty ?? 0}</p><p className="text-xs text-ink-3">{sold ? brl(sold.value) : "—"}</p></td>
                            <td className="px-3 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                              {p.active ? (
                                <button type="button" onClick={() => { setStartMode("sell"); setSelected(p.id); }} className="h-8 px-3 rounded-lg border border-control text-xs font-semibold hover:bg-surface-3">Vender</button>
                              ) : <span className="text-xs text-ink-4">inativo</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="px-4 py-2.5 text-xs text-ink-3 border-t border-line-2">Lucro = preço de venda menos o preço de custo, por unidade. Estoque “—” = sem controle de estoque.</p>
                </div>
              )
            ) : sales.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nenhuma venda em {month}.</p> : (
              <ul className="divide-y divide-line-3">
                {sales.map((s) => (
                  <li key={s.id} className="grid grid-cols-[70px_minmax(0,1fr)_auto] sm:grid-cols-[90px_minmax(0,1fr)_minmax(0,0.6fr)_100px] gap-3 items-center px-4 py-2.5 text-[13px]">
                    <span className="text-ink-3">{new Date(s.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}</span>
                    <span className="min-w-0 truncate"><span className="font-semibold">{s.product.name}</span>{s.quantity > 1 && <span className="text-ink-3"> · {s.quantity} un.</span>}</span>
                    <span className="hidden sm:block text-ink-2 truncate">{barberName(s.barber)}{s.client ? ` · ${s.client.name}` : ""}</span>
                    <span className="font-semibold text-right">{formatCurrency(s.total)}</span>
                  </li>
                ))}
                <li className="flex justify-between px-4 py-3 text-sm font-semibold bg-surface-3/40"><span>Total do mês · {k.units} un.</span><span>{formatCurrency(k.salesTotal)}</span></li>
              </ul>
            )}
          </section>

          {reorder.length > 0 && (
            <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-[15px] font-semibold">Precisa repor</h2>
                  <p className="text-[13px] text-ink-3">Sugestão para chegar ao fim do mês, pelo ritmo de vendas de {month}</p>
                </div>
                <button type="button" onClick={supplierList} className="h-9 px-3 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-surface-3">
                  <Send className="w-4 h-4" aria-hidden /> Mandar lista pro fornecedor
                </button>
              </div>
              <ul className="flex flex-col divide-y divide-line-3">
                {reorder.map((r) => (
                  <li key={r.p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center py-2 text-[13px]">
                    <span className="min-w-0"><span className="font-semibold">{r.p.name}</span> <span className="text-ink-3">· {r.sold ? `${r.sold} vendidos no mês` : "sem vendas no mês"} · tem {r.p.stock}</span></span>
                    <span className="font-semibold">comprar {r.buy}</span>
                    <span className="text-ink-3 w-20 text-right">{brl(r.buy * r.p.costPrice)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <SidePanel open={!!selected && (selected === "new" || !!sel)} wide={wide} onClose={() => setSelected(null)} label="Produto">
          {selected === "new" ? (
            <Editor key="new" barbers={barbers} startMode="edit" onClose={() => setSelected(null)} onSaved={(id) => { load(); setSelected(id ?? null); }} />
          ) : sel ? (
            <Editor key={sel.id + startMode} product={sel} sold={soldBy[sel.id]} month={month} barbers={barbers} startMode={startMode}
              onClose={() => setSelected(null)} onSaved={() => load()} />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}

function Editor({ product, sold, month, barbers, startMode, onClose, onSaved }: {
  product?: Product; sold?: { qty: number; value: number }; month?: string; barbers: Barber[]; startMode: "edit" | "sell";
  onClose: () => void; onSaved: (id?: string) => void;
}) {
  const { token } = useAuthStore();
  const isNew = !product;
  const init = () => ({
    name: product?.name ?? "", description: product?.description ?? "", barcode: product?.barcode ?? "", imageUrl: product?.imageUrl ?? "",
    category: product?.category ?? "GERAL", stock: String(product?.stock ?? 0), price: product ? money(product.price) : "",
    costPrice: product?.costPrice ? money(product.costPrice) : "", commissionType: product?.commissionType ?? "PERCENTAGE",
    commissionValue: String(product?.commissionValue ?? 10), active: product?.active ?? true,
  });
  const [form, setForm] = useState(init);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(init());
  const [saving, setSaving] = useState(false);
  const stockNow = product?.stock;
  useEffect(() => { if (stockNow !== undefined) setForm((f) => ({ ...f, stock: String(stockNow) })); }, [stockNow]);
  const [mode, setMode] = useState<"sell" | "restock" | null>(isNew ? null : startMode === "sell" ? "sell" : null);
  const [qty, setQty] = useState(1);
  const [pay, setPay] = useState("PIX");
  const [barberId, setBarberId] = useState("");
  const [unitCost, setUnitCost] = useState(product?.costPrice ? money(product.costPrice) : "");
  const [confirmOff, setConfirmOff] = useState(false);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const price = parseMoney(form.price), cost = parseMoney(form.costPrice);
  const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;

  async function save(override?: Partial<ReturnType<typeof init>>) {
    const f = { ...form, ...override };
    if (!f.name.trim()) { toast.error("Informe o nome."); return; }
    if (!(parseMoney(f.price) > 0)) { toast.error("Informe o preço de venda."); return; }
    const cv = Number(f.commissionValue.replace(",", "."));
    if (!(cv >= 0) || (f.commissionType === "PERCENTAGE" && cv > 100)) { toast.error("Comissão inválida."); return; }
    setSaving(true);
    const body = {
      name: f.name.trim(), description: f.description.trim() || null, barcode: f.barcode.trim(), imageUrl: f.imageUrl.trim(),
      category: f.category, stock: Math.max(0, Math.floor(Number(f.stock) || 0)), price: parseMoney(f.price), costPrice: parseMoney(f.costPrice),
      commissionType: f.commissionType, commissionValue: cv, active: f.active,
    };
    const r = await fetch(isNew ? "/api/barbershop/products" : `/api/barbershop/products/${product!.id}`, { method: isNew ? "POST" : "PUT", headers, body: JSON.stringify(body) });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success(isNew ? "Produto cadastrado" : override?.active === false ? "Produto desativado" : override?.active ? "Produto reativado" : "Produto salvo");
    if (override) setForm(f);
    onSaved(isNew ? d.product?.id : undefined);
  }

  async function sell() {
    setSaving(true);
    const r = await fetch(`/api/barbershop/products/${product!.id}/sell`, { method: "POST", headers, body: JSON.stringify({ quantity: qty, paymentMethod: pay, barberId: barberId || undefined }) });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível vender."); return; }
    toast.success(`Venda registrada: ${qty}× ${product!.name}`);
    setMode(null); setQty(1);
    onSaved();
  }

  async function restock() {
    setSaving(true);
    const c = parseMoney(unitCost);
    const r = await fetch(`/api/barbershop/products/${product!.id}`, { method: "PATCH", headers, body: JSON.stringify({ addStock: qty, costPrice: c }) });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível repor."); return; }
    toast.success(`+${qty} no estoque de ${product!.name}`);
    setForm((f) => ({ ...f, stock: String(d.product.stock), costPrice: money(d.product.costPrice) }));
    setMode(null); setQty(1);
    onSaved();
  }

  const total = (product?.price ?? 0) * qty;
  const max = product && tracked(product) && mode === "sell" ? product.stock : 999;

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 pr-10 xl:pr-0">
          <div className="min-w-0">
            <h2 className="font-display text-[21px] font-bold truncate">{isNew ? "Novo produto" : product!.name}</h2>
            {!isNew && <p className="text-[13px] text-ink-3">{catLabel(product!.category)}{product!.barcode ? ` · ${product!.barcode}` : ""}</p>}
          </div>
          {!isNew && (
            <span className="flex items-center gap-2 text-[13px] font-semibold shrink-0">
              {form.active ? "Ativo" : "Inativo"}
              <Switch checked={form.active} label="Ativo" onChange={(v) => (v ? save({ active: true }) : setConfirmOff(true))} />
            </span>
          )}
        </div>
        {!isNew && (
          <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-line-2 border border-line-2">
            <div className="bg-surface p-3">
              <p className="text-xs text-ink-3">Na prateleira</p>
              <p className="text-lg font-bold">{tracked(product!) ? `${product!.stock} un.` : "—"}</p>
              <p className="text-[11px] text-ink-3">{!tracked(product!) ? "sem controle de estoque" : product!.stock <= LOW ? "estoque baixo" : "ok"}</p>
            </div>
            <div className="bg-surface p-3">
              <p className="text-xs text-ink-3">Vendidos em {month}</p>
              <p className="text-lg font-bold">{sold?.qty ?? 0}</p>
              <p className="text-[11px] text-ink-3">{sold ? brl(sold.value) : "nenhuma venda"}</p>
            </div>
          </div>
        )}

        {!isNew && form.active && (
          <div className="rounded-xl border border-line-2 p-3 flex flex-col gap-3">
            <div role="group" aria-label="Movimentar" className="grid grid-cols-2 gap-2">
              {([["sell", "Vender"], ["restock", "Repor estoque"]] as const).map(([m, l]) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(mode === m ? null : m); setQty(1); }}
                  className={cn("h-10 rounded-[10px] text-[13px] font-semibold border", mode === m ? "bg-ink text-white border-ink" : "border-control hover:bg-surface-3")}>{l}</button>
              ))}
            </div>
            {mode && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink-2">Quantidade</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Menos" onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 rounded-lg border border-control flex items-center justify-center"><Minus className="w-4 h-4" aria-hidden /></button>
                    <span className="w-8 text-center font-bold">{qty}</span>
                    <button type="button" aria-label="Mais" onClick={() => setQty(Math.min(max, qty + 1))} className="w-9 h-9 rounded-lg border border-control flex items-center justify-center"><Plus className="w-4 h-4" aria-hidden /></button>
                  </div>
                </div>
                {mode === "sell" ? (
                  <>
                    <div>
                      <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">Pagamento</span>
                      <div role="radiogroup" aria-label="Pagamento" className="grid grid-cols-4 gap-1.5">
                        {[["PIX", "Pix"], ["CASH", "Dinheiro"], ["CREDIT_CARD", "Crédito"], ["DEBIT_CARD", "Débito"]].map(([v, l]) => (
                          <button key={v} type="button" role="radio" aria-checked={pay === v} onClick={() => setPay(v)}
                            className={cn("h-9 rounded-lg border text-xs font-semibold", pay === v ? "bg-ink text-white border-ink" : "border-control")}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-ink-2">Quem vendeu <span className="font-normal text-ink-3">· recebe a comissão</span></span>
                      <select value={barberId} onChange={(e) => setBarberId(e.target.value)} className={fieldCls}>
                        <option value="">Balcão (sem comissão)</option>
                        {barbers.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.nickname || b.user.name}</option>)}
                      </select>
                    </label>
                    <Button loading={saving} onClick={sell}>Vender por {formatCurrency(total)}</Button>
                    <p className="text-xs text-ink-3">Com o caixa aberto, a venda entra no caixa sozinha.</p>
                  </>
                ) : (
                  <>
                    <Field label="Custo de cada unidade" prefix="R$" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" />
                    <Button loading={saving} onClick={restock}>Somar {qty} ao estoque</Button>
                    <p className="text-xs text-ink-3">Fica com {product!.stock + qty} un.{parseMoney(unitCost) > 0 && ` · gasto de ${formatCurrency(parseMoney(unitCost) * qty)} (lance em Resultado do mês, se quiser)`}</p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Section title="Cadastro">
        <Field label="Nome" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Pomada modeladora" />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Descrição <span className="font-normal text-ink-3">· opcional</span></span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={160} className={cn(fieldCls, "h-auto py-2.5 resize-none")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código de barras" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} inputMode="numeric" />
          <Field label="Foto (link)" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">Categoria</span>
          <div role="radiogroup" aria-label="Categoria" className="flex gap-1.5 flex-wrap">
            {CATS.map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.category === v} onClick={() => set("category", v)}
                className={cn("h-9 px-3 rounded-lg border text-[13px] font-semibold", form.category === v ? "bg-ink text-white border-ink" : "border-control hover:bg-surface-3")}>{l}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Estoque">
        <Field label="Quantidade atual" suffix="un." value={form.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} inputMode="numeric"
          hint={`Deixe 0 para não controlar estoque (vende sem limite). Com ${LOW} ou menos aparece como estoque baixo.`} />
      </Section>

      <Section title="Preço">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço de venda" prefix="R$" value={form.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" />
          <Field label="Preço de custo" prefix="R$" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} inputMode="decimal" />
        </div>
        {price > 0 && <p className="text-xs text-ink-3">Lucro de {formatCurrency(price - cost)} por unidade · margem de {margin}%</p>}
      </Section>

      <Section title="Comissão de quem vende">
        <div className="flex items-end gap-2">
          <div role="radiogroup" aria-label="Tipo de comissão" className="flex rounded-[10px] border border-control overflow-hidden h-11 shrink-0">
            {[["PERCENTAGE", "%"], ["FIXED", "R$"]].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={form.commissionType === v} onClick={() => set("commissionType", v)}
                className={cn("w-12 text-sm font-semibold", form.commissionType === v ? "bg-ink text-white" : "bg-surface")}>{l}</button>
            ))}
          </div>
          <Field className="flex-1" label={form.commissionType === "FIXED" ? "Valor por unidade" : "Porcentagem da venda"} value={form.commissionValue}
            onChange={(e) => set("commissionValue", e.target.value)} inputMode="decimal" />
        </div>
        {price > 0 && (
          <p className="text-xs text-ink-3">
            Em cada venda, quem vendeu recebe {formatCurrency(form.commissionType === "FIXED" ? Number(form.commissionValue.replace(",", ".")) || 0 : price * ((Number(form.commissionValue.replace(",", ".")) || 0) / 100))}.
          </p>
        )}
      </Section>

      <div className="px-5 py-4 border-t border-line-2 flex items-center gap-2 sticky bottom-0 bg-surface">
        <Button variant="outline" className="ml-auto" onClick={() => (dirty && !isNew ? setForm(init()) : onClose())}>{dirty && !isNew ? "Descartar" : "Fechar"}</Button>
        <Button loading={saving} disabled={!dirty} onClick={() => save()}>{isNew ? "Cadastrar" : "Salvar"}</Button>
      </div>

      <ConfirmDialog isOpen={confirmOff} title={`Desativar ${product?.name}?`} message="Ele some da comanda e da lista de venda. O histórico de vendas continua."
        confirmLabel="Desativar" onConfirm={() => { setConfirmOff(false); save({ active: false }); }} onCancel={() => setConfirmOff(false)} />
    </div>
  );
}
