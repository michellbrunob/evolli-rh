/**
 * T208 — Configurações › Meu perfil (MP-1 a MP-8).
 *
 * A conta de acesso da própria pessoa logada, **só leitura**: o e-mail com
 * que ela entra, o papel, a empresa ativa e a data de criação da conta.
 *
 * ## Sem requisição própria
 *
 * Tudo vem do ator que a sessão já leu em `GET /v1/users/me` (o mesmo objeto
 * que decide o papel e a empresa do shell). A tela não chama a API: ela só
 * depende do CONTRATO dessa leitura (`SafeAccessUserApi`) e dos rótulos de
 * papel do mesmo cliente. Trocar de empresa remonta a árvore e esta tela
 * nasce com a empresa nova.
 *
 * ## O que fica de fora, de propósito
 *
 * Nada de identificador interno, situação da conta, unidade, equipe, nome,
 * documento, contato, foto, idioma ou preferência — a conta não tem esses
 * dados, ou eles pertencem ao cadastro de colaborador, que não é desta tela.
 * Também não há campo editável, botão inativo nem promessa: a edição ainda
 * não existe, e a tela diz isso em texto.
 *
 * A navegação interna tem um item só, Meu perfil. Segurança, Empresas e
 * Equipe e permissões não aparecem até terem tela.
 */
import { ROTULO_PAPEL, type SafeAccessUserApi } from "../../api/usersClient";
import { PageHeader, TrilhaNavegacao } from "../../components";
import { AUSENTE, formatarInstante } from "../../format/data";
import "./MeuPerfilScreen.css";

/** `id` do `h1` da tela — o título que recebe o foco ao abrir. */
export const CONFIGURACOES_TITULO_ID = "configuracoes-titulo";
const MEU_PERFIL_TITULO_ID = "configuracoes-meu-perfil-titulo";
const GRUPO_SUA_CONTA_ID = "configuracoes-grupo-sua-conta";

/** Só os campos do ator que esta tela exibe. */
export type ContaDoMeuPerfil = Pick<
  SafeAccessUserApi,
  "email" | "role" | "createdAt" | "empresaAtiva"
>;

export interface MeuPerfilScreenProps {
  /** A conta da sessão; `null` só quando o shell monta sem ator (testes). */
  readonly conta: ContaDoMeuPerfil | null;
}

/** A data (sem a hora) do instante de criação, no fuso de negócio. */
function dataDaCriacao(instante: string | undefined): string {
  const formatado = formatarInstante(instante);
  return formatado.split(" às ")[0] ?? AUSENTE;
}

export function MeuPerfilScreen({ conta }: MeuPerfilScreenProps) {
  const papel =
    conta === null ? AUSENTE : (ROTULO_PAPEL[conta.role] ?? conta.role);
  const empresa = conta?.empresaAtiva ?? null;

  return (
    <div className="configuracoes">
      <TrilhaNavegacao
        itens={[{ rotulo: "Configurações" }, { rotulo: "Meu perfil" }]}
      />
      <PageHeader
        headingLevel={1}
        titleId={CONFIGURACOES_TITULO_ID}
        title="Configurações"
        description="A sua conta de acesso ao Evolli RH."
      />

      <div className="configuracoes__corpo">
        <nav className="configuracoes__navegacao" aria-label="Configurações">
          <p className="configuracoes__grupo" id={GRUPO_SUA_CONTA_ID}>
            Sua conta
          </p>
          <ul
            className="configuracoes__itens"
            aria-labelledby={GRUPO_SUA_CONTA_ID}
          >
            <li>
              <a
                className="configuracoes__item configuracoes__item--atual"
                href="#/configuracoes/meu-perfil"
                aria-current="page"
              >
                Meu perfil
              </a>
            </li>
          </ul>
        </nav>

        <section
          className="configuracoes__painel"
          aria-labelledby={MEU_PERFIL_TITULO_ID}
        >
          <h2 className="configuracoes__titulo" id={MEU_PERFIL_TITULO_ID}>
            Meu perfil
          </h2>
          <p className="configuracoes__texto">
            Os dados da conta com que você entrou.
          </p>

          <dl className="configuracoes__dados">
            <div className="configuracoes__dado">
              <dt>E-mail de acesso</dt>
              <dd>{conta?.email ?? AUSENTE}</dd>
            </div>
            <div className="configuracoes__dado">
              <dt>Papel</dt>
              <dd>{papel}</dd>
            </div>
            <div className="configuracoes__dado">
              <dt>Empresa ativa</dt>
              <dd>
                {conta === null
                  ? AUSENTE
                  : empresa === null
                    ? "Nenhuma empresa ativa"
                    : `${empresa.nome} (${empresa.codigo})`}
              </dd>
            </div>
            <div className="configuracoes__dado">
              <dt>Conta criada em</dt>
              <dd>
                {conta === null ? (
                  AUSENTE
                ) : (
                  <time dateTime={conta.createdAt}>
                    {dataDaCriacao(conta.createdAt)}
                  </time>
                )}
              </dd>
            </div>
          </dl>

          <p className="configuracoes__aviso">
            A edição destes dados ainda não está disponível. Para corrigir algum
            deles, fale com quem administra o Evolli RH na sua empresa.
          </p>
        </section>
      </div>
    </div>
  );
}
