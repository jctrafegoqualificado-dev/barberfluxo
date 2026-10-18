"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfigSection, Pills } from "@/components/config/ConfigNav";
import { Switch, fieldCls } from "@/components/catalogo/SidePanel";
import WhatsAppTabs from "@/components/whatsapp/WhatsAppTabs";
import PhonePreview, { type Bubble } from "@/components/whatsapp/PhonePreview";

const LEADS: [number, string][] = [[30, "30 min"], [60, "1 hora"], [120, "2 horas"], [240, "4 horas"], [720, "12 horas"], [1440, "24 horas"], [2880, "48 horas"]];

// Mesmos textos do cron (src/app/api/cron/reminders/route.ts), para a prévia bater com o que o cliente recebe.
const DEFAULT_MESSAGE = "Olá {{nome}}! 😊\n\nLembramos que você tem um horário de *{{servico}}* marcado para *{{data}}* às *{{hora}}* com *{{profissional}}* no(a) *{{empresa}}*.\n\nAté lá!";
const CONFIRMATION_QUESTION = "Podemos confirmar sua presença? Responda com *SIM* para confirmar ou *NÃO* para cancelar.";

const VARIABLES: [string, string][] = [
  ["{{nome}}", "Nome do cliente"], ["{{servico}}", "Serviço"], ["{{data}}", "Data"], ["{{hora}}", "Horário"],
  ["{{profissional}}", "Profissional"], ["{{empresa}}", "Nome da barbearia"],
];

interface Form { enabled: boolean; minutes: number; message: string; askConfirmation: boolean; notifyBarber: boolean }
interface Stats { sent: number; confirmed: number; cancelledByReply: number; noShows: number; total: number }

/** Exemplo da prévia: horário às 16:00. Diz quando o lembrete chega. */
function arrival(minutes: number) {
  const total = 16 * 60 - minutes;
  const daysBefore = total < 0 ? Math.ceil(-total / 1440) : 0;
  const m = ((total % 1440) + 1440) % 1440;
  const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return daysBefore === 0 ? `chega às ${t}` : daysBefore === 1 ? `chega na véspera, às ${t}` : `chega ${daysBefore} dias antes, às ${t}`;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-[14px] px-[18px] py-4 flex flex-col gap-1 min-w-0">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="font-display text-[26px] font-bold leading-tight">
        {value}{sub && <span className="ml-1.5 font-sans text-sm font-medium text-ink-3">{sub}</span>}
      </span>
    </div>
  );
}

export default function LembretesPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopName, setShopName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState<Form>({ enabled: false, minutes: 60, message: "", askConfirmation: true, notifyBarber: true });
  const [saved, setSaved] = useState<Form | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/barbershop/reminders", { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json().catch(() => null);
        if (res.ok && d) {
          const f: Form = {
            enabled: d.reminderEnabled ?? false, minutes: d.reminderMinutes ?? 60, message: d.reminderMessage ?? "",
            askConfirmation: d.reminderAskConfirmation ?? true, notifyBarber: d.notifyBarberOnNewAppointment ?? true,
          };
          setForm(f);
          setSaved(f);
          setShopName(d.name ?? "");
          setStats(d.stats ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = !!saved && JSON.stringify(form) !== JSON.stringify(saved);

  /** Insere a variável onde está o cursor (ou no fim). */
  function insert(tag: string) {
    const el = textRef.current;
    const base = form.message || DEFAULT_MESSAGE;
    const start = el && form.message ? el.selectionStart : base.length;
    const end = el && form.message ? el.selectionEnd : base.length;
    const next = base.slice(0, start) + tag + base.slice(end);
    set("message", next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  }

  // Data de exemplo da prévia: daqui a 2 dias
  const [sample] = useState(() => new Date(Date.now() + 2 * 86_400_000)
    .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }));

  const bubbles = useMemo<Bubble[]>(() => {
    const base = form.message.trim() || DEFAULT_MESSAGE;
    const text = (form.askConfirmation && !/\bSIM\b/i.test(base) ? `${base}\n\n${CONFIRMATION_QUESTION}` : base)
      .replace(/\{\{nome\}\}/g, "Gustavo").replace(/\{\{servico\}\}/g, "Corte degradê").replace(/\{\{data\}\}/g, sample)
      .replace(/\{\{hora\}\}/g, "16:00").replace(/\{\{profissional\}\}/g, "Diego").replace(/\{\{empresa\}\}/g, shopName || "Sua barbearia");
    const b: Bubble[] = [{ from: "shop", text }];
    if (form.askConfirmation) {
      b.push({ from: "client", text: "SIM" }, { from: "shop", text: `Perfeito, Gustavo! Seu horário ${sample.slice(0, 5)} às 16:00 com Diego está confirmado. Até lá! 💈` });
    }
    return b;
  }, [form.message, form.askConfirmation, sample, shopName]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/barbershop/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reminderEnabled: form.enabled, reminderMinutes: form.minutes, reminderMessage: form.message.trim() || null,
          reminderAskConfirmation: form.askConfirmation, notifyBarberOnNewAppointment: form.notifyBarber,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível salvar");
      setSaved(form);
      toast.success("Lembretes salvos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  const header = <WhatsAppTabs current="lembretes" subtitle="Lembretes automáticos para diminuir faltas" />;
  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <div className="h-96 rounded-2xl bg-surface border border-line animate-pulse" />
      </div>
    );
  }

  const month = new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="flex flex-col gap-5">
      {header}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label={`Lembretes enviados em ${month}`} value={String(stats.sent)}
            sub={stats.cancelledByReply ? `${stats.cancelledByReply} ${stats.cancelledByReply === 1 ? "vaga liberada" : "vagas liberadas"} com NÃO` : undefined} />
          <Kpi label="Clientes que confirmaram pela mensagem" value={pct(stats.confirmed, stats.sent)} sub={stats.sent ? `${stats.confirmed} de ${stats.sent}` : undefined} />
          <Kpi label="Faltas no mês" value={String(stats.noShows)} sub={stats.total ? `de ${stats.total} atendimentos · ${pct(stats.noShows, stats.total)}` : undefined} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <ConfigSection title="Lembrete para o cliente" subtitle="Enviado automaticamente pelo WhatsApp antes do horário"
            aside={<Switch checked={form.enabled} onChange={(v) => set("enabled", v)} label="Lembrete para o cliente" />}>
            {!form.enabled ? (
              <p className="text-[13px] text-ink-3">Desligado: ninguém recebe lembrete. Ligue para diminuir as faltas.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-ink-2">Quanto tempo antes</span>
                  <Pills value={form.minutes} onChange={(v) => set("minutes", v)} options={LEADS} label="Antecedência" />
                </div>

                <label className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-ground cursor-pointer">
                  <input type="checkbox" checked={form.askConfirmation} onChange={(e) => set("askConfirmation", e.target.checked)}
                    className="mt-0.5 w-[18px] h-[18px] accent-[#1B1916] shrink-0" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">Pedir confirmação</span>
                    <span className="text-[13px] text-ink-2">
                      O cliente responde SIM ou NÃO. Se disser não, o horário é liberado na agenda e a lista de espera é avisada.
                      Se as suas regras não deixam cancelar, a conversa vai para &quot;Precisa de você&quot;.
                    </span>
                  </span>
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-ink-2">Mensagem</span>
                  <textarea ref={textRef} rows={5} aria-label="Mensagem do lembrete" value={form.message} placeholder={DEFAULT_MESSAGE}
                    onChange={(e) => set("message", e.target.value)} className={cn(fieldCls, "h-auto py-3 resize-none leading-relaxed")} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-ink-3">Toque para inserir:</span>
                    {VARIABLES.map(([tag, desc]) => (
                      <button key={tag} type="button" title={desc} onClick={() => insert(tag)}
                        className="h-[30px] px-2.5 rounded-lg border border-dashed border-bar bg-surface text-xs font-semibold hover:bg-surface-2">
                        {desc}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-ink-3">
                    Em branco, usa a mensagem padrão.{" "}
                    {form.message && (
                      <button type="button" onClick={() => set("message", "")} className="font-semibold text-ink-2 underline">Voltar para a padrão</button>
                    )}
                  </span>
                </div>
              </>
            )}
          </ConfigSection>

          <section aria-labelledby="bar-t" className="bg-surface border border-line rounded-2xl px-5 md:px-6 py-5 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h2 id="bar-t" className="text-[17px] font-semibold">Avisar o barbeiro</h2>
              <span className="text-[13px] text-ink-3">
                O barbeiro recebe uma mensagem quando marcam com ele (pelo link, pelo painel ou pela IA). Não avisa quando é ele mesmo que marca.
              </span>
            </div>
            <Switch checked={form.notifyBarber} onChange={(v) => set("notifyBarber", v)} label="Avisar o barbeiro" />
          </section>
        </div>

        <aside aria-label="Prévia do lembrete" className="flex flex-col gap-3 lg:sticky lg:top-6">
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[15px] font-semibold">Como o cliente recebe</span>
            {form.enabled && <span className="text-xs text-ink-3">Horário às 16:00 · {arrival(form.minutes)}</span>}
          </div>
          <div className={cn(!form.enabled && "opacity-50")}>
            <PhonePreview name={shopName || "Sua barbearia"} bubbles={bubbles} />
          </div>
          <p className="text-xs text-ink-3">Para enviar, o WhatsApp da barbearia precisa estar conectado.</p>
          <Button onClick={save} loading={saving} disabled={!dirty} className="h-[46px]">
            {dirty ? "Salvar lembretes" : "Tudo salvo"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
