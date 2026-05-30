"use client";
import { useEffect, useState } from "react";
import { Package, Plus, ShoppingCart, AlertTriangle, TrendingUp, Edit2, Minus, Percent, HelpCircle, Trash2, Image as ImageIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency, formatDateTime } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  costPrice: number;
  stock: number;
  barcode: string | null;
  category: string;
  active: boolean;
  commissionType: string;
  commissionValue: number;
  imageUrl: string | null;
}

interface Sale {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  product: { name: string; category: string };
  barber: { user: { name: string } } | null;
}

const CATEGORIAS: Record<string, { label: string; emoji: string; color: string }> = {
  GERAL:    { label: "Geral",     emoji: "📦", color: "bg-zinc-100 text-zinc-700" },
  CABELO:   { label: "Cabelo",    emoji: "✂️",  color: "bg-blue-100 text-blue-700" },
  BARBA:    { label: "Barba",     emoji: "🪒",  color: "bg-primary/20 text-amber-700" },
  SKINCARE: { label: "Skincare",  emoji: "🧴",  color: "bg-green-100 text-green-700" },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  costPrice: "",
  stock: "",
  category: "GERAL",
  barcode: "",
  commissionType: "PERCENTAGE",
  commissionValue: "10",
  imageUrl: "",
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
  const [sellPaymentMethod, setSellPaymentMethod] = useState("CASH");
  const [barcodeSearch, setBarcodeSearch] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);

  function setField(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function load() {
    const [pr, sr] = await Promise.all([
      fetch("/api/barbershop/products?admin=1", { headers: { Authorization: `Bearer ${token}` } }),
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
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        costPrice: parseFloat(form.costPrice || "0"),
        stock: parseInt(form.stock || "0"),
        barcode: form.barcode || null,
        category: form.category,
        imageUrl: form.imageUrl || null,
        commissionType: form.commissionType,
        commissionValue: parseFloat(form.commissionValue || "0"),
      }),
    });
    setLoading(false);
    setOpenAdd(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);
    await fetch(`/api/barbershop/products/${selectedProduct.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        ...selectedProduct,
        name: form.name,
        description: form.description || null,
        price: parseFloat(form.price),
        costPrice: parseFloat(form.costPrice || "0"),
        stock: parseInt(form.stock || "0"),
        barcode: form.barcode || null,
        category: form.category,
        imageUrl: form.imageUrl || null,
        commissionType: form.commissionType,
        commissionValue: parseFloat(form.commissionValue || "0"),
      }),
    });
    setLoading(false);
    setOpenEdit(false);
    load();
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/barbershop/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...p, active: !p.active }),
    });
    load();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Excluir "${p.name}"? O produto será desativado permanentemente.`)) return;
    await fetch(`/api/barbershop/products/${p.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  async function handleSell() {
    if (!selectedProduct) return;
    setLoading(true);
    const res = await fetch(`/api/barbershop/products/${selectedProduct.id}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quantity: sellQty, paymentMethod: sellPaymentMethod }),
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
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      costPrice: String(p.costPrice),
      stock: String(p.stock),
      barcode: p.barcode || "",
      category: p.category,
      imageUrl: p.imageUrl || "",
      commissionType: p.commissionType || "PERCENTAGE",
      commissionValue: String(p.commissionValue ?? 10),
    });
    setOpenEdit(true);
  }

  const lowStock = products.filter((p) => p.active && p.stock > 0 && p.stock <= 3);
  const byCategory = Object.keys(CATEGORIAS).reduce<Record<string, Product[]>>((acc, cat) => {
    acc[cat] = products.filter((p) => p.category === cat);
    return acc;
  }, {});

  const CommissionFields = () => (
    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-150 space-y-4">
      <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
        <Percent className="w-4 h-4 text-primary" /> Configuração de Comissão do Profissional
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1">
            Tipo de Comissão
            <span className="group relative cursor-help text-zinc-400 hover:text-zinc-600">
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:block w-48 bg-zinc-950 text-white text-[10px] p-2 rounded-lg leading-tight shadow-xl z-50">
                Escolha se a comissão é uma porcentagem sobre o preço de venda ou um valor fixo em reais.
              </span>
            </span>
          </label>
          <select
            value={form.commissionType}
            onChange={(e) => setField("commissionType", e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="PERCENTAGE">Porcentagem (%)</option>
            <option value="FIXED">Valor Fixo (R$)</option>
          </select>
        </div>
        <Input
          label={form.commissionType === "PERCENTAGE" ? "Comissão (%)" : "Comissão (R$)"}
          type="number"
          step="0.01"
          min="0"
          value={form.commissionValue}
          onChange={(e) => setField("commissionValue", e.target.value)}
          placeholder={form.commissionType === "PERCENTAGE" ? "10" : "5.00"}
          required
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Produtos</h1>
          <p className="text-zinc-500 text-sm mt-1">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrados</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              placeholder="Bipar Código de Barras..."
              value={barcodeSearch}
              onChange={(e) => {
                setBarcodeSearch(e.target.value);
                const found = products.find(p => p.barcode === e.target.value && p.active);
                if (found) { openSellModal(found); setBarcodeSearch(""); }
              }}
              className="w-48 sm:w-64"
            />
          </div>
          <Button onClick={() => setOpenAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-zinc-500">Vendas do mês</span>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900">{formatCurrency(totalMes)}</p>
          <p className="text-xs text-zinc-400 mt-1">{totalUnidades} unidades vendidas</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-zinc-500">Em estoque</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-zinc-900">{products.filter(p => p.active).reduce((s, p) => s + p.stock, 0)}</p>
          <p className="text-xs text-zinc-400 mt-1">unidades no total</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 sm:p-5 ${lowStock.length > 0 ? "bg-red-50 border-red-300" : "bg-white border-zinc-200"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs sm:text-sm ${lowStock.length > 0 ? "text-red-600" : "text-zinc-500"}`}>Estoque baixo</span>
            <AlertTriangle className={`w-4 h-4 ${lowStock.length > 0 ? "text-red-500" : "text-zinc-300"}`} />
          </div>
          <p className={`text-xl sm:text-2xl font-bold ${lowStock.length > 0 ? "text-red-700" : "text-zinc-400"}`}>{lowStock.length}</p>
          <p className={`text-xs mt-1 truncate ${lowStock.length > 0 ? "text-red-500" : "text-zinc-400"}`}>
            {lowStock.length > 0 ? lowStock.map((p) => p.name).join(", ") : "tudo OK"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden w-fit">
        {(["estoque", "vendas"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-primary text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}>
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
                      <div key={p.id} className={`bg-white rounded-xl border border-zinc-150 shadow-sm p-5 flex flex-col justify-between min-h-[220px] relative overflow-hidden transition-all ${!p.active ? "opacity-50" : ""}`}>
                        {/* Imagem de fundo decorativa */}
                        {p.imageUrl && (
                          <div className="absolute top-0 right-0 w-24 h-24 opacity-10 pointer-events-none">
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-bl-full" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-zinc-900 truncate">{p.name}</p>
                              {p.description && <p className="text-xs text-zinc-400 mt-0.5 truncate">{p.description}</p>}
                            </div>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ml-2 shrink-0 ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-xl font-bold text-zinc-900">{formatCurrency(p.price)}</p>
                              {p.costPrice > 0 && (
                                <p className="text-[10px] text-zinc-400 font-medium">Custo: {formatCurrency(p.costPrice)}</p>
                              )}
                            </div>
                            {margem !== null && (
                              <div className="text-right">
                                <p className="text-xs font-bold text-green-600">+{margem}%</p>
                                <p className="text-[10px] text-zinc-400 font-medium">Lucro</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {/* Comissão */}
                          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg mb-2 bg-zinc-100 border border-zinc-200 text-xs text-zinc-600">
                            <span className="flex items-center gap-1 font-medium"><Percent className="w-3.5 h-3.5 text-primary" /> Comissão</span>
                            <span className="font-bold text-primary">
                              {p.commissionType === "PERCENTAGE" ? `${p.commissionValue}%` : formatCurrency(p.commissionValue)}
                            </span>
                          </div>

                          {/* Estoque */}
                          <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-3 border text-xs ${p.stock <= 3 && p.stock > 0 ? "bg-red-50 border-red-300 text-red-700" : "bg-zinc-100 border-zinc-200 text-zinc-600"}`}>
                            <span>Estoque</span>
                            <span className="font-bold">
                              {p.stock === 0 ? "Não controlado" : `${p.stock} un.`}
                              {p.stock <= 3 && p.stock > 0 && " ⚠️"}
                            </span>
                          </div>

                          {/* Ações */}
                          <div className="flex gap-2 items-center">
                            {p.active && (
                              <Button onClick={() => openSellModal(p)} className="flex-1 font-bold text-xs" size="sm">
                                <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Vender
                              </Button>
                            )}
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                              title="Editar produto"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                            </button>
                            <button
                              onClick={() => toggleActive(p)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold border transition-colors ${p.active ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"}`}
                              title={p.active ? "Desativar produto" : "Ativar produto"}
                            >
                              {p.active ? "Ativo" : "Inativo"}
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-2 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
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
        <div className="bg-white rounded-xl border border-zinc-150 shadow-sm overflow-hidden">
          {sales.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3" />
              <p>Nenhuma venda registrada este mês</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {sales.map((s) => {
                const cfg = CATEGORIAS[s.product.category] || CATEGORIAS.GERAL;
                return (
                  <div key={s.id} className="px-6 py-4 flex items-center gap-4 hover:bg-zinc-50 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                      {cfg.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-900">{s.product.name}</p>
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
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-between text-sm">
              <span className="text-zinc-500 font-medium">Total do mês</span>
              <span className="font-black text-zinc-900">{formatCurrency(totalMes)}</span>
            </div>
          )}
        </div>
      )}

      {/* Modal: Novo produto */}
      <Modal open={openAdd} onClose={() => setOpenAdd(false)} title="Novo Produto" className="max-w-lg">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Pomada Modeladora Matte" required />
          <Input label="Descrição (opcional)" value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Breve descrição do produto" />
          <Input label="Código de Barras (opcional)" value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} placeholder="Bipe aqui" />

          {/* Foto */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-zinc-400" /> Foto do produto (URL, opcional)
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setField("imageUrl", e.target.value)}
              placeholder="https://exemplo.com/foto.jpg"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Preview" className="mt-2 h-16 w-16 object-cover rounded-lg border border-zinc-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">Categoria</label>
              <select value={form.category} onChange={(e) => setField("category", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(CATEGORIAS).map(([v, c]) => (
                  <option key={v} value={v}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <Input label="Estoque inicial (0 = s/ controle)" type="number" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} placeholder="10" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Preço de venda (R$)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setField("price", e.target.value)} placeholder="45.00" required />
            <Input label="Preço de Custo (R$)" type="number" step="0.01" min="0" value={form.costPrice} onChange={(e) => setField("costPrice", e.target.value)} placeholder="20.00" />
          </div>

          <CommissionFields />

          <Button type="submit" loading={loading} className="w-full mt-2">Cadastrar Produto</Button>
        </form>
      </Modal>

      {/* Modal: Editar produto */}
      <Modal open={openEdit} onClose={() => setOpenEdit(false)} title="Editar Produto" className="max-w-lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
          <Input label="Descrição (opcional)" value={form.description} onChange={(e) => setField("description", e.target.value)} />
          <Input label="Código de Barras (opcional)" value={form.barcode} onChange={(e) => setField("barcode", e.target.value)} />

          {/* Foto */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-zinc-400" /> Foto do produto (URL, opcional)
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setField("imageUrl", e.target.value)}
              placeholder="https://exemplo.com/foto.jpg"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="Preview" className="mt-2 h-16 w-16 object-cover rounded-lg border border-zinc-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1">Categoria</label>
              <select value={form.category} onChange={(e) => setField("category", e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(CATEGORIAS).map(([v, c]) => (
                  <option key={v} value={v}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <Input label="Estoque atual" type="number" min="0" value={form.stock} onChange={(e) => setField("stock", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Preço de Venda (R$)" type="number" step="0.01" value={form.price} onChange={(e) => setField("price", e.target.value)} required />
            <Input label="Preço de Custo (R$)" type="number" step="0.01" value={form.costPrice} onChange={(e) => setField("costPrice", e.target.value)} />
          </div>

          <CommissionFields />

          <Button type="submit" loading={loading} className="w-full mt-2">Salvar Alterações</Button>
        </form>
      </Modal>

      {/* Modal: Vender */}
      <Modal open={openSell} onClose={() => setOpenSell(false)} title="Registrar Venda">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="bg-zinc-50 rounded-xl p-4 flex items-center gap-3">
              {selectedProduct.imageUrl && (
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-12 h-12 object-cover rounded-lg border border-zinc-200 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-zinc-900">{selectedProduct.name}</p>
                <p className="text-sm text-zinc-500 mt-0.5">{formatCurrency(selectedProduct.price)} por unidade</p>
                {selectedProduct.stock > 0 && (
                  <p className="text-xs text-zinc-400 mt-0.5">{selectedProduct.stock} em estoque</p>
                )}
              </div>
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

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Forma de Pagamento (Caixa)</label>
              <select
                value={sellPaymentMethod}
                onChange={(e) => setSellPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="PIX">Pix</option>
                <option value="CREDIT_CARD">Cartão de Crédito</option>
                <option value="DEBIT_CARD">Cartão de Débito</option>
                <option value="CASH">Dinheiro Vivo</option>
              </select>
            </div>

            <div className="bg-primary/10 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-amber-700 font-medium">Total</span>
              <span className="text-xl font-black text-primary/90">
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
