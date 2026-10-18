"use client";
import { Suspense } from "react";
import AssinantesView from "@/components/assinantes/AssinantesView";

export default function AssinaturasPage() {
  return <Suspense><AssinantesView mode="owner" /></Suspense>;
}
