/**
 * Comportamento do shell modular (T146) — protótipo ESTÁTICO.
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

const selo = (estado) =>
  `<span class="selo selo--${estado}">${txt(ESTADOS[estado].rotulo)}</span>`;

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
    .map(
      (g) => `
      <div class="lateral__grupo">
        <p class="lateral__rotulo-grupo" id="grupo-${txt(g.titulo)}">${txt(g.titulo)}</p>
        <ul class="lateral__lista" aria-labelledby="grupo-${txt(g.titulo)}">
          ${g.itens
            .map(
              (m) => `
            <li>
              <button type="button" class="lateral__link" data-modulo="${txt(m.id)}">
                <span class="lateral__glifo" aria-hidden="true">${txt(m.glifo)}</span>
                <span class="lateral__texto">${txt(m.nome)}</span>
              </button>
            </li>`,
            )
            .join("")}
        </ul>
      </div>`,
    )
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
    const ativo = b.dataset.modulo === id;
    if (ativo) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  $("#migalhas").innerHTML =
    `<li>Evolli RH</li><li>${txt(m.grupo)}</li><li>${txt(m.nome)}</li>`;
  $("#contexto-titulo").textContent = m.nome;
  document.title = `${m.nome} — protótipo T146 — Evolli RH`;
  conteudo.innerHTML = id === "inicio" ? paginaInicial() : workspace(m);
  ligarAcoes();
  conteudo.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

// ------------------------------------------------------------- páginas

function legenda() {
  return `
    <section class="secao" aria-labelledby="legenda-titulo">
      <h2 class="secao__titulo" id="legenda-titulo">O que cada marca quer dizer</h2>
      <p class="secao__apoio">
        Toda tela deste protótipo mostra em que pé ela realmente está. A aparência
        aqui não quer dizer que a tela já exista.
      </p>
      <div class="grade">
        ${Object.entries(ESTADOS)
          .map(
            ([k, v]) => `
          <div class="cartao">
            ${selo(k)}
            <p class="secao__apoio" style="margin-top: var(--space-xs)">${txt(v.explicacao)}</p>
          </div>`,
          )
          .join("")}
      </div>
    </section>`;
}

function paginaInicial() {
  const porModulo = MODULOS.map((m) => {
    const f = m.telas.filter((t) => t.estado === "funcional").length;
    const total = m.telas.length;
    return `
      <div class="cartao">
        <p style="margin:0 0 var(--space-xxs); font-weight: var(--weight-strong)">
          <span aria-hidden="true">${txt(m.glifo)}</span> ${txt(m.nome)}
        </p>
        <p class="secao__apoio" style="margin:0 0 var(--space-xs)">${txt(m.resumo)}</p>
        <p class="secao__apoio" style="margin:0">
          ${f} de ${total} ${total === 1 ? "tela funciona" : "telas funcionam"} de verdade
        </p>
        <p style="margin: var(--space-xs) 0 0">
          <button type="button" class="botao botao--secundario" data-ir="${txt(m.id)}">
            Abrir ${txt(m.nome)}
          </button>
        </p>
      </div>`;
  }).join("");

  return `
    <h1 class="sr-only">Visão geral do ecossistema Evolli RH</h1>

    <section class="secao" aria-labelledby="estado-titulo">
      <h2 class="secao__titulo" id="estado-titulo">Onde o produto está hoje</h2>
      <p class="secao__apoio">
        Contagem real das ${INVENTARIO.totalFolhas} telas que existem, feita a partir do
        próprio código. Não é estimativa.
      </p>
      <div class="grade">
        <div class="cartao">${selo("funcional")}
          <p style="margin: var(--space-xs) 0 0; font-size: var(--text-title); font-weight: var(--weight-bold)">${INVENTARIO.funcional}</p>
          <p class="secao__apoio" style="margin:0">telas já funcionam de verdade</p></div>
        <div class="cartao">${selo("parcial")}
          <p style="margin: var(--space-xs) 0 0; font-size: var(--text-title); font-weight: var(--weight-bold)">${INVENTARIO.parcial}</p>
          <p class="secao__apoio" style="margin:0">tela só mostra, ainda não deixa alterar</p></div>
        <div class="cartao">${selo("demonstrativo")}
          <p style="margin: var(--space-xs) 0 0; font-size: var(--text-title); font-weight: var(--weight-bold)">${INVENTARIO.demonstrativo}</p>
          <p class="secao__apoio" style="margin:0">telas são só aparência, com dados de exemplo</p></div>
      </div>
    </section>

    <section class="secao" aria-labelledby="modulos-titulo">
      <h2 class="secao__titulo" id="modulos-titulo">Módulos do ecossistema</h2>
      <div class="grade">${porModulo}</div>
    </section>

    ${legenda()}

    <section class="secao" aria-labelledby="futuro-titulo">
      <h2 class="secao__titulo" id="futuro-titulo">Evolução futura</h2>
      <p class="secao__apoio">
        Fora da navegação de propósito: um item no menu é lido como algo que já
        existe, e nenhum destes existe.
      </p>
      ${EVOLUCAO_FUTURA.map(
        (e) => `
        <div class="pendencia">
          <span><strong>${txt(e.nome)}</strong> — ${txt(e.nota)}</span>
          ${selo("planejado")}
        </div>`,
      ).join("")}
    </section>`;
}

function workspace(m) {
  const atalhos = m.atalhos.length
    ? `<section class="secao" aria-labelledby="atalhos-${txt(m.id)}">
        <h2 class="secao__titulo" id="atalhos-${txt(m.id)}">Atalhos</h2>
        <div class="atalhos">
          ${m.atalhos
            .map(
              (a) =>
                `<button type="button" class="botao" data-acao="${txt(a.acao)}">${txt(a.rotulo)}</button>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const pendencias = m.pendencias.length
    ? `<section class="secao" aria-labelledby="pend-${txt(m.id)}">
        <h2 class="secao__titulo" id="pend-${txt(m.id)}">Pendências</h2>
        <p class="secao__apoio">Números de exemplo — nada aqui foi apurado.</p>
        ${m.pendencias
          .map(
            (p) =>
              `<div class="pendencia"><span>${txt(p.texto)}</span>${selo(p.selo)}</div>`,
          )
          .join("")}
      </section>`
    : "";

  const lista =
    m.id === "pessoas"
      ? listaColaboradores()
      : `<section class="secao" aria-labelledby="telas-${txt(m.id)}">
          <h2 class="secao__titulo" id="telas-${txt(m.id)}">Telas deste módulo</h2>
          <div class="tabela-rolagem">
            <table>
              <caption class="sr-only">Telas do módulo ${txt(m.nome)} e o estado real de cada uma</caption>
              <thead><tr><th scope="col">Tela</th><th scope="col">Estado</th><th scope="col">Observação</th></tr></thead>
              <tbody>
                ${m.telas
                  .map(
                    (t) => `
                  <tr>
                    <td>${txt(t.nome)}</td>
                    <td>${selo(t.estado)}</td>
                    <td>${txt(t.nota ?? "—")}</td>
                  </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>`;

  const f = m.telas.filter((t) => t.estado === "funcional").length;
  return `
    <h1 class="sr-only">${txt(m.nome)}</h1>
    <section class="secao">
      <p class="secao__apoio" style="margin:0 0 var(--space-xs)">${txt(m.resumo)}</p>
      <p class="secao__apoio" style="margin:0">
        ${f} de ${m.telas.length} ${m.telas.length === 1 ? "tela funciona" : "telas funcionam"} de verdade neste módulo.
      </p>
    </section>
    ${atalhos}
    ${pendencias}
    ${lista}
    ${legenda()}`;
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
        <td>${txt(c.id)}</td>
        <td>${txt(c.nome)}</td>
        <td>${txt(c.empresa)}</td>
        <td>${txt(c.departamento)}</td>
        <td>${c.situacao === "ativo" ? selo("funcional") : selo("demonstrativo")}</td>
        <td><button type="button" class="botao botao--secundario" data-detalhe="${txt(c.id)}">Abrir</button></td>
      </tr>`,
    )
    .join("");

  return `
    <section class="secao" aria-labelledby="lista-titulo">
      <h2 class="secao__titulo" id="lista-titulo">Colaboradores</h2>
      <p class="secao__apoio">
        Lista navegável de verdade neste protótipo: o filtro funciona e o detalhe
        abre em janela. Os dados são sintéticos.
      </p>

      <div class="filtros">
        <div class="campo">
          <label class="campo__rotulo" for="filtro-nome">Nome ou matrícula</label>
          <input id="filtro-nome" type="search" value="${txt(filtroBusca)}" />
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="filtro-situacao">Situação</label>
          <select id="filtro-situacao">
            <option value="todos"${filtroSituacao === "todos" ? " selected" : ""}>Todas</option>
            <option value="ativo"${filtroSituacao === "ativo" ? " selected" : ""}>Ativo</option>
            <option value="inativo"${filtroSituacao === "inativo" ? " selected" : ""}>Inativo</option>
          </select>
        </div>
        <button type="button" class="botao" data-acao="admissao">Admitir colaborador</button>
      </div>

      <div class="tabela-rolagem">
        <table>
          <caption class="sr-only">Colaboradores sintéticos do protótipo</caption>
          <thead>
            <tr>
              <th scope="col">Matrícula</th><th scope="col">Nome</th><th scope="col">Empresa</th>
              <th scope="col">Departamento</th><th scope="col">Situação</th><th scope="col">Ação</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
        </table>
        ${visiveis.length === 0 ? '<p class="vazio">Nenhum colaborador corresponde ao filtro.</p>' : ""}
      </div>
    </section>`;
}

// ---------------------------------------------------------------- ações

function ligarAcoes() {
  for (const b of conteudo.querySelectorAll("[data-ir]")) {
    b.addEventListener("click", () => irPara(b.dataset.ir));
  }
  for (const b of conteudo.querySelectorAll('[data-acao="admissao"]')) {
    b.addEventListener("click", () => abrirAdmissao(b));
  }
  for (const b of conteudo.querySelectorAll('[data-acao="lista"]')) {
    b.addEventListener("click", () => irPara("pessoas"));
  }
  for (const b of conteudo.querySelectorAll("[data-detalhe]")) {
    b.addEventListener("click", () => abrirDetalhe(b.dataset.detalhe, b));
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

/** Redesenha só a lista, devolvendo o foco a quem estava filtrando. */
function redesenharLista(posicaoCursor) {
  const focoEra = document.activeElement?.id;
  irPara("pessoas");
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
  alterado = () => false,
}) {
  const acionador = document.activeElement;
  const caixa = document.createElement("div");
  caixa.className = "modal";
  caixa.innerHTML = `
    <div class="modal__fundo" data-fundo></div>
    <div class="modal__caixa" role="dialog" aria-modal="true" aria-labelledby="modal-titulo"
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
  modalAtual = { fechar, pedirFechamento };
  return modalAtual;
}

function abrirAdmissao() {
  let tocado = false;
  const m = abrirModal({
    titulo: "Admitir colaborador",
    descricao:
      "Formulário de demonstração. Nada é gravado — nenhum colaborador será criado.",
    corpo: `
      <div class="grade">
        <div class="campo"><label class="campo__rotulo" for="adm-nome">Nome completo</label>
          <input id="adm-nome" type="text" /></div>
        <div class="campo"><label class="campo__rotulo" for="adm-matricula">Matrícula</label>
          <input id="adm-matricula" type="text" /></div>
        <div class="campo"><label class="campo__rotulo" for="adm-empresa">Empresa</label>
          <select id="adm-empresa"><option>Alfa</option><option>Beta</option></select></div>
        <div class="campo"><label class="campo__rotulo" for="adm-admissao">Data de admissão</label>
          <input id="adm-admissao" type="date" /></div>
      </div>
      <p class="secao__apoio" style="margin-top: var(--space-md)">
        Digite algo e tente fechar: a janela pede confirmação antes de descartar.
      </p>`,
    rodape: `
      <button type="button" class="botao botao--secundario" data-cancelar>Cancelar</button>
      <button type="button" class="botao" data-salvar>Salvar</button>`,
    alterado: () => tocado,
  });

  const caixa = raizModal.querySelector(".modal");
  for (const campo of caixa.querySelectorAll("input, select")) {
    campo.addEventListener("input", () => {
      tocado = true;
    });
  }
  caixa
    .querySelector("[data-cancelar]")
    .addEventListener("click", () => m.pedirFechamento());
  caixa.querySelector("[data-salvar]").addEventListener("click", () => {
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
      <div class="campo" style="margin-bottom: var(--space-md)">
        <label class="campo__rotulo" for="det-nome">Nome</label>
        <input id="det-nome" type="text" value="${txt(c.nome)}" />
      </div>
      <div class="tabela-rolagem tabela-rolagem--par">
        <table>
          <caption class="sr-only">Dados sintéticos de ${txt(c.nome)}</caption>
          <tbody>
            <tr><th scope="row">Matrícula</th><td>${txt(c.id)}</td></tr>
            <tr><th scope="row">Empresa</th><td>${txt(c.empresa)}</td></tr>
            <tr><th scope="row">Departamento</th><td>${txt(c.departamento)}</td></tr>
            <tr><th scope="row">Admissão</th><td>${txt(c.admissao)}</td></tr>
            <tr><th scope="row">Vínculos</th><td>${c.vinculos}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="secao__apoio" style="margin-top: var(--space-md)">
        Matrícula, empresa e data de admissão não são editáveis nesta janela —
        o mesmo limite da tela funcional de Colaboradores.
      </p>`,
    rodape: `
      <button type="button" class="botao botao--secundario" data-cancelar>Cancelar</button>
      <button type="button" class="botao" data-salvar>Salvar nome</button>`,
    alterado: () => tocado,
  });

  const caixa = raizModal.querySelector(".modal");
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

$("#alternar-lateral").addEventListener("click", (e) => {
  const recolhida = shell.getAttribute("data-lateral") === "recolhida";
  shell.setAttribute("data-lateral", recolhida ? "expandida" : "recolhida");
  e.currentTarget.textContent = recolhida ? "Recolher menu" : "Expandir menu";
});

// A busca é só visual, e o protótipo diz isso em voz alta.
$("#busca-visual").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.preventDefault();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalAtual) fecharMenuMovel();
});

montarLateral();
irPara("inicio");
