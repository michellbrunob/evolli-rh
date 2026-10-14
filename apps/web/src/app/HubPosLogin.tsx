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
 * ## Empresa: contexto, nunca seletor
 *
 * **Não existe contrato de troca de empresa ou de escopo de sessão.** A
 * empresa do ator é `access_user.companyId`, uma coluna da conta; o
 * controlador de autenticação tem apenas login, logout, CSRF, sessões e
 * redefinição de senha. Então aqui a empresa é texto: sem seletor clicável,
 * sem empresa fictícia, sem simulação de troca. Implementar troca exigiria
 * contrato de servidor que não existe, e inventá-lo no frontend seria inventar
 * escopo de acesso.
 *
 * O nome vem de `GET /v1/empresas`, guardado por `empresa:read` e com o escopo
 * resolvido **no servidor** (`filtroDeEscopo`): para `rh` e `dp` a resposta já
 * contém apenas a própria empresa. Nada é carregado "para depois filtrar".
 *
 * Três consequências de contrato, todas visíveis na tela:
 *
 * - `gestor` e `colaborador` **não têm `empresa:read`**. Para eles não há como
 *   ler o nome da empresa — e o Hub diz isso, em vez de inventar um.
 * - `master_tecnico` **não tem empresa**: `companyId` é nulo e o escopo é
 *   global. Mostrar "a empresa dele" seria escolher uma entre várias.
 * - se o item devolvido não for a empresa da sessão, o nome **não** é exibido.
 *   A conferência é barata e fecha a única porta por onde um nome fora do
 *   escopo poderia aparecer.
 *
 * ## Fail-closed
 *
 * Falha ao ler a empresa **não** monta o shell nem esconde o problema: o Hub
 * continua na tela, diz que o contexto não pôde ser carregado e oferece nova
 * tentativa. Os produtos seguem listados — eles dependem do papel, que já foi
 * resolvido pelo `AutenticacaoApp`, não desta leitura.
 */
import { useCallback, useEffect, useState } from "react";
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
import { listarEmpresas } from "../api/organizacaoClient";

/**
 * Papéis a que `evaluateOrganizacao` concede `empresa`/`read`.
 *
 * `financeiro` fica de fora de propósito: o ramo dele exige
 * `resource === "centro_custo"`, então `empresa:read` é negado. Pedir a lista
 * para quem o servidor vai recusar renderia um 403 garantido a cada abertura
 * do Hub — ruído no log de auditoria e nada na tela.
 */
const PAPEIS_COM_LEITURA_DE_EMPRESA: readonly string[] = [
  "rh",
  "dp",
  "master_tecnico",
];

/** Papéis cujo escopo é a instância inteira, sem empresa de contexto. */
const PAPEIS_DE_ESCOPO_GLOBAL: readonly string[] = ["master_tecnico"];

/**
 * O que cada produto faz. Frases descritivas do que a tela já entrega hoje —
 * nenhuma promete recurso inexistente, e nenhuma diz "em breve".
 */
const DESCRICAO_DO_DESTINO: Readonly<Record<string, string>> = {
  pessoas:
    "Cadastro de colaboradores, vida funcional e vínculo com horário de trabalho.",
  cadastros:
    "Tabelas de horário e a estrutura organizacional da empresa: unidades, departamentos, áreas, equipes, cargos e centros de custo.",
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

/** Estado da leitura do contexto de empresa. */
type EstadoEmpresa =
  /** O papel não tem `empresa:read`, ou o escopo é global: nada a buscar. */
  | { readonly tipo: "nao-aplicavel" }
  | { readonly tipo: "carregando" }
  | {
      readonly tipo: "carregada";
      readonly nome: string;
      readonly codigo: string;
    }
  /** Leitura concluída sem a empresa da sessão: não se exibe nome nenhum. */
  | { readonly tipo: "indisponivel" }
  | { readonly tipo: "falha" };

export interface HubPosLoginProps {
  /** Papel decidido pelo SERVIDOR (`GET /v1/users/me`), já resolvido. */
  readonly papelDoAtor: string;
  /** Empresa da sessão, da mesma leitura. Nulo em escopo global. */
  readonly empresaDoAtor: string | null;
  /** E-mail do ator — o único identificador pessoal que a API devolve. */
  readonly emailDoAtor: string;
  /** Abre um destino no shell. Só recebe id que veio de um item desta tela. */
  readonly onAbrirDestino: (destinoId: string) => void;
  readonly onLogout: () => void;
}

export function HubPosLogin({
  papelDoAtor,
  empresaDoAtor,
  emailDoAtor,
  onAbrirDestino,
  onLogout,
}: HubPosLoginProps) {
  const produtos = capacidadeFuncionalDe(papelDoAtor);
  const escopoGlobal = PAPEIS_DE_ESCOPO_GLOBAL.includes(papelDoAtor);
  const podeLerEmpresa =
    PAPEIS_COM_LEITURA_DE_EMPRESA.includes(papelDoAtor) &&
    !escopoGlobal &&
    empresaDoAtor !== null;

  const [empresa, setEmpresa] = useState<EstadoEmpresa>(() =>
    podeLerEmpresa ? { tipo: "carregando" } : { tipo: "nao-aplicavel" },
  );
  /** Incrementado pelo botão "Tentar novamente"; redispara o efeito. */
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!podeLerEmpresa) return;
    let cancelado = false;
    setEmpresa({ tipo: "carregando" });

    async function carregar() {
      try {
        const pagina = await listarEmpresas();
        if (cancelado) return;
        // Conferência de escopo, não formalidade: só é exibido o nome da
        // empresa da PRÓPRIA sessão. Qualquer outra coisa que chegasse aqui
        // seria dado fora do escopo, e some em vez de aparecer.
        const minha = pagina.itens.find((e) => e.id === empresaDoAtor);
        if (minha === undefined) {
          setEmpresa({ tipo: "indisponivel" });
          return;
        }
        setEmpresa({
          tipo: "carregada",
          nome: minha.nome,
          codigo: minha.codigo,
        });
      } catch {
        // Nada do corpo da resposta é lido nem exibido: a mensagem é nossa.
        if (!cancelado) setEmpresa({ tipo: "falha" });
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, [podeLerEmpresa, empresaDoAtor, tentativa]);

  const tentarDeNovo = useCallback(() => {
    setTentativa((n) => n + 1);
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
          <h1 className="hub__titulo">Seu acesso</h1>
          <p className="hub__intro">
            Estes são os produtos que o seu acesso abre hoje. O que não aparece
            aqui não está liberado para o seu perfil.
          </p>

          <ContextoDaSessao
            email={emailDoAtor}
            rotuloDoPapel={rotuloDoPapel}
            escopoGlobal={escopoGlobal}
            empresa={empresa}
            onTentarDeNovo={tentarDeNovo}
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
  readonly escopoGlobal: boolean;
  readonly empresa: EstadoEmpresa;
  readonly onTentarDeNovo: () => void;
}

/**
 * O contexto da sessão, em texto. É deliberadamente uma `<dl>` e não um menu:
 * nada aqui é editável, porque não há contrato que permita editar.
 */
function ContextoDaSessao({
  email,
  rotuloDoPapel,
  escopoGlobal,
  empresa,
  onTentarDeNovo,
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
      <div className="hub__contexto-item">
        <dt>Empresa</dt>
        <dd>
          {escopoGlobal ? (
            "Acesso global — não vinculado a uma empresa"
          ) : empresa.tipo === "carregando" ? (
            <span role="status">Carregando…</span>
          ) : empresa.tipo === "carregada" ? (
            <>
              {empresa.nome}{" "}
              <span className="hub__contexto-codigo">({empresa.codigo})</span>
            </>
          ) : empresa.tipo === "falha" ? (
            <span className="hub__contexto-falha">
              <span role="alert">Não foi possível carregar.</span>{" "}
              <button
                type="button"
                className="hub__contexto-retry"
                onClick={onTentarDeNovo}
              >
                Tentar novamente
              </button>
            </span>
          ) : (
            "Não disponível para o seu perfil"
          )}
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
