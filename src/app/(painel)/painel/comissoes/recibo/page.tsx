"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, Scissors, Star } from "lucide-react";

export default function ReciboPage() {
  const searchParams = useSearchParams();
  const barberId = searchParams.get("barberId");
  const monthOffset = searchParams.get("monthOffset") || "0";
  const type = searchParams.get("type") || "STANDARD"; // STANDARD or SUBSCRIPTION
  const token = useAuthStore((s) => s.token);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !barberId) return;
    fetch(`/api/barbershop/comissoes?month=${monthOffset}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.barbers) {
          const barber = res.barbers.find((b: any) => b.id === barberId);
          setData({ barber, mes: res.mes });
        }
        setLoading(false);
      });
  }, [token, barberId, monthOffset]);

  useEffect(() => {
    if (!loading && data) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, data]);

  if (loading) return <div className="p-10 text-center">Gerando recibo...</div>;
  if (!data || !data.barber) return <div className="p-10 text-center text-red-500">Barbeiro não encontrado.</div>;

  const { barber, mes } = data;
  const isSub = type === "SUBSCRIPTION";

  const totalAtendimentos = isSub ? barber.assinatura.servicos : barber.avulso.atendimentos;
  const comissao = isSub ? barber.liquidoAssinatura : barber.liquidoAPagar;
  const nps = barber.npsScore;

  return (
    <div className="min-h-screen bg-white p-8 font-mono text-black">
      <div className="max-w-2xl mx-auto border-2 border-dashed border-zinc-300 p-8 rounded-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold uppercase tracking-widest">Extrato de Performance</h1>
          <p className="text-zinc-500 mt-1">Recibo de Pagamento de Comissões</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-zinc-50 rounded-lg">
            <p className="text-xs text-zinc-500 uppercase">Profissional</p>
            <p className="font-bold text-lg">{barber.name}</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-lg text-right">
            <p className="text-xs text-zinc-500 uppercase">Competência</p>
            <p className="font-bold text-lg capitalize">{mes}</p>
          </div>
        </div>

        {/* PERFORMANCE SECTION */}
        <div className="mb-8 border border-zinc-200 rounded-lg p-5 bg-white">
          <h2 className="text-sm font-bold uppercase mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" /> Suas Conquistas no Mês
          </h2>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-3xl font-black">{totalAtendimentos}</p>
              <p className="text-xs text-zinc-500 uppercase">Clientes Atendidos</p>
            </div>
            <div>
              <p className="text-3xl font-black">{nps !== null ? nps : "--"}</p>
              <p className="text-xs text-zinc-500 uppercase">NPS (Satisfação)</p>
            </div>
          </div>
        </div>

        {/* FINANCIAL SECTION */}
        <div className="mb-8">
          <h2 className="text-sm font-bold uppercase mb-4 flex items-center gap-2 border-b pb-2">
            <CheckCircle2 className="w-4 h-4" /> Detalhamento Financeiro ({isSub ? "Assinaturas" : "Avulsos"})
          </h2>
          
          {!isSub && (
            <>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span>Comissão Avulsa Bruta</span>
                <span>{formatCurrency(barber.avulso.comissao)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span>Comissão de Produtos</span>
                <span>{formatCurrency(barber.produtos.comissao)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 text-red-600">
                <span>Descontos (Vales Adiantados)</span>
                <span>- {formatCurrency(barber.totalVales)}</span>
              </div>
            </>
          )}

          {isSub && (
            <div className="flex justify-between py-2 border-b border-zinc-100">
              <span>Comissão Pool de Assinaturas</span>
              <span>{formatCurrency(barber.assinatura.comissao)}</span>
            </div>
          )}

          <div className="flex justify-between py-4 mt-4 bg-zinc-100 px-4 rounded-lg font-bold text-xl">
            <span>Total Líquido Pago</span>
            <span>{formatCurrency(comissao)}</span>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="mt-16 pt-8 text-center border-t border-zinc-300">
          <p className="text-xs text-zinc-500 mb-8">
            Declaro ter recebido a importância supra descrita e que o valor confere exatamente com as regras de comissionamento acordadas.
          </p>
          <div className="w-64 border-b border-black mx-auto mb-2"></div>
          <p className="font-bold">{barber.name}</p>
          <p className="text-xs text-zinc-500">Assinatura</p>
        </div>
      </div>
      
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .min-h-screen, .min-h-screen * {
            visibility: visible;
          }
          .min-h-screen {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
}
