"use client";
import { Suspense } from "react";
import AgendaView from "@/components/agenda/AgendaView";

export default function MinhaAgendaPage() {
  return <Suspense><AgendaView mode="barber" /></Suspense>;
}
