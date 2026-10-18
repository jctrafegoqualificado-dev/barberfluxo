import { redirect } from "next/navigation";

// Comissões e Ganhos viraram uma tela só ("Seus ganhos").
export default function ComissoesBarbeiroPage() {
  redirect("/barbeiro/producao");
}
