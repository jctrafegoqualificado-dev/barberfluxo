"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Section } from "@/components/catalogo/SidePanel";
import { METHOD_LABEL, normalizeMethod } from "@/lib/finance";
import { advanceDue, dueKey } from "@/lib/subscriptionCycle";
import { BaixaModal, EditarModal, EmailModal } from "./Modals";
import { brl, isFakeEmail, methodText, priceText, shortDay, since, stateOf, usage, whatsappCharge, type PlanOption, type Sub } from "./types";

interface Use {
  id: string; date: string; startTime: string;
  barber: { nickname?: string | null; user: { name: string } } | null;
  services: { service: { id: string; name: string } }[];
}

const dayKey = (iso: string) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/**
 * canManage = dono: pausar, cancelar, reativar, desfazer baixa, apagar e mexer no débito automático.
 * O barbeiro só dá baixa, cobra, reenvia o link, lança uso e edita.
 */
export function SubscriberPanel({ sub: listSub, today, plans, onChanged, onClose, canManage = true }: {
  sub: Sub; today: string; plans: PlanOption[]; onChanged: () => void; onClose: () => void; canManage?: boolean;
}) {
  const { token } = useAuthStore();
  const [sub, setSub] = useState<Sub>(listSub);
  const [uses, setUses] = useState<Use[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"baixa" | "editar" | "email" | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "pause" | "delete" | "undo" | "use" | "stopAuto" | null>(null);
  const [picking, setPicking] = useState(false);
  const h = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    const hh = { Authorization: `Bearer ${token}` };
    const [d, hist] = await Promise.all([
      fetch(`/api/barbershop/subscriptions/${listSub.id}`, { headers: hh }).then((r) => r.json()),
      fetch(`/api/barbershop/subscriptions/${listSub.id}/history`, { headers: hh }).then((r) => r.json()),
    ]);
    if (d.subscription) setSub(d.subscription);
    setUses(hist.history || []);
  }, [listSub.id, token]);
  useEffect(() => { load(); }, [load]);

  const refresh = () => { load(); onChanged(); };
  const st = stateOf(sub, today);
  const live = sub.status !== "CANCELLED";
  const u = usage(sub);
  const cycleStart = dueKey(advanceDue(sub.nextBillingDate, sub.billingDay, sub.plan.billingCycle, -1));
  const cycleUses = (uses ?? []).filter((x) => dayKey(x.date) >= cycleStart);
  const lastPaidId = sub.payments.filter((p) => p.status === "PAID").sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))[0]?.id;
  const waLink = whatsappCharge(sub);
  const ben = Array.isArray(sub.beneficiaries) && sub.beneficiaries.length ? sub.beneficiaries : null;

  async function call(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    const r = await fetch(url, { ...init, headers: { ...h, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? d.message ?? "Não deu certo. Tente de novo."); return null; }
    if (ok) toast.success(ok);
    return d;
  }
  const setStatus = async (status: string, msg: string) => { if (await call(`/api/barbershop/subscriptions/${sub.id}`, { method: "PUT", body: JSON.stringify({ status }) }, msg)) refresh(); };
  const sendLink = async () => { const d = await call(`/api/barbershop/subscriptions/${sub.id}/send-authorization`, { method: "POST" }, ""); if (d) toast.success(d.message ?? "Link enviado no WhatsApp"); };
  async function createAuto(email?: string) {
    const clientEmail = email ?? (isFakeEmail(sub.client.email) ? undefined : sub.client.email);
    if (!clientEmail) { setModal("email"); return; }
    const d = await call("/api/payments/preapproval", { method: "POST", body: JSON.stringify({ subscriptionId: sub.id, clientEmail }) }, "");
    if (d) {
      setModal(null);
      toast.success("Link do débito automático gerado");
      if (d.checkoutUrl) navigator.clipboard?.writeText(d.checkoutUrl).catch(() => {});
      refresh();
    }
  }
  async function launchUse(beneficiaryName?: string) {
    if (await call("/api/barbershop/subscriptions", { method: "PATCH", body: JSON.stringify({ subscriptionId: sub.id, beneficiaryName }) }, "Uso lançado")) refresh();
  }

  const alert = (() => {
    const baixa = <Button size="sm" className="h-[38px]" onClick={() => setModal("baixa")}>Dar baixa</Button>;
    const cobrar = waLink && <a href={waLink} target="_blank" rel="noreferrer" className="h-[38px] px-3 rounded-[9px] border border-control bg-surface text-[13px] font-semibold inline-flex items-center justify-center gap-1.5"><MessageCircle className="w-4 h-4" aria-hidden />Cobrar no WhatsApp</a>;
    switch (st.state) {
      case "failed": return { tone: "danger", title: "O cartão foi recusado", text: "Mande o link para trocar o cartão ou receba no balcão.", actions: <><Button size="sm" className="h-[38px]" loading={busy} onClick={sendLink}>Enviar novo link</Button><Button size="sm" variant="outline" className="h-[38px]" onClick={() => setModal("baixa")}>Dar baixa</Button></> };
      case "late": return { tone: "danger", title: st.text, text: `Venceu em ${shortDay(dueKey(sub.nextBillingDate))}. Cobre no WhatsApp ou dê baixa se já pagou.`, actions: <>{baixa}{cobrar}</> };
      case "today": return { tone: "warning", title: "Vence hoje", text: `${brl(sub.plan.price)} · ${methodText(sub)}`, actions: <>{baixa}{cobrar}</> };
      case "auth": return { tone: "neutral", title: "Esperando o cliente autorizar", text: "O link do débito automático foi enviado e ainda não foi aceito.", actions: <><Button size="sm" variant="outline" className="h-[38px]" loading={busy} onClick={sendLink}>Reenviar link</Button>{sub.authorizationLink && <Button size="sm" variant="outline" className="h-[38px]" onClick={() => { navigator.clipboard?.writeText(sub.authorizationLink!); toast.success("Link copiado"); }}><Copy className="w-4 h-4 mr-1" aria-hidden />Copiar</Button>}</> };
      case "paused": return { tone: "neutral", title: "Assinatura pausada", text: "Não cobra e não dá para usar o plano até retomar.", actions: canManage ? <Button size="sm" className="h-[38px]" loading={busy} onClick={() => setStatus("ACTIVE", "Assinatura retomada")}>Retomar</Button> : null };
      case "cancelled": return { tone: "neutral", title: "Assinatura cancelada", text: "O histórico continua aqui.", actions: canManage ? <Button size="sm" variant="outline" className="h-[38px]" loading={busy} onClick={() => setStatus("ACTIVE", "Assinatura reativada")}>Reativar</Button> : null };
      default: return null;
    }
  })();

  const auto = sub.authorizationStatus ?? "MANUAL";

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 pr-12 xl:pr-5">
        <div className="w-12 h-12 rounded-full bg-surface-2 text-ink-2 font-bold flex items-center justify-center shrink-0">{getInitials(sub.client.name)}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold truncate">{sub.client.name}</h2>
          <p className="text-[13px] text-ink-3 flex items-center gap-2 flex-wrap">
            <span>{since(sub.startDate, today)}</span>
            {sub.client.phone && <a href={`tel:${sub.client.phone}`} className="inline-flex items-center gap-1 underline underline-offset-2"><Phone className="w-3 h-3" aria-hidden />{sub.client.phone}</a>}
          </p>
        </div>
      </div>

      <div className="mx-5 p-3.5 rounded-xl bg-ground flex flex-col gap-1">
        <div className="flex justify-between items-baseline gap-2"><span className="text-[15px] font-semibold truncate">{sub.plan.name}</span><span className="text-[15px] font-bold shrink-0">{priceText(sub)}</span></div>
        <span className="text-[13px] text-ink-2">
          {sub.billingDay ? `Cobra todo dia ${sub.billingDay}` : "Sem dia fixo"} · {methodText(sub)}
          {live && <> · próxima {dueKey(sub.nextBillingDate) === today ? "hoje" : shortDay(dueKey(sub.nextBillingDate))}</>}
        </span>
      </div>

      {alert && (
        <div role="status" className={cn("mx-5 mt-3 p-3.5 rounded-xl border flex flex-col gap-2.5",
          alert.tone === "danger" ? "bg-danger-soft border-danger/25" : alert.tone === "warning" ? "bg-warning-soft border-warning/20" : "bg-surface-3 border-line")}>
          <div className="flex flex-col gap-0.5">
            <span className={cn("text-sm font-semibold", alert.tone === "danger" ? "text-danger" : alert.tone === "warning" ? "text-warning" : "text-ink")}>{alert.title}</span>
            <span className={cn("text-[13px]", alert.tone === "danger" ? "text-danger" : "text-ink-2")}>{alert.text}</span>
          </div>
          <div className="flex flex-wrap gap-2">{alert.actions}</div>
        </div>
      )}

      <Section title="Usos neste ciclo" aside={live && sub.status !== "PAUSED" ? (
        <button type="button" onClick={() => (ben ? setPicking((v) => !v) : setConfirm("use"))} aria-expanded={ben ? picking : undefined} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Lançar uso</button>
      ) : undefined}>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]"><span className="text-ink-3">Desde {shortDay(cycleStart)}</span><span className={cn("font-semibold", u.over ? "text-danger font-semibold" : u.full && "text-warning")}>{u.text}</span></div>
          {u.pct > 0 && <div className="h-1.5 rounded-full bg-track"><div className={cn("h-full rounded-full", u.over ? "bg-danger-strong" : u.full ? "bg-[#B08A2E]" : "bg-ink")} style={{ width: `${u.pct}%` }} /></div>}
          {ben && !picking && <div className="flex flex-wrap gap-x-3 text-xs text-ink-3">{ben.map((b) => <span key={b.name}>{b.name}: {b.uses}/{b.maxUses}</span>)}</div>}
          {ben && picking && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-surface-3/60 p-2.5">
              <span className="text-xs text-ink-3">Só para atendimento que não passou pela agenda. De quem é o uso?</span>
              <div className="flex flex-wrap gap-2">
                {ben.map((b) => (
                  <Button key={b.name} size="sm" variant="outline" disabled={busy || b.uses >= b.maxUses} onClick={() => { setPicking(false); launchUse(b.name); }}>
                    {b.name} · {b.uses}/{b.maxUses}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        {uses === null ? <div className="h-12 rounded-lg bg-surface-3/60 animate-pulse" /> : cycleUses.length === 0 ? (
          <p className="text-[13px] text-ink-3">Nenhum atendimento pelo plano neste ciclo.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {cycleUses.slice(0, 6).map((x) => (
              <div key={x.id} className="flex justify-between gap-3 text-[13px]">
                <span className="truncate">{shortDay(dayKey(x.date))} · {x.services.map((s) => s.service.name).join(" + ") || "Atendimento"}</span>
                <span className="text-ink-3 shrink-0">{x.barber ? x.barber.nickname || x.barber.user.name.split(" ")[0] : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Cobranças">
        {sub.payments.length === 0 ? <p className="text-[13px] text-ink-3">Nenhuma cobrança registrada.</p> : (
          <div className="flex flex-col gap-2">
            {sub.payments.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate">
                  {p.paidAt ? shortDay(dayKey(p.paidAt)) : p.status === "PENDING" && live ? `a cobrar em ${shortDay(dueKey(sub.nextBillingDate))}` : shortDay(dayKey(p.createdAt))} · {brl(p.amount)}
                  {p.status === "PAID" && <span className="text-ink-3"> · {METHOD_LABEL[normalizeMethod(p.method)]}</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {canManage && p.id === lastPaidId && <button type="button" onClick={() => setConfirm("undo")} className="text-xs font-semibold text-ink-3 underline underline-offset-2">Desfazer</button>}
                  <span className={cn("h-[22px] px-2 rounded-full text-[11px] font-semibold inline-flex items-center",
                    p.status === "PAID" ? "bg-positive-soft text-positive" : p.status === "PENDING" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger")}>
                    {p.status === "PAID" ? "Paga" : p.status === "PENDING" ? "Aberta" : "Recusada"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {live && (
        <Section title="Débito automático">
          <p className="text-[13px] text-ink-2">
            {auto === "AUTHORIZED" ? "Ativo: o Mercado Pago cobra sozinho todo ciclo."
              : auto === "PENDING_AUTH" ? "Link enviado, esperando o cliente autorizar."
              : auto === "PAUSED" ? "Pausado (houve baixa manual). Retome quando quiser voltar a cobrar sozinho."
              : auto === "FAILED" ? "A última cobrança falhou."
              : "Cobrança manual: o cliente paga no balcão ou por Pix e você dá baixa."}
          </p>
          {canManage && <div className="flex flex-wrap gap-2">
            {!sub.mpPreapprovalId && <Button size="sm" variant="outline" loading={busy} onClick={() => createAuto()}>Ativar débito automático</Button>}
            {sub.mpPreapprovalId && auto === "PAUSED" && (
              <Button size="sm" variant="outline" loading={busy} onClick={async () => { if (await call(`/api/barbershop/subscriptions/${sub.id}/resume-authorization`, { method: "POST" }, "Débito automático retomado")) refresh(); }}>Retomar débito</Button>
            )}
            {sub.mpPreapprovalId && <Button size="sm" variant="ghost" onClick={() => setConfirm("stopAuto")}>{auto === "AUTHORIZED" ? "Cancelar débito" : "Cancelar e gerar outro"}</Button>}
          </div>}
        </Section>
      )}

      <div className="px-5 py-4 border-t border-line-2 flex flex-wrap items-center gap-2 sticky bottom-0 bg-surface mt-2">
        {live ? (
          <>
            <Button variant="outline" size="sm" onClick={() => setModal("editar")}>Editar</Button>
            {canManage && sub.status !== "PAUSED" && <Button variant="outline" size="sm" onClick={() => setConfirm("pause")}>Pausar</Button>}
            {canManage ? <Button variant="outline" size="sm" className="ml-auto text-danger border-danger/30" onClick={() => setConfirm("cancel")}>Cancelar assinatura</Button>
              : <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>}
          </>
        ) : (
          <>
            {canManage && <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirm("delete")}>Apagar registro</Button>}
            <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Fechar</Button>
          </>
        )}
      </div>

      {modal === "baixa" && <BaixaModal subs={[sub]} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "editar" && <EditarModal sub={sub} plans={plans} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === "email" && <EmailModal sub={sub} busy={busy} onClose={() => setModal(null)} onSubmit={(e) => createAuto(e)} />}

      <ConfirmDialog isOpen={confirm === "cancel"} type="danger" title={`Cancelar a assinatura de ${sub.client.name.split(" ")[0]}?`}
        message={sub.mpPreapprovalId ? "Ele perde o plano e o débito automático no Mercado Pago é cancelado (não cobra mais)." : "Ele perde o plano a partir de agora. O histórico continua."}
        confirmLabel="Cancelar assinatura" cancelLabel="Voltar" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); setStatus("CANCELLED", "Assinatura cancelada"); }} />
      <ConfirmDialog isOpen={confirm === "pause"} title="Pausar a assinatura?"
        message={sub.authorizationStatus === "AUTHORIZED" ? "Não cobra e não dá para usar o plano até retomar. O débito automático também fica pausado." : "Não cobra e não dá para usar o plano até retomar."}
        confirmLabel="Pausar" cancelLabel="Voltar" onCancel={() => setConfirm(null)} onConfirm={() => { setConfirm(null); setStatus("PAUSED", "Assinatura pausada"); }} />
      <ConfirmDialog isOpen={confirm === "undo"} type="danger" title="Desfazer a última baixa?"
        message="O pagamento é apagado e o vencimento volta 1 ciclo." confirmLabel="Desfazer" cancelLabel="Voltar" onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); if (await call(`/api/barbershop/subscriptions/pagamento?subscriptionId=${sub.id}`, { method: "DELETE" }, "Baixa desfeita")) refresh(); }} />
      <ConfirmDialog isOpen={confirm === "delete"} type="danger" title="Apagar o registro desta assinatura?"
        message="Some de vez, junto com as cobranças. Os atendimentos continuam na agenda. Não dá para desfazer." confirmLabel="Apagar" cancelLabel="Voltar" onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); if (await call(`/api/barbershop/subscriptions/${sub.id}`, { method: "DELETE" }, "Registro apagado")) { onChanged(); onClose(); } }} />
      <ConfirmDialog isOpen={confirm === "stopAuto"} type="danger" title="Cancelar o débito automático?"
        message="O Mercado Pago para de cobrar. A assinatura continua, com cobrança manual, e dá para gerar outro link depois." confirmLabel="Cancelar débito" cancelLabel="Voltar" onCancel={() => setConfirm(null)}
        onConfirm={async () => { setConfirm(null); if (await call(`/api/payments/preapproval?subscriptionId=${sub.id}`, { method: "DELETE" }, "Débito automático cancelado")) refresh(); }} />
      <ConfirmDialog isOpen={confirm === "use"} title="Lançar um uso à mão?"
        message="Use só para atendimento que não passou pela agenda — atendimento concluído na agenda já conta sozinho."
        confirmLabel="Lançar uso" cancelLabel="Voltar" onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); launchUse(); }} />
    </div>
  );
}
