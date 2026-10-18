"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Segmented } from "@/components/catalogo/SidePanel";
import WhatsAppManager from "./WhatsAppManager";
import WhatsAppTabs from "./WhatsAppTabs";

interface Conv {
  id: string; name: string; phone: string | null; lastMessage: string | null; lastFromMe: boolean; at: string | null;
  status: "human" | "booked" | "ai"; handoffReason: string | null; booked: { startTime: string; date: string } | null;
}
interface Resumo {
  connection: { status: string; lastConnectedAt: string | null; lastMessageAt: string | null; phone: string | null };
  ai: { on: boolean; name: string | null };
  today: { conversations: number; aiBooked: number; aiBookedValue: number; needYou: number };
  conversations: Conv[];
}
interface Msg { id: string; fromMe: boolean; textContent: string | null; messageType: string; timestamp: string }
type Filter = "all" | "human" | "booked";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
function ago(iso: string | null) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h}h` : new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const STATUS: Record<Conv["status"], [string, string]> = {
  human: ["Precisa de você", "bg-danger-soft text-danger"],
  booked: ["Marcou horário", "bg-positive-soft text-positive"],
  ai: ["IA respondendo", "bg-surface-2 text-ink-2"],
};

export default function WhatsAppOverview() {
  const { token } = useAuthStore();
  const [d, setD] = useState<Resumo | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/barbershop/whatsapp/resumo", { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => null);
    if (r.ok && data) setD(data);
  }, [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // conversas chegam a qualquer momento
    return () => clearInterval(t);
  }, [load]);

  // Abre sozinho quem precisa de você (no computador)
  useEffect(() => {
    if (!d || open) return;
    const first = d.conversations.find((c) => c.status === "human");
    if (first && window.matchMedia("(min-width: 1280px)").matches) setOpen(first.id);
  }, [d, open]);

  async function toggleAi(on: boolean) {
    setAiBusy(true);
    const r = await fetch("/api/barbershop/whatsapp/resumo", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ aiAtendimentoAtivo: on }) });
    setAiBusy(false);
    if (!r.ok) { toast.error("Não deu certo. Tente de novo."); return; }
    setD((x) => x && { ...x, ai: { ...x.ai, on } });
    toast.success(on ? "Atendente de IA ligado" : "Atendente de IA desligado: ninguém responde sozinho no WhatsApp");
  }

  const list = (d?.conversations ?? []).filter((c) => filter === "all" || c.status === filter);
  const connected = d?.connection.status === "CONNECTED";

  return (
    <div className="flex flex-col gap-5">
      <WhatsAppTabs current="geral" />

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <section aria-labelledby="con-t" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="con-t" className="text-[17px] font-semibold">Conexão</h2>
            {d && (
              <span className={cn("h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5", connected ? "bg-positive-soft text-positive" : "bg-danger-soft text-danger")}>
                <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-positive" : "bg-danger")} />{connected ? "Conectado" : "Desconectado"}
              </span>
            )}
          </div>
          {connected && d?.connection.lastMessageAt && <span className="text-xs text-ink-3">Última mensagem {ago(d.connection.lastMessageAt)}</span>}
          <WhatsAppManager embedded />
          <span className="text-xs text-ink-3">Se o celular ficar sem internet por muito tempo, a conexão cai. Volte aqui para reconectar.</span>
        </section>

        <section aria-labelledby="ia-t" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="ia-t" className="text-[17px] font-semibold flex items-center gap-2"><Bot className="w-5 h-5 text-ink-3" aria-hidden />Atendente de IA</h2>
            {d && (
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                {d.ai.on ? "Ligado" : "Desligado"}
                <button type="button" role="switch" aria-checked={d.ai.on} aria-label="Atendente de IA ligado" disabled={aiBusy} onClick={() => toggleAi(!d.ai.on)}
                  className={cn("relative w-11 h-6 rounded-full transition-colors disabled:opacity-50", d.ai.on ? "bg-positive-strong" : "bg-bar")}>
                  <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", d.ai.on && "translate-x-5")} />
                </button>
              </span>
            )}
          </div>
          <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Hoje, até agora</span>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              [d?.today.conversations, "conversas"],
              [d?.today.aiBooked, "horários marcados pela IA"],
              [d?.today.needYou, "precisam de você"],
            ].map(([v, l], i) => (
              <div key={String(l)} className={cn("rounded-xl p-3 flex flex-col gap-0.5", i === 2 && (d?.today.needYou ?? 0) > 0 ? "bg-danger-soft" : "bg-ground")}>
                <span className={cn("font-display text-[26px] font-bold leading-none", i === 2 && (d?.today.needYou ?? 0) > 0 && "text-danger")}>{v ?? "—"}</span>
                <span className="text-xs text-ink-3">{l}</span>
              </div>
            ))}
          </div>
          {d && d.today.aiBookedValue > 0 && <span className="text-[13px] text-ink-2"><strong className="text-ink">{formatCurrency(d.today.aiBookedValue)}</strong> em horários marcados pela IA hoje.</span>}
          {d && !d.ai.on && <span className="text-[13px] text-warning bg-warning-soft rounded-lg px-3 py-2">Com a IA desligada, ninguém responde sozinho: as mensagens ficam para a barbearia.</span>}
        </section>
      </div>

      <div className="flex gap-5 items-start">
        <section aria-labelledby="conv-t" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
            <h2 id="conv-t" className="text-[15px] font-semibold">Conversas de hoje</h2>
            <Segmented value={filter} onChange={setFilter} label="Filtrar conversas"
              options={[["all", `Todas · ${d?.conversations.length ?? 0}`], ["human", `Precisam de você · ${d?.today.needYou ?? 0}`], ["booked", "Marcaram"]]} />
          </div>
          {!d ? <div className="h-48 animate-pulse bg-surface-3/50" /> : list.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-3">{filter === "human" ? "Ninguém esperando a barbearia. 👏" : connected ? "Nenhuma conversa hoje ainda." : "Conecte o WhatsApp para ver as conversas."}</p>
          ) : (
            <div className="divide-y divide-line-3">
              {list.map((c) => (
                <button key={c.id} type="button" onClick={() => setOpen(c.id)} aria-current={open === c.id || undefined}
                  className={cn("w-full text-left flex items-center gap-3 px-4 py-3 min-h-[64px]", open === c.id ? "bg-primary/[0.07]" : "hover:bg-surface-3/50")}>
                  <div className={cn("w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center shrink-0", c.status === "human" ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-2")}>{getInitials(c.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="flex justify-between gap-2 text-sm"><span className="font-semibold truncate">{c.name}</span><span className="text-xs text-ink-3 shrink-0">{c.at ? hhmm(c.at) : ""}</span></p>
                    <p className="text-xs text-ink-3 truncate">
                      {c.status === "human" && c.handoffReason ? `${c.handoffReason} · ` : c.booked ? `Marcou ${c.booked.startTime} · ` : ""}
                      {c.lastFromMe ? "Você: " : ""}{c.lastMessage ?? "(mídia)"}
                    </p>
                  </div>
                  <span className={cn("h-6 px-2.5 rounded-full text-[11px] font-semibold inline-flex items-center whitespace-nowrap shrink-0", STATUS[c.status][1])}>{STATUS[c.status][0]}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {open && (
          <div className="hidden xl:block w-[400px] shrink-0 sticky top-6">
            <Conversa key={open} contactId={open} onChanged={load} onClose={() => setOpen(null)} />
          </div>
        )}
      </div>

      {open && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(null)} />
          <div className="relative w-full sm:max-w-lg sm:mx-4 max-h-[92vh] flex">
            <Conversa key={open} contactId={open} onChanged={load} onClose={() => setOpen(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Conversa({ contactId, onChanged, onClose }: { contactId: string; onChanged: () => void; onClose: () => void }) {
  const { token } = useAuthStore();
  const [c, setC] = useState<{ name: string; phone: string | null; paused: boolean; handoffReason: string | null } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const h = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const r = await fetch(`/api/barbershop/whatsapp/conversa?contactId=${contactId}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => null);
    if (r.ok && d) { setC(d.contact); setMsgs(d.messages); }
  }, [contactId, token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const r = await fetch("/api/barbershop/whatsapp/conversa", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ contactId, text }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível enviar."); return; }
    setMsgs((m) => [...m, { id: `local-${Date.now()}`, fromMe: true, textContent: text.trim(), messageType: "conversation", timestamp: new Date().toISOString() }]);
    setText("");
    setC((x) => x && { ...x, paused: true });
    onChanged();
  }
  async function setAi(action: "release" | "pause") {
    setBusy(true);
    const r = await fetch("/api/barbershop/whatsapp/atendimento", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ contactId, action }) });
    setBusy(false);
    if (!r.ok) { toast.error("Não deu certo."); return; }
    setC((x) => x && { ...x, paused: action === "pause" });
    toast.success(action === "release" ? "A IA volta a responder esta conversa" : "IA pausada nesta conversa");
    onChanged();
  }

  return (
    <section aria-label="Conversa" className="w-full bg-surface border border-line rounded-t-[18px] sm:rounded-2xl flex flex-col max-h-[92vh] xl:max-h-[calc(100vh-3rem)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-line-2 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold truncate">{c?.paused ? "Precisa de você · " : ""}{c?.name ?? "…"}</h2>
          <span className="text-xs text-ink-3">{c?.paused ? (c.handoffReason ? `A IA passou a conversa: ${c.handoffReason.toLowerCase()}` : "IA pausada nesta conversa") : "A IA está respondendo"}</span>
        </div>
        <button type="button" onClick={onClose} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2 shrink-0">Fechar</button>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#EFE9DF] px-4 py-3 flex flex-col gap-1.5 min-h-[240px]">
        {msgs.length === 0 && <p className="text-xs text-ink-3 text-center py-6">Sem mensagens salvas desta conversa.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug shadow-sm whitespace-pre-line", m.fromMe ? "self-end bg-[#DCF7C5]" : "self-start bg-white")}>
            {m.textContent ?? <span className="italic text-ink-3">({m.messageType === "audioMessage" ? "áudio" : m.messageType === "imageMessage" ? "imagem" : "mídia"})</span>}
            <span className="block text-right text-[10px] text-ink-4 mt-0.5">{hhmm(m.timestamp)}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="p-3 border-t border-line-2 flex flex-col gap-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Responder" placeholder="Escreva sua resposta"
            className="flex-1 min-w-0 h-11 rounded-[10px] border border-control bg-surface px-3.5 text-sm outline-none focus:border-primary" />
          <Button type="submit" loading={busy} disabled={!text.trim()} aria-label="Enviar"><Send className="w-4 h-4" aria-hidden /></Button>
        </form>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-3">{c?.paused ? "Ao responder por aqui, a IA fica quieta nesta conversa." : "Responder por aqui pausa a IA nesta conversa."}</span>
          {c && (c.paused
            ? <Button size="sm" variant="outline" disabled={busy} onClick={() => setAi("release")}>Devolver para a IA</Button>
            : <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAi("pause")}>Pausar a IA</Button>)}
        </div>
      </div>
    </section>
  );
}
