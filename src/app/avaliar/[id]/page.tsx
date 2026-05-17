"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Star, MessageSquare, Award, CheckCircle, Loader2, Sparkles, Heart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface AppointmentData {
  id: string;
  client: { name: string };
  barber: { user: { name: string } };
  barbershop: { name: string; logoUrl: string | null; primaryColor: string | null };
  service: { name: string } | null;
  review: any | null;
}

export default function ClientReviewPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/reviews?appointmentId=${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Agendamento inválido ou não encontrado");
        return r.json();
      })
      .then((json) => {
        setData(json.appointment);
        if (json.appointment.review) {
          setSubmitted(true);
          setRating(json.appointment.review.rating);
          setComment(json.appointment.review.comment || "");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === null) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: id, rating, comment }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao salvar avaliação");
      }

      setSubmitted(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
        <p className="text-zinc-400 font-medium">Carregando avaliação...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
          <Heart className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Ops! Link Inválido</h1>
        <p className="text-zinc-400 text-sm max-w-sm">{error || "Não conseguimos localizar este agendamento."}</p>
      </div>
    );
  }

  const primaryColor = data.barbershop.primaryColor || "#f59e0b";

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white p-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <CheckCircle className="w-10 h-10" />
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight mb-2">Avaliação Enviada!</h1>
        <p className="text-zinc-400 text-sm max-w-xs mb-8">
          Muito obrigado, *${data.client.name.split(" ")[0]}*! Sua opinião ajuda a melhorar cada vez mais o serviço de *${data.barbershop.name}*.
        </p>

        {/* Loyalty Reward Card */}
        <div className="w-full max-w-sm bg-zinc-900/50 rounded-2xl border border-zinc-800/80 p-5 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl" />
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Award className="w-6 h-6 animate-bounce" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Programa de Fidelidade</p>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-black text-white mt-0.5">+10 Pontos Ganhos!</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Acumule pontos e troque por prêmios e descontos exclusivos!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/40 rounded-3xl border border-zinc-800/85 p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
        
        {/* Establishiment Name */}
        <div className="text-center mb-6">
          {data.barbershop.logoUrl ? (
            <img src={data.barbershop.logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center text-xl font-black text-zinc-300 mx-auto mb-3">
              {data.barbershop.name[0]}
            </div>
          )}
          <h2 className="text-lg font-black tracking-tight">{data.barbershop.name}</h2>
          <p className="text-xs text-zinc-400 mt-1">Como foi o seu atendimento?</p>
        </div>

        {/* Dynamic description of the appointment */}
        <div className="bg-zinc-900/60 rounded-2xl border border-zinc-800/50 p-4 mb-6">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Serviço:</span>
            <span className="font-bold text-zinc-300">{data.service?.name || "Corte de Cabelo"}</span>
          </div>
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-zinc-500">Profissional:</span>
            <span className="font-bold text-zinc-300">{data.barber.user.name}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NPS Scale: 0 to 10 Buttons */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block text-center">
              Dê sua nota de 0 a 10:
            </label>
            
            {/* Grid of round buttons */}
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 11 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                    rating === i
                      ? "bg-amber-500 text-black scale-110 shadow-lg shadow-amber-500/20"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            {/* Scale Helper Labels */}
            <div className="flex justify-between text-[10px] text-zinc-500 px-1 pt-1">
              <span>Muito insatisfeito (0)</span>
              <span>Muito satisfeito (10)</span>
            </div>
          </div>

          {/* Optional Textarea comment */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Quer deixar algum comentário? (Opcional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte como foi sua experiência, o que você mais gostou ou sugestões..."
              rows={3}
              className="w-full rounded-2xl bg-zinc-900 border border-zinc-800/80 p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={rating === null || submitting}
            style={{ backgroundColor: rating !== null ? primaryColor : undefined }}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              rating === null
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "text-zinc-950 hover:brightness-110 active:scale-95 shadow-xl"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Enviar Avaliação e Ganhar Pontos
              </>
            )}
          </button>
        </form>

        <p className="text-[10px] text-zinc-600 text-center mt-6">
          Ao responder você ganha +10 pontos no programa de fidelidade do estabelecimento.
        </p>
      </div>
    </div>
  );
}
