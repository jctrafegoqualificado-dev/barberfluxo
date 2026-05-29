import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — IaDeBarbearia",
  description: "Como coletamos, usamos e protegemos seus dados pessoais na plataforma IaDeBarbearia.",
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white text-zinc-800" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header className="border-b border-zinc-100 bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-zinc-900 hover:text-orange-500 transition-colors">
            ← IaDeBarbearia
          </Link>
          <span className="text-xs text-zinc-400">Última atualização: maio de 2026</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Política de Privacidade</h1>
        <p className="text-zinc-500 mb-10">
          Esta política descreve como a <strong className="text-zinc-800">IaDeBarbearia</strong> coleta, usa, armazena e protege
          seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>

        <Section title="1. Quem somos">
          <p>
            A <strong>IaDeBarbearia</strong> é uma plataforma SaaS de gestão para barbearias.
            Atuamos como <strong>operadora</strong> dos dados dos clientes finais das barbearias e como
            <strong> controladora</strong> dos dados dos donos e barbeiros que utilizam a plataforma.
            Cada barbearia é controladora dos dados dos seus próprios clientes.
          </p>
          <p className="mt-3">
            Responsável: <a href="mailto:contato@iadebarbearia.com.br" className="text-orange-500 hover:underline">contato@iadebarbearia.com.br</a>
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <Table
            headers={["Categoria", "Dados", "Quem"]}
            rows={[
              ["Conta da barbearia", "Nome, e-mail, telefone, senha (hash bcrypt), nome da empresa", "Dono / Barbeiro"],
              ["Clientes da barbearia", "Nome, telefone, e-mail (opcional), histórico de agendamentos", "Clientes das barbearias"],
              ["Mensagens WhatsApp", "Conteúdo das conversas, número de telefone, payload bruto da API", "Clientes via WhatsApp"],
              ["Pagamentos", "Valor, status, método — dados de cartão tratados exclusivamente pelo MercadoPago", "Assinantes"],
              ["Uso da plataforma", "Logs de acesso, endereço IP, ações realizadas no painel", "Usuários autenticados"],
            ]}
          />
        </Section>

        <Section title="3. Finalidade e base legal">
          <Table
            headers={["Finalidade", "Base legal (LGPD)"]}
            rows={[
              ["Criar e gerenciar conta", "Execução de contrato (art. 7º, V)"],
              ["Processar agendamentos", "Execução de contrato (art. 7º, V)"],
              ["Enviar lembretes via WhatsApp", "Legítimo interesse (art. 7º, IX)"],
              ["Processar cobranças e assinaturas", "Execução de contrato (art. 7º, V)"],
              ["Análise de uso e melhorias", "Legítimo interesse (art. 7º, IX)"],
              ["Cumprimento de obrigações legais", "Cumprimento de obrigação legal (art. 7º, II)"],
            ]}
          />
        </Section>

        <Section title="4. Retenção dos dados">
          <ul className="list-disc list-inside space-y-2 text-zinc-600">
            <li>
              <strong className="text-zinc-800">Dados de conta:</strong> mantidos enquanto a conta estiver ativa.
              Após cancelamento, retidos por até 5 anos para cumprimento de obrigações fiscais e legais, depois excluídos.
            </li>
            <li>
              <strong className="text-zinc-800">Mensagens do WhatsApp:</strong> excluídas automaticamente após
              <strong> 365 dias</strong> (rotina mensal automática). O conteúdo das conversas contém dados pessoais
              e não é retido além do necessário para prestação do serviço.
            </li>
            <li>
              <strong className="text-zinc-800">Histórico de agendamentos:</strong> retido enquanto a conta estiver ativa.
              Pode ser exportado ou excluído mediante solicitação.
            </li>
            <li>
              <strong className="text-zinc-800">Logs de sistema:</strong> retidos por até 90 dias para fins de segurança e diagnóstico.
            </li>
          </ul>
        </Section>

        <Section title="5. Compartilhamento com terceiros">
          <p className="text-zinc-600 mb-4">
            Não vendemos dados pessoais. Compartilhamos apenas com prestadores de serviço essenciais à operação:
          </p>
          <Table
            headers={["Fornecedor", "Finalidade", "País"]}
            rows={[
              ["Vercel", "Hospedagem e execução da aplicação", "EUA"],
              ["Supabase / PostgreSQL", "Banco de dados principal", "EUA"],
              ["Upstash Redis", "Cache e rate limiting", "EUA"],
              ["MercadoPago", "Processamento de pagamentos", "Brasil"],
              ["Evolution API (self-hosted)", "Envio de mensagens WhatsApp", "Brasil"],
              ["Sentry (se configurado)", "Monitoramento de erros", "EUA"],
            ]}
          />
          <p className="text-zinc-500 text-sm mt-3">
            Todos os fornecedores internacionais operam sob mecanismos adequados de transferência (cláusulas contratuais padrão ou equivalentes).
          </p>
        </Section>

        <Section title="6. Seus direitos como titular">
          <p className="text-zinc-600 mb-4">
            De acordo com o art. 18 da LGPD, você tem direito a:
          </p>
          <ul className="list-disc list-inside space-y-2 text-zinc-600">
            <li><strong className="text-zinc-800">Confirmação e acesso</strong> — saber quais dados temos sobre você e obter uma cópia.</li>
            <li><strong className="text-zinc-800">Correção</strong> — atualizar dados incompletos, inexatos ou desatualizados.</li>
            <li><strong className="text-zinc-800">Exclusão</strong> — solicitar a exclusão de dados desnecessários ou tratados em desconformidade com a LGPD.</li>
            <li><strong className="text-zinc-800">Portabilidade</strong> — receber seus dados em formato estruturado e legível por máquina.</li>
            <li><strong className="text-zinc-800">Revogação de consentimento</strong> — quando o tratamento se basear em consentimento, você pode revogá-lo a qualquer momento.</li>
            <li><strong className="text-zinc-800">Oposição</strong> — opor-se a tratamentos realizados com base em legítimo interesse.</li>
          </ul>
          <p className="mt-4 text-zinc-600">
            Para exercer qualquer direito, envie um e-mail para{" "}
            <a href="mailto:contato@iadebarbearia.com.br" className="text-orange-500 hover:underline">
              contato@iadebarbearia.com.br
            </a>{" "}
            com o assunto <em>"Direitos LGPD"</em>. Responderemos em até 15 dias úteis.
          </p>
        </Section>

        <Section title="7. Segurança">
          <ul className="list-disc list-inside space-y-2 text-zinc-600">
            <li>Senhas armazenadas com hash bcrypt (nunca em texto puro).</li>
            <li>Comunicação criptografada via HTTPS/TLS em todo o tráfego.</li>
            <li>Headers de segurança HTTP: HSTS, X-Frame-Options, Content-Security-Policy.</li>
            <li>Acesso administrativo à plataforma protegido por JWT + revalidação no banco.</li>
            <li>Rate limiting por barbearia para proteção contra abuso de APIs.</li>
          </ul>
        </Section>

        <Section title="8. Cookies e rastreamento">
          <p className="text-zinc-600">
            Utilizamos apenas cookies de sessão estritamente necessários para autenticação (JWT em localStorage).
            Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
          </p>
        </Section>

        <Section title="9. Menores de idade">
          <p className="text-zinc-600">
            Nossa plataforma não é direcionada a menores de 18 anos. Não coletamos intencionalmente dados
            de menores. Se identificarmos que coletamos dados de menor sem consentimento do responsável,
            excluiremos os dados imediatamente.
          </p>
        </Section>

        <Section title="10. Atualizações desta política">
          <p className="text-zinc-600">
            Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas
            por e-mail ou notificação no painel com antecedência mínima de 15 dias.
            A data da última atualização está sempre no topo desta página.
          </p>
        </Section>

        <Section title="11. Contato e DPO">
          <p className="text-zinc-600">
            Responsável pelo tratamento de dados (encarregado / DPO provisório):{" "}
            <strong className="text-zinc-800">Equipe IaDeBarbearia</strong>
            <br />
            E-mail:{" "}
            <a href="mailto:contato@iadebarbearia.com.br" className="text-orange-500 hover:underline">
              contato@iadebarbearia.com.br
            </a>
          </p>
          <p className="mt-3 text-zinc-600">
            Você também pode registrar reclamações perante a{" "}
            <strong className="text-zinc-800">Autoridade Nacional de Proteção de Dados (ANPD)</strong>:{" "}
            <span className="text-zinc-500">gov.br/anpd</span>
          </p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-100 mt-12 py-8">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-sm text-zinc-400">
          <span>© 2026 IaDeBarbearia. Todos os direitos reservados.</span>
          <Link href="/" className="hover:text-orange-500 transition-colors">Voltar ao site</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-black text-zinc-900 mb-4 pb-2 border-b border-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 font-bold text-zinc-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-zinc-50/50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-zinc-600 leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
