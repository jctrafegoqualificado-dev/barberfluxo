"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Field, Segmented } from "@/components/catalogo/SidePanel";
import { ConfigNav, ConfigSection, type NavSection } from "@/components/config/ConfigNav";

const PRIMARIES: [string, string][] = [["#C94F0C", "Telha"], ["#A16207", "Mostarda"], ["#2F6B4F", "Verde"], ["#1F4E8C", "Azul"], ["#7A2E3A", "Vinho"], ["#1B1916", "Preto"], ["#E0A21B", "Amarelo"]];
const SECONDARIES: [string, string][] = [["#E8B04A", "Dourado"], ["#D9C9A8", "Areia"], ["#8FB996", "Sálvia"], ["#9DB4D9", "Céu"], ["#E7A38B", "Salmão"]];
const SECTIONS: NavSection[] = [
  { id: "dados", label: "Dados da barbearia", hint: "Nome, contato e senha" },
  { id: "horarios", label: "Horários", hint: "Funcionamento e feriados" },
  { id: "agendamento", label: "Agendamento online", hint: "Link, desmarcar e faltas" },
  { id: "descontos", label: "Descontos", hint: "Máximo na comanda" },
];
const HEX = /^#[0-9a-fA-F]{6}$/;

interface Brand { name: string; description: string; logoUrl: string; primaryColor: string; secondaryColor: string; favIconUrl: string }

/** Luminância relativa (WCAG) para decidir texto branco ou escuro sobre a cor. */
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

function resize(file: File, max = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(max / img.width, max / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        // PNG mantém o fundo transparente da logo; o resto vira JPEG (menor)
        resolve(file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MarcaPage() {
  const { token } = useAuthStore();
  const [b, setB] = useState<Brand | null>(null);
  const [b0, setB0] = useState<Brand | null>(null);
  const [favFromLogo, setFavFromLogo] = useState(true);
  const [view, setView] = useState<"client" | "panel">("client");
  const [saving, setSaving] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/barbershop/settings", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).then((s) => {
      const v: Brand = {
        name: s.name ?? "", description: s.description ?? "", logoUrl: s.logoUrl ?? "",
        primaryColor: HEX.test(s.primaryColor ?? "") ? s.primaryColor : "#C94F0C",
        secondaryColor: HEX.test(s.secondaryColor ?? "") ? s.secondaryColor : "#E8B04A",
        favIconUrl: s.favIconUrl ?? "",
      };
      setB(v); setB0(v); setFavFromLogo(!v.favIconUrl);
    }).catch(() => toast.error("Não foi possível carregar a marca."));
  }, [token]);

  if (!b || !b0) return <div className="h-96 rounded-2xl bg-surface-3/60 animate-pulse" />;
  const set = (patch: Partial<Brand>) => setB({ ...b, ...patch });
  const dirty = JSON.stringify(b) !== JSON.stringify(b0);
  const pOk = HEX.test(b.primaryColor);
  const sOk = HEX.test(b.secondaryColor);
  const primary = pOk ? b.primaryColor : b0.primaryColor;
  const secondary = sOk ? b.secondaryColor : b0.secondaryColor;
  const cw = contrastWhite(primary);
  const btnText = cw >= 3 ? "#FFFFFF" : "#1B1916";
  const contrast = cw >= 4.5 ? ["Texto branco fica bem legível nos botões", "bg-positive-soft text-positive"]
    : cw >= 3 ? ["Legível em botões grandes. Para textos pequenos, um tom mais escuro é melhor", "bg-warning-soft text-warning"]
    : ["Cor clara: os botões vão usar texto escuro para dar para ler", "bg-danger-soft text-danger"];
  const initial = (b.name || "B").trim()[0]?.toUpperCase() ?? "B";

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5 MB."); return; }
    setImgLoading(true);
    try { set({ logoUrl: await resize(file) }); } catch { toast.error("Não deu para ler a imagem."); }
    setImgLoading(false);
  }

  async function save() {
    if (!b) return;
    if (!b.name.trim()) { toast.error("Informe o nome da barbearia."); return; }
    if (!pOk || !sOk) { toast.error("Confira o código da cor (formato #RRGGBB)."); return; }
    setSaving(true);
    const r = await fetch("/api/barbershop/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...b, name: b.name.trim(), favIconUrl: favFromLogo ? "" : b.favIconUrl.trim() }),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success("Marca salva. Aplicando as cores…");
    setTimeout(() => window.location.reload(), 900); // o painel lê as cores ao carregar
  }

  const swatch = (list: [string, string][], value: string, onPick: (hex: string) => void, label: string) => (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {list.map(([hex, name]) => {
        const on = value.toLowerCase() === hex.toLowerCase();
        return (
          <button key={hex} type="button" role="radio" aria-checked={on} aria-label={name} title={name} onClick={() => onPick(hex)}
            className={cn("w-11 h-11 rounded-full flex items-center justify-center ring-offset-2 ring-offset-surface", on ? "ring-2 ring-ink" : "hover:ring-2 hover:ring-control")}
            style={{ background: hex }}>
            {on && <Check className="w-5 h-5" style={{ color: contrastWhite(hex) >= 3 ? "#fff" : "#1B1916" }} aria-hidden />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Marca</h1>
          <span className="text-sm text-ink-3">Logo e cores que o cliente vê na página de agendamento, no painel e nos e-mails</span>
        </div>
        <div className="flex gap-2">
          {dirty && <Button variant="outline" onClick={() => { setB(b0); setFavFromLogo(!b0.favIconUrl); }}>Desfazer mudanças</Button>}
          <Button disabled={!dirty} loading={saving} onClick={save}>Salvar marca</Button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ConfigNav current="marca" sections={SECTIONS} />

        <div className="flex-1 min-w-0 w-full grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
          <div className="flex flex-col gap-5 min-w-0">
            <ConfigSection title="Logo e nome" subtitle="É a primeira coisa que o cliente vê ao abrir o seu link">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 text-white font-display text-3xl font-bold" style={{ background: b.logoUrl ? undefined : primary }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {b.logoUrl ? <img src={b.logoUrl} alt="Logo" className="w-full h-full object-cover" /> : initial}
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex gap-2 flex-wrap">
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" />
                    <Button size="sm" variant="outline" loading={imgLoading} onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1.5" aria-hidden />{b.logoUrl ? "Trocar logo" : "Enviar logo"}</Button>
                    {b.logoUrl && <Button size="sm" variant="ghost" onClick={() => set({ logoUrl: "" })}>Remover</Button>}
                  </div>
                  <span className="text-xs text-ink-3">JPG, PNG ou WebP, até 5 MB. A imagem é ajustada para 400 × 400.</span>
                  {!b.logoUrl && <span className="text-xs text-ink-3">Sem logo, aparece a inicial do nome na cor principal.</span>}
                </div>
              </div>
              <Field label="Nome da barbearia" value={b.name} onChange={(e) => set({ name: e.target.value })} />
              <Field label="Frase curta" value={b.description} onChange={(e) => set({ description: e.target.value })} maxLength={80} placeholder="Ex.: Corte e barba na hora marcada" hint="Aparece embaixo do nome na página de agendamento." />
            </ConfigSection>

            <ConfigSection title="Cores" subtitle="Toque numa cor e veja a prévia mudar na hora">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">Cor principal</span>
                  <span className="text-xs text-ink-3">Botões, barra de progresso e o que o cliente escolheu</span>
                </div>
                {swatch(PRIMARIES, b.primaryColor, (hex) => set({ primaryColor: hex }), "Cor principal")}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-control w-[170px]">
                    <span className="w-5 h-5 rounded-full shrink-0" style={{ background: primary }} />
                    <span className="text-xs text-ink-3">Código</span>
                    <input value={b.primaryColor} onChange={(e) => set({ primaryColor: e.target.value.trim() })} aria-label="Código da cor principal" className={cn("flex-1 min-w-0 bg-transparent outline-none text-sm font-mono uppercase", !pOk && "text-danger")} />
                  </label>
                  <span className={cn("text-xs font-semibold rounded-lg px-2.5 py-1.5", contrast[1])}>{contrast[0]}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 border-t border-line-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">Cor de apoio</span>
                  <span className="text-xs text-ink-3">Selos e detalhes, como o &quot;mais pedido&quot; e a estrela da nota</span>
                </div>
                {swatch(SECONDARIES, b.secondaryColor, (hex) => set({ secondaryColor: hex }), "Cor de apoio")}
                <label className="flex items-center gap-2 h-11 px-3 rounded-[10px] border border-control w-[170px]">
                  <span className="w-5 h-5 rounded-full shrink-0" style={{ background: secondary }} />
                  <span className="text-xs text-ink-3">Código</span>
                  <input value={b.secondaryColor} onChange={(e) => set({ secondaryColor: e.target.value.trim() })} aria-label="Código da cor de apoio" className={cn("flex-1 min-w-0 bg-transparent outline-none text-sm font-mono uppercase", !sOk && "text-danger")} />
                </label>
              </div>
            </ConfigSection>

            <ConfigSection title="Ícone da aba do navegador" subtitle="O desenho pequeno que aparece na aba quando o cliente abre o seu link">
              <div className="inline-flex self-start items-center gap-2 h-9 px-3 rounded-t-[10px] bg-surface-3 border border-line-2 border-b-0 max-w-full">
                <span className="w-4 h-4 rounded-[4px] overflow-hidden flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: primary }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {(favFromLogo ? b.logoUrl : b.favIconUrl) ? <img src={favFromLogo ? b.logoUrl : b.favIconUrl} alt="" className="w-full h-full object-cover" /> : initial}
                </span>
                <span className="text-xs truncate">{b.name || "Barbearia"} · Agendar</span>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-line-2 p-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">Usar a logo como ícone</span>
                  <span className="text-[13px] text-ink-3">{favFromLogo ? (b.logoUrl ? "A aba mostra a sua logo." : "Sem logo: a aba mostra a inicial do nome.") : "A aba mostra a imagem do endereço abaixo."}</span>
                </span>
                <button type="button" role="switch" aria-checked={favFromLogo} aria-label="Usar a logo como ícone" onClick={() => setFavFromLogo(!favFromLogo)}
                  className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", favFromLogo ? "bg-positive-strong" : "bg-bar")}>
                  <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", favFromLogo && "translate-x-5")} />
                </button>
              </div>
              {!favFromLogo && <Field label="Endereço da imagem do ícone" type="url" value={b.favIconUrl} onChange={(e) => set({ favIconUrl: e.target.value })} placeholder="https://suabarbearia.com.br/icone.png" hint="Imagem quadrada, em .png ou .ico." />}
            </ConfigSection>
          </div>

          {/* Prévia */}
          <aside aria-label="Prévia da marca" className="xl:sticky xl:top-6 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Prévia</span>
              <Segmented value={view} onChange={setView} label="Onde ver a prévia" options={[["client", "Página do cliente"], ["panel", "Painel"]]} />
            </div>
            {view === "client" ? (
              <div className="rounded-xl bg-ground p-3.5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-white font-display text-xl font-bold shrink-0" style={{ background: b.logoUrl ? undefined : primary }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {b.logoUrl ? <img src={b.logoUrl} alt="" className="w-full h-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-[17px] font-bold truncate">{b.name || "Sua barbearia"}</p>
                    <p className="text-xs text-ink-3 truncate">{b.description || "Sua frase aparece aqui"}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-track"><div className="h-full w-1/3 rounded-full" style={{ background: primary }} /></div>
                {[["Corte + barba", "45 min · R$ 70", true], ["Corte", "30 min · R$ 45", false]].map(([n, sub, picked]) => (
                  <div key={String(n)} className="rounded-xl bg-surface p-3 flex items-center justify-between gap-2" style={{ border: picked ? `2px solid ${primary}` : "1px solid var(--color-line)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-1.5">{n}{picked && <span className="h-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center" style={{ background: secondary, color: contrastWhite(secondary) >= 3 ? "#fff" : "#1B1916" }}>mais pedido</span>}</p>
                      <p className="text-xs text-ink-3">{sub}</p>
                    </div>
                    <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: picked ? primary : "var(--color-control)", background: picked ? primary : undefined }}>
                      {picked && <Check className="w-3 h-3" style={{ color: btnText }} aria-hidden />}
                    </span>
                  </div>
                ))}
                <p className="text-xs text-ink-2 flex items-center gap-1"><span style={{ color: secondary }}>★</span> 9,4 · 120 avaliações</p>
                <div className="h-11 rounded-[10px] flex items-center justify-center text-sm font-semibold" style={{ background: primary, color: btnText }}>Escolher horário</div>
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden flex h-[300px] border border-line-2">
                <div className="w-[120px] bg-night p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 pb-2">
                    <div className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: primary }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {b.logoUrl ? <img src={b.logoUrl} alt="" className="w-full h-full object-cover" /> : initial}
                    </div>
                    <span className="text-[10px] font-semibold text-white truncate">{b.name || "Barbearia"}</span>
                  </div>
                  {["Início", "Agenda", "Clientes", "Caixa"].map((x, i) => (
                    <span key={x} className="h-6 px-1.5 rounded text-[10px] flex items-center" style={i === 1 ? { background: "rgba(255,255,255,0.08)", color: primary, fontWeight: 700 } : { color: "#C9C2B6" }}>{x}</span>
                  ))}
                </div>
                <div className="flex-1 bg-ground p-3 flex flex-col gap-2">
                  <span className="font-display text-sm font-bold">Agenda</span>
                  <div className="h-7 self-start px-2.5 rounded-md text-[10px] font-semibold flex items-center" style={{ background: primary, color: btnText }}>+ Novo agendamento</div>
                  <div className="rounded-md bg-surface border-l-[3px] p-2 text-[10px]" style={{ borderLeftColor: primary }}><strong>14:30</strong> Rafael · Corte + barba</div>
                  <div className="rounded-md bg-surface p-2 text-[10px] border border-line-2"><strong>15:15</strong> Bruno · Barba</div>
                </div>
              </div>
            )}
            <span className="text-xs text-ink-3">As cores valem para o painel de todos da equipe e para a sua página de agendamento.</span>
          </aside>
        </div>
      </div>
    </div>
  );
}
