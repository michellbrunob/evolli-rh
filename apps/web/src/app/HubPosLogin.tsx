/**
 * Hub pós-login (T162) — a primeira tela depois de o ator ser resolvido.
 *
 * ## O que muda, e por quê
 *
 * Até a T161 o login levava direto ao shell de módulos, já num destino. A
 * T153 corrigiu o pior efeito disso (aterrissar num 403) escolhendo o destino
 * pelo papel, mas a pergunta que quem entra realmente faz continuava sem
 * resposta na tela: **o que este acesso abre?** O shell responde "o menu que
 * sobrou", de relance, misturado com a tela que já montou.
 *
 * O Hub responde antes de qualquer tela funcional montar, e responde só com o
 * que o servidor autoriza no contexto atual.
 *
 * ## A regra é a da T159, um nível acima
 *
 * Menu é promessa; cartão de produto também — e um cartão promete mais, porque
 * não tem abas. Ele leva ao destino, que abre na aba padrão e dispara a
 * primeira requisição dela. Por isso a lista de cartões **não** sai de
 * `destinoVisivelPara` (que mantém contêineres incondicionais, e deve mesmo
 * manter), e sim de `capacidadeFuncionalDe` — derivada do `rbac.evaluator`,
 * recurso por recurso. Ver o bloco de comentário dessa função.
 *
 * Superfície demonstrativa não vira cartão. Ela existe desde a T159, continua
 * alcançável pelo shell, e aqui aparece num bloco separado e nomeado — nunca
 * anunciada como produto entregue.
 *
 * ## Empresa: contexto do servidor, e agora também troca (T163)
 *
 * Na T162 este bloco dizia que **não existia contrato de troca de empresa**, e
 * por isso a empresa aparecia só como texto. A T163 criou o contrato, e o que
 * mudou aqui é exatamente o que o contrato passou a permitir — nada além.
 *
 * **A empresa ativa não é escolhida pelo navegador.** Ela vive em
 * `access_session.empresa_ativa_id`, e chega pronta em `GET /v1/users/me`
 * como `empresaAtiva`. Não há `localStorage`, `sessionStorage`, query string
 * nem cookie escrito por script nesta tela — procurar por eles neste arquivo
 * é um teste da suíte, e ele falha se algum aparecer.
 *
 * **Quem vê seletor é quem o servidor diz que pode.** `podeTrocarEmpresa` vem
 * de `/users/me`; as opções vêm de `GET /v1/auth/contexto/empresas`, que
 * responde **403** a papel sem poder de seleção. O frontend não decide isso, e
 * nem teria como: a rota recusa gestor e colaborador mesmo que esta tela
 * pedisse a lista.
 *
 * **T189 — um componente só.** O `<select>` que morava aqui deu lugar ao
 * `SeletorEmpresaAtiva`, o mesmo do topo do menu lateral do shell. A lista de
 * empresas, o carregamento, a falha e a troca moram nele; o Hub só o põe na
 * tela e repassa a confirmação do servidor.
 *
 * **A troca remonta tudo.** Depois do `POST /v1/auth/contexto/empresa`, o
 * `AutenticacaoApp` reresolve o ator e troca a `key` da árvore — Hub e
 * módulos nascem de novo no contexto novo. É assim que nenhum dado da empresa
 * anterior sobra na tela: não há o que limpar, porque os componentes que o
 * exibiam deixaram de existir.
 *
 * ### A R-2 da T162 morreu aqui, e dá para verificar
 *
 * A ressalva era: o Hub lia `GET /v1/empresas` **a cada montagem**, e aquela
 * rota chama `registrarConsultaAmpla` — um registro de auditoria por visita.
 * Agora o nome vem dentro de `/users/me`, leitura direta por id que o SPA já
 * fazia de qualquer jeito. Este arquivo **não importa mais
 * `organizacaoClient`**, e há teste que prende isso.
 *
 * ### O que continua valendo da T162
 *
 * - `gestor` e `colaborador` seguem sem seletor e sem lista de empresas;
 * - `master_tecnico` **sem seleção** continua em escopo global, e a tela diz
 *   isso em vez de escolher uma empresa por ele;
 * - nenhum nome de empresa fora do escopo da sessão chega à tela, porque o
 *   único nome exibido é o que o servidor devolveu como empresa ativa.
 *
 * ## Fail-closed
 *
 * Falha ao carregar as opções de troca **não** monta o shell nem esconde o
 * problema: o Hub continua na tela, informa e oferece nova tentativa. Os
 * produtos seguem listados — eles dependem do papel, não desta leitura.
 */
import { useEffect, useRef } from "react";
import "./HubPosLogin.css";
import { IconeModulo, MarcaEvolli } from "./IconeModulo";
import type { IconeModuloId } from "./IconeModulo";
import {
  capacidadeFuncionalDe,
  DESTINOS_DEMONSTRATIVOS,
  GRUPOS,
  type DestinoNavegacao,
} from "./mapaNavegacao";
import { ROTULO_PAPEL } from "../api/usersClient";
import type { EmpresaDoContextoApi } from "../api/contextoEmpresarialClient";
import { SeletorEmpresaAtiva } from "./SeletorEmpresaAtiva";

/*
 * T163 — as duas listas de papéis que existiam aqui foram REMOVIDAS, e isso é
 * a melhoria, não uma omissão.
 *
 * `PAPEIS_COM_LEITURA_DE_EMPRESA` espelhava `evaluateOrganizacao` à mão, para
 * não pedir `/v1/empresas` a quem levaria 403. `PAPEIS_DE_ESCOPO_GLOBAL`
 * espelhava a política do Master. Duas cópias de regra de servidor vivendo no
 * frontend, que silenciosamente ficariam erradas quando o RBAC mudasse.
 *
 * Agora o servidor responde as duas perguntas: `podeTrocarEmpresa` e
 * `empresaAtiva` vêm de `/users/me`. O frontend não espelha mais nada.
 */

/**
 * O que cada produto faz. Frases descritivas do que a tela já entrega hoje —
 * nenhuma promete recurso inexistente, e nenhuma diz "em breve".
 */
const DESCRICAO_DO_DESTINO: Readonly<Record<string, string>> = {
  // T178 — porta principal de Gestão de Pessoas: só o que a listagem entrega
  // hoje (busca, contadores e ficha), sem cargo nem departamento na linha.
  pessoas:
    "Consulta de colaboradores por nome ou matrícula, ficha, vida funcional e vínculo com horário de trabalho.",
  "nova-admissao":
    "Admissão em página própria: cria o colaborador, o vínculo previsto e o ato de admissão na empresa ativa.",
  cadastros:
    "Estrutura organizacional da empresa: unidades, departamentos, áreas, equipes, cargos e centros de custo.",
  // T182 — tela própria do catálogo de jornadas (antes a aba Horários).
  "jornadas-trabalho":
    "Jornadas de trabalho da empresa: código, nome e os dias e horários de cada turno.",
  ponto: "Registros de ponto do período e conferência das folhas apuradas.",
  equipe:
    "Consulta da sua equipe: quem responde a você hoje, pela atribuição vigente.",
  "administracao-lideranca":
    "Atribuição de gestores a equipes, com vigência e histórico.",
  "contas-acesso": "Contas de acesso, papéis e redefinição de segundo fator.",
};

/** Ícone do grupo a que o destino pertence — mesma identidade da barra lateral. */
const ICONE_DO_DESTINO: Readonly<Record<string, IconeModuloId>> =
  Object.fromEntries(
    GRUPOS.flatMap((grupo) =>
      grupo.destinos.map((destino) => [destino.id, grupo.icone] as const),
    ),
  );

export interface HubPosLoginProps {
  /** Papel decidido pelo SERVIDOR (`GET /v1/users/me`), já resolvido. */
  readonly papelDoAtor: string;
  /**
   * T163 — a empresa **ATIVA** desta sessão, resolvida pelo servidor, já com
   * nome e código. Nula em escopo global (`master_tecnico` sem seleção).
   */
  readonly empresaAtiva: EmpresaDoContextoApi | null;
  /**
   * T163 — o servidor diz se este papel escolhe empresa. O frontend não
   * deduz: a rota de opções recusaria quem não pode, de todo modo.
   */
  readonly podeTrocarEmpresa: boolean;
  /** E-mail do ator — o único identificador pessoal que a API devolve. */
  readonly emailDoAtor: string;
  /** Abre um destino no shell. Só recebe id que veio de um item desta tela. */
  readonly onAbrirDestino: (destinoId: string) => void;
  /**
   * Chamado depois de o SERVIDOR confirmar a troca. Quem monta esta tela
   * reresolve o ator e remonta a árvore — é isso que garante que nada da
   * empresa anterior siga na tela.
   */
  readonly onEmpresaTrocada: (empresa: EmpresaDoContextoApi) => void;
  readonly onLogout: () => void;
  /**
   * T189 — ao montar, levar o foco ao título. Usado depois de uma troca de
   * empresa feita aqui: a tela foi recriada e o foco não pode ficar perdido.
   */
  readonly focarTituloAoAbrir?: boolean;
}

export function HubPosLogin({
  papelDoAtor,
  empresaAtiva,
  podeTrocarEmpresa,
  emailDoAtor,
  onAbrirDestino,
  onEmpresaTrocada,
  onLogout,
  focarTituloAoAbrir = false,
}: HubPosLoginProps) {
  const produtos = capacidadeFuncionalDe(papelDoAtor);

  const tituloRef = useRef<HTMLHeadingElement | null>(null);
  const focarTituloRef = useRef(focarTituloAoAbrir);
  useEffect(() => {
    if (!focarTituloRef.current) return;
    focarTituloRef.current = false;
    tituloRef.current?.focus();
  }, []);

  const rotuloDoPapel = ROTULO_PAPEL[papelDoAtor] ?? papelDoAtor;

  return (
    <div className="hub">
      <a className="hub__skip-link" href="#hub-conteudo">
        Pular para o conteúdo
      </a>

      <header className="hub__topo">
        <div className="hub__topo-inner">
          <span className="hub__marca">
            <MarcaEvolli />
            <span className="hub__marca-nome">Evolli RH</span>
          </span>
          <div className="hub__acoes">
            <span className="hub__papel">{rotuloDoPapel}</span>
            <button type="button" className="hub__sair" onClick={onLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="hub__area" id="hub-conteudo">
        <div className="hub__area-inner">
          <h1 className="hub__titulo" ref={tituloRef} tabIndex={-1}>
            Seu acesso
          </h1>
          <p className="hub__intro">
            Estes são os produtos que o seu acesso abre hoje. O que não aparece
            aqui não está liberado para o seu perfil.
          </p>

          <ContextoDaSessao
            email={emailDoAtor}
            rotuloDoPapel={rotuloDoPapel}
            empresaAtiva={empresaAtiva}
            podeTrocarEmpresa={podeTrocarEmpresa}
            papelDoAtor={papelDoAtor}
            onEmpresaTrocada={onEmpresaTrocada}
          />

          <section className="hub__secao" aria-labelledby="hub-produtos">
            <h2 className="hub__secao-titulo" id="hub-produtos">
              Produtos disponíveis
            </h2>
            {produtos.length === 0 ? (
              <p className="hub__vazio">
                Nenhum produto está liberado para o seu perfil no momento. Se
                você precisa de acesso a algum módulo, fale com quem administra
                o Evolli RH na sua empresa.
              </p>
            ) : (
              <ul className="hub__cartoes">
                {produtos.map((destino) => (
                  <li key={destino.id}>
                    <CartaoDeProduto
                      destino={destino}
                      onAbrir={() => onAbrirDestino(destino.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hub__secao" aria-labelledby="hub-demonstracao">
            <h2 className="hub__secao-titulo" id="hub-demonstracao">
              Demonstração
            </h2>
            <p className="hub__aviso-demonstracao">
              Superfícies de exemplo. Nada aqui grava, consulta o servidor ou
              representa capacidade disponível — não são produtos entregues.
            </p>
            <ul className="hub__lista-demonstracao">
              {DESTINOS_DEMONSTRATIVOS.map((destino) => (
                <li key={destino.id}>
                  <button
                    type="button"
                    className="hub__item-demonstracao"
                    onClick={() => onAbrirDestino(destino.id)}
                  >
                    {destino.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

interface ContextoDaSessaoProps {
  readonly email: string;
  readonly rotuloDoPapel: string;
  readonly empresaAtiva: EmpresaDoContextoApi | null;
  readonly podeTrocarEmpresa: boolean;
  readonly papelDoAtor: string;
  readonly onEmpresaTrocada: (empresa: EmpresaDoContextoApi) => void;
}

/**
 * O contexto da sessão.
 *
 * `Conta` e `Perfil` são texto, porque nada neles é editável. `Empresa` é o
 * `SeletorEmpresaAtiva` (T189) — o MESMO componente do topo do menu lateral:
 * só leitura para quem não troca ou tem uma empresa só; lista das
 * autorizadas, com a atual marcada, para quem o servidor deixa trocar.
 */
function ContextoDaSessao({
  email,
  rotuloDoPapel,
  empresaAtiva,
  podeTrocarEmpresa,
  papelDoAtor,
  onEmpresaTrocada,
}: ContextoDaSessaoProps) {
  return (
    <dl className="hub__contexto">
      <div className="hub__contexto-item">
        <dt>Conta</dt>
        <dd>{email}</dd>
      </div>
      <div className="hub__contexto-item">
        <dt>Perfil</dt>
        <dd>{rotuloDoPapel}</dd>
      </div>
      <div className="hub__contexto-item hub__contexto-item--empresa">
        {/* O componente já diz "Empresa ativa" à vista; o `dt` existe para a
            estrutura da lista de definição, sem repetir o rótulo na tela. */}
        <dt className="hub__contexto-oculto">Empresa</dt>
        <dd>
          <SeletorEmpresaAtiva
            id="hub-empresa-ativa"
            variante="hub"
            empresaAtiva={empresaAtiva}
            podeTrocarEmpresa={podeTrocarEmpresa}
            papelDoAtor={papelDoAtor}
            onEmpresaTrocada={onEmpresaTrocada}
          />
        </dd>
      </div>
    </dl>
  );
}

interface CartaoDeProdutoProps {
  readonly destino: DestinoNavegacao;
  readonly onAbrir: () => void;
}

/**
 * Um `<button>`, não um link: a navegação deste produto é estado do shell e
 * não tem URL desde a T044. Um `<a href="#">` seria um link que não leva a
 * lugar nenhum — pior para quem navega por teclado e por leitor de tela.
 */
function CartaoDeProduto({ destino, onAbrir }: CartaoDeProdutoProps) {
  const icone = ICONE_DO_DESTINO[destino.id];
  const descricao = DESCRICAO_DO_DESTINO[destino.id];
  return (
    <button type="button" className="hub__cartao" onClick={onAbrir}>
      {icone ? (
        <span className="hub__cartao-icone" aria-hidden="true">
          <IconeModulo nome={icone} />
        </span>
      ) : null}
      <span className="hub__cartao-texto">
        <span className="hub__cartao-titulo">{destino.label}</span>
        {destino.subRotulo ? (
          <span className="hub__cartao-sub">{destino.subRotulo}</span>
        ) : null}
        {descricao ? (
          <span className="hub__cartao-descricao">{descricao}</span>
        ) : null}
      </span>
    </button>
  );
}
