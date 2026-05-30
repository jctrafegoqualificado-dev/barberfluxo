import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.hoisted garante que as variáveis estejam disponíveis dentro das factories de vi.mock
const { mockUserFindUnique, mockBarbershopFindUnique, mockBarberFindUnique } = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockBarbershopFindUnique: vi.fn(),
  mockBarberFindUnique: vi.fn(),
}));

const { mockBcryptCompare } = vi.hoisted(() => ({
  mockBcryptCompare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    barbershop: { findUnique: mockBarbershopFindUnique },
    barber: { findUnique: mockBarberFindUnique },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mockBcryptCompare,
    hash: vi.fn().mockResolvedValue("$2b$12$mocked"),
  },
}));

vi.mock("@/lib/ratelimit", () => ({
  loginRatelimit: {
    limit: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: Date.now() + 60000 }),
  },
}));

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { POST as refreshPOST } from "@/app/api/auth/refresh/route";
import { signToken } from "@/lib/auth";

function makePost(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

const OWNER = {
  id: "user-1",
  name: "João Dono",
  email: "dono@barbearia.com",
  password: "$2b$12$hashed",
  role: "OWNER",
  isPlatformAdmin: false,
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBarbershopFindUnique.mockResolvedValue(null);
    mockBarberFindUnique.mockResolvedValue(null);
  });

  it("retorna token e dados do usuário para credenciais válidas", async () => {
    mockUserFindUnique.mockResolvedValue(OWNER);
    mockBcryptCompare.mockResolvedValue(true);

    const res = await loginPOST(
      makePost("http://localhost/api/auth/login", { email: OWNER.email, password: "senha123" }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.token).toBeDefined();
    expect(data.user.email).toBe(OWNER.email);
    expect(data.user.role).toBe("OWNER");
    expect(data.user).not.toHaveProperty("password");
  });

  it("retorna 401 para senha incorreta", async () => {
    mockUserFindUnique.mockResolvedValue(OWNER);
    mockBcryptCompare.mockResolvedValue(false);

    const res = await loginPOST(
      makePost("http://localhost/api/auth/login", { email: OWNER.email, password: "errada" }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Credenciais inválidas");
  });

  it("retorna 401 para email não cadastrado (sem revelar se email existe)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await loginPOST(
      makePost("http://localhost/api/auth/login", { email: "fantasma@test.com", password: "qualquer" }),
    );

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Credenciais inválidas");
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emite novo token a partir de um token ainda válido", async () => {
    const token = signToken({ id: "user-1", email: OWNER.email, role: "OWNER", barbershopId: "shop-1" });
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: OWNER.email,
      role: "OWNER",
      isPlatformAdmin: false,
    });

    const res = await refreshPOST(
      makePost("http://localhost/api/auth/refresh", {}, { authorization: `Bearer ${token}` }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.token).toBe("string");
    expect(data.token).not.toBe(token); // token novo, não o mesmo
  });

  it("retorna 401 quando nenhum token é enviado", async () => {
    const res = await refreshPOST(makePost("http://localhost/api/auth/refresh", {}));

    expect(res.status).toBe(401);
  });

  it("retorna 401 quando usuário do token não existe mais no banco", async () => {
    const token = signToken({ id: "user-deletado", email: "gone@test.com", role: "OWNER" });
    mockUserFindUnique.mockResolvedValue(null);

    const res = await refreshPOST(
      makePost("http://localhost/api/auth/refresh", {}, { authorization: `Bearer ${token}` }),
    );

    expect(res.status).toBe(401);
  });
});
