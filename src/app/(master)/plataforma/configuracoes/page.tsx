"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";
import { Field } from "@/components/catalogo/SidePanel";

const fmtPhone = (d: string) => {
  const n = d.replace(/^55/, "");
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
};

/** Contato da plataforma: aparece na página de vendas ("Falar com a gente no WhatsApp"). */
export default function PlataformaConfiguracoes() {
  const { token } = useAuthStore();
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/plataforma/config", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setWhatsapp(d.whatsapp ? fmtPhone(d.whatsapp) : ""); setEmail(d.email ?? ""); } })
      .finally(() => setLoaded(true));
  }, [token]);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/plataforma/config", {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Não foi possível salvar");
      setWhatsapp(d.whatsapp ? fmtPhone(d.whatsapp) : "");
      setEmail(d.email ?? "");
      toast.success("Contato salvo. A página de vendas já usa o número novo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Contato e suporte</h1>
        <span className="text-sm text-ink-3">Onde quem visita a página de vendas fala com vocês</span>
      </header>
      <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
        {!loaded ? <div className="h-32 rounded-xl bg-surface-2 animate-pulse" /> : (
          <>
            <Field label="WhatsApp de vendas e suporte" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel"
              placeholder="(41) 99999-0000" hint="Aparece nos botões “Falar com a gente” da página de vendas. Em branco, os botões somem." />
            <Field label="E-mail de contato" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@seudominio.com.br" hint="Aparece no rodapé da página de vendas. Opcional." />
            <div className="flex justify-end">
              <Button onClick={save} loading={saving}>Salvar</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
