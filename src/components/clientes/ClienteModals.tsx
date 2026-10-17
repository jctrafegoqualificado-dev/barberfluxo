"use client";
import { useEffect, useRef, useState } from "react";
import { Check, FileText, MessageCircle, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { type ClienteRow, type Ficha, comebackMessage, waLink, lastVisitLabel, LAPSED } from "./types";

const textarea =
  "w-full rounded-[10px] border border-control bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 resize-none " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

async function readError(r: Response, fallback: string) {
  const d = await r.json().catch(() => ({}));
  return (d as { error?: string }).error || fallback;
}

/* ─── Editar dados (nome, WhatsApp, aniversário, observações, bloqueio) ─── */
export function EditarClienteModal({ ficha, onClose, onSaved, onDelete }: {
  ficha: Ficha;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const { token } = useAuthStore();
  const c = ficha.client;
  const [name, setName] = useState(c.name);
  const [phone, setPhone] = useState(c.phone ?? "");
  const [birthday, setBirthday] = useState(c.birthday ?? "");
  const [note, setNote] = useState(ficha.note?.content ?? "");
  const [blocked, setBlocked] = useState(c.isBlocked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const r = await fetch(`/api/barbershop/clientes/${c.id}`, {
      method: "PUT", headers,
      body: JSON.stringify({
        name, phone,
        ...(blocked !== c.isBlocked ? { isBlocked: blocked } : {}),
        // Meio-dia UTC: o dia não volta por causa do fuso
        birthday: birthday ? `${birthday}T12:00:00Z` : null,
      }),
    });
    if (!r.ok) { setError(await readError(r, "Não foi possível salvar.")); setSaving(false); return; }
    if (note.trim() !== (ficha.note?.content ?? "").trim()) {
      const n = await fetch(`/api/barbershop/clientes/${c.id}/nota`, { method: "PUT", headers, body: JSON.stringify({ content: note }) });
      if (!n.ok) { setError(await readError(n, "Os dados foram salvos, mas as observações não.")); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  async function exportLgpd() {
    const r = await fetch(`/api/barbershop/clientes/${c.id}/lgpd`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return;
    const url = URL.createObjectURL(new Blob([await r.text()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `lgpd_${c.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open onClose={onClose} title="Editar dados" description={c.name}>
      <div className="flex flex-col gap-3.5">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <Input label="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(41) 99999-9999" />
        <Input label="Aniversário" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        <div>
          <label htmlFor="cli-note" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Observações</label>
          <textarea id="cli-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
            placeholder="Ex.: gosta de degradê médio, prefere depois das 17h" className={textarea} />
          <p className="mt-1.5 text-xs text-ink-3">
            {ficha.note
              ? `Atualizado em ${new Date(ficha.note.updatedAt).toLocaleDateString("pt-BR")}${ficha.note.updatedBy ? ` por ${ficha.note.updatedBy}` : ""}.`
              : "Só a sua equipe vê."}
          </p>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-line p-3.5 cursor-pointer">
          <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[var(--color-danger-strong)]" />
          <span className="text-sm">
            <span className="font-semibold text-ink">Bloquear cliente</span>
            <span className="block text-xs text-ink-3 mt-0.5">O atendente do WhatsApp deixa de marcar horário para ele.</span>
          </span>
        </label>

        {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" loading={saving} disabled={!name.trim()} onClick={save}>Salvar</Button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-line-2">
          <button type="button" onClick={exportLgpd} className="h-10 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink">
            <FileText className="w-4 h-4" aria-hidden /> Exportar dados (LGPD)
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="h-10 text-[13px] font-semibold text-danger hover:underline">
              Excluir cliente
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Novo cliente ─── */
export function NovoClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, linked: boolean) => void }) {
  const { token } = useAuthStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/barbershop/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, phone, birthday: birthday || undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(d.error || "Não foi possível cadastrar."); return; }
    onCreated(d.client.id, !!d.linked);
  }

  return (
    <Modal open onClose={onClose} title="Novo cliente" description="Ele aparece na lista mesmo antes do primeiro horário.">
      <div className="flex flex-col gap-3.5">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" autoFocus />
        <Input label="WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(41) 99999-9999" />
        <Input label="Aniversário (opcional)" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" loading={saving}
            disabled={!name.trim() || phone.replace(/\D/g, "").length < 10} onClick={create}>
            Cadastrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Importar planilha (CSV) ─── */
function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(/[;,\t]/).map((h) => h.trim().replace(/"/g, ""));
  const nameIdx = header.findIndex((h) => h.includes("nome") || h === "name");
  const phoneIdx = header.findIndex((h) => h.includes("fone") || h.includes("celular") || h.includes("whatsapp") || h === "phone");
  const emailIdx = header.findIndex((h) => h === "email" || h === "e-mail");
  if (nameIdx === -1) return [];
  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,\t]/).map((c) => c.trim().replace(/"/g, ""));
    return { name: cols[nameIdx] ?? "", phone: phoneIdx >= 0 ? cols[phoneIdx] ?? "" : "", email: emailIdx >= 0 ? cols[emailIdx] ?? "" : "" };
  }).filter((r) => r.name.length > 0);
}

export function ImportarModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<{ name: string; phone: string; email: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; linked: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRows(parseCsv(String(ev.target?.result ?? "")));
    reader.readAsText(file, "UTF-8");
  }

  async function run() {
    if (!rows?.length) return;
    setLoading(true);
    setError(null);
    const r = await fetch("/api/barbershop/clientes/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rows }),
    });
    const d = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setError(d.error || "Falha ao importar."); return; }
    setResult({ created: d.created ?? 0, linked: d.linked ?? 0, skipped: d.skipped ?? 0, errors: d.errors ?? [] });
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Importar planilha" description="Traga os clientes de outro sistema (arquivo .csv).">
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-line-2 bg-line-2 text-center">
            {[["Novos", result.created], ["Já tinham cadastro", result.linked], ["Ignorados", result.skipped]].map(([l, v]) => (
              <div key={l as string} className="bg-surface p-3">
                <p className="font-display text-2xl font-bold">{v}</p>
                <p className="text-xs text-ink-3">{l}</p>
              </div>
            ))}
          </div>
          {result.linked > 0 && <p className="text-[13px] text-ink-2">Quem já tinha cadastro (de outra barbearia ou do link) agora aparece na sua lista.</p>}
          {result.errors.length > 0 && (
            <div className="text-xs text-danger bg-danger-soft rounded-[10px] p-3 max-h-32 overflow-y-auto">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <Button size="lg" onClick={onClose}>Fechar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="text-[13px] text-ink-2 bg-surface-3 rounded-xl p-3.5 space-y-1">
            <p>A primeira linha é o cabeçalho, com as colunas <strong>nome</strong> e <strong>telefone</strong> (e-mail é opcional).</p>
            <p>Separadas por vírgula, ponto e vírgula ou tab. Quem já estiver na sua lista é ignorado.</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border-2 border-dashed border-control hover:border-ink-4 py-7 flex flex-col items-center gap-2 text-ink-2">
            <Upload className="w-6 h-6" aria-hidden />
            <span className="text-sm font-semibold">{rows ? "Trocar arquivo" : "Escolher arquivo"}</span>
          </button>
          {rows && (
            rows.length === 0 ? (
              <p className="text-[13px] text-danger">Não achamos a coluna “nome” nesse arquivo.</p>
            ) : (
              <div className="rounded-xl border border-line p-3.5">
                <p className="text-sm font-semibold mb-1.5">{rows.length} cliente{rows.length > 1 ? "s" : ""} no arquivo</p>
                <div className="max-h-32 overflow-y-auto text-xs text-ink-2 space-y-0.5">
                  {rows.slice(0, 8).map((r, i) => <p key={i} className="truncate">{r.name} <span className="text-ink-4">{r.phone}</span></p>)}
                  {rows.length > 8 && <p className="text-ink-4">… e mais {rows.length - 8}</p>}
                </div>
              </div>
            )
          )}
          {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button size="lg" className="flex-[1.5]" loading={loading} disabled={!rows?.length} onClick={run}>
              Importar{rows?.length ? ` ${rows.length}` : ""}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─── Oferecer plano (criar assinatura) ─── */
export function OferecerPlanoModal({ ficha, onClose, onDone }: { ficha: Ficha; onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const [plans, setPlans] = useState<{ id: string; name: string; price: number }[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [billingDay, setBillingDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setPlans((d.plans || []).filter((p: { active?: boolean }) => p.active !== false)))
      .catch(() => setPlans([]));
  }, [token]);

  async function create() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/barbershop/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientName: ficha.client.name, clientPhone: ficha.client.phone ?? "", planId, billingDay }),
    });
    setSaving(false);
    if (!r.ok) { setError(await readError(r, "Não foi possível criar a assinatura.")); return; }
    onDone();
  }

  const select = "w-full h-11 rounded-[10px] border border-control bg-surface px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <Modal open onClose={onClose} title="Assinatura" description={`Colocar ${ficha.client.name} em um plano.`}>
      <div className="flex flex-col gap-3.5">
        {plans === null ? (
          <p className="text-sm text-ink-3">Carregando planos…</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-ink-2">Você ainda não tem planos. Crie um em <a href="/painel/planos" className="font-semibold underline">Planos</a>.</p>
        ) : (
          <>
            <div>
              <label htmlFor="sub-plan" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Plano</label>
              <select id="sub-plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={select}>
                <option value="">Escolha um plano</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatCurrency(p.price)}/mês</option>)}
              </select>
            </div>
            <Input label="Dia da cobrança (opcional)" type="number" min={1} max={31} value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)} placeholder="Ex.: 10" />
            {!ficha.client.phone && <p className="text-[13px] text-danger">Cadastre o WhatsApp do cliente antes (Editar dados).</p>}
          </>
        )}
        {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" loading={saving} disabled={!planId || !ficha.client.phone} onClick={create}>
            Criar assinatura
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Chamar de volta (fila: um WhatsApp por vez, enviado pelo próprio celular) ─── */
export function ChamarDeVoltaModal({ clientes, shop, onClose }: {
  clientes: ClienteRow[];
  shop: { slug: string; name: string } | null;
  onClose: () => void;
}) {
  const [sent, setSent] = useState<Set<string>>(new Set());
  const withPhone = clientes.filter((c) => c.phone);
  const pending = withPhone.filter((c) => !sent.has(c.id)).length;

  return (
    <Modal open onClose={onClose} title="Chamar de volta"
      description={`${withPhone.length} cliente${withPhone.length === 1 ? "" : "s"} com WhatsApp. Cada toque abre a conversa com a mensagem pronta.`}
      className="sm:max-w-lg">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-line-2 rounded-xl border border-line max-h-[55vh] overflow-y-auto">
          {withPhone.map((c) => {
            const done = sent.has(c.id);
            const text = comebackMessage({ name: c.name, shopName: shop?.name, barberName: c.preferredBarber, slug: shop?.slug });
            return (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className={`text-xs ${LAPSED.late}`}>
                    {lastVisitLabel(c.daysSinceLastVisit)}
                    {c.lastRetentionAt && <span className="text-ink-3"> · mensagem automática em {new Date(c.lastRetentionAt).toLocaleDateString("pt-BR")}</span>}
                  </p>
                </div>
                <a href={waLink(c.phone!, text)} target="_blank" rel="noreferrer"
                  onClick={() => setSent((s) => new Set(s).add(c.id))}
                  className={`h-9 px-3 rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0 ${
                    done ? "bg-positive-soft text-positive" : "bg-ink text-white hover:bg-ink/90"}`}>
                  {done ? <><Check className="w-4 h-4" aria-hidden /> Enviado</> : <><MessageCircle className="w-4 h-4" aria-hidden /> Enviar</>}
                </a>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-3">
          {pending === 0 ? "Pronto, todos chamados." : `Faltam ${pending}.`} Mandamos um por vez de propósito: disparo em massa pelo WhatsApp pode bloquear o número.
        </p>
        <Button variant="outline" size="lg" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}

