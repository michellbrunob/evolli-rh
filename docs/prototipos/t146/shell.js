/**
 * Comportamento do shell modular (T146, 2ª versão) — protótipo ESTÁTICO.
 *
 * Nenhuma dependência, nenhuma chamada de rede, nenhuma persistência: sem
 * `fetch`, `XMLHttpRequest`, WebSocket, `localStorage`, `sessionStorage` ou
 * cookie. O estado vive em memória e some ao recarregar — é o que se espera de
 * um protótipo que não grava nada.
 *
 * As regras de janela repetem as decisões aprovadas (T142, endurecidas na
 * T144): nome acessível, foco inicial, foco PRESO, devolução ao acionador,
 * `Escape` seguro, confirmação de descarte dentro da própria janela e clique no
 * fundo que NÃO descarta trabalho.
 */
import {
  ESTADOS,
  MODULOS,
  EVOLUCAO_FUTURA,
  INVENTARIO,
  COLABORADORES,
} from "./dados.js";
import { ICONES } from "./icones.js";

const $ = (sel) => document.querySelector(sel);
const shell = $("#shell");
const conteudo = $("#conteudo");
const raizModal = $("#raiz-modal");

/** Escapa texto antes de ir para `innerHTML`. */
const txt = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Selo de estado: superfície + rótulo + ponto. A cor nunca carrega sozinha. */
const selo = (estado) =>
  `<span class="selo selo--${estado}" title="${txt(ESTADOS[estado].explicacao)}"><span class="selo__rotulo">${txt(ESTADOS[estado].rotulo)}</span></span>`;

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Conta telas por estado num módulo. */
function resumoDe(m) {
  const conta = (e) => m.telas.filter((t) => t.estado === e).length;
  return {
    funcional: conta("funcional"),
    parcial: conta("parcial"),
    demonstrativo: conta("demonstrativo"),
    planejado: conta("planejado"),
    total: m.telas.length,
  };
}

/** Prioridade de leitura: o que já dá para usar vem primeiro. */
function prioridade(m) {
  const r = resumoDe(m);
  if (r.funcional > 0) return 0;
  if (r.parcial > 0) return 1;
  if (r.demonstrativo > 0) return 2;
  return 3;
}

let moduloAtivo = "inicio";
let filtroBusca = "";
let filtroSituacao = "todos";

// --------------------------------------------------------------- navegação

function montarLateral() {
  const grupos = [];
  for (const m of MODULOS) {
    let g = grupos.find((x) => x.titulo === m.grupo);
    if (!g) grupos.push((g = { titulo: m.grupo, itens: [] }));
    g.itens.push(m);
  }
  $("#lateral-grupos").innerHTML = grupos
    .map((g, i) => {
      const idGrupo = `grupo-${i}`;
      return `
      <div class="lateral__grupo">
        <p class="lateral__rotulo-grupo" id="${idGrupo}">${txt(g.titulo)}</p>
        <ul class="lateral__lista" aria-labelledby="${idGrupo}">
          ${g.itens
            .map((m) => {
              const r = resumoDe(m);
              return `
            <li>
              <button type="button" class="lateral__link" data-modulo="${txt(m.id)}">
                ${ICONES[m.icone] ?? ""}
                <span class="lateral__texto">${txt(m.nome)}</span>
                <span class="lateral__contador" aria-hidden="true">${r.funcional}/${r.total}</span>
                <span class="sr-only">${plural(r.funcional, "tela funcional", "telas funcionais")} de ${r.total}</span>
              </button>
            </li>`;
            })
            .join("")}
        </ul>
      </div>`;
    })
    .join("");

  for (const b of document.querySelectorAll("[data-modulo]")) {
    b.addEventListener("click", () => {
      irPara(b.dataset.modulo);
      fecharMenuMovel();
    });
  }
}

function irPara(id) {
  moduloAtivo = id;
  const m = MODULOS.find((x) => x.id === id);
  for (const b of document.querySelectorAll("[data-modulo]")) {
    if (b.dataset.modulo === id) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }

  $("#contexto-titulo").textContent = m.nome;
  $("#contexto-apoio").textContent =
    id === "inicio"
      ? "Onde o ecossistema está hoje, módulo a módulo, com o estado real de cada tela."
      : m.resumo;
  $("#contexto-acoes").innerHTML = acoesDoContexto(m);
  document.title = `${m.nome} — protótipo T146 — Evolli RH`;

  conteudo.innerHTML = id === "inicio" ? paginaInicial() : workspace(m);
  ligarAcoes();
  $("#contexto-titulo").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

/** Uma ação primária por contexto — e só uma. */
function acoesDoContexto(m) {
  if (m.id === "pessoas") {
    return `<button type="button" class="botao" data-acao="admissao">${ICONES.mais}Admitir colaborador</button>`;
  }
  if (m.id === "inicio") {
    return `<button type="button" class="botao" data-ir="pessoas">Ver o que já funciona</button>`;
  }
  return `<span class="meta">Nenhuma ação operacional neste módulo do protótipo.</span>`;
}

// ------------------------------------------------------------- páginas

function paginaInicial() {
  const porPrioridade = [...MODULOS].sort(
    (a, b) =>
      prioridade(a) - prioridade(b) || a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const totalReais =
    INVENTARIO.funcional + INVENTARIO.parcial + INVENTARIO.demonstrativo;
  const pct = (n) => (n / totalReais) * 100;

  const cartoes = porPrioridade
    .map((m) => {
      const r = resumoDe(m);
      const estadoTopo =
        r.funcional > 0
          ? "funcional"
          : r.parcial > 0
            ? "parcial"
            : r.demonstrativo > 0
              ? "demonstrativo"
              : "planejado";
      const destaque = r.funcional > 0 ? " modulo--destaque" : "";
      return `
      <button type="button" class="modulo${destaque}" data-ir="${txt(m.id)}">
        <span class="modulo__topo">
          ${ICONES[m.icone] ?? ""}
          <span class="modulo__nome">${txt(m.nome)}</span>
          ${selo(estadoTopo)}
        </span>
        <p class="modulo__resumo">${txt(m.resumo)}</p>
        <span class="modulo__rodape">
          <span class="modulo__progresso">${r.funcional}/${r.total}</span>
          <span class="meta">${r.total === 1 ? "tela funcional" : "telas funcionais"}</span>
        </span>
      </button>`;
    })
    .join("");

  const prontas = MODULOS.filter((m) => resumoDe(m).funcional > 0);

  return `
    <section class="painel-avanco" aria-labelledby="avanco-titulo">
      <div>
        <h2 class="sr-only" id="avanco-titulo">Avanço do ecossistema</h2>
        <strong class="avanco__numero">${INVENTARIO.funcional}</strong>
        <span class="avanco__rotulo">telas já funcionam de verdade</span>
        <span class="avanco__apoio">
          de ${totalReais} telas construídas. Contagem feita a partir do próprio
          código, não é estimativa.
        </span>
      </div>
      <div>
        <div class="barra" role="img"
             aria-label="De ${totalReais} telas construídas: ${INVENTARIO.funcional} funcionais, ${INVENTARIO.parcial} parcial e ${INVENTARIO.demonstrativo} demonstrativas.">
          <span class="barra__parte barra__parte--funcional" style="width:${pct(INVENTARIO.funcional)}%"></span>
          <span class="barra__parte barra__parte--parcial" style="width:${pct(INVENTARIO.parcial)}%"></span>
          <span class="barra__parte barra__parte--demonstrativo" style="width:${pct(INVENTARIO.demonstrativo)}%"></span>
        </div>
        <ul class="barra-legenda">
          <li><span class="barra-legenda__ponto" style="background:var(--status-success-ink)"></span>
            <span class="barra-legenda__valor">${INVENTARIO.funcional}</span> funcionais</li>
          <li><span class="barra-legenda__ponto" style="background:var(--status-info-ink)"></span>
            <span class="barra-legenda__valor">${INVENTARIO.parcial}</span> parcial</li>
          <li><span class="barra-legenda__ponto" style="background:var(--hairline)"></span>
            <span class="barra-legenda__valor">${INVENTARIO.demonstrativo}</span> demonstrativas</li>
        </ul>
      </div>
    </section>

    <section class="secao" aria-labelledby="testar-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="testar-titulo">O que dá para testar agora</h2>
        <span class="meta">${plural(prontas.length, "módulo", "módulos")} com tela funcional</span>
      </div>
      <p class="secao__apoio">
        Nestes módulos existe pelo menos uma tela que fala com o servidor de
        verdade. Os demais ainda são aparência ou plano.
      </p>
      <div class="pilha" style="margin-top: var(--space-sm)">
        ${prontas
          .map((m) => {
            const r = resumoDe(m);
            const funcionais = m.telas.filter((t) => t.estado === "funcional");
            return `
          <div class="linha">
            <span class="linha__texto">
              <span class="linha__titulo">${txt(m.nome)}</span>
              <span class="linha__apoio">${txt(funcionais.map((t) => t.nome).join(" · "))}</span>
            </span>
            <span class="linha__fim">
              <span class="modulo__progresso">${r.funcional}/${r.total}</span>
              <button type="button" class="botao botao--discreto" data-ir="${txt(m.id)}">Abrir</button>
            </span>
          </div>`;
          })
          .join("")}
      </div>
    </section>

    <section class="secao" aria-labelledby="modulos-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="modulos-titulo">Módulos do ecossistema</h2>
        <span class="meta">em ordem de prontidão</span>
      </div>
      <div class="modulos">${cartoes}</div>
    </section>

    ${blocoLegenda()}

    <section class="secao" aria-labelledby="futuro-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="futuro-titulo">Evolução futura</h2>
        <span class="meta">fora da navegação</span>
      </div>
      <p class="secao__apoio">
        Ficam fora do menu de propósito: um item na navegação é lido como algo
        que já existe, e nenhum destes existe.
      </p>
      <div class="pilha" style="margin-top: var(--space-sm)">
        ${EVOLUCAO_FUTURA.map(
          (e) => `
          <div class="linha">
            <span class="linha__texto">
              <span class="linha__titulo">${txt(e.nome)}</span>
              <span class="linha__apoio">${txt(e.nota)}</span>
            </span>
            <span class="linha__fim">${selo("planejado")}</span>
          </div>`,
        ).join("")}
      </div>
    </section>`;
}

function blocoLegenda() {
  return `
    <section class="secao" aria-labelledby="legenda-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="legenda-titulo">O que cada marca quer dizer</h2>
      </div>
      <div class="pilha">
        ${Object.entries(ESTADOS)
          .map(
            ([k, v]) => `
          <div class="linha">
            <span class="linha__fim">${selo(k)}</span>
            <span class="linha__texto"><span class="linha__apoio">${txt(v.explicacao)}</span></span>
          </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

function workspace(m) {
  const r = resumoDe(m);

  const proximoPasso =
    r.funcional > 0
      ? "Dá para usar o que já está funcional. As telas demonstrativas precisam de uma fatia própria para virar capacidade real."
      : r.demonstrativo > 0
        ? "Este módulo só tem aparência hoje. O próximo passo é escolher uma tela, dar identificador próprio a ela e construí-la de verdade."
        : "Nada foi construído aqui ainda. O próximo passo é a decisão de escopo: o que este módulo precisa resolver primeiro.";

  const atalhos = m.atalhos.length
    ? `<section class="secao" aria-labelledby="atalhos-${txt(m.id)}">
        <div class="secao__cabecalho">
          <h2 class="secao__titulo" id="atalhos-${txt(m.id)}">Atalhos</h2>
          <span class="meta">do protótipo</span>
        </div>
        <div class="atalhos">
          ${m.atalhos
            .map(
              (a) =>
                `<button type="button" class="botao botao--secundario" data-acao="${txt(a.acao)}">${txt(a.rotulo)}</button>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const pendencias = m.pendencias.length
    ? `<section class="secao" aria-labelledby="pend-${txt(m.id)}">
        <div class="secao__cabecalho">
          <h2 class="secao__titulo" id="pend-${txt(m.id)}">Pendências</h2>
          <span class="meta">números de exemplo</span>
        </div>
        <div class="pilha">
          ${m.pendencias
            .map(
              (p) => `
            <div class="linha">
              <span class="linha__texto"><span class="linha__titulo">${txt(p.texto)}</span></span>
              <span class="linha__fim">${selo(p.selo)}</span>
            </div>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const lista = m.id === "pessoas" ? listaColaboradores() : "";

  // Funcionalidades agrupadas por estado: o disponível vem antes do plano.
  const ordem = ["funcional", "parcial", "demonstrativo", "planejado"];
  const grupos = ordem
    .map((e) => ({ estado: e, telas: m.telas.filter((t) => t.estado === e) }))
    .filter((g) => g.telas.length > 0);

  return `
    <section class="secao" aria-labelledby="resumo-${txt(m.id)}">
      <h2 class="sr-only" id="resumo-${txt(m.id)}">Resumo do módulo</h2>
      <div class="aviso aviso--info">
        ${ICONES.info}
        <span>
          <strong>${r.funcional} de ${r.total} ${r.total === 1 ? "tela funciona" : "telas funcionam"} de verdade.</strong>
          ${txt(proximoPasso)}
        </span>
      </div>
    </section>
    ${atalhos}
    ${pendencias}
    ${lista}

    <section class="secao" aria-labelledby="telas-${txt(m.id)}">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="telas-${txt(m.id)}">Funcionalidades</h2>
        <span class="meta">${plural(r.total, "tela", "telas")}</span>
      </div>
      ${grupos
        .map(
          (g) => `
        <div style="margin-bottom: var(--space-md)">
          <p class="secao__apoio" style="margin-bottom: var(--space-xs)">
            ${selo(g.estado)} <span>${txt(ESTADOS[g.estado].explicacao)}</span>
          </p>
          <div class="pilha">
            ${g.telas
              .map(
                (t) => `
              <div class="linha">
                <span class="linha__texto">
                  <span class="linha__titulo">${txt(t.nome)}</span>
                  ${t.nota ? `<span class="linha__apoio">${txt(t.nota)}</span>` : ""}
                </span>
              </div>`,
              )
              .join("")}
          </div>
        </div>`,
        )
        .join("")}
    </section>

    ${m.id === "pessoas" ? blocoEstados() : ""}`;
}

/** Exemplos visuais de carregamento, vazio, erro e sucesso. Não simulam nada. */
function blocoEstados() {
  return `
    <section class="secao" aria-labelledby="estados-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="estados-titulo">Estados da interface</h2>
        <span class="meta">exemplos visuais</span>
      </div>
      <p class="secao__apoio">
        Como a tela se comporta em cada situação. São amostras estáticas — nada
        aqui está carregando, falhando ou salvando de verdade.
      </p>
      <div class="modulos" style="margin-top: var(--space-sm)">
        <div class="cartao-registro">
          <strong class="cartao-registro__nome">Carregando</strong>
          <span class="esqueleto esqueleto--medio"></span>
          <span class="esqueleto esqueleto--curto"></span>
          <span class="esqueleto"></span>
        </div>
        <div class="cartao-registro">
          <strong class="cartao-registro__nome">Sem resultado</strong>
          <div class="estado" style="padding: var(--space-md) 0">
            <p class="estado__titulo">Nenhum colaborador encontrado</p>
            <p class="estado__texto">Tente outro nome ou limpe os filtros.</p>
          </div>
        </div>
        <div class="cartao-registro">
          <strong class="cartao-registro__nome">Erro</strong>
          <div class="aviso aviso--erro">
            ${ICONES.alerta}
            <span>Não foi possível carregar a lista. Tente de novo em instantes.</span>
          </div>
        </div>
        <div class="cartao-registro">
          <strong class="cartao-registro__nome">Sucesso</strong>
          <div class="aviso aviso--sucesso">
            ${ICONES.certo}
            <span>Nome atualizado.</span>
          </div>
        </div>
      </div>
    </section>`;
}

function listaColaboradores() {
  const alvo = filtroBusca.trim().toLowerCase();
  const visiveis = COLABORADORES.filter(
    (c) =>
      (filtroSituacao === "todos" || c.situacao === filtroSituacao) &&
      (alvo === "" ||
        c.nome.toLowerCase().includes(alvo) ||
        c.id.toLowerCase().includes(alvo)),
  );

  const linhas = visiveis
    .map(
      (c) => `
      <tr>
        <td class="tabela__mono">${txt(c.id)}</td>
        <td class="tabela__principal">${txt(c.nome)}</td>
        <td>${txt(c.empresa)}</td>
        <td>${txt(c.departamento)}</td>
        <td class="tabela__mono">${txt(c.admissao)}</td>
        <td>${c.situacao === "ativo" ? selo("funcional") : selo("demonstrativo")}</td>
        <td class="tabela__acao">
          <button type="button" class="botao botao--discreto" data-detalhe="${txt(c.id)}">Abrir</button>
        </td>
      </tr>`,
    )
    .join("");

  const cartoes = visiveis
    .map(
      (c) => `
      <div class="cartao-registro">
        <div class="cartao-registro__topo">
          <span class="cartao-registro__nome">${txt(c.nome)}</span>
          ${c.situacao === "ativo" ? selo("funcional") : selo("demonstrativo")}
        </div>
        <dl class="cartao-registro__dados">
          <dt>Matrícula</dt><dd>${txt(c.id)}</dd>
          <dt>Empresa</dt><dd>${txt(c.empresa)}</dd>
          <dt>Departamento</dt><dd>${txt(c.departamento)}</dd>
          <dt>Admissão</dt><dd>${txt(c.admissao)}</dd>
        </dl>
        <button type="button" class="botao botao--secundario" data-detalhe="${txt(c.id)}">Abrir detalhe</button>
      </div>`,
    )
    .join("");

  const corpoVazio = `
    <div class="estado">
      <p class="estado__titulo">Nenhum colaborador corresponde ao filtro</p>
      <p class="estado__texto">
        Ajuste o nome ou a situação para ver os registros sintéticos de novo.
      </p>
      <button type="button" class="botao botao--secundario" data-limpar>Limpar filtros</button>
    </div>`;

  return `
    <section class="secao" aria-labelledby="lista-titulo">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo" id="lista-titulo">Colaboradores</h2>
        <span class="meta" role="status">
          ${plural(visiveis.length, "resultado", "resultados")} de ${COLABORADORES.length}
        </span>
      </div>
      <p class="secao__apoio">
        Lista navegável de verdade neste protótipo: o filtro funciona e o detalhe
        abre em janela. Os dados são sintéticos.
      </p>

      <div class="ferramentas" style="margin-top: var(--space-sm)">
        <div class="ferramentas__campos">
          <div class="campo">
            <label class="campo__rotulo" for="filtro-nome">Nome ou matrícula</label>
            <input id="filtro-nome" type="search" value="${txt(filtroBusca)}"
                   placeholder="Ex.: Alfa" aria-describedby="filtro-nome-dica" />
            <span class="campo__dica" id="filtro-nome-dica">Filtra nesta lista sintética.</span>
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="filtro-situacao">Situação</label>
            <select id="filtro-situacao">
              <option value="todos"${filtroSituacao === "todos" ? " selected" : ""}>Todas</option>
              <option value="ativo"${filtroSituacao === "ativo" ? " selected" : ""}>Ativo</option>
              <option value="inativo"${filtroSituacao === "inativo" ? " selected" : ""}>Inativo</option>
            </select>
          </div>
        </div>
      </div>

      ${
        visiveis.length === 0
          ? corpoVazio
          : `
        <div class="tabela-envolucro">
          <table class="tabela">
            <caption class="sr-only">Colaboradores sintéticos do protótipo</caption>
            <thead>
              <tr>
                <th scope="col">Matrícula</th><th scope="col">Nome</th>
                <th scope="col">Empresa</th><th scope="col">Departamento</th>
                <th scope="col">Admissão</th><th scope="col">Situação</th>
                <th scope="col"><span class="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
        <div class="cartoes-lista">${cartoes}</div>`
      }
    </section>`;
}

// ---------------------------------------------------------------- ações

function ligarAcoes() {
  for (const raiz of [conteudo, $("#contexto-acoes")]) {
    for (const b of raiz.querySelectorAll("[data-ir]")) {
      b.addEventListener("click", () => irPara(b.dataset.ir));
    }
    for (const b of raiz.querySelectorAll('[data-acao="admissao"]')) {
      b.addEventListener("click", () => abrirAdmissao());
    }
    for (const b of raiz.querySelectorAll('[data-acao="lista"]')) {
      b.addEventListener("click", () => irPara("pessoas"));
    }
    for (const b of raiz.querySelectorAll("[data-detalhe]")) {
      b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe));
    }
  }

  const limpar = conteudo.querySelector("[data-limpar]");
  if (limpar) {
    limpar.addEventListener("click", () => {
      filtroBusca = "";
      filtroSituacao = "todos";
      redesenharLista(null);
    });
  }

  const nome = conteudo.querySelector("#filtro-nome");
  if (nome) {
    nome.addEventListener("input", () => {
      filtroBusca = nome.value;
      redesenharLista(nome.selectionStart);
    });
  }
  const sit = conteudo.querySelector("#filtro-situacao");
  if (sit) {
    sit.addEventListener("change", () => {
      filtroSituacao = sit.value;
      redesenharLista(null);
    });
  }
}

/** Redesenha a lista devolvendo o foco a quem estava filtrando. */
function redesenharLista(posicaoCursor) {
  const focoEra = document.activeElement?.id;
  const m = MODULOS.find((x) => x.id === moduloAtivo);
  conteudo.innerHTML = workspace(m);
  ligarAcoes();
  if (!focoEra) return;
  const alvo = conteudo.querySelector(`#${focoEra}`);
  if (!alvo) return;
  alvo.focus({ preventScroll: true });
  if (posicaoCursor != null && alvo.setSelectionRange) {
    alvo.setSelectionRange(posicaoCursor, posicaoCursor);
  }
}

// ---------------------------------------------------------------- modal

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalAtual = null;

/**
 * Abre uma janela modal. `alterado()` diz se há trabalho não salvo — é o que
 * faz `Escape` e "Fechar" pedirem confirmação em vez de descartar calado.
 */
function abrirModal({
  titulo,
  descricao,
  corpo,
  rodape,
  larga = false,
  alterado = () => false,
}) {
  const acionador = document.activeElement;
  const caixa = document.createElement("div");
  caixa.className = "modal";
  caixa.innerHTML = `
    <div class="modal__fundo" data-fundo></div>
    <div class="modal__caixa${larga ? " modal__caixa--larga" : ""}" role="dialog"
         aria-modal="true" aria-labelledby="modal-titulo"
         ${descricao ? 'aria-describedby="modal-descricao"' : ""}>
      <header class="modal__cabecalho">
        <div>
          <h2 class="modal__titulo" id="modal-titulo" tabindex="-1">${txt(titulo)}</h2>
          ${descricao ? `<p class="modal__descricao" id="modal-descricao">${txt(descricao)}</p>` : ""}
        </div>
        <button type="button" class="botao botao--secundario" data-fechar>Fechar</button>
      </header>
      <div class="modal__corpo">${corpo}</div>
      ${rodape ? `<footer class="modal__rodape">${rodape}</footer>` : ""}
    </div>`;
  raizModal.appendChild(caixa);
  document.body.dataset.modalAberto = "sim";

  const painel = caixa.querySelector(".modal__caixa");
  const tituloEl = caixa.querySelector("#modal-titulo");
  let confirmando = false;
  let focoAntesDaConfirmacao = null;

  const fechar = () => {
    document.removeEventListener("keydown", aoTeclar, true);
    caixa.remove();
    delete document.body.dataset.modalAberto;
    modalAtual = null;
    if (acionador && document.contains(acionador)) acionador.focus();
  };

  const continuarEditando = () => {
    confirmando = false;
    caixa.querySelector("[data-confirmacao]")?.remove();
    const alvo = focoAntesDaConfirmacao;
    focoAntesDaConfirmacao = null;
    if (alvo && document.contains(alvo)) alvo.focus();
    else tituloEl.focus({ preventScroll: true });
  };

  const pedirFechamento = () => {
    if (!alterado()) return fechar();
    if (confirmando) return;
    confirmando = true;
    const ativo = document.activeElement;
    focoAntesDaConfirmacao = ativo instanceof HTMLElement ? ativo : null;
    const bloco = document.createElement("div");
    bloco.className = "modal__confirmacao";
    bloco.setAttribute("role", "alertdialog");
    bloco.setAttribute("aria-modal", "true");
    bloco.setAttribute("aria-labelledby", "confirmacao-texto");
    bloco.setAttribute("tabindex", "-1");
    bloco.dataset.confirmacao = "";
    bloco.innerHTML = `
      <p class="modal__confirmacao-texto" id="confirmacao-texto">
        Há alterações não salvas nesta janela. Descartar?
      </p>
      <div class="modal__confirmacao-acoes">
        <button type="button" class="botao botao--secundario" data-continuar>Continuar editando</button>
        <button type="button" class="botao" data-descartar>Descartar alterações</button>
      </div>`;
    painel.insertBefore(bloco, painel.querySelector(".modal__corpo"));
    bloco
      .querySelector("[data-continuar]")
      .addEventListener("click", continuarEditando);
    bloco.querySelector("[data-descartar]").addEventListener("click", fechar);
    bloco.querySelector("[data-continuar]").focus({ preventScroll: true });
  };

  function aoTeclar(evento) {
    if (evento.key === "Escape") {
      evento.preventDefault();
      if (confirmando) continuarEditando();
      else pedirFechamento();
      return;
    }
    if (evento.key !== "Tab") return;

    // Enquanto a confirmação está aberta, o foco circula SÓ nela: declarar
    // `aria-modal` e deixar o Tab alcançar o que está atrás seria afirmar uma
    // coisa e permitir outra.
    const raiz = confirmando
      ? painel.querySelector("[data-confirmacao]")
      : painel;
    if (!raiz) return;
    const focaveis = [...raiz.querySelectorAll(FOCAVEIS)].filter(
      (el) => !el.hasAttribute("hidden"),
    );
    if (focaveis.length === 0) {
      evento.preventDefault();
      (confirmando ? raiz : tituloEl).focus();
      return;
    }
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    const atual = document.activeElement;
    if (!raiz.contains(atual)) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primeiro).focus();
      return;
    }
    const antesDoPrimeiro = confirmando ? raiz : tituloEl;
    if (evento.shiftKey && (atual === primeiro || atual === antesDoPrimeiro)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && atual === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    } else if (!evento.shiftKey && atual === antesDoPrimeiro) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  document.addEventListener("keydown", aoTeclar, true);
  caixa
    .querySelector("[data-fechar]")
    .addEventListener("click", pedirFechamento);
  // Clique no fundo NÃO descarta: num formulário longo isso perderia trabalho.
  caixa
    .querySelector("[data-fundo]")
    .addEventListener("click", pedirFechamento);

  tituloEl.focus({ preventScroll: true });
  modalAtual = { fechar, pedirFechamento, caixa };
  return modalAtual;
}

function abrirAdmissao() {
  let tocado = false;
  const m = abrirModal({
    titulo: "Admitir colaborador",
    descricao:
      "Formulário de demonstração. Nada é gravado — nenhum colaborador será criado.",
    larga: true,
    corpo: `
      <fieldset class="grupo-campos">
        <legend class="grupo-campos__titulo">Identificação</legend>
        <div class="grade-campos">
          <div class="campo">
            <label class="campo__rotulo" for="adm-nome">Nome completo</label>
            <input id="adm-nome" type="text" aria-describedby="adm-nome-erro" />
            <span class="campo__erro" id="adm-nome-erro" hidden>
              ${ICONES.alerta}<span>Informe o nome completo.</span>
            </span>
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="adm-matricula">Matrícula</label>
            <input id="adm-matricula" type="text" placeholder="Ex.: DEMO-A-0005" />
            <span class="campo__dica">Única por empresa.</span>
          </div>
        </div>
      </fieldset>

      <fieldset class="grupo-campos">
        <legend class="grupo-campos__titulo">Vínculo</legend>
        <div class="grade-campos">
          <div class="campo">
            <label class="campo__rotulo" for="adm-empresa">Empresa</label>
            <select id="adm-empresa"><option>Alfa</option><option>Beta</option></select>
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="adm-departamento">Departamento</label>
            <select id="adm-departamento">
              <option>Operações</option><option>Administrativo</option><option>Comercial</option>
            </select>
          </div>
          <div class="campo">
            <label class="campo__rotulo" for="adm-admissao">Data de admissão</label>
            <input id="adm-admissao" type="date" />
          </div>
        </div>
      </fieldset>

      <p class="secao__apoio">
        O erro aparece junto do campo, não só no topo. Digite algo e tente
        fechar: a janela pede confirmação antes de descartar.
      </p>`,
    rodape: `
      <button type="button" class="botao botao--secundario" data-cancelar>Cancelar</button>
      <button type="button" class="botao" data-salvar>Admitir</button>`,
    alterado: () => tocado,
  });

  const caixa = m.caixa;
  for (const campo of caixa.querySelectorAll("input, select")) {
    campo.addEventListener("input", () => {
      tocado = true;
    });
  }

  const nome = caixa.querySelector("#adm-nome");
  const erroNome = caixa.querySelector("#adm-nome-erro");
  // Valida ao sair do campo, não só ao enviar.
  nome.addEventListener("blur", () => {
    const vazio = nome.value.trim() === "";
    erroNome.hidden = !vazio;
    nome.setAttribute("aria-invalid", vazio ? "true" : "false");
  });

  caixa
    .querySelector("[data-cancelar]")
    .addEventListener("click", () => m.pedirFechamento());
  caixa.querySelector("[data-salvar]").addEventListener("click", () => {
    if (nome.value.trim() === "") {
      erroNome.hidden = false;
      nome.setAttribute("aria-invalid", "true");
      nome.focus();
      return;
    }
    tocado = false;
    m.fechar();
  });
}

function abrirDetalhe(id) {
  const c = COLABORADORES.find((x) => x.id === id);
  let tocado = false;
  const m = abrirModal({
    titulo: c.nome,
    descricao: "Detalhe de demonstração. Alterações não são gravadas.",
    corpo: `
      <fieldset class="grupo-campos">
        <legend class="grupo-campos__titulo">Editável</legend>
        <div class="campo">
          <label class="campo__rotulo" for="det-nome">Nome</label>
          <input id="det-nome" type="text" value="${txt(c.nome)}" />
        </div>
      </fieldset>

      <fieldset class="grupo-campos">
        <legend class="grupo-campos__titulo">Imutável nesta janela</legend>
        <dl class="cartao-registro__dados">
          <dt>Matrícula</dt><dd>${txt(c.id)}</dd>
          <dt>Empresa</dt><dd>${txt(c.empresa)}</dd>
          <dt>Departamento</dt><dd>${txt(c.departamento)}</dd>
          <dt>Admissão</dt><dd>${txt(c.admissao)}</dd>
          <dt>Vínculos</dt><dd>${c.vinculos}</dd>
        </dl>
      </fieldset>

      <p class="secao__apoio">
        Matrícula, empresa e data de admissão não são editáveis aqui — o mesmo
        limite da tela funcional de Colaboradores.
      </p>`,
    rodape: `
      <button type="button" class="botao botao--secundario" data-cancelar>Cancelar</button>
      <button type="button" class="botao" data-salvar>Salvar nome</button>`,
    alterado: () => tocado,
  });

  const caixa = m.caixa;
  caixa.querySelector("#det-nome").addEventListener("input", () => {
    tocado = true;
  });
  caixa
    .querySelector("[data-cancelar]")
    .addEventListener("click", () => m.pedirFechamento());
  caixa.querySelector("[data-salvar]").addEventListener("click", () => {
    tocado = false;
    m.fechar();
  });
}

// ------------------------------------------------------------- sidebar

function fecharMenuMovel() {
  shell.removeAttribute("data-lateral-movel");
  $("#lateral-fundo").hidden = true;
  $("#abrir-menu").setAttribute("aria-expanded", "false");
}

$("#abrir-menu").addEventListener("click", () => {
  const aberta = shell.getAttribute("data-lateral-movel") === "aberta";
  if (aberta) return fecharMenuMovel();
  shell.setAttribute("data-lateral-movel", "aberta");
  $("#lateral-fundo").hidden = false;
  $("#abrir-menu").setAttribute("aria-expanded", "true");
  $("#lateral").querySelector("[data-modulo]")?.focus();
});

$("#lateral-fundo").addEventListener("click", fecharMenuMovel);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalAtual) fecharMenuMovel();
});

montarLateral();
irPara("inicio");
