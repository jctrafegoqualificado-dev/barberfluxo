import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const serverUrl = `${url.protocol}//${url.host}`;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "BarberFluxo Public API",
      version: "1.0.0",
      description:
        "API pública (sem autenticação) usada por bots/integrações externas (ex.: n8n + WhatsApp) para consultar barbearia e gerenciar agendamentos.",
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "Barbershop", description: "Informações públicas da barbearia" },
      { name: "Catalog", description: "Serviços, preços e barbeiros" },
      { name: "Scheduling", description: "Horários disponíveis e agendamentos" },
    ],
    paths: {
      "/api/v1/barbershops/{slug}": {
        get: {
          tags: ["Barbershop"],
          summary: "Informações da barbearia",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" }, description: "Slug único da barbearia" },
          ],
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Barbershop" } } },
            },
            "404": { description: "Barbearia não encontrada" },
          },
        },
      },
      "/api/v1/barbershops/{slug}/services": {
        get: {
          tags: ["Catalog"],
          summary: "Lista de serviços ativos",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      services: { type: "array", items: { $ref: "#/components/schemas/Service" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/barbershops/{slug}/barbers": {
        get: {
          tags: ["Catalog"],
          summary: "Lista de barbeiros ativos",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      barbers: { type: "array", items: { $ref: "#/components/schemas/Barber" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/barbershops/{slug}/slots": {
        get: {
          tags: ["Scheduling"],
          summary: "Horários disponíveis para um barbeiro/serviço numa data",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            { name: "date", in: "query", required: true, schema: { type: "string", format: "date" }, description: "YYYY-MM-DD" },
            { name: "barberId", in: "query", required: true, schema: { type: "string" } },
            { name: "serviceId", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lista de horários (vazia se barbearia fechada ou barbeiro de folga)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      date: { type: "string", format: "date" },
                      dayOfWeek: { type: "integer", minimum: 0, maximum: 6 },
                      duration: { type: "integer", description: "Duração do serviço em minutos" },
                      slots: { type: "array", items: { type: "string", example: "14:00" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/barbershops/{slug}/appointments": {
        get: {
          tags: ["Scheduling"],
          summary: "Agendamentos futuros de um cliente (por telefone)",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            { name: "clientPhone", in: "query", required: true, schema: { type: "string" }, description: "Telefone do cliente (com ou sem máscara)" },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      appointments: { type: "array", items: { $ref: "#/components/schemas/Appointment" } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Scheduling"],
          summary: "Cria agendamento. Se o cliente não existir, cria User automaticamente pelo telefone.",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["date", "startTime", "barberId", "serviceId", "clientPhone", "clientName"],
                  properties: {
                    date: { type: "string", format: "date", example: "2026-05-20" },
                    startTime: { type: "string", example: "14:00" },
                    barberId: { type: "string" },
                    serviceId: { type: "string" },
                    clientPhone: { type: "string", example: "5511999998888" },
                    clientName: { type: "string", example: "João Cliente" },
                    notes: { type: "string", nullable: true },
                    paymentMethod: { type: "string", enum: ["CASH", "PIX", "CREDIT_CARD", "DEBIT_CARD"], default: "CASH" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Criado",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { appointment: { $ref: "#/components/schemas/Appointment" } },
                  },
                },
              },
            },
            "409": { description: "Conflito (horário ocupado, fora do funcionamento, barbeiro de folga)" },
          },
        },
      },
      "/api/v1/barbershops/{slug}/appointments/{id}/cancel": {
        patch: {
          tags: ["Scheduling"],
          summary: "Cancela um agendamento (status → CANCELLED)",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      appointment: {
                        type: "object",
                        properties: { id: { type: "string" }, status: { type: "string", example: "CANCELLED" } },
                      },
                    },
                  },
                },
              },
            },
            "404": { description: "Agendamento não encontrado" },
            "409": { description: "Já cancelado ou concluído" },
          },
        },
      },
    },
    components: {
      schemas: {
        Barbershop: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            phone: { type: "string", nullable: true },
            address: { type: "string", nullable: true },
            city: { type: "string", nullable: true },
            state: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            logoUrl: { type: "string", nullable: true },
            active: { type: "boolean" },
            openingHours: { type: "array", items: { $ref: "#/components/schemas/OpeningHour" } },
          },
        },
        OpeningHour: {
          type: "object",
          properties: {
            dayOfWeek: { type: "integer", minimum: 0, maximum: 6, description: "0=Domingo ... 6=Sábado" },
            openTime: { type: "string", example: "09:00" },
            closeTime: { type: "string", example: "20:00" },
            isOpen: { type: "boolean" },
          },
        },
        Service: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            price: { type: "number", format: "float" },
            duration: { type: "integer", description: "Duração em minutos" },
          },
        },
        Barber: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string", description: "Nome do User vinculado" },
            nickname: { type: "string", nullable: true },
            photoUrl: { type: "string", nullable: true },
            dayOff: { type: "integer", nullable: true, minimum: 0, maximum: 6 },
          },
        },
        Appointment: {
          type: "object",
          properties: {
            id: { type: "string" },
            date: { type: "string", format: "date" },
            startTime: { type: "string", example: "14:00" },
            endTime: { type: "string", example: "14:30" },
            status: { type: "string", example: "PENDING" },
            price: { type: "number", format: "float" },
            paymentMethod: { type: "string", nullable: true },
            notes: { type: "string", nullable: true },
            client: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                phone: { type: "string", nullable: true },
              },
            },
            barber: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                nickname: { type: "string", nullable: true },
              },
            },
            service: { $ref: "#/components/schemas/Service" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
