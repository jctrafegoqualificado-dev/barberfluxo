"use client";
import { Suspense } from "react";
import AssinantesView from "@/components/assinantes/AssinantesView";

export default function AssinantesBarbeiroPage() {
  return <Suspense><AssinantesView mode="barber" /></Suspense>;
}
