"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/auth";
import {
  Building2, Phone, Mail, Instagram, FileText, MapPin,
  Lock, Save, Camera, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, KeyRound, Search, User, X,
} from "lucide-react";

/* ─── tipos ─────────────────────────────────────────────── */
interface ProfileData {
  name: string;
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
  // logo
  logoUrl: string;
}

const EMPTY: ProfileData = {
  name: "", phone: "", contactEmail: "", instagram: "", cnpj: "",
  ownerName: "", ownerEmail: "",
  zipCode: "", address: "", streetNumber: "", streetComplement: "",
  neighborhood: "", city: "", state: "",
  logoUrl: "",
};

/* ─── máscara CNPJ ──────────────────────────────────────── */
function maskCnpj(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/* ─── máscara CEP ───────────────────────────────────────── */
function maskCep(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
}

/* ─── máscara Telefone ─────────────────────────────────── */
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

  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [cepLoading, setCepLoading] = useState(false);

  // upload foto
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgLoading, setImgLoading] = useState(false);

  // modal de senha
  const [pwdModal, setPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  /* ── carrega ── */
  useEffect(() => {
    if (!token) return;
    fetch("/api/barbershop/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setForm({
            name: d.name ?? "",
            phone: d.phone ?? "",
            contactEmail: d.contactEmail ?? "",
            instagram: d.instagram ?? "",
            cnpj: d.cnpj ?? "",
            ownerName: d.ownerName ?? "",
            ownerEmail: d.ownerEmail ?? "",
            zipCode: d.zipCode ?? "",
            address: d.address ?? "",
            streetNumber: d.streetNumber ?? "",
            streetComplement: d.streetComplement ?? "",
            neighborhood: d.neighborhood ?? "",
            city: d.city ?? "",
            state: d.state ?? "",
            logoUrl: d.logoUrl ?? "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof ProfileData, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  /* ── busca CEP ── */
  const fetchCep = useCallback(async (raw: string) => {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((f) => ({
          ...f,
          address: data.logradouro ?? f.address,
          neighborhood: data.bairro ?? f.neighborhood,
          city: data.localidade ?? f.city,
          state: data.uf ?? f.state,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }, []);

  /* ── upload foto ── */
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
      setForm((f) => ({ ...f, logoUrl: b64 }));
    } catch {
      setStatus({ type: "error", msg: "Erro ao processar imagem." });
    } finally {
      setImgLoading(false);
      e.target.value = "";
    }
  }

  /* ── salvar perfil ── */
  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/barbershop/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erro ao salvar");
      }
      setStatus({ type: "success", msg: "Perfil salvo com sucesso!" });
    } catch (e) {
      setStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao salvar" });
    } finally {
      setSaving(false);
    }
  }

  /* ── alterar senha ── */
  async function handlePasswordChange() {
    if (newPwd !== confirmPwd) {
      setPwdStatus({ type: "error", msg: "As senhas não coincidem." });
      return;
    }
    if (newPwd.length < 6) {
      setPwdStatus({ type: "error", msg: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setPwdSaving(true);
    setPwdStatus(null);
    try {
      const res = await fetch("/api/barbershop/profile/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro");
      setPwdStatus({ type: "success", msg: "Senha alterada com sucesso!" });
      setTimeout(() => {
        setPwdModal(false);
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        setPwdStatus(null);
      }, 1500);
    } catch (e) {
      setPwdStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao alterar senha" });
    } finally {
      setPwdSaving(false);
    }
  }

  /* ─── loading ── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-zinc-500 animate-pulse">Carregando perfil…</p>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Meu Negócio</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Informações do seu estabelecimento, endereço e acesso.
          </p>
        </div>
        <button
          onClick={() => setPwdModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          <KeyRound className="w-4 h-4" />
          Alterar Senha
        </button>
      </div>

      {/* ── Status global ── */}
      {status && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-in zoom-in-95 duration-200 ${
            status.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {status.msg}
          <button onClick={() => setStatus(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Foto + nome ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
        <div className="flex items-center gap-6 flex-wrap">
          {/* avatar */}
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center">
              {imgLoading ? (
                <Loader2 className="w-7 h-7 text-zinc-400 animate-spin" />
              ) : form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-10 h-10 text-zinc-300" />
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-md hover:brightness-110 transition-all"
              title="Trocar foto"
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

          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
              Foto do estabelecimento
            </p>
            <p className="text-xs text-zinc-400">
              JPG, PNG ou WebP • máx. 5 MB • redimensionada automaticamente para 400×400 px
            </p>
            {form.logoUrl && (
              <button
                onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Remover foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Informações básicas ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          Informações do Estabelecimento
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Nome do estabelecimento"
            icon={Building2}
            value={form.name}
            onChange={(v) => set("name", v)}
            placeholder="Ex: Barbearia do João"
          />
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

      {/* ── Endereço ── */}
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
              ].map((uf) => (
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
            <><Save className="w-4 h-4" /> Salvar Perfil</>
          )}
        </button>
      </div>

      {/* ══════════════ MODAL ALTERAR SENHA ══════════════ */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-zinc-900">Alterar Senha</h3>
              </div>
              <button
                onClick={() => { setPwdModal(false); setPwdStatus(null); }}
                className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* status */}
            {pwdStatus && (
              <div
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                  pwdStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {pwdStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {pwdStatus.msg}
              </div>
            )}

            {/* campos */}
            <div className="space-y-4">
              {/* senha atual */}
              <div className="space-y-1.5">
                <label className={labelCls}>Senha atual</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* nova senha */}
              <div className="space-y-1.5">
                <label className={labelCls}>Nova senha</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* força da senha */}
                {newPwd.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          newPwd.length >= i * 3
                            ? i <= 2 ? "bg-amber-400" : "bg-emerald-500"
                            : "bg-zinc-200"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-zinc-400 ml-1">
                      {newPwd.length < 6 ? "Fraca" : newPwd.length < 9 ? "Média" : "Forte"}
                    </span>
                  </div>
                )}
              </div>

              {/* confirmar */}
              <div className="space-y-1.5">
                <label className={labelCls}>Confirmar nova senha</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Repita a nova senha"
                    className={`${inputCls} pl-10 ${
                      confirmPwd && confirmPwd !== newPwd ? "border-red-300 focus:ring-red-200" : ""
                    }`}
                  />
                </div>
                {confirmPwd && confirmPwd !== newPwd && (
                  <p className="text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>
            </div>

            {/* actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setPwdModal(false); setPwdStatus(null); }}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwdSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                ) : (
                  <><Lock className="w-4 h-4" /> Alterar Senha</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
