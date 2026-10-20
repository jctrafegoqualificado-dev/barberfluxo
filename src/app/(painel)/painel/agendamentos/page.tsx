"use client";
import { Suspense } from "react";
import AgendaView from "@/components/agenda/AgendaView";

export default function AgendamentosPage() {
  return <Suspense><AgendaView mode="owner" /></Suspense>;
}
