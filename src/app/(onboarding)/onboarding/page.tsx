"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import {
  Scissors, Building2, Palette, Clock, Sparkles, Users,
  Check, ChevronRight, ChevronLeft, Copy, ExternalLink,
  Plus, Trash2, Upload, X, Loader2,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Hour { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }
interface ServiceTemplate { id: string; name: string; price: number; duration: number; selected: boolean; customPrice: string; customDuration: string }
interface CustomService { name: string; price: string; duration: string }

// ─── Constantes ──────────────────────────────────────────────────────────────
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const COLOR_PALETTE = [
  { hex: "#f59e0b", name: "Dourado" },
  { hex: "#ef4444", name: "Vermelho" },
  { hex: "#3b82f6", name: "Azul Royal" },
  { hex: "#10b981", name: "Verde" },
  { hex: "#8b5cf6", name: "Roxo" },
  { hex: "#ec4899", name: "Rosa" },
  { hex: "#f97316", name: "Laranja" },
  { hex: "#06b6d4", name: "Ciano" },
  { hex: "#1f2937", name: "Preto" },
  { hex: "#6366f1", name: "Índigo" },
];

const SERVICE_TEMPLATES: Omit<ServiceTemplate, "selected" | "customPrice" | "customDuration">[] = [
  { id: "corte", name: "Corte Masculino", price: 50, duration: 30 },
  { id: "barba", name: "Barba Completa", price: 35, duration: 25 },
  { id: "combo", name: "Corte + Barba", price: 80, duration: 50 },
  { id: "pigmentacao", name: "Pigmentação", price: 25, duration: 15 },
  { id: "hidratacao", name: "Hidratação Capilar", price: 60, duration: 45 },
  { id: "sobrancelha", name: "Design de Sobrancelha", price: 20, duration: 15 },
];

const STEPS = [
  { icon: Building2, label: "Negócio" },
  { icon: Palette, label: "Visual" },
  { icon: Clock, label: "Horários" },
  { icon: Sparkles, label: "Serviços" },
  { icon: Users, label: "Equipe" },
  { icon: Check, label: "Pronto!" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resizeImage(file: File, maxPx = 400): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — Negócio
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [instagram, setInstagram] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);

  // Step 2 — Visual
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Horários
  const [hours, setHours] = useState<Hour[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      isOpen: i >= 1 && i <= 6,
      openTime: "09:00",
      closeTime: "20:00",
    }))
  );

  // Step 4 — Serviços
  const [templates, setTemplates] = useState<ServiceTemplate[]>(
    SERVICE_TEMPLATES.map((t) => ({
      ...t,
      selected: ["corte", "barba", "combo"].includes(t.id),
      customPrice: String(t.price),
      customDuration: String(t.duration),
    }))
  );
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: "", price: "", duration: "" });

  // Step 5 — Equipe
  const [workAlone, setWorkAlone] = useState(true);
  const [barberName, setBarberName] = useState("");
  const [barberEmail, setBarberEmail] = useState("");
  const [barberPassword, setBarberPassword] = useState("");
  const [barberCommission, setBarberCommission] = useState("50");

  // Step 6 — Conclusão
  const [bookingLink, setBookingLink] = useState("");
  const [copied, setCopied] = useState(false);

  // ─── Carrega dados existentes ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch("/api/barbershop/settings", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/barbershop/profile", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/barbershop/horarios", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([settings, profile, horariosData]) => {
      if (settings.name) setShopName(settings.name);
      if (settings.primaryColor) setPrimaryColor(settings.primaryColor);
      if (settings.logoUrl) setLogoUrl(settings.logoUrl);
      if (settings.description) setDescription(settings.description);
      if (profile.phone) setPhone(profile.phone);
      if (profile.zipCode) setZipCode(profile.zipCode);
      if (profile.city) setCity(profile.city);
      if (profile.state) setState(profile.state);
      if (profile.instagram) setInstagram(profile.instagram);
      if (horariosData.hours?.length) {
        const map: Record<number, Hour> = {};
        horariosData.hours.forEach((h: Hour) => { map[h.dayOfWeek] = h; });
        setHours(Array.from({ length: 7 }, (_, i) => map[i] ?? {
          dayOfWeek: i, isOpen: i >= 1 && i <= 6, openTime: "09:00", closeTime: "20:00"
        }));
      }
      // Link de agendamento
      if (profile.slug) setBookingLink(`${window.location.origin}/${profile.slug}`);
    });
  }, [token]);

  // ─── Auto-fill CEP ────────────────────────────────────────────────────────
  async function fetchCep(cep: string) {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (!d.erro) { setCity(d.localidade); setState(d.uf); }
    } finally { setLoadingCep(false); }
  }

  // ─── Handlers de imagem ───────────────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await resizeImage(file);
    setLogoUrl(base64);
  }

  // ─── Ações de horário ─────────────────────────────────────────────────────
  function updateHour(dayOfWeek: number, field: keyof Hour, value: boolean | string) {
    setHours(h => h.map(d => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d));
  }

  function copyHoursToAll() {
    const first = hours.find(h => h.isOpen);
    if (!first) return;
    setHours(h => h.map(d => d.isOpen ? { ...d, openTime: first.openTime, closeTime: first.closeTime } : d));
  }

  // ─── Save por step ────────────────────────────────────────────────────────
  async function saveStep1() {
    await fetch("/api/barbershop/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: shopName, phone, zipCode, city, state, instagram }),
    });
    // Atualiza também o nome no settings
    await fetch("/api/barbershop/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: shopName }),
    });
  }

  async function saveStep2() {
    await fetch("/api/barbershop/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ primaryColor, secondaryColor: primaryColor, logoUrl, description }),
    });
  }

  async function saveStep3() {
    await fetch("/api/barbershop/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hours }),
    });
  }

  async function saveStep4() {
    const servicesToCreate = [
      ...templates.filter(t => t.selected).map(t => ({
        name: t.name,
        price: Number(t.customPrice) || t.price,
        duration: Number(t.customDuration) || t.duration,
      })),
      ...customServices.filter(s => s.name && s.price && s.duration).map(s => ({
        name: s.name,
        price: Number(s.price),
        duration: Number(s.duration),
      })),
    ];
    await Promise.all(servicesToCreate.map(svc =>
      fetch("/api/barbershop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(svc),
      })
    ));
  }

  async function saveStep5AndComplete() {
    const body = workAlone
      ? { workAlone: true }
      : { workAlone: false, barberName, barberEmail, barberPassword, barberCommission: Number(barberCommission) };

    const r = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("Erro ao finalizar equipe");
  }

  async function goNext() {
    setError("");
    setSaving(true);
    try {
      if (step === 0) await saveStep1();
      if (step === 1) await saveStep2();
      if (step === 2) await saveStep3();
      if (step === 3) {
        const hasService = templates.some(t => t.selected) || customServices.some(s => s.name && s.price && s.duration);
        if (!hasService) { setError("Adicione pelo menos 1 serviço para continuar."); return; }
        await saveStep4();
      }
      if (step === 4) {
        if (!workAlone && (!barberName || !barberEmail || !barberPassword)) {
          setError("Preencha nome, e-mail e senha do profissional.");
          return;
        }
        await saveStep5AndComplete();
        // Carrega o link de agendamento
        const profileRes = await fetch("/api/barbershop/profile", { headers: { Authorization: `Bearer ${token}` } });
        const profileData = await profileRes.json();
        if (profileData.slug) setBookingLink(`${window.location.origin}/${profileData.slug}`);
      }
      setStep(s => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(bookingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Render steps ─────────────────────────────────────────────────────────
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-zinc-900 text-sm">IaDeBarbearia</span>
        </div>
        <span className="text-xs text-zinc-400">Configuração inicial</span>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-zinc-100 px-4 py-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    done ? "bg-green-500 text-white"
                    : active ? "bg-amber-500 text-white ring-4 ring-amber-100"
                    : "bg-zinc-100 text-zinc-400"
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block ${
                    active ? "text-amber-600" : done ? "text-green-600" : "text-zinc-400"
                  }`}>{s.label}</span>
                  {i < STEPS.length - 1 && (
                    <div className={`hidden sm:block absolute`} />
                  )}
                </div>
              );
            })}
          </div>
          {/* barra de progresso */}
          <div className="mt-3 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-500 rounded-full"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl">

          {/* ── STEP 0: Seu Negócio ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Bem-vindo! Vamos configurar sua barbearia 💈</h1>
                <p className="text-zinc-500 mt-1 text-sm">Comece com as informações básicas do seu negócio.</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do estabelecimento</label>
                  <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="Ex: Barbearia do João"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">WhatsApp de contato</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(41) 99999-9999" type="tel"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">CEP <span className="text-zinc-400 font-normal">(para localização)</span></label>
                  <div className="relative">
                    <input
                      value={zipCode}
                      onChange={e => setZipCode(e.target.value)}
                      onBlur={e => fetchCep(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 pr-10"
                    />
                    {loadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-zinc-400" />}
                  </div>
                  {city && state && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {city} — {state}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Instagram <span className="text-zinc-400 font-normal">(opcional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">@</span>
                    <input value={instagram.replace("@", "")} onChange={e => setInstagram(e.target.value)} placeholder="suabarbearia"
                      className="w-full rounded-xl border border-zinc-200 pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 1: Identidade Visual ───────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Identidade visual 🎨</h1>
                <p className="text-zinc-500 mt-1 text-sm">Personalize as cores e o logo que seus clientes verão.</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-5">
                {/* Paleta de cores */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Cor principal da barbearia</label>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => setPrimaryColor(c.hex)}
                        title={c.name}
                        className={`h-10 rounded-xl transition-transform ${primaryColor === c.hex ? "ring-3 ring-offset-2 ring-zinc-400 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500">Cor personalizada:</label>
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-10 h-8 rounded-lg border border-zinc-200 cursor-pointer p-0.5" />
                    <span className="text-xs font-mono text-zinc-600">{primaryColor}</span>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: `${primaryColor}18` }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                    <Scissors className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">{shopName || "Sua Barbearia"}</p>
                    <p className="text-xs" style={{ color: primaryColor }}>Agendamento online</p>
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Logo <span className="text-zinc-400 font-normal">(opcional)</span></label>
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <div className="relative">
                        <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-zinc-200" />
                        <button onClick={() => setLogoUrl(null)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-300">
                        <Scissors className="w-6 h-6" />
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                      <Upload className="w-4 h-4" /> {logoUrl ? "Trocar logo" : "Enviar logo"}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição curta <span className="text-zinc-400 font-normal">(opcional)</span></label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                    placeholder="Ex: Barbearia masculina especializada em cortes modernos e barba..."
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Horários ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Horários de funcionamento 🕘</h1>
                <p className="text-zinc-500 mt-1 text-sm">Defina em quais dias e horários sua barbearia atende.</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-50 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Dias da semana</span>
                  <button onClick={copyHoursToAll} className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Aplicar horário a todos os dias abertos
                  </button>
                </div>
                <div className="divide-y divide-zinc-50">
                  {hours.map((h) => (
                    <div key={h.dayOfWeek} className={`flex items-center gap-3 px-5 py-3 transition-colors ${!h.isOpen ? "opacity-50" : ""}`}>
                      <button
                        onClick={() => updateHour(h.dayOfWeek, "isOpen", !h.isOpen)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${h.isOpen ? "bg-amber-500" : "bg-zinc-200"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${h.isOpen ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      <span className="w-14 text-sm font-medium text-zinc-700">{DAYS[h.dayOfWeek]}</span>
                      {h.isOpen ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={h.openTime} onChange={e => updateHour(h.dayOfWeek, "openTime", e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <span className="text-zinc-400 text-xs">até</span>
                          <input type="time" value={h.closeTime} onChange={e => updateHour(h.dayOfWeek, "closeTime", e.target.value)}
                            className="flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 flex-1">Fechado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Serviços ────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Serviços oferecidos ✂️</h1>
                <p className="text-zinc-500 mt-1 text-sm">Selecione os serviços do seu cardápio. Você pode ajustar preços depois.</p>
              </div>
              <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-50">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Serviços sugeridos</span>
                </div>
                <div className="divide-y divide-zinc-50">
                  {templates.map(t => (
                    <div key={t.id} className={`px-5 py-3.5 transition-colors ${t.selected ? "bg-amber-50/50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setTemplates(ts => ts.map(s => s.id === t.id ? { ...s, selected: !s.selected } : s))}
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${t.selected ? "bg-amber-500 border-amber-500 text-white" : "border-zinc-300"}`}>
                          {t.selected && <Check className="w-3 h-3" />}
                        </button>
                        <span className={`flex-1 text-sm font-medium ${t.selected ? "text-zinc-900" : "text-zinc-500"}`}>{t.name}</span>
                        {t.selected && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-zinc-400">R$</span>
                              <input type="number" value={t.customPrice}
                                onChange={e => setTemplates(ts => ts.map(s => s.id === t.id ? { ...s, customPrice: e.target.value } : s))}
                                className="w-16 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            </div>
                            <div className="flex items-center gap-1">
                              <input type="number" value={t.customDuration}
                                onChange={e => setTemplates(ts => ts.map(s => s.id === t.id ? { ...s, customDuration: e.target.value } : s))}
                                className="w-14 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-amber-400" />
                              <span className="text-xs text-zinc-400">min</span>
                            </div>
                          </div>
                        )}
                        {!t.selected && (
                          <span className="text-xs text-zinc-400">{t.duration}min · R${t.price}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Serviços personalizados */}
                {customServices.length > 0 && (
                  <div className="border-t border-zinc-100">
                    {customServices.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-5 py-3 bg-amber-50/30">
                        <span className="flex-1 text-sm font-medium text-zinc-900">{s.name}</span>
                        <span className="text-xs text-zinc-500">R${s.price} · {s.duration}min</span>
                        <button onClick={() => setCustomServices(cs => cs.filter((_, j) => j !== i))}
                          className="p-1 text-zinc-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-5 py-3 border-t border-zinc-50">
                  {showAddCustom ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input placeholder="Nome do serviço" value={newSvc.name} onChange={e => setNewSvc(s => ({ ...s, name: e.target.value }))}
                          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1">
                          <span className="text-xs text-zinc-400 shrink-0">R$</span>
                          <input type="number" placeholder="Preço" value={newSvc.price} onChange={e => setNewSvc(s => ({ ...s, price: e.target.value }))}
                            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <input type="number" placeholder="Minutos" value={newSvc.duration} onChange={e => setNewSvc(s => ({ ...s, duration: e.target.value }))}
                            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                          <span className="text-xs text-zinc-400 shrink-0">min</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setShowAddCustom(false); setNewSvc({ name: "", price: "", duration: "" }); }}
                          className="flex-1 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50">Cancelar</button>
                        <button onClick={() => {
                          if (newSvc.name && newSvc.price && newSvc.duration) {
                            setCustomServices(cs => [...cs, newSvc]);
                            setNewSvc({ name: "", price: "", duration: "" });
                            setShowAddCustom(false);
                          }
                        }} className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600">Adicionar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddCustom(true)}
                      className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium w-full">
                      <Plus className="w-4 h-4" /> Adicionar serviço personalizado
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Equipe ───────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Sua equipe 👤</h1>
                <p className="text-zinc-500 mt-1 text-sm">Quem vai realizar os atendimentos?</p>
              </div>

              {/* Toggle trabalha sozinho */}
              <div className="bg-white rounded-2xl border border-zinc-100 p-5 space-y-4">
                <button
                  onClick={() => setWorkAlone(true)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${workAlone ? "border-amber-400 bg-amber-50" : "border-zinc-100 hover:border-zinc-200"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${workAlone ? "border-amber-500" : "border-zinc-300"}`}>
                    {workAlone && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">Trabalho sozinho</p>
                    <p className="text-xs text-zinc-500">Você será o único profissional da barbearia</p>
                  </div>
                </button>

                <button
                  onClick={() => setWorkAlone(false)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-colors text-left ${!workAlone ? "border-amber-400 bg-amber-50" : "border-zinc-100 hover:border-zinc-200"}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${!workAlone ? "border-amber-500" : "border-zinc-300"}`}>
                    {!workAlone && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 text-sm">Tenho equipe</p>
                    <p className="text-xs text-zinc-500">Adicione o primeiro profissional agora</p>
                  </div>
                </button>

                {/* Formulário de barbeiro */}
                {!workAlone && (
                  <div className="space-y-3 pt-2 border-t border-zinc-100">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Dados do 1º profissional</p>
                    <input placeholder="Nome completo" value={barberName} onChange={e => setBarberName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input placeholder="E-mail de acesso" type="email" value={barberEmail} onChange={e => setBarberEmail(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <input placeholder="Senha de acesso" type="password" value={barberPassword} onChange={e => setBarberPassword(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Comissão: <strong>{barberCommission}%</strong></label>
                      <input type="range" min="0" max="100" step="5" value={barberCommission} onChange={e => setBarberCommission(e.target.value)}
                        className="w-full accent-amber-500" />
                      <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
                        <span>0%</span><span>50%</span><span>100%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 5: Conclusão ────────────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="text-center py-2">
                <div className="inline-flex w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-2xl font-bold text-zinc-900">Tudo pronto! 🎉</h1>
                <p className="text-zinc-500 mt-1 text-sm">Sua barbearia está configurada. Compartilhe o link com seus clientes.</p>
              </div>

              {/* Resumo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl border border-zinc-100 p-4">
                  <Building2 className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-xs text-zinc-500">Estabelecimento</p>
                  <p className="font-semibold text-zinc-900 text-sm truncate">{shopName}</p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-100 p-4">
                  <Clock className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-xs text-zinc-500">Dias abertos</p>
                  <p className="font-semibold text-zinc-900 text-sm">{hours.filter(h => h.isOpen).map(h => DAYS_SHORT[h.dayOfWeek]).join(", ")}</p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-100 p-4">
                  <Sparkles className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-xs text-zinc-500">Serviços</p>
                  <p className="font-semibold text-zinc-900 text-sm">
                    {templates.filter(t => t.selected).length + customServices.length} serviço{(templates.filter(t => t.selected).length + customServices.length) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-zinc-100 p-4">
                  <Users className="w-5 h-5 text-amber-500 mb-2" />
                  <p className="text-xs text-zinc-500">Profissionais</p>
                  <p className="font-semibold text-zinc-900 text-sm">{workAlone ? "Você mesmo" : barberName}</p>
                </div>
              </div>

              {/* Link de agendamento */}
              {bookingLink && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Seu link de agendamento</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-sm font-mono text-zinc-800 bg-white rounded-xl px-3 py-2 border border-amber-200 truncate">{bookingLink}</p>
                    <button onClick={copyLink}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${copied ? "bg-green-500 text-white" : "bg-amber-500 text-white hover:bg-amber-600"}`}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                    <a href={bookingLink} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 p-2 rounded-xl border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push("/painel")}
                className="w-full py-3.5 rounded-2xl bg-zinc-900 text-white font-bold text-sm hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                Entrar no painel <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── Erro e navegação ─────────────────────────────────────────── */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {!isLastStep && (
            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <button onClick={() => { setStep(s => s - 1); setError(""); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
                  <ChevronLeft className="w-4 h-4" /> Voltar
                </button>
              )}
              <button
                onClick={goNext}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-60 transition-colors"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : <>{step === 4 ? "Concluir configuração" : "Próximo"} <ChevronRight className="w-4 h-4" /></>
                }
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
