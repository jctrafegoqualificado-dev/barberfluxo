import Link from "next/link";
import { Scissors, Calendar, Users, CreditCard, ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">BarberApp</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-white transition-colors">Entrar</Link>
          <Link href="/cadastro" className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 font-medium transition-colors">Começar grátis</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 text-amber-400 text-sm font-medium mb-6">
          🚀 Sistema completo para barbearias
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight">
          Gerencie sua barbearia<br />
          <span className="text-amber-400">do jeito certo</span>
        </h1>
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          Agendamento online, gestão de assinaturas, controle financeiro e muito mais — tudo em um só lugar.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/cadastro" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 font-semibold text-lg transition-colors">
            Criar conta grátis <ChevronRight className="w-5 h-5" />
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-semibold text-lg transition-colors">
            Já tenho conta
          </Link>
        </div>
      </main>

      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-3 gap-6">
          {[
            { icon: Calendar, title: "Agendamento Online 24h", desc: "Clientes agendam pelo celular a qualquer hora, sem depender do WhatsApp." },
            { icon: CreditCard, title: "Clube de Assinaturas", desc: "Fidelize clientes com planos mensais. Receita recorrente e previsível." },
            { icon: Users, title: "Gestão de Barbeiros", desc: "Controle comissões, agenda e desempenho de cada profissional." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
