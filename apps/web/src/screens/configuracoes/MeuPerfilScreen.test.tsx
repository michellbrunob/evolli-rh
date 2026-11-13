/**
 * T208 — Configurações › Meu perfil (MP-1 a MP-8; ampliação MPA-1 a MPA-11).
 *
 * A tela: três seções (identificação, contato, formas de entrada); o nome de
 * exibição como único campo editável; iniciais no lugar da foto; rodapé de
 * edição só com alteração; salvar, descartar, validação, conflito e falha,
 * com um anúncio por desfecho; o registro na guarda de saída; nenhum dado
 * proibido; e o layout que não vaza rolagem horizontal a 375 px.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ROTULO_PAPEL,
  atualizarPerfilProprio,
  enviarFotoPropria,
  obterUsuarioAtual,
  removerFotoPropria,
  type SafeAccessUserApi,
} from "../../api/usersClient";
import {
  ProvedorDeEdicoes,
  RegistroDeEdicoes,
} from "../../app/edicoesPendentes";
import {
  CONFIGURACOES_TITULO_ID,
  MeuPerfilScreen,
  ROTULO_DA_EDICAO_DO_PERFIL,
  type ContaDoMeuPerfil,
} from "./MeuPerfilScreen";
import { iniciaisDe } from "./nomeExibicao";

vi.mock("../../api/usersClient", async () => {
  const actual = await vi.importActual<typeof import("../../api/usersClient")>(
    "../../api/usersClient",
  );
  return {
    ...actual,
    atualizarPerfilProprio: vi.fn(),
    obterUsuarioAtual: vi.fn(),
    enviarFotoPropria: vi.fn(),
    removerFotoPropria: vi.fn(),
  };
});

const EMPRESA = {
  id: "empresa-sintetica-id-interno",
  codigo: "ALFA",
  nome: "Empresa Alfa",
};
const VERSAO = "2026-11-10T13:00:00.000Z";
const CONTA: ContaDoMeuPerfil = {
  email: "pessoa.teste@example.test",
  role: "rh",
  createdAt: "2026-03-15T12:00:00.000Z",
  empresaAtiva: EMPRESA,
  nomeExibicao: null,
  perfilAtualizadoEm: null,
};

function ator(parcial: Partial<SafeAccessUserApi> = {}): SafeAccessUserApi {
  return {
    id: "conta-id-interno",
    email: CONTA.email,
    role: "rh",
    companyId: EMPRESA.id,
    unitId: null,
    teamId: null,
    status: "active",
    createdAt: CONTA.createdAt,
    empresaAtiva: EMPRESA,
    nomeExibicao: null,
    perfilAtualizadoEm: null,
    ...parcial,
  };
}

const criarUrl = vi.fn(() => "blob:previa-sintetica");
const revogarUrl = vi.fn();

beforeEach(() => {
  vi.mocked(atualizarPerfilProprio).mockReset();
  vi.mocked(obterUsuarioAtual).mockReset();
  vi.mocked(enviarFotoPropria).mockReset();
  vi.mocked(removerFotoPropria).mockReset();
  criarUrl.mockClear();
  revogarUrl.mockClear();
  // jsdom não tem URL de objeto; a prévia local só precisa de uma URL.
  Object.defineProperty(URL, "createObjectURL", {
    value: criarUrl,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revogarUrl,
    configurable: true,
  });
});

// Como o navegador: elemento desabilitado não recebe foco. Sem isto, o jsdom
// aceitava o foco num botão ainda desabilitado pelo envio, e o defeito que o
// navegador mostrou (foco caindo no `body` depois de enviar a foto) passava.
const focarOriginal = HTMLElement.prototype.focus;
beforeEach(() => {
  HTMLElement.prototype.focus = function focarSeHabilitado(
    this: HTMLElement,
    opcoes?: FocusOptions,
  ) {
    if ((this as HTMLButtonElement).disabled) return;
    focarOriginal.call(this, opcoes);
  };
});
afterEach(() => {
  HTMLElement.prototype.focus = focarOriginal;
});

const painel = () => screen.getByRole("region", { name: "Meu perfil" });
const campo = () =>
  screen.getByRole("textbox", { name: "Nome de exibição" }) as HTMLInputElement;
const salvar = () => screen.queryByRole("button", { name: "Salvar" });
const descartar = () => screen.queryByRole("button", { name: "Descartar" });
const status = () => screen.getByRole("status");
const nomeExibido = () =>
  painel().querySelector(".configuracoes__nome-exibido");
const iniciais = () => painel().querySelector(".configuracoes__iniciais");

/** Pares rótulo → valor das listas de dados, na ordem da tela. */
function dados(): [string, string][] {
  return [...painel().querySelectorAll(".configuracoes__dado")].map((par) => [
    par.querySelector("dt")!.textContent ?? "",
    par.querySelector("dd")!.textContent ?? "",
  ]);
}

function digitar(valor: string) {
  fireEvent.change(campo(), { target: { value: valor } });
}

async function clicarSalvar() {
  await act(async () => {
    fireEvent.click(salvar()!);
  });
}

/** Uma promessa que o teste resolve quando quiser. */
function adiada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promessa, resolver };
}

describe("T208 — o que Meu perfil mostra", () => {
  it("três seções reais: identificação, contato e formas de entrada, nessa ordem", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(
      within(painel())
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Identificação", "Contato", "Formas de entrada"]);
  });

  it("dados reais, só leitura: papel, empresa, criação, última alteração, e-mail e a forma de entrada", () => {
    render(
      <MeuPerfilScreen conta={{ ...CONTA, perfilAtualizadoEm: VERSAO }} />,
    );
    expect(dados()).toEqual([
      ["Papel", "RH"],
      ["Empresa ativa", "Empresa Alfa (ALFA)"],
      ["Conta criada em", "15/03/2026"],
      ["Última alteração do perfil", "10/11/2026 às 10:00"],
      ["E-mail de acesso", "pessoa.teste@example.test"],
      ["E-mail e senha", "Em uso"],
    ]);
    const datas = painel().querySelectorAll("time");
    expect(datas[0]).toHaveAttribute("dateTime", CONTA.createdAt);
    expect(datas[1]).toHaveAttribute("dateTime", VERSAO);
  });

  it("perfil nunca salvo: 'Ainda não alterado'", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(dados()).toContainEqual([
      "Última alteração do perfil",
      "Ainda não alterado",
    ]);
  });

  it("sem empresa ativa (escopo global), diz isso — não inventa empresa", () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, empresaAtiva: null }} />);
    expect(dados()).toContainEqual(["Empresa ativa", "Nenhuma empresa ativa"]);
  });

  it.each(Object.entries(ROTULO_PAPEL))(
    "papel %s aparece pelo rótulo (%s), nunca pelo código",
    (codigo, rotulo) => {
      render(<MeuPerfilScreen conta={{ ...CONTA, role: codigo }} />);
      expect(dados()).toContainEqual(["Papel", rotulo]);
    },
  );

  it("sem nome: o e-mail é o nome exibido e as iniciais saem dele", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(nomeExibido()).toHaveTextContent("pessoa.teste@example.test");
    expect(iniciais()).toHaveTextContent("PT");
    expect(campo().value).toBe("");
  });

  it("com nome: o nome é o exibido, as iniciais saem dele, e o campo vem preenchido", () => {
    render(
      <MeuPerfilScreen conta={{ ...CONTA, nomeExibicao: "Ana Maria Lima" }} />,
    );
    expect(nomeExibido()).toHaveTextContent("Ana Maria Lima");
    expect(iniciais()).toHaveTextContent("AL");
    expect(iniciais()).toHaveAttribute("aria-hidden", "true");
    expect(campo().value).toBe("Ana Maria Lima");
  });

  it("iniciais: uma palavra, acento e símbolos", () => {
    expect(iniciaisDe("Ângela", "x@example.test")).toBe("Â");
    expect(iniciaisDe(null, "joao_da-silva@example.test")).toBe("JS");
    expect(iniciaisDe(null, "...@example.test")).toBe("?");
  });

  it("sem conta (shell montado sem ator): '—' e nenhum campo", () => {
    render(<MeuPerfilScreen conta={null} />);
    for (const [, valor] of dados().filter(([r]) => r !== "E-mail e senha")) {
      expect(valor).toBe("—");
    }
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("título único de página, trilha Configurações › Meu perfil", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    const titulo = screen.getByRole("heading", { level: 1 });
    expect(titulo).toHaveTextContent("Configurações");
    expect(titulo).toHaveAttribute("id", CONFIGURACOES_TITULO_ID);
    const trilha = screen.getByRole("navigation", {
      name: "Trilha de navegação",
    });
    expect(trilha).toHaveTextContent("Configurações");
    expect(trilha).toHaveTextContent("Meu perfil");
  });

  it("navegação interna só com Meu perfil, no grupo Sua conta — nenhum item sem tela", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    const interna = screen.getByRole("navigation", { name: "Configurações" });
    const links = within(interna).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Meu perfil");
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(within(interna).getByRole("list")).toHaveAccessibleName("Sua conta");
    expect(interna).not.toHaveTextContent(
      /Segurança|Empresas|Equipe|Permiss|Sessões/,
    );
  });
});

describe("T208 — o que Meu perfil NÃO mostra nem oferece", () => {
  it("nenhum identificador interno, documento, cargo, telefone, Google, segundo fator ou sessão", () => {
    render(
      <MeuPerfilScreen
        conta={
          {
            ...CONTA,
            // Campos que o ator real também traz: não podem vazar.
            id: "conta-id-interno",
            companyId: "empresa-sintetica-id-interno",
            unitId: "unidade-id-interna",
            teamId: "equipe-id-interna",
            status: "active",
          } as ContaDoMeuPerfil
        }
      />,
    );
    const texto = document.body.textContent ?? "";
    for (const proibido of [
      "conta-id-interno",
      "empresa-sintetica-id-interno",
      "unidade-id-interna",
      "equipe-id-interna",
      "active",
      "Ativa",
    ]) {
      expect(texto).not.toContain(proibido);
    }
    expect(texto).not.toMatch(
      /CPF|CNPJ|Telefone|Celular|Cargo|Google|segundo fator|2º fator|Sessões|Sessão|Segurança|Idioma|Fuso|Preferênc|Situação|Unidade|Endereço|Nome completo/i,
    );
  });

  it("com o formulário limpo: o nome é o único campo de texto, a foto só tem 'Enviar foto' e nada aparece desabilitado", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    // Os únicos controles: o nome e o arquivo da foto (escondido, aberto
    // pelo botão).
    expect(document.querySelectorAll("input, select, textarea")).toHaveLength(
      2,
    );
    expect(document.querySelector('input[type="file"]')).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Enviar foto",
    ]);
    expect(
      document.querySelectorAll("[disabled], [aria-disabled]"),
    ).toHaveLength(0);
  });

  it("o e-mail diz que a alteração não está disponível — sem prometer que alguém troca", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    const contato = screen.getByRole("region", { name: "Contato" });
    expect(contato).toHaveTextContent(
      "A alteração do e-mail ainda não está disponível.",
    );
    expect(contato).not.toHaveTextContent(/administra|suporte|fale com/i);
  });
});

describe("T208 — editar o nome: rodapé, descartar e salvar", () => {
  it("o rodapé aparece só com alteração; espaço a mais não conta", () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, nomeExibicao: "Ana" }} />);
    expect(salvar()).toBeNull();
    digitar("  Ana   ");
    expect(salvar()).toBeNull();
    digitar("Ana Lima");
    expect(salvar()).toBeInTheDocument();
    expect(descartar()).toBeInTheDocument();
  });

  it("Descartar volta ao salvo, esconde o rodapé e devolve o foco ao campo", () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, nomeExibicao: "Ana" }} />);
    digitar("Outro Nome");
    fireEvent.click(descartar()!);
    expect(campo().value).toBe("Ana");
    expect(salvar()).toBeNull();
    expect(document.activeElement).toBe(campo());
    expect(atualizarPerfilProprio).not.toHaveBeenCalled();
  });

  it("Salvar envia o nome normalizado e a versão lida; aplica a resposta; um anúncio só", async () => {
    const resposta = ator({
      nomeExibicao: "Ana Lima",
      perfilAtualizadoEm: "2026-11-12T15:30:00.000Z",
    });
    vi.mocked(atualizarPerfilProprio).mockResolvedValue(resposta);
    const aoAtualizar = vi.fn();
    render(
      <MeuPerfilScreen
        conta={{ ...CONTA, perfilAtualizadoEm: VERSAO }}
        onContaAtualizada={aoAtualizar}
      />,
    );
    digitar("  Ana    Lima ");
    await clicarSalvar();
    expect(atualizarPerfilProprio).toHaveBeenCalledTimes(1);
    expect(atualizarPerfilProprio).toHaveBeenCalledWith({
      nomeExibicao: "Ana Lima",
      perfilAtualizadoEmLido: VERSAO,
    });
    expect(aoAtualizar).toHaveBeenCalledWith(resposta);
    expect(campo().value).toBe("Ana Lima");
    expect(nomeExibido()).toHaveTextContent("Ana Lima");
    expect(dados()).toContainEqual([
      "Última alteração do perfil",
      "12/11/2026 às 12:30",
    ]);
    expect(salvar()).toBeNull();
    expect(status()).toHaveTextContent("Perfil salvo.");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(document.activeElement).toBe(campo());
  });

  it("limpar o nome envia null e volta ao e-mail", async () => {
    vi.mocked(atualizarPerfilProprio).mockResolvedValue(
      ator({ nomeExibicao: null, perfilAtualizadoEm: VERSAO }),
    );
    render(<MeuPerfilScreen conta={{ ...CONTA, nomeExibicao: "Ana" }} />);
    digitar("   ");
    await clicarSalvar();
    expect(atualizarPerfilProprio).toHaveBeenCalledWith({
      nomeExibicao: null,
      perfilAtualizadoEmLido: null,
    });
    expect(nomeExibido()).toHaveTextContent("pessoa.teste@example.test");
  });

  it("enquanto salva: campo só leitura, botões desabilitados, segundo envio ignorado", async () => {
    const pendente = adiada<SafeAccessUserApi>();
    vi.mocked(atualizarPerfilProprio).mockReturnValue(pendente.promessa);
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar("Ana");
    await clicarSalvar();
    expect(campo()).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Salvando…" })).toBeDisabled();
    expect(descartar()).toBeDisabled();
    fireEvent.submit(campo().form!);
    expect(atualizarPerfilProprio).toHaveBeenCalledTimes(1);
    await act(async () => {
      pendente.resolver(
        ator({ nomeExibicao: "Ana", perfilAtualizadoEm: VERSAO }),
      );
    });
    expect(campo()).not.toHaveAttribute("readonly");
  });
});

describe("T208 — validação, conflito e falha", () => {
  it.each([
    ["curto", "A", "Use ao menos 2 caracteres"],
    ["longo", "a".repeat(81), "Use no máximo 80 caracteres"],
    ["sem letra", "1234", "Use ao menos uma letra."],
  ])(
    "nome %s: erro no campo, foco nele, nada enviado",
    async (_caso, valor, mensagem) => {
      render(<MeuPerfilScreen conta={CONTA} />);
      digitar(valor);
      await clicarSalvar();
      expect(atualizarPerfilProprio).not.toHaveBeenCalled();
      const alerta = screen.getByRole("alert");
      expect(alerta).toHaveTextContent(mensagem);
      expect(campo()).toHaveAttribute("aria-invalid", "true");
      expect(campo().getAttribute("aria-describedby")).toContain(alerta.id);
      expect(document.activeElement).toBe(campo());
      expect(status()).toHaveTextContent("");
      // Digitar de novo tira o erro.
      digitar("Ana");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(campo()).not.toHaveAttribute("aria-invalid");
    },
  );

  it("80 caracteres passam; um emoji conta como um caractere", async () => {
    vi.mocked(atualizarPerfilProprio).mockResolvedValue(ator());
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar(`${"😀".repeat(79)}a`);
    await clicarSalvar();
    expect(atualizarPerfilProprio).toHaveBeenCalledTimes(1);
  });

  it("conflito (409): diz o que houve, mantém o texto e oferece carregar os dados atuais", async () => {
    vi.mocked(atualizarPerfilProprio).mockRejectedValue(
      new ApiError(409, "Conflito ao processar a requisição."),
    );
    vi.mocked(obterUsuarioAtual).mockResolvedValue(
      ator({
        nomeExibicao: "Salvo Em Outra Sessao",
        perfilAtualizadoEm: VERSAO,
      }),
    );
    const aoAtualizar = vi.fn();
    render(<MeuPerfilScreen conta={CONTA} onContaAtualizada={aoAtualizar} />);
    digitar("Meu Texto");
    await clicarSalvar();
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent("alterado em outra sessão");
    expect(alerta).toHaveTextContent("Nada foi salvo");
    expect(campo().value).toBe("Meu Texto");
    expect(salvar()).toBeInTheDocument();
    expect(status()).toHaveTextContent("");
    expect(aoAtualizar).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        within(alerta).getByRole("button", {
          name: "Carregar os dados atuais",
        }),
      );
    });
    expect(obterUsuarioAtual).toHaveBeenCalledTimes(1);
    expect(campo().value).toBe("Salvo Em Outra Sessao");
    expect(salvar()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(status()).toHaveTextContent("Dados atuais carregados.");
    expect(aoAtualizar).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(campo());
  });

  it("recusa do servidor (400): erro no campo, sem anúncio de sucesso", async () => {
    vi.mocked(atualizarPerfilProprio).mockRejectedValue(
      new ApiError(400, "Requisição inválida."),
    );
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar("Ana");
    await clicarSalvar();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Este nome não foi aceito",
    );
    expect(campo()).toHaveAttribute("aria-invalid", "true");
    expect(status()).toHaveTextContent("");
  });

  it("sessão encerrada (401): diz para entrar de novo, sem prometer que tentar de novo resolve", async () => {
    vi.mocked(atualizarPerfilProprio).mockRejectedValue(
      new ApiError(401, "Não autorizado."),
    );
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar("Ana");
    await clicarSalvar();
    const alerta = screen.getByRole("alert");
    expect(alerta).toHaveTextContent(
      "A sua sessão terminou. Entre de novo para salvar; nada foi alterado.",
    );
    expect(alerta).not.toHaveTextContent("tente de novo");
    expect(campo().value).toBe("Ana");
  });

  it.each([
    ["erro do servidor", () => new ApiError(500, "Erro")],
    ["sem rede", () => new TypeError("Failed to fetch")],
  ])("falha (%s): alerta único, nada perdido", async (_caso, erro) => {
    vi.mocked(atualizarPerfilProprio).mockRejectedValue(erro());
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar("Ana");
    await clicarSalvar();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Não foi possível concluir agora. Nada foi alterado",
    );
    expect(campo().value).toBe("Ana");
    expect(salvar()).toBeInTheDocument();
    expect(status()).toHaveTextContent("");
  });
});

describe("T208 — a edição se declara à guarda de saída", () => {
  function montarComRegistro(conta: ContaDoMeuPerfil) {
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <MeuPerfilScreen conta={conta} />
      </ProvedorDeEdicoes>,
    );
    return registro;
  }

  it("limpo: nada pendente; alterado: pendente; de volta ao salvo: nada", () => {
    const registro = montarComRegistro({ ...CONTA, nomeExibicao: "Ana" });
    expect(registro.obter().pendentes).toEqual([]);
    digitar("Ana Lima");
    expect(registro.obter().pendentes).toEqual([ROTULO_DA_EDICAO_DO_PERFIL]);
    digitar("Ana");
    expect(registro.obter().pendentes).toEqual([]);
  });

  it("salvando: declara salvamento em curso (a guarda bloqueia a saída)", async () => {
    const pendente = adiada<SafeAccessUserApi>();
    vi.mocked(atualizarPerfilProprio).mockReturnValue(pendente.promessa);
    const registro = montarComRegistro(CONTA);
    digitar("Ana");
    await clicarSalvar();
    expect(registro.obter().salvando).toEqual([ROTULO_DA_EDICAO_DO_PERFIL]);
    await act(async () => {
      pendente.resolver(
        ator({ nomeExibicao: "Ana", perfilAtualizadoEm: VERSAO }),
      );
    });
    expect(registro.obter().salvando).toEqual([]);
    expect(registro.obter().pendentes).toEqual([]);
  });
});

describe("T208 — layout a 375 px (CSS)", () => {
  const css = readFileSync(
    "src/screens/configuracoes/MeuPerfilScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const regra = (seletor: string) => {
    const inicio = css.indexOf(`\n${seletor} {`);
    if (inicio < 0) return "";
    return css.slice(inicio, css.indexOf("}", inicio));
  };

  it("uma coluna que encolhe por padrão; duas só a partir de 720 px", () => {
    expect(regra(".configuracoes__corpo")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(css).toMatch(
      /@media \(min-width: 720px\) \{\s*\.configuracoes__corpo \{\s*grid-template-columns: minmax\(0, 13rem\) minmax\(0, 1fr\);/,
    );
    expect(regra(".configuracoes")).toMatch(/min-width:\s*0/);
    expect(regra(".configuracoes__painel")).toMatch(/min-width:\s*0/);
  });

  it("linhas de rótulo e valor: empilhadas por padrão; lado a lado só quando o PAINEL tem 40rem (não a janela)", () => {
    expect(css).toMatch(
      /\n\.configuracoes__linha,\n\.configuracoes__linha\.evolli-field \{\n\s*display: grid;\n\s*grid-template-columns: minmax\(0, 1fr\);/,
    );
    // Achado no navegador: a 1024 px, com o menu aberto, o painel tinha
    // 443 px e a regra pela JANELA espremia o campo em 129 px. A decisão é
    // pela largura do próprio painel.
    expect(regra(".configuracoes__painel")).toMatch(
      /container-type:\s*inline-size/,
    );
    expect(css).toMatch(
      /@container \(min-width: 40rem\) \{\s*\.configuracoes__linha,\s*\.configuracoes__linha\.evolli-field \{\s*grid-template-columns: minmax\(0, 15rem\) minmax\(0, 1fr\);/,
    );
    expect(css).not.toMatch(/@media \(min-width: 1024px\)/);
  });

  it("e-mail, empresa e nome longos quebram dentro da caixa", () => {
    expect(regra(".configuracoes__dado dd")).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
    expect(regra(".configuracoes__dado dd")).toMatch(/min-width:\s*0/);
    expect(regra(".configuracoes__nome-exibido")).toMatch(
      /overflow-wrap:\s*anywhere/,
    );
  });

  it("rodapé preso ao pé da área visível, com ações de 44 px que quebram linha", () => {
    expect(regra(".configuracoes__rodape")).toMatch(/position:\s*sticky/);
    expect(regra(".configuracoes__rodape")).toMatch(/bottom:\s*0/);
    expect(regra(".configuracoes__rodape")).toMatch(/flex-wrap:\s*wrap/);
    expect(regra(".configuracoes__rodape-acoes > *")).toMatch(
      /min-height:\s*44px/,
    );
  });

  it("a região de status nunca some do layout (display: none calaria o anúncio)", () => {
    expect(css).not.toMatch(
      /configuracoes__anuncio[^{]*\{[^}]*display:\s*none/,
    );
  });

  it("o item atual se distingue do fundo da página (superfície, filete e peso), não só por um tom", () => {
    const atual = regra(".configuracoes__item--atual");
    expect(atual).toMatch(/background:\s*var\(--surface-canvas\)/);
    expect(atual).not.toMatch(/background:\s*var\(--surface-neutral\)/);
    expect(atual).toMatch(/border-left:\s*3px solid var\(--color-action\)/);
    expect(atual).toMatch(/font-weight:\s*var\(--weight-strong\)/);
  });

  it("o item da navegação interna tem alvo de 44 px e foco visível", () => {
    expect(regra(".configuracoes__item")).toMatch(/min-height:\s*44px/);
    expect(regra(".configuracoes__item:focus-visible")).toMatch(/outline:/);
  });

  it("sem posição fixa nem largura mínima que force rolagem", () => {
    expect(css).not.toMatch(/position:\s*fixed/);
    // Declarações de propriedade (não as consultas de mídia).
    expect(css).not.toMatch(/^\s+min-width:\s*[1-9]/m);
    expect(css).not.toMatch(/^\s+(min-)?width:\s*\d{3,}px/m);
  });
});

// ---------------------------------------------------------------------------
// T208 — foto de perfil (ADR 0018)
// ---------------------------------------------------------------------------

const VERSAO_FOTO = "2026-11-13T12:00:00.000Z";
const botao = (nome: string) => screen.queryByRole("button", { name: nome });
const arquivo = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

function escolher(conteudo: File) {
  Object.defineProperty(arquivo(), "files", {
    value: [conteudo],
    configurable: true,
  });
  fireEvent.change(arquivo());
}

function foto(tipo = "image/png", bytes = 64) {
  return new File([new Uint8Array(bytes)], "qualquer-nome.jpg", { type: tipo });
}

describe("T208 — foto de perfil: o que aparece", () => {
  it("sem foto: iniciais, 'Enviar foto', sem 'Remover foto' e sem imagem", () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    expect(iniciais()).toHaveTextContent("PT");
    expect(painel().querySelector("img")).toBeNull();
    expect(botao("Enviar foto")).toBeInTheDocument();
    expect(botao("Remover foto")).toBeNull();
    expect(painel()).toHaveTextContent(
      "Sem foto: o Evolli RH mostra as suas iniciais.",
    );
  });

  it("com foto: a imagem da própria conta, pela API e versionada; 'Trocar foto' e 'Remover foto'", () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, fotoVersao: VERSAO_FOTO }} />);
    const imagem = screen.getByRole("img", { name: "Sua foto de perfil" });
    expect(imagem).toHaveAttribute(
      "src",
      `/v1/users/me/foto?v=${encodeURIComponent(VERSAO_FOTO)}`,
    );
    expect(iniciais()).toBeNull();
    expect(botao("Trocar foto")).toBeInTheDocument();
    expect(botao("Remover foto")).toBeInTheDocument();
    expect(painel()).toHaveTextContent("Só você vê a sua foto.");
  });

  it("se a imagem não carregar, voltam as iniciais", () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, fotoVersao: VERSAO_FOTO }} />);
    fireEvent.error(screen.getByRole("img", { name: "Sua foto de perfil" }));
    expect(iniciais()).toHaveTextContent("PT");
  });
});

describe("T208 — foto de perfil: escolher, prévia e cancelar", () => {
  it("escolher um arquivo mostra a prévia local, leva o foco a 'Usar esta foto' e não envia nada", async () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    const previa = screen.getByRole("group", { name: "Prévia da nova foto" });
    expect(
      within(previa).getByRole("img", {
        name: "Prévia da nova foto, recortada no centro",
      }),
    ).toHaveAttribute("src", "blob:previa-sintetica");
    expect(document.activeElement).toBe(botao("Usar esta foto"));
    expect(enviarFotoPropria).not.toHaveBeenCalled();
  });

  it("Cancelar some com a prévia, libera a URL local e devolve o foco a 'Enviar foto'", async () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    fireEvent.click(botao("Cancelar")!);
    expect(
      screen.queryByRole("group", { name: "Prévia da nova foto" }),
    ).toBeNull();
    expect(revogarUrl).toHaveBeenCalledWith("blob:previa-sintetica");
    expect(document.activeElement).toBe(botao("Enviar foto"));
  });

  it("arquivo acima de 5 MB: alerta, sem prévia, nada enviado, foco em 'Enviar foto'", async () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto("image/png", 5 * 1024 * 1024 + 1));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O arquivo passa de 5 MB.",
    );
    expect(
      screen.queryByRole("group", { name: "Prévia da nova foto" }),
    ).toBeNull();
    expect(document.activeElement).toBe(botao("Enviar foto"));
    expect(enviarFotoPropria).not.toHaveBeenCalled();
  });

  it("tipo que não é JPEG, PNG ou WebP: alerta, sem prévia", async () => {
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto("image/gif"));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escolha uma imagem JPEG, PNG ou WebP",
    );
    expect(
      screen.queryByRole("group", { name: "Prévia da nova foto" }),
    ).toBeNull();
  });
});

describe("T208 — foto de perfil: enviar", () => {
  it("'Usar esta foto' envia o arquivo como veio e a versão lida; aplica a resposta; um anúncio só", async () => {
    const escolhida = foto("image/webp");
    const resposta = ator({
      fotoVersao: VERSAO_FOTO,
      perfilAtualizadoEm: VERSAO_FOTO,
    });
    vi.mocked(enviarFotoPropria).mockResolvedValue(resposta);
    const aoAtualizar = vi.fn();
    render(
      <MeuPerfilScreen
        conta={{ ...CONTA, perfilAtualizadoEm: VERSAO }}
        onContaAtualizada={aoAtualizar}
      />,
    );
    await act(async () => {
      escolher(escolhida);
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(enviarFotoPropria).toHaveBeenCalledWith(escolhida, VERSAO);
    expect(aoAtualizar).toHaveBeenCalledWith(resposta);
    expect(
      screen.getByRole("img", { name: "Sua foto de perfil" }),
    ).toHaveAttribute(
      "src",
      `/v1/users/me/foto?v=${encodeURIComponent(VERSAO_FOTO)}`,
    );
    expect(
      screen.queryByRole("group", { name: "Prévia da nova foto" }),
    ).toBeNull();
    expect(status()).toHaveTextContent("Foto atualizada.");
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(document.activeElement).toBe(botao("Trocar foto"));
  });

  it("enviar a foto não apaga o nome que está sendo editado", async () => {
    vi.mocked(enviarFotoPropria).mockResolvedValue(
      ator({ fotoVersao: VERSAO_FOTO, perfilAtualizadoEm: VERSAO_FOTO }),
    );
    render(<MeuPerfilScreen conta={CONTA} />);
    digitar("Nome Em Edicao");
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(campo().value).toBe("Nome Em Edicao");
    expect(salvar()).toBeInTheDocument();
  });

  it("enquanto envia: botões desabilitados e 'Enviando…'", async () => {
    let concluir!: (a: SafeAccessUserApi) => void;
    vi.mocked(enviarFotoPropria).mockReturnValue(
      new Promise((r) => {
        concluir = r;
      }),
    );
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(botao("Enviando…")).toBeDisabled();
    expect(botao("Enviar foto")).toBeDisabled();
    expect(botao("Cancelar")).toBeDisabled();
    await act(async () => {
      concluir(
        ator({ fotoVersao: VERSAO_FOTO, perfilAtualizadoEm: VERSAO_FOTO }),
      );
    });
    expect(botao("Trocar foto")).not.toBeDisabled();
  });

  it.each([
    ["foto_formato_invalido", "não é uma imagem JPEG, PNG ou WebP"],
    ["foto_pequena", "ao menos 128 × 128 pixels"],
    ["foto_grande_demais", "até 25 megapixels"],
    ["foto_invalida", "pode estar corrompido"],
  ])(
    "recusa do servidor (%s): alerta com o motivo, prévia descartada, foco em 'Enviar foto'",
    async (codigo, trecho) => {
      vi.mocked(enviarFotoPropria).mockRejectedValue(
        new ApiError(422, "Não foi possível processar a requisição.", codigo),
      );
      render(<MeuPerfilScreen conta={CONTA} />);
      await act(async () => {
        escolher(foto());
      });
      await act(async () => {
        fireEvent.click(botao("Usar esta foto")!);
      });
      expect(screen.getByRole("alert")).toHaveTextContent(trecho);
      expect(screen.getByRole("alert")).toHaveTextContent("Nada foi alterado.");
      expect(
        screen.queryByRole("group", { name: "Prévia da nova foto" }),
      ).toBeNull();
      expect(document.activeElement).toBe(botao("Enviar foto"));
      expect(status()).toHaveTextContent("");
    },
  );

  it("413 do servidor: mensagem de 5 MB", async () => {
    vi.mocked(enviarFotoPropria).mockRejectedValue(new ApiError(413, "x"));
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O arquivo passa de 5 MB.",
    );
  });

  it("conflito (409, outra aba mexeu no perfil): alerta de conflito e a prévia fica para tentar de novo", async () => {
    vi.mocked(enviarFotoPropria).mockRejectedValue(
      new ApiError(409, "Conflito."),
    );
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "alterado em outra sessão",
    );
    expect(
      screen.getByRole("group", { name: "Prévia da nova foto" }),
    ).toBeInTheDocument();
    // A frase vale para o nome e para a foto: nada de "texto no campo".
    expect(screen.getByRole("alert")).toHaveTextContent(
      "o que você alterou continua na tela",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(/texto|campo/);
  });

  it("sessão encerrada (401): diz para entrar de novo", async () => {
    vi.mocked(enviarFotoPropria).mockRejectedValue(new ApiError(401, "x"));
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A sua sessão terminou.",
    );
  });
});

describe("T208 — foto de perfil: remover", () => {
  it("pede confirmação com o foco no botão que confirma; Cancelar devolve o foco a 'Trocar foto'", async () => {
    render(<MeuPerfilScreen conta={{ ...CONTA, fotoVersao: VERSAO_FOTO }} />);
    await act(async () => {
      fireEvent.click(botao("Remover foto")!);
    });
    const confirmacao = screen.getByRole("group", {
      name: /Remover a sua foto\?/,
    });
    expect(document.activeElement).toBe(
      within(confirmacao).getByRole("button", { name: "Remover a foto" }),
    );
    fireEvent.click(
      within(confirmacao).getByRole("button", { name: "Cancelar" }),
    );
    expect(
      screen.queryByRole("group", { name: /Remover a sua foto\?/ }),
    ).toBeNull();
    expect(document.activeElement).toBe(botao("Trocar foto"));
    expect(removerFotoPropria).not.toHaveBeenCalled();
  });

  it("confirmar remove com a versão lida; voltam as iniciais; anúncio e foco em 'Enviar foto'", async () => {
    vi.mocked(removerFotoPropria).mockResolvedValue(
      ator({ fotoVersao: null, perfilAtualizadoEm: VERSAO_FOTO }),
    );
    render(
      <MeuPerfilScreen
        conta={{
          ...CONTA,
          fotoVersao: VERSAO_FOTO,
          perfilAtualizadoEm: VERSAO,
        }}
      />,
    );
    await act(async () => {
      fireEvent.click(botao("Remover foto")!);
    });
    await act(async () => {
      fireEvent.click(botao("Remover a foto")!);
    });
    expect(removerFotoPropria).toHaveBeenCalledWith(VERSAO);
    expect(painel().querySelector("img")).toBeNull();
    expect(iniciais()).toHaveTextContent("PT");
    expect(status()).toHaveTextContent("Foto removida.");
    expect(document.activeElement).toBe(botao("Enviar foto"));
  });

  it("remover com versão velha (409): alerta de conflito, a foto continua", async () => {
    vi.mocked(removerFotoPropria).mockRejectedValue(new ApiError(409, "x"));
    render(<MeuPerfilScreen conta={{ ...CONTA, fotoVersao: VERSAO_FOTO }} />);
    await act(async () => {
      fireEvent.click(botao("Remover foto")!);
    });
    await act(async () => {
      fireEvent.click(botao("Remover a foto")!);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "alterado em outra sessão",
    );
    expect(
      screen.getByRole("img", { name: "Sua foto de perfil" }),
    ).toBeInTheDocument();
  });
});

describe("T208 — foto de perfil: guarda de saída", () => {
  function montarComRegistro(conta: ContaDoMeuPerfil) {
    const registro = new RegistroDeEdicoes();
    render(
      <ProvedorDeEdicoes registro={registro}>
        <MeuPerfilScreen conta={conta} />
      </ProvedorDeEdicoes>,
    );
    return registro;
  }

  it("foto escolhida e não enviada é edição pendente; cancelar limpa", async () => {
    const registro = montarComRegistro(CONTA);
    expect(registro.obter().pendentes).toEqual([]);
    await act(async () => {
      escolher(foto());
    });
    expect(registro.obter().pendentes).toEqual([ROTULO_DA_EDICAO_DO_PERFIL]);
    fireEvent.click(botao("Cancelar")!);
    expect(registro.obter().pendentes).toEqual([]);
  });

  it("enviando ou removendo a foto: salvamento em curso (a saída fica bloqueada)", async () => {
    let concluir!: (a: SafeAccessUserApi) => void;
    vi.mocked(enviarFotoPropria).mockReturnValue(
      new Promise((r) => {
        concluir = r;
      }),
    );
    const registro = montarComRegistro(CONTA);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(registro.obter().salvando).toEqual([ROTULO_DA_EDICAO_DO_PERFIL]);
    await act(async () => {
      concluir(
        ator({ fotoVersao: VERSAO_FOTO, perfilAtualizadoEm: VERSAO_FOTO }),
      );
    });
    expect(registro.obter().salvando).toEqual([]);
    expect(registro.obter().pendentes).toEqual([]);
  });
});

describe("T208 — foto de perfil: layout a 375 px (CSS)", () => {
  const css = readFileSync(
    "src/screens/configuracoes/MeuPerfilScreen.css",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const regra = (seletor: string) => {
    const inicio = css.indexOf(`\n${seletor} {`);
    if (inicio < 0) return "";
    return css.slice(inicio, css.indexOf("}", inicio));
  };

  it("foto e prévia em tamanho fixo pequeno, sem distorcer (corte central, como o servidor)", () => {
    expect(regra(".configuracoes__foto")).toMatch(/object-fit:\s*cover/);
    expect(regra(".configuracoes__previa-imagem")).toMatch(
      /object-fit:\s*cover/,
    );
    expect(regra(".configuracoes__previa-imagem")).toMatch(
      /object-position:\s*center/,
    );
    expect(regra(".configuracoes__previa-imagem")).toMatch(/max-width:\s*100%/);
  });

  it("ações da foto quebram linha e têm alvo de 44 px", () => {
    expect(css).toMatch(
      /\.configuracoes__foto-acoes,\n\.configuracoes__previa-acoes \{[^}]*flex-wrap:\s*wrap/,
    );
    expect(css).toMatch(
      /\.configuracoes__foto-acoes > button,\n\.configuracoes__previa-acoes > button \{\n\s*min-height:\s*44px/,
    );
  });
});

describe("T208 — foto de perfil: o foco volta ao botão depois que ele se reabilita", () => {
  // No navegador, o estado "enviando" chega ao DOM antes da resposta: o
  // botão da foto fica desabilitado enquanto espera. Achado no navegador: o
  // foco era pedido com o botão ainda desabilitado e caía no `body`. Aqui a
  // resposta só chega DEPOIS de a tela mostrar o envio em curso.
  function pendente<T>() {
    let resolver!: (v: T) => void;
    let rejeitar!: (e: unknown) => void;
    const promessa = new Promise<T>((res, rej) => {
      resolver = res;
      rejeitar = rej;
    });
    return { promessa, resolver, rejeitar };
  }

  it("depois de enviar: foco em 'Trocar foto'", async () => {
    const envio = pendente<SafeAccessUserApi>();
    vi.mocked(enviarFotoPropria).mockReturnValue(envio.promessa);
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    expect(botao("Enviar foto")).toBeDisabled();
    await act(async () => {
      envio.resolver(
        ator({ fotoVersao: VERSAO_FOTO, perfilAtualizadoEm: VERSAO_FOTO }),
      );
    });
    expect(document.activeElement).toBe(botao("Trocar foto"));
  });

  it("depois de uma recusa do servidor: foco em 'Enviar foto'", async () => {
    const envio = pendente<SafeAccessUserApi>();
    vi.mocked(enviarFotoPropria).mockReturnValue(envio.promessa);
    render(<MeuPerfilScreen conta={CONTA} />);
    await act(async () => {
      escolher(foto());
    });
    await act(async () => {
      fireEvent.click(botao("Usar esta foto")!);
    });
    await act(async () => {
      envio.rejeitar(new ApiError(422, "x", "foto_pequena"));
    });
    expect(document.activeElement).toBe(botao("Enviar foto"));
  });

  it("depois de remover: foco em 'Enviar foto'", async () => {
    const remocao = pendente<SafeAccessUserApi>();
    vi.mocked(removerFotoPropria).mockReturnValue(remocao.promessa);
    render(<MeuPerfilScreen conta={{ ...CONTA, fotoVersao: VERSAO_FOTO }} />);
    await act(async () => {
      fireEvent.click(botao("Remover foto")!);
    });
    await act(async () => {
      fireEvent.click(botao("Remover a foto")!);
    });
    await act(async () => {
      remocao.resolver(
        ator({ fotoVersao: null, perfilAtualizadoEm: VERSAO_FOTO }),
      );
    });
    expect(document.activeElement).toBe(botao("Enviar foto"));
  });
});
