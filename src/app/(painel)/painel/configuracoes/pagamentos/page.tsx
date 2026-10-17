"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Repeat, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Field } from "@/components/catalogo/SidePanel";
import { ConfigNav, ConfigSection, Pills, ToggleRow, type NavSection } from "@/components/config/ConfigNav";

type MpConfig = {
  connected: boolean;
  config?: { id: string; mpUserId: string | null; mpEmail?: string | null; active: boolean; createdAt: string; updatedAt: string } | null;
  subscribers?: { total: number; auto: number; manual: number };
};
interface Rules { debitFee: number; creditFee: number; prebillingReminderEnabled: boolean; prebillingReminderDays: number; blockOverdueEnabled: boolean }

const SECTIONS: NavSection[] = [
  { id: "dados", label: "Dados da barbearia", hint: "Nome, contato e senha" },
  { id: "horarios", label: "Horários", hint: "Funcionamento e feriados" },
  { id: "agendamento", label: "Agendamento online", hint: "Link, desmarcar e faltas" },
  { id: "descontos", label: "Descontos", hint: "Máximo na comanda" },
];
const FEATURES = [
  { icon: CreditCard, label: "Pix e cartão", desc: "Cobrança avulsa por link" },
  { icon: Repeat, label: "Débito automático", desc: "Mensalidade das assinaturas cobrada sozinha" },
  { icon: Shield, label: "Pagamento seguro", desc: "Proteção antifraude do Mercado Pago" },
];
const OAUTH_ERRORS: Record<string, string> = {
  unauthorized: "Sessão expirada. Entre de novo e tente outra vez.",
  invalid_state: "O link de autorização expirou. Tente de novo.",
  token_exchange_failed: "O Mercado Pago não devolveu a autorização. Tente de novo.",
  missing_params: "Resposta inválida do Mercado Pago.",
  db_error: "Não deu para salvar a conexão. Tente de novo.",
  not_configured: "Conexão com o Mercado Pago não configurada na plataforma. Fale com o suporte.",
  access_denied: "Você cancelou a autorização no Mercado Pago.",
};
const brl = (v: number) => formatCurrency(v);
const ddmmyyyy = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function OAuthResult() {
  const sp = useSearchParams();
  useEffect(() => {
    const r = sp.get("mp_oauth");
    if (r === "success") toast.success("Mercado Pago conectado!");
    else if (r === "error") toast.error(OAUTH_ERRORS[sp.get("reason") ?? ""] ?? "Não foi possível conectar o Mercado Pago.");
  }, [sp]);
  return null;
}

export default function PagamentosPage() {
  const { token } = useAuthStore();
  const h = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);
  const [mp, setMp] = useState<MpConfig | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [rules0, setRules0] = useState<Rules | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [mpToken, setMpToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [askDisconnect, setAskDisconnect] = useState(false);

  useEffect(() => {
    fetch("/api/barbershop/payment-config", { headers: h }).then((r) => r.json()).then(setMp).catch(() => setMp({ connected: false }));
    fetch("/api/barbershop/settings", { headers: h }).then((r) => r.json()).then((s) => {
      const v: Rules = {
        debitFee: Number(s.debitFee ?? 0), creditFee: Number(s.creditFee ?? 0),
        prebillingReminderEnabled: s.prebillingReminderEnabled ?? true, prebillingReminderDays: Number(s.prebillingReminderDays ?? 5),
        blockOverdueEnabled: !!s.blockOverdueEnabled,
      };
      setRules(v); setRules0(v);
    }).catch(() => {});
  }, [h]);

  async function connectManual() {
    if (!mpToken.trim()) return;
    setBusy("connect");
    const r = await fetch("/api/barbershop/payment-config", { method: "POST", headers: h, body: JSON.stringify({ gateway: "mercadopago", accessToken: mpToken.trim() }) });
    setBusy(null);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível conectar."); return; }
    setMp((m) => ({ ...m, connected: true, config: d.config }));
    setMpToken(""); setManualOpen(false);
    toast.success(d.message ?? "Mercado Pago conectado!");
  }
  async function disconnect() {
    setBusy("disconnect");
    const r = await fetch("/api/barbershop/payment-config", { method: "DELETE", headers: h });
    setBusy(null);
    const d = await r.json().catch(() => ({}));
    setAskDisconnect(false);
    if (!r.ok) { toast.error("Não foi possível desconectar."); return; }
    setMp((m) => ({ ...m, connected: false, config: null }));
    if (d.warning) toast.warning(d.warning); else toast.success("Mercado Pago desconectado");
  }
  async function saveRules() {
    if (!rules) return;
    setBusy("rules");
    const r = await fetch("/api/barbershop/financeiro", { method: "PATCH", headers: h, body: JSON.stringify(rules) });
    setBusy(null);
    if (!r.ok) { toast.error("Não foi possível salvar."); return; }
    setRules0(rules);
    toast.success("Salvo");
  }

  const subs = mp?.subscribers;
  const dirty = JSON.stringify(rules) !== JSON.stringify(rules0);
  const SAMPLE = 75;

  return (
    <div className="flex flex-col gap-5">
      <Suspense><OAuthResult /></Suspense>
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Pagamentos</h1>
          <span className="text-sm text-ink-3">Como a barbearia recebe: Mercado Pago, maquininha e a mensalidade dos assinantes</span>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ConfigNav current="pagamentos" sections={SECTIONS} other={{ pagamentos: mp ? (mp.connected ? "Mercado Pago ligado" : "Mercado Pago desligado") : undefined }} />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
          {/* Mercado Pago */}
          <section aria-labelledby="mp-t" className="bg-surface border border-line rounded-2xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#00B1EA] text-white font-bold text-sm flex items-center justify-center shrink-0">MP</div>
              <div className="flex-1 min-w-0">
                <h2 id="mp-t" className="text-[17px] font-semibold">Mercado Pago</h2>
                <span className="text-[13px] text-ink-3">Pix, cartão e débito automático das assinaturas</span>
              </div>
              {mp && (
                <span className={cn("h-7 px-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5", mp.connected ? "bg-positive-soft text-positive" : "bg-surface-2 text-ink-2")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", mp.connected ? "bg-positive" : "bg-ink-4")} />{mp.connected ? "Conectado" : "Não conectado"}
                </span>
              )}
            </div>

            {!mp ? <div className="h-32 rounded-xl bg-surface-3/60 animate-pulse" /> : mp.connected ? (
              <>
                <p className="text-sm text-ink-2">O dinheiro cai direto na sua conta do Mercado Pago. O sistema não fica com nenhuma porcentagem: só vale a taxa do próprio Mercado Pago.</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-ground p-4 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[13px] font-semibold">Conta conectada{mp.config?.createdAt ? ` desde ${ddmmyyyy(mp.config.createdAt)}` : ""}</span>
                    <span className="text-xs text-ink-3 truncate">{mp.config?.mpEmail || (mp.config?.mpUserId ? `ID ${mp.config.mpUserId}` : "Chave de acesso própria")}</span>
                  </div>
                  <div className="rounded-xl bg-ground p-4 flex flex-col gap-1">
                    <span><strong className="font-display text-2xl">{subs?.auto ?? 0}</strong> <span className="text-xs text-ink-3">de {subs?.total ?? 0} assinantes</span></span>
                    <span className="text-xs text-ink-3">pagam no débito automático</span>
                    <div className="h-1.5 rounded-full bg-track mt-1"><div className="h-full rounded-full bg-positive" style={{ width: `${subs?.total ? (subs.auto / subs.total) * 100 : 0}%` }} /></div>
                  </div>
                  <div className="rounded-xl bg-ground p-4 flex flex-col gap-1">
                    <span><strong className="font-display text-2xl">{subs?.manual ?? 0}</strong> <span className="text-xs text-ink-3">assinantes</span></span>
                    <span className="text-xs text-ink-3">pagam por Pix ou no balcão</span>
                    <Link href="/painel/assinaturas" className="text-xs font-semibold text-ink-2 underline underline-offset-2 mt-auto">Ver assinantes</Link>
                  </div>
                </div>
                {askDisconnect ? (
                  <div role="alertdialog" aria-label="Desconectar o Mercado Pago" className="rounded-xl bg-danger-soft border border-danger/25 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-danger">Desconectar o Mercado Pago?</p>
                      <p className="text-[13px] text-danger">{subs?.auto ? `As ${subs.auto} assinaturas no débito automático param de ser cobradas sozinhas. Você vai precisar cobrar esses clientes na mão.` : "Você não vai mais conseguir gerar link de pagamento nem débito automático."}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setAskDisconnect(false)}>Cancelar</Button>
                    <Button size="sm" variant="danger" loading={busy === "disconnect"} onClick={disconnect}>Sim, desconectar</Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAskDisconnect(true)} className="self-start text-[13px] font-semibold text-danger underline underline-offset-2">Desconectar conta</button>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FEATURES.map((f) => (
                    <div key={f.label} className="rounded-xl bg-ground p-3.5 flex flex-col gap-1">
                      <f.icon className="w-4 h-4 text-ink-3" aria-hidden />
                      <span className="text-sm font-semibold">{f.label}</span>
                      <span className="text-xs text-ink-3">{f.desc}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <a href="/api/payments/mp-oauth/initiate" className="h-12 px-5 rounded-[10px] bg-[#009EE3] hover:bg-[#008ACB] text-white text-sm font-semibold inline-flex items-center justify-center gap-2">
                    <span className="w-6 h-6 rounded bg-white/20 text-[10px] font-bold flex items-center justify-center">MP</span>Conectar com Mercado Pago
                  </a>
                  <span className="text-xs text-ink-3">Você vai para o site do Mercado Pago, autoriza e volta para cá.</span>
                </div>
                {manualOpen ? (
                  <div className="rounded-xl border border-line-2 p-4 flex flex-col gap-3">
                    <span className="text-xs text-ink-3">Use para chaves de teste ou se preferir colar a chave na mão. Na dúvida, use o botão azul acima.</span>
                    <Field label="Chave de acesso (Access Token)" type="password" autoComplete="off" value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder="APP_USR-... ou TEST-..." />
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Onde encontro minha chave</a>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setManualOpen(false)}>Cancelar</Button>
                        <Button size="sm" disabled={!mpToken.trim()} loading={busy === "connect"} onClick={connectManual}>Conectar com a chave</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setManualOpen(true)} className="self-start text-[13px] font-semibold text-ink-2 underline underline-offset-2">Conectar colando a chave</button>
                )}
              </>
            )}
          </section>

          {rules && (
            <div className="grid gap-5 xl:grid-cols-2 items-start">
              <ConfigSection title="Taxas da maquininha" subtitle="Servem para o Financeiro mostrar quanto sobra de verdade em cada venda"
                footer={dirty ? <><Button size="sm" variant="outline" onClick={() => setRules(rules0)}>Descartar</Button><Button size="sm" loading={busy === "rules"} onClick={saveRules}>Salvar</Button></> : undefined}>
                <div className="flex flex-col divide-y divide-line-3 rounded-xl border border-line-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_90px] gap-3 px-3 py-2 text-xs font-semibold text-ink-3"><span>Forma</span><span>Taxa</span><span className="text-right">Em {brl(SAMPLE)}, sobra</span></div>
                  {([["Pix", "na hora", null], ["Dinheiro", "vai para o caixa", null], ["Débito", "maquininha", "debitFee"], ["Crédito", "maquininha, à vista", "creditFee"]] as const).map(([name, note, key]) => {
                    const fee = key ? rules[key] : 0;
                    return (
                      <div key={name} className="grid grid-cols-[minmax(0,1fr)_120px_90px] gap-3 items-center px-3 py-2.5">
                        <span className="flex flex-col"><span className="text-sm font-semibold">{name}</span><span className="text-xs text-ink-3">{note}</span></span>
                        {key ? (
                          <div className="flex items-center rounded-[9px] border border-control w-fit">
                            <button type="button" onClick={() => setRules({ ...rules, [key]: Math.max(0, Math.round((fee - 0.1) * 100) / 100) })} aria-label={`Diminuir taxa do ${name}`} className="w-8 h-9 text-lg">−</button>
                            <input value={String(fee).replace(".", ",")} inputMode="decimal" aria-label={`Taxa do ${name} em %`}
                              onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (!isNaN(n) && n >= 0 && n <= 30) setRules({ ...rules, [key]: n }); }}
                              className="w-11 text-center text-sm font-semibold bg-transparent outline-none" />
                            <button type="button" onClick={() => setRules({ ...rules, [key]: Math.min(30, Math.round((fee + 0.1) * 100) / 100) })} aria-label={`Aumentar taxa do ${name}`} className="w-8 h-9 text-lg">+</button>
                          </div>
                        ) : <span className="text-[13px] text-ink-3">sem taxa</span>}
                        <span className="text-sm font-semibold text-right">{brl(SAMPLE * (1 - fee / 100))}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-xs text-ink-3">Taxas em %. Não sabe? Olhe no aplicativo ou no contrato da sua maquininha.</span>
              </ConfigSection>

              <ConfigSection title="Mensalidade das assinaturas" subtitle="O que acontece antes e depois de vencer"
                footer={dirty ? <><Button size="sm" variant="outline" onClick={() => setRules(rules0)}>Descartar</Button><Button size="sm" loading={busy === "rules"} onClick={saveRules}>Salvar</Button></> : undefined}>
                <ToggleRow title="Avisar antes de vencer" checked={rules.prebillingReminderEnabled} onChange={(v) => setRules({ ...rules, prebillingReminderEnabled: v })}
                  text={rules.prebillingReminderEnabled ? `WhatsApp ${rules.prebillingReminderDays} dias antes do vencimento.` : "O assinante não recebe aviso antes de vencer."}>
                  <Pills label="Dias antes do vencimento" value={rules.prebillingReminderDays} onChange={(v) => setRules({ ...rules, prebillingReminderDays: v })}
                    options={[[3, "3 dias"], [5, "5 dias · recomendado"], [7, "7 dias"], [10, "10 dias"]]} />
                  <div className="rounded-xl bg-[#E6DED3] p-3">
                    <div className="rounded-lg bg-white px-3 py-2 text-[13px] leading-snug shadow-sm">Oi, Rafael! Sua assinatura Corte + barba (R$ 149) vence em {rules.prebillingReminderDays} dias. Mantenha em dia para continuar usando seus cortes do mês.</div>
                  </div>
                  <span className="text-xs text-ink-3">Quem está no débito automático não recebe este aviso.</span>
                </ToggleRow>
                <ToggleRow title="Bloquear quem está em atraso" checked={rules.blockOverdueEnabled} onChange={(v) => setRules({ ...rules, blockOverdueEnabled: v })}
                  text={rules.blockOverdueEnabled ? "Quem está em atraso não consegue agendar pelo link até pagar." : "Quem está em atraso agenda normalmente, mas paga o preço avulso, sem o benefício do plano."} />
              </ConfigSection>
            </div>
          )}

          <section aria-labelledby="breve-t" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
            <h2 id="breve-t" className="text-[15px] font-semibold">Outras formas de receber · em breve</h2>
            <div className="flex flex-wrap gap-2">
              {[["PB", "PagBank"], ["ST", "Stripe"], ["PH", "PagHiper"]].map(([i, n]) => (
                <span key={n} className="h-10 px-3 rounded-xl border border-line-2 inline-flex items-center gap-2 text-sm text-ink-3">
                  <span className="w-6 h-6 rounded-md bg-surface-2 text-[10px] font-bold flex items-center justify-center">{i}</span>{n}<span className="text-xs">· em breve</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
