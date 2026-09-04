import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const serverUrl = `${url.protocol}//${url.host}`;

  const spec = {
    openapi: "3.0.3",
    info: {
      title: "IaDeBarbearia Public API",
      version: "1.0.0",
      description:
        "API protegida por API key (header `x-api-key`) usada por bots/integrações externas (ex.: n8n + WhatsApp) para consultar barbearia e gerenciar agendamentos. Clique em **Authorize** e cole a chave antes de testar.",
    },
    servers: [{ url: serverUrl }],
    security: [{ ApiKeyAuth: [] }],
    tags: [
      { name: "Barbershop", description: "Informações públicas da barbearia" },
      { name: "Catalog", description: "Serviços, preços e barbeiros" },
      { name: "Scheduling", description: "Horários disponíveis e agendamentos" },
      { name: "Subscriptions", description: "Planos de assinatura e situação do assinante" },
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
      "/api/v1/barbershops/{slug}/plans": {
        get: {
          tags: ["Subscriptions"],
          summary: "Planos de assinatura ativos, com preço e serviços inclusos",
          description:
            "Não existe cadastro separado de \"serviços de assinatura\": são os mesmos serviços de /services. O que os torna parte do plano é o vínculo, que carrega `quantity` (usos por ciclo; null = ilimitado).",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      plans: { type: "array", items: { $ref: "#/components/schemas/Plan" } },
                    },
                  },
                },
              },
            },
            "404": { description: "Barbearia não encontrada" },
          },
        },
      },
      "/api/v1/barbershops/{slug}/subscriber": {
        get: {
          tags: ["Subscriptions"],
          summary: "Situação de assinatura de um cliente (por telefone)",
          description:
            "Responde 200 mesmo para quem não é assinante (`isSubscriber: false`). Versão autenticada do lookup usado pela página pública de agendamento — integrações devem usar esta.",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            {
              name: "phone",
              in: "query",
              required: true,
              schema: { type: "string" },
              description: "Telefone do cliente, com ou sem máscara/DDI (casa variações do mesmo número)",
            },
          ],
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/SubscriberStatus" } },
              },
            },
            "400": { description: "Parâmetro phone ausente" },
            "404": { description: "Barbearia não encontrada" },
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
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "Chave compartilhada com o n8n. Configurada na Vercel como `PUBLIC_API_KEY`.",
        },
      },
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
        PlanService: {
          type: "object",
          description: "Serviço incluído num plano",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            price: { type: "number", format: "float", description: "Preço avulso, para comparar com o plano" },
            duration: { type: "integer", description: "Duração em minutos" },
            quantity: {
              type: "integer",
              nullable: true,
              description: "Usos por ciclo. null = ilimitado",
            },
          },
        },
        AllowedBarber: {
          type: "object",
          description: "Barbeiro autorizado a atender pelo plano. Lista vazia = qualquer um atende",
          properties: { id: { type: "string" }, name: { type: "string" } },
        },
        Plan: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            price: { type: "number", format: "float" },
            billingCycle: { type: "string", enum: ["MONTHLY", "QUARTERLY", "YEARLY"] },
            maxUses: { type: "integer", nullable: true, description: "Usos por ciclo no plano todo. null = ilimitado" },
            extraDiscount: { type: "number", format: "float", description: "% de desconto em serviços fora do plano (0 = sem desconto)" },
            beneficiaryRules: { nullable: true, description: "Regras de dependentes, quando o plano permite" },
            services: { type: "array", items: { $ref: "#/components/schemas/PlanService" } },
            allowedBarbers: { type: "array", items: { $ref: "#/components/schemas/AllowedBarber" } },
          },
        },
        SubscriberStatus: {
          type: "object",
          properties: {
            isSubscriber: { type: "boolean" },
            clientName: { type: "string", description: "Ausente quando isSubscriber é false" },
            subscription: {
              type: "object",
              nullable: true,
              properties: {
                id: { type: "string" },
                status: { type: "string", example: "ACTIVE" },
                nextBillingDate: { type: "string", format: "date" },
                usesThisCycle: { type: "integer" },
                maxUses: { type: "integer", nullable: true },
                remainingUses: { type: "integer", nullable: true, description: "null quando o plano é ilimitado" },
                beneficiaries: { nullable: true, description: "Uso por dependente, quando o plano tem beneficiários" },
                plan: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    price: { type: "number", format: "float" },
                    billingCycle: { type: "string" },
                    extraDiscount: { type: "number", format: "float" },
                    services: { type: "array", items: { $ref: "#/components/schemas/PlanService" } },
                    allowedBarbers: { type: "array", items: { $ref: "#/components/schemas/AllowedBarber" } },
                  },
                },
              },
            },
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
