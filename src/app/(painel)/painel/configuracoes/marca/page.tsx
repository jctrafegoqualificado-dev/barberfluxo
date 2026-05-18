"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { Palette, Image as ImageIcon, Save, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";

export default function MarcaPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    primaryColor: "#f59e0b",
    secondaryColor: "#fbbf24",
    logoUrl: "",
    favIconUrl: "",
  });

  useEffect(() => {
    if (token) {
      fetch("/api/barbershop/settings", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setForm({
            name: data.name || "",
            description: data.description || "",
            primaryColor: data.primaryColor || "#f59e0b",
            secondaryColor: data.secondaryColor || "#fbbf24",
            logoUrl: data.logoUrl || "",
            favIconUrl: data.favIconUrl || "",
          });
        }
      })
      .finally(() => setLoading(false));
    }
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/barbershop/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Não foi possível salvar as configurações de marca agora. Por favor, tente novamente em alguns instantes ou contate o administrador do sistema.");
      }

      setStatus({ type: 'success', message: 'Identidade visual salva com sucesso! O sistema está aplicando as novas cores...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error instanceof Error && !error.message.includes("sincronização") 
          ? error.message 
          : "⚠️ Ocorreu uma instabilidade na comunicação com o banco de dados. Nosso suporte técnico já foi notificado. Por favor, tente novamente mais tarde." 
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-zinc-500 animate-pulse">Carregando identidade visual...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Identidade Visual</h1>
        <p className="text-zinc-500">Customize as cores, textos e a marca do seu ecossistema White Label.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configurações */}
        <div className="space-y-6">
          {/* Dados Gerais do Estabelecimento */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-zinc-900 font-bold border-b border-zinc-100 pb-4">
              <Palette className="w-5 h-5 text-primary" />
              Dados do Estabelecimento
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Nome do Estabelecimento</label>
                <input 
                  type="text" 
                  placeholder="Meu Estabelecimento"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Slogan ou Frase (Descrição no agendamento)</label>
                <input 
                  type="text" 
                  placeholder="Ex: A melhor barbearia da cidade!"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Paleta de Cores */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-zinc-900 font-bold border-b border-zinc-100 pb-4">
              <Palette className="w-5 h-5 text-primary" />
              Paleta de Cores
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Cor Principal</label>
                <div className="flex gap-3">
                  <input 
                    type="color" 
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="w-12 h-12 rounded-xl border-0 cursor-pointer p-0 overflow-hidden"
                  />
                  <input 
                    type="text" 
                    value={form.primaryColor.toUpperCase()}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="flex-1 px-4 rounded-xl border border-zinc-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">Cor Secundária</label>
                <div className="flex gap-3">
                  <input 
                    type="color" 
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="w-12 h-12 rounded-xl border-0 cursor-pointer p-0 overflow-hidden"
                  />
                  <input 
                    type="text" 
                    value={form.secondaryColor.toUpperCase()}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="flex-1 px-4 rounded-xl border border-zinc-200 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-zinc-900 font-bold border-b border-zinc-100 pb-4">
              <ImageIcon className="w-5 h-5 text-primary" />
              Logotipos e Assets
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">URL da Logo (PNG ou SVG)</label>
                <input 
                  type="text" 
                  placeholder="https://sua-logo.com/logo.png"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700">URL do Favicon (.ico ou .png)</label>
                <input 
                  type="text" 
                  placeholder="https://sua-logo.com/favicon.png"
                  value={form.favIconUrl}
                  onChange={(e) => setForm({ ...form, favIconUrl: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="bg-zinc-950 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group min-h-[360px] flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: form.primaryColor }} />
            
            <div>
              <h3 className="text-white/30 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Live Preview</h3>
              
              <div className="text-center py-4 border-b border-white/5 mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 text-white font-black text-xl shadow-lg" style={{ backgroundColor: form.primaryColor }}>
                  {form.name ? form.name.charAt(0).toUpperCase() : "B"}
                </div>
                <h4 className="text-white font-bold text-lg">{form.name || "Seu Estabelecimento"}</h4>
                <p className="text-zinc-400 text-xs mt-1">{form.description || "Seu slogan ou frase de impacto aparecerá aqui"}</p>
              </div>

              <div className="flex flex-wrap gap-4 items-center justify-center">
                <div 
                  className="px-6 py-2.5 rounded-xl font-bold text-white shadow-xl text-sm transition-all duration-500 cursor-default"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Botão Principal
                </div>

                <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: form.primaryColor }}>
                  <CheckCircle2 className="w-5 h-5" />
                  Destaque Ativo
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-6">
               <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner" style={{ backgroundColor: form.primaryColor }}>
                    {form.name ? form.name.charAt(0).toUpperCase() : "B"}
                  </div>
                  <div className="flex-1">
                    <div className="w-24 h-2.5 bg-white/20 rounded-full mb-2" />
                    <div className="w-16 h-2 bg-white/10 rounded-full" />
                  </div>
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: form.secondaryColor }} />
                </div>
              </div>
            </div>
          </div>

          {/* Status e Ação */}
          <div className="space-y-4">
            {status && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 animate-in zoom-in-95 duration-300 ${
                status.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <p className="text-sm font-semibold leading-snug">{status.message}</p>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: saving ? '#3f3f46' : form.primaryColor }}
              className="w-full flex items-center justify-center gap-3 py-4.5 rounded-[1.25rem] text-white font-bold text-lg shadow-2xl shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Save className="w-6 h-6" />
                  Publicar Identidade Visual
                </>
              )}
            </button>
            
            <p className="text-center text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
              As alterações afetarão o Dashboard, App de Agendamento e Emails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
