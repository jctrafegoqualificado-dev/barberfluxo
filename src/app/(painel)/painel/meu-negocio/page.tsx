"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import {
  Building2, Phone, Mail, Instagram, FileText, MapPin,
  Save, Camera, Loader2, CheckCircle2, AlertCircle,
  Search, User, X, Palette, Image as ImageIcon,
} from "lucide-react";

/* ─── tipos ─────────────────────────────────────────────── */
interface FormData {
  // identidade visual
  name: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  favIconUrl: string;
  // dados comerciais
  phone: string;
  contactEmail: string;
  instagram: string;
  cnpj: string;
  ownerName: string;
  ownerEmail: string;
  // endereço
  zipCode: string;
  address: string;
  streetNumber: string;
  streetComplement: string;
  neighborhood: string;
  city: string;
  state: string;
}

const EMPTY: FormData = {
  name: "", description: "", logoUrl: "",
  primaryColor: "#f59e0b", secondaryColor: "#fbbf24", favIconUrl: "",
  phone: "", contactEmail: "", instagram: "", cnpj: "",
  ownerName: "", ownerEmail: "",
  zipCode: "", address: "", streetNumber: "", streetComplement: "",
  neighborhood: "", city: "", state: "",
};

/* ─── máscaras ───────────────────────────────────────────── */
function maskCnpj(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCep(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

function maskPhone(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return n.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}

/* ─── resize de imagem client-side ─────────────────────── */
function resizeImageToBase64(file: File, maxPx = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════════════════════════════════ */
export default function MeuNegocioPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [cepLoading, setCepLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgLoading, setImgLoading] = useState(false);

  /* ── carrega as duas APIs em paralelo ── */
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/barbershop/profile", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/barbershop/settings", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ])
      .then(([profile, settings]) => {
        setForm({
          name:            profile.name         ?? settings.name       ?? "",
          description:     settings.description  ?? "",
          logoUrl:         profile.logoUrl       ?? settings.logoUrl    ?? "",
          primaryColor:    settings.primaryColor  ?? "#f59e0b",
          secondaryColor:  settings.secondaryColor ?? "#fbbf24",
          favIconUrl:      settings.favIconUrl    ?? "",
          phone:           profile.phone          ?? "",
          contactEmail:    profile.contactEmail   ?? "",
          instagram:       profile.instagram      ?? "",
          cnpj:            profile.cnpj           ?? "",
          ownerName:       profile.ownerName      ?? "",
          ownerEmail:      profile.ownerEmail     ?? "",
          zipCode:         profile.zipCode        ?? "",
          address:         profile.address        ?? "",
          streetNumber:    profile.streetNumber   ?? "",
          streetComplement:profile.streetComplement ?? "",
          neighborhood:    profile.neighborhood   ?? "",
          city:            profile.city           ?? "",
          state:           profile.state          ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  /* ── busca CEP ── */
  const fetchCep = useCallback(async (raw: string) => {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          address:      data.logradouro ?? f.address,
          neighborhood: data.bairro     ?? f.neighborhood,
          city:         data.localidade ?? f.city,
          state:        data.uf         ?? f.state,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }, []);

  /* ── upload logo ── */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: "error", msg: "Imagem muito grande. Máximo 5 MB." });
      return;
    }
    setImgLoading(true);
    try {
      const b64 = await resizeImageToBase64(file, 400);
      setForm(f => ({ ...f, logoUrl: b64 }));
    } catch {
      setStatus({ type: "error", msg: "Erro ao processar imagem." });
    } finally {
      setImgLoading(false);
      e.target.value = "";
    }
  }

  /* ── salvar tudo ── */
  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const [profileRes, settingsRes] = await Promise.all([
        fetch("/api/barbershop/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name:             form.name,
            phone:            form.phone,
            contactEmail:     form.contactEmail,
            instagram:        form.instagram,
            cnpj:             form.cnpj,
            ownerName:        form.ownerName,
            ownerEmail:       form.ownerEmail,
            zipCode:          form.zipCode,
            address:          form.address,
            streetNumber:     form.streetNumber,
            streetComplement: form.streetComplement,
            neighborhood:     form.neighborhood,
            city:             form.city,
            state:            form.state,
            logoUrl:          form.logoUrl,
          }),
        }),
        fetch("/api/barbershop/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name:           form.name,
            description:    form.description,
            primaryColor:   form.primaryColor,
            secondaryColor: form.secondaryColor,
            logoUrl:        form.logoUrl,
            favIconUrl:     form.favIconUrl,
          }),
        }),
      ]);

      if (!profileRes.ok) {
        const d = await profileRes.json();
        throw new Error(d.error ?? "Erro ao salvar perfil");
      }
      if (!settingsRes.ok) {
        const d = await settingsRes.json();
        throw new Error(d.error ?? "Erro ao salvar configurações");
      }

      setStatus({ type: "success", msg: "Salvo com sucesso! Aplicando novas cores…" });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  }

  /* ── loading ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-zinc-500 animate-pulse">Carregando…</p>
      </div>
    );
  }

  /* ─── helpers de input ── */
  const inputCls =
    "w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition bg-white disabled:bg-zinc-50 disabled:text-zinc-400";
  const labelCls = "text-sm font-medium text-zinc-700";

  function Field({
    label, icon: Icon, value, onChange, placeholder, disabled, type = "text",
  }: {
    label: string; icon: React.ElementType; value: string;
    onChange: (v: string) => void; placeholder?: string;
    disabled?: boolean; type?: string;
  }) {
    return (
      <div className="space-y-1.5">
        <label className={labelCls}>{label}</label>
        <div className="relative">
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`${inputCls} pl-10`}
          />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════ RENDER ════════════════ */
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Meu Negócio</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Identidade visual, dados comerciais e endereço do estabelecimento.
        </p>
      </div>

      {/* ── Status global ── */}
      {status && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-in zoom-in-95 duration-200 ${
          status.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {status.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {status.msg}
          <button onClick={() => setStatus(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══ CARD 1: Identidade Visual ══ */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-6">
        <h2 className="font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          Identidade Visual
        </h2>

        {/* Logo + Nome + Slogan */}
        <div className="flex items-start gap-6 flex-wrap">
          {/* Logo */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center">
              {imgLoading ? (
                <Loader2 className="w-7 h-7 text-zinc-400 animate-spin" />
              ) : form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white font-black text-3xl"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  {form.name ? form.name.charAt(0).toUpperCase() : "B"}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md hover:brightness-110 transition-all"
              title="Trocar logo"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Nome + Slogan */}
          <div className="flex-1 min-w-[200px] space-y-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Nome do estabelecimento</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex: Barbearia do João"
                  className={`${inputCls} pl-10`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Slogan / Frase de impacto</label>
              <div className="relative">
                <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Ex: A melhor barbearia da cidade!"
                  className={`${inputCls} pl-10`}
                />
              </div>
              <p className="text-xs text-zinc-400">Aparece na página de agendamento online dos seus clientes.</p>
            </div>
          </div>
        </div>

        {/* Remover logo */}
        <div className="flex items-center gap-4 -mt-2">
          <p className="text-xs text-zinc-400">
            JPG, PNG ou WebP • máx. 5 MB • redimensionada automaticamente para 400×400 px
          </p>
          {form.logoUrl && (
            <button
              onClick={() => setForm(f => ({ ...f, logoUrl: "" }))}
              className="text-xs text-red-500 hover:text-red-600 font-medium shrink-0"
            >
              Remover logo
            </button>
          )}
        </div>

        {/* Cores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={labelCls}>Cor principal</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="w-12 h-12 rounded-xl border border-zinc-200 cursor-pointer p-1 bg-white shrink-0"
              />
              <input
                type="text"
                value={form.primaryColor.toUpperCase()}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="flex-1 px-4 rounded-xl border border-zinc-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Cor secundária</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => set("secondaryColor", e.target.value)}
                className="w-12 h-12 rounded-xl border border-zinc-200 cursor-pointer p-1 bg-white shrink-0"
              />
              <input
                type="text"
                value={form.secondaryColor.toUpperCase()}
                onChange={(e) => set("secondaryColor", e.target.value)}
                className="flex-1 px-4 rounded-xl border border-zinc-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Favicon */}
        <div className="space-y-1.5">
          <label className={labelCls}>
            URL do Favicon{" "}
            <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={form.favIconUrl}
              onChange={(e) => set("favIconUrl", e.target.value)}
              placeholder="https://suabarbearia.com/favicon.ico"
              className={`${inputCls} pl-10`}
            />
          </div>
          <p className="text-xs text-zinc-400">
            Ícone exibido na aba do navegador. Formato .ico ou .png recomendado.
          </p>
        </div>

        {/* ── Live Preview ── */}
        <div className="rounded-2xl overflow-hidden border border-zinc-700/40">
          {/* Barra título estilo "janela" */}
          <div className="bg-zinc-800 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <p className="text-xs font-bold text-zinc-400 tracking-widest uppercase flex-1 text-center pr-8">
              Live Preview
            </p>
          </div>

          {/* Conteúdo do preview */}
          <div className="bg-zinc-900 px-6 py-8 space-y-6">
            {/* Logo + Nome + Slogan */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg"
                style={{ backgroundColor: form.primaryColor }}
              >
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-2xl select-none">
                    {form.name ? form.name.charAt(0).toUpperCase() : "B"}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p className="font-bold text-white text-lg leading-tight">
                  {form.name || "Nome da Barbearia"}
                </p>
                {form.description && (
                  <p className="text-zinc-400 text-sm mt-1 max-w-[240px] line-clamp-2">
                    {form.description}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-zinc-800" />

            {/* Botões de amostra */}
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                className="px-5 py-2.5 rounded-full font-bold text-sm text-white shadow-md transition-none cursor-default"
                style={{ backgroundColor: form.primaryColor }}
                tabIndex={-1}
              >
                Botão Principal
              </button>
              <span
                className="flex items-center gap-1.5 font-semibold text-sm cursor-default"
                style={{ color: form.secondaryColor }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Destaque Ativo
              </span>
            </div>

            {/* Mini item de sidebar */}
            <div className="max-w-[260px] mx-auto bg-zinc-800 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
                style={{ backgroundColor: form.primaryColor }}
              >
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-sm select-none">
                    {form.name ? form.name.charAt(0).toUpperCase() : "B"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-2 rounded-full bg-zinc-600 w-3/4" />
                <div className="h-1.5 rounded-full bg-zinc-700 w-1/2" />
              </div>
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: form.secondaryColor }}
              />
            </div>

            <p className="text-center text-xs text-zinc-600">
              As alterações afetarão o dashboard, app de agendamento e e-mails.
            </p>
          </div>
        </div>
      </div>

      {/* ══ CARD 2: Dados Comerciais ══ */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Dados Comerciais
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Nome do proprietário"
            icon={User}
            value={form.ownerName}
            onChange={(v) => set("ownerName", v)}
            placeholder="Seu nome completo"
          />
          <Field
            label="Telefone / WhatsApp"
            icon={Phone}
            value={form.phone}
            onChange={(v) => set("phone", maskPhone(v))}
            placeholder="(41) 99999-0000"
          />
          <Field
            label="E-mail de contato"
            icon={Mail}
            value={form.contactEmail}
            onChange={(v) => set("contactEmail", v)}
            placeholder="contato@suabarbearia.com.br"
            type="email"
          />
          <Field
            label="Instagram"
            icon={Instagram}
            value={form.instagram}
            onChange={(v) => set("instagram", v.startsWith("@") ? v : v ? `@${v}` : "")}
            placeholder="@suabarbearia"
          />
          <div className="space-y-1.5">
            <label className={labelCls}>CNPJ</label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelCls}>E-mail do proprietário (login)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="email"
                value={form.ownerEmail}
                disabled
                className={`${inputCls} pl-10`}
                title="Para alterar o e-mail de login, entre em contato com o suporte."
              />
            </div>
            <p className="text-xs text-zinc-400">
              E-mail usado para login. Para alterá-lo, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>

      {/* ══ CARD 3: Endereço ══ */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Endereço
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CEP */}
          <div className="space-y-1.5">
            <label className={labelCls}>CEP</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => set("zipCode", maskCep(e.target.value))}
                onBlur={(e) => fetchCep(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className={`${inputCls} pl-10 pr-10`}
              />
              {cepLoading ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
              ) : (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
              )}
            </div>
            <p className="text-xs text-zinc-400">Preenchimento automático ao sair do campo.</p>
          </div>

          {/* Logradouro */}
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelCls}>Logradouro (Rua / Avenida)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Rua Capitão Antônio José"
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>

          {/* Número */}
          <div className="space-y-1.5">
            <label className={labelCls}>Número</label>
            <input
              type="text"
              value={form.streetNumber}
              onChange={(e) => set("streetNumber", e.target.value)}
              placeholder="810"
              className={inputCls}
            />
          </div>

          {/* Complemento */}
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelCls}>Complemento</label>
            <input
              type="text"
              value={form.streetComplement}
              onChange={(e) => set("streetComplement", e.target.value)}
              placeholder="Sala 2, Bloco A, etc."
              className={inputCls}
            />
          </div>

          {/* Bairro */}
          <div className="space-y-1.5">
            <label className={labelCls}>Bairro</label>
            <input
              type="text"
              value={form.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
              placeholder="Centro"
              className={inputCls}
            />
          </div>

          {/* Cidade */}
          <div className="space-y-1.5">
            <label className={labelCls}>Cidade</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Curitiba"
              className={inputCls}
            />
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <label className={labelCls}>Estado</label>
            <select
              value={form.state}
              onChange={(e) => set("state", e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione</option>
              {[
                "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
                "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
                "RS","RO","RR","SC","SP","SE","TO",
              ].map(uf => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Botão salvar ── */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
          ) : (
            <><Save className="w-4 h-4" /> Salvar Meu Negócio</>
          )}
        </button>
      </div>
    </div>
  );
}
