"use client";
import { useEffect, useState } from "react";
import { Package, Plus, ShoppingCart, AlertTriangle, TrendingUp, Edit2, Minus } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Product {
  id: string; name: string; description: string | null;
  price: number; costPrice: number; stock: number;
  category: string; active: boolean;
}
interface Sale {
  id: string; quantity: number; unitPrice: number; total: number; createdAt: string;
  product: { name: string; category: string };
  barber: { user: { name: string } } | null;
}

const CATEGORIAS: Record<string, { label: string; emoji: string; color: string }> = {
  GERAL:    { label: "Geral",     emoji: "📦", color: "bg-zinc-100 text-zinc-700" },
  CABELO:   { label: "Cabelo",    emoji: "✂️",  color: "bg-blue-100 text-blue-700" },
  BARBA:    { label: "Barba",     emoji: "🪒",  color: "bg-amber-100 text-amber-700" },
  SKINCARE: { label: "Skincare",  emoji: "🧴",  color: "bg-green-100 text-green-700" },
};

export default function ProdutosPage() {
  const { token } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalMes, setTotalMes] = useState(0);
  const [totalUnidades, setTotalUnidades] = useState(0);
  const [tab, setTab] = useState<"estoque" | "vendas">("estoque");
  const [openAdd, setOpenAdd] = useState(false);
  const [openSell, setOpenSell] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [sellQty, setSellQty] = useState(1);

  const [form, setForm] = useState({
    name: "", description: "", price: "", costPrice: "", stock: "", category: "GERAL",
  });

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [pr, sr] = await Promise.all([
      fetch("/api/barbershop/products", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/barbershop/products/sales", { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [pd, sd] = await Promise.all([pr.json(), sr.json()]);
    setProducts(pd.products || []);
    setSales(sd.sales || []);
    setTotalMes(sd.totalMes || 0);
    setTotalUnidades(sd.totalUnidades || 0);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/barbershop/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    setLoading(false);
    setOpenAdd(false);
    setForm({ name: "", description: "", price: "", costPrice: "", stock: "", category: "GERAL" });
    load();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);
    await fetch(`/api/barbershop/products/${selectedProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...selectedProduct, ...form }),
    });
    setLoading(false);
    setOpenEdit(false);
    load();
  }

  async function handleSell() {
    if (!selectedProduct) return;
    setLoading(true);
    const res = await fetch(`/api/barbershop/products/${selectedProduct.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quantity: sellQty }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); setLoading(false); return; }
    setLoading(false);
    setOpenSell(false);
    setSellQty(1);
    load();
  }

  function openSellModal(p: Product) {
    setSelectedProduct(p);
    setSellQty(1);
    setOpenSell(true);
  }

  function openEditModal(p: Product) {
    setSelectedProduct(p);
    setForm({
      name: p.name, description: p.description || "",
      price: String(p.price), costPrice: String(p.costPrice),
      stock: String(p.stock), category: p.category,
    });
    setOpenEdit(true);
  }

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 3);
  const byCategory = Object.keys(CATEGORIAS).reduce<Record<string, Product[]>>((acc, cat) => {
    acc[cat] = products.filter((p) => p.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Produtos</h1>
          <p className="text-zinc-500 text-sm mt-1">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrados</p>
        </div>
        <Button onClick={() => setOpenAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Produto
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-500">Vendas do mês</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatCurrency(totalMes)}</p>
          <p className="text-xs text-zinc-400 mt-1">{totalUnidades} unidades vendidas</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-500">Em estoque</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{products.reduce((s, p) => s + p.stock, 0)}</p>
          <p className="text-xs text-zinc-400 mt-1">unidades no total</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-5 ${lowStock.length > 0 ? "bg-red-50 border-red-100" : "bg-white border-zinc-100"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${lowStock.length > 0 ? "text-red-600" : "text-zinc-500"}`}>Estoque baixo</span>
            <AlertTriangle className={`w-4 h-4 ${lowStock.length > 0 ? "text-red-500" : "text-zinc-300"}`} />
          </div>
          <p className={`text-2xl font-bold ${lowStock.length > 0 ? "text-red-700" : "text-zinc-400"}`}>{lowStock.length}</p>
          <p className={`text-xs mt-1 ${lowStock.length > 0 ? "text-red-500" : "text-zinc-400"}`}>
            {lowStock.length > 0 ? lowStock.map((p) => p.name).join(", ") : "tudo OK"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
        {(["estoque", "vendas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-amber-500 text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
            {t === "estoque" ? "📦 Estoque" : "🛒 Vendas do Mês"}
          </button>
        ))}
      </div>

      {tab === "estoque" && (
        <div className="space-y-6">
          {Object.entries(byCategory).map(([cat, prods]) => {
            if (prods.length === 0) return null;
            const cfg = CATEGORIAS[cat];
            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                  {cfg.emoji} {cfg.label}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {prods.map((p) => {
                    const margem = p.costPrice > 0
                      ? Math.round(((p.price - p.costPrice) / p.price) * 100)
                      : null;
                    return (
                      <div key={p.id} className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-900 truncate">{p.name}</p>
                            {p.description && <p className="text-xs text-zinc-400 mt-0.5 truncate">{p.description}</p>}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xl font-bold text-zinc-900">{formatCurrency(p.price)}</p>
                            {p.costPrice > 0 && (
                              <p className="text-xs text-zinc-400">Custo: {formatCurrency(p.costPrice)}</p>
                            )}
                          </div>
                          {margem !== null && (
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">{margem}%</p>
                              <p className="text-xs text-zinc-400">margem</p>
                            </div>
                          )}
                        </div>

                        {/* Estoque */}
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${p.stock <= 3 && p.stock > 0 ? "bg-red-50" : p.stock === 0 ? "bg-zinc-50" : "bg-zinc-50"}`}>
                          <span className="text-xs text-zinc-500">Estoque</span>
                          <span className={`text-sm font-bold ${p.stock <= 3 && p.stock > 0 ? "text-red-600" : "text-zinc-900"}`}>
                            {p.stock === 0 ? "Não controlado" : `${p.stock} un.`}
                            {p.stock <= 3 && p.stock > 0 && " ⚠️"}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => openSellModal(p)}
                            className="flex-1" size="sm"
                          >
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Vender
                          </Button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-zinc-100 text-zinc-400">
              <Package className="w-14 h-14 mb-3" />
              <p className="font-semibold text-lg">Nenhum produto cadastrado</p>
              <Button className="mt-5" onClick={() => setOpenAdd(true)}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar produto
              </Button>
            </div>
          )}
        </div>
      )}

      {tab === "vendas" && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
          {sales.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3" />
              <p>Nenhuma venda registrada este mês</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {sales.map((s) => {
                const cfg = CATEGORIAS[s.product.category] || CATEGORIAS.GERAL;
                return (
                  <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center text-lg shrink-0">
                      {cfg.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900">{s.product.name}</p>
                      <p className="text-xs text-zinc-400">
                        {s.quantity} × {formatCurrency(s.unitPrice)}
                        {s.barber && ` · ${s.barber.user.name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-900">{formatCurrency(s.total)}</p>
                      <p className="text-xs text-zinc-400">{formatDateTime(s.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {sales.length > 0 && (
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-between text-sm">
              <span className="text-zinc-500">Total do mês</span>
              <span className="font-bold text-zinc-900">{formatCurrency(totalMes)}</span>
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo produto */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Novo Produto" className="max-w-lg">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Nome" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Pomada Matte" required />
          <Input label="Descrição" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Breve descrição do produto" />
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
            <select value={form.category} onChange={(e) => setField("category", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              {Object.entries(CATEGORIAS).map(([v, c]) => (
                <option key={v} value={v}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço de venda (R$)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="45.00" required />
            <Input label="Custo (R$)" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setField("costPrice", e.target.value)} placeholder="20.00" />
          </div>
          <Input label="Estoque inicial (0 = não controlar)" type="number" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} placeholder="10" />
          <Button type="submit" loading={loading} className="w-full mt-2">Cadastrar Produto</Button>
        </form>
      </Modal>

      {/* Modal: Editar produto */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar Produto" className="max-w-lg">
        <form onSubmit={handleEdit} className="space-y-3">
          <Input label="Nome" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
          <Input label="Descrição" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
            <select value={form.category} onChange={(e) => setField("category", e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
              {Object.entries(CATEGORIAS).map(([v, c]) => (
                <option key={v} value={v}>{c.emoji} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço (R$)" type="number" step="0.01" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
            <Input label="Custo (R$)" type="number" step="0.01" value={form.costPrice} onChange={(e) => setField("costPrice", e.target.value)} />
          </div>
          <Input label="Estoque atual" type="number" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} />
          <Button type="submit" loading={loading} className="w-full mt-2">Salvar Alterações</Button>
        </form>
      </Modal>

      {/* Modal: Vender */}
      <Modal open={openSell} onClose={() => setOpenSell(false)} title="Registrar Venda">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-xl p-4">
              <p className="font-semibold text-zinc-900">{selectedProduct.name}</p>
              <p className="text-sm text-zinc-500 mt-0.5">{formatCurrency(selectedProduct.price)} por unidade</p>
              {selectedProduct.stock > 0 && (
                <p className="text-xs text-zinc-400 mt-0.5">{selectedProduct.stock} em estoque</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Quantidade</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setSellQty((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-lg border border-zinc-300 flex items-center justify-center hover:bg-zinc-50">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-2xl font-bold text-zinc-900 w-10 text-center">{sellQty}</span>
                <button onClick={() => setSellQty((q) => q + 1)}
                  className="w-10 h-10 rounded-lg border border-zinc-300 flex items-center justify-center hover:bg-zinc-50">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-amber-700 font-medium">Total</span>
              <span className="text-xl font-black text-amber-600">
                {formatCurrency(selectedProduct.price * sellQty)}
              </span>
            </div>

            <Button onClick={handleSell} loading={loading} className="w-full" size="lg">
              <ShoppingCart className="w-4 h-4 mr-1" /> Confirmar Venda
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
