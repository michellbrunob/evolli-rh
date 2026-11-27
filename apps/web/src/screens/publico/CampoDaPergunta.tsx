/**
 * T216 — uma pergunta por tela, na página pública: o texto em destaque (o
 * título da tela, que recebe o foco a cada troca) e o controle próprio de
 * cada um dos 11 tipos, ligado a esse título por `aria-labelledby`.
 *
 * Escalas, notas, estrelas, sim/não e escolha única são `input type="radio"`
 * nativos num `role="radiogroup"` (o teclado do navegador vale: Tab entra no
 * grupo, as setas trocam a opção). A aparência de botão vem do rótulo; o
 * círculo nativo fica só para o leitor de tela. Múltipla escolha usa caixas
 * de seleção do padrão do sistema.
 */
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Pergunta } from "../../api/pesquisaPublicaClient";
import {
  LIMITE_OUTRO,
  LIMITE_PARAGRAFO,
  LIMITE_TEXTO_CURTO,
  type EscolhaRascunho,
  type MultiplaRascunho,
  type ValorRascunho,
} from "./regrasDaPesquisa";
import { mascararDataDigitada } from "../../format/dataDigitada";

const OUTRO = "__outro";

const CONCORDANCIA = [
  "Discordo totalmente",
  "Discordo",
  "Não concordo nem discordo",
  "Concordo",
  "Concordo totalmente",
] as const;

export interface CampoDaPerguntaProps {
  readonly pergunta: Pergunta;
  readonly valor: ValorRascunho | undefined;
  readonly erro: string | null;
  readonly aoMudar: (valor: ValorRascunho) => void;
  /** O título da pergunta: recebe o foco a cada troca de tela. */
  readonly tituloRef?: Ref<HTMLHeadingElement>;
  /**
   * Nível do título: 1 quando a pergunta é a tela inteira (uma por tela);
   * 2 quando aparece dentro de uma seção (Personalizada).
   */
  readonly nivel?: 1 | 2;
}

function intervalo(de: number, ate: number): number[] {
  const saida: number[] = [];
  for (let n = de; n <= ate; n++) saida.push(n);
  return saida;
}

function textoDoNumero(n: number): string {
  return String(n).replace(".", ",");
}

function MarcaObrigatoria({ obrigatoria }: { readonly obrigatoria: boolean }) {
  if (!obrigatoria) {
    return <span className="pesquisa-pergunta__opcional"> (opcional)</span>;
  }
  return (
    <>
      <span className="pesquisa-pergunta__obrigatoria" aria-hidden="true">
        {" "}
        *
      </span>
      <span className="pesquisa-sr"> (obrigatória)</span>
    </>
  );
}

function MensagemDeErro({
  id,
  erro,
}: {
  readonly id: string;
  readonly erro: string | null;
}) {
  if (!erro) return null;
  return (
    <p id={id} className="pesquisa-pergunta__erro" role="alert">
      <span className="pesquisa-pergunta__erro-icone" aria-hidden="true">
        !
      </span>
      <span>{erro}</span>
    </p>
  );
}

interface OpcaoDoGrupo {
  readonly valor: string;
  /** O que aparece no botão. */
  readonly rotulo: ReactNode;
  /** Complemento só para o leitor de tela (ex.: "3 estrelas"). */
  readonly complemento?: string;
}

/** Grupo de botões rádio (escala, nota, estrelas, sim/não, escolha única). */
function GrupoDeRadios({
  base,
  descritores,
  erro,
  opcoes,
  marcado,
  aoMarcar,
  disposicao,
  extremos,
}: {
  readonly base: string;
  readonly descritores: string | undefined;
  readonly erro: string | null;
  readonly opcoes: readonly OpcaoDoGrupo[];
  readonly marcado: string | null;
  readonly aoMarcar: (valor: string) => void;
  readonly disposicao: "linha" | "lista" | "estrelas";
  readonly extremos?: readonly [string, string] | null;
}) {
  const valorMarcado = marcado === null ? null : Number(marcado);
  const descricao = [descritores, extremos ? `${base}-extremos` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${base}-titulo`}
      aria-describedby={descricao || undefined}
      aria-invalid={erro ? true : undefined}
      className="pesquisa-grupo"
    >
      {/* Os extremos ficam ACIMA da fileira, alinhados às pontas. */}
      {extremos ? (
        <p id={`${base}-extremos`} className="pesquisa-extremos">
          <span>{extremos[0]}</span>
          <span>{extremos[1]}</span>
        </p>
      ) : null}
      <div
        className={`pesquisa-opcoes pesquisa-opcoes--${disposicao}`}
        style={
          disposicao === "linha"
            ? ({
                // Todos os quadrados numa linha; no celular, em duas
                // linhas iguais quando passam de 6 (alvo de toque de 44 px).
                "--colunas": opcoes.length,
                "--colunas-celular":
                  opcoes.length > 6
                    ? Math.ceil(opcoes.length / 2)
                    : opcoes.length,
              } as CSSProperties)
            : undefined
        }
      >
        {opcoes.map((o) => {
          const ativo =
            disposicao === "estrelas"
              ? valorMarcado !== null && Number(o.valor) <= valorMarcado
              : marcado === o.valor;
          return (
            <label
              key={o.valor}
              className={[
                "pesquisa-opcao",
                marcado === o.valor ? "pesquisa-opcao--marcada" : null,
                ativo ? "pesquisa-opcao--ativa" : null,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                className="pesquisa-opcao__entrada"
                name={base}
                value={o.valor}
                checked={marcado === o.valor}
                onChange={() => aoMarcar(o.valor)}
              />
              <span className="pesquisa-opcao__rotulo">{o.rotulo}</span>
              {o.complemento ? (
                <span className="pesquisa-sr">{o.complemento}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Campo de texto livre para "Outro". */
function CampoOutro({
  base,
  valor,
  aoMudar,
}: {
  readonly base: string;
  readonly valor: string;
  readonly aoMudar: (texto: string) => void;
}) {
  const id = `${base}-outro`;
  return (
    <div className="pesquisa-outro">
      <label htmlFor={id} className="pesquisa-pergunta__rotulo-menor">
        Qual é a outra opção?
      </label>
      <input
        id={id}
        type="text"
        className="pesquisa-campo"
        value={valor}
        maxLength={LIMITE_OUTRO}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}

/** A ajuda fixa de cada tipo (formato, limite, quantas escolhas). */
function ajudaDoTipo(
  pergunta: Pergunta,
  valor: ValorRascunho | undefined,
): string | null {
  const { tipo, config } = pergunta;
  switch (tipo) {
    case "texto_curto":
      return `Até ${LIMITE_TEXTO_CURTO} caracteres.`;
    case "paragrafo":
      return `Até ${LIMITE_PARAGRAFO} caracteres.`;
    case "data":
      return "No formato dd/mm/aaaa.";
    case "estrelas":
      return typeof valor === "number"
        ? `Você deu ${valor} de 5 estrelas.`
        : "De 1 a 5 estrelas.";
    case "multipla_escolha":
      return config.maximo !== undefined
        ? `Escolha até ${config.maximo === 1 ? "1 opção" : `${config.maximo} opções`}.`
        : "Escolha quantas opções quiser.";
    case "numero": {
      const { minimo, maximo, inteiro } = config;
      const partes = [
        inteiro ? "Número inteiro" : null,
        minimo !== undefined && maximo !== undefined
          ? `entre ${textoDoNumero(minimo)} e ${textoDoNumero(maximo)}`
          : minimo !== undefined
            ? `a partir de ${textoDoNumero(minimo)}`
            : maximo !== undefined
              ? `até ${textoDoNumero(maximo)}`
              : null,
      ].filter(Boolean);
      return partes.length
        ? `${partes.join(", ")}.`.replace(/^./, (c) => c.toUpperCase())
        : null;
    }
    default:
      return null;
  }
}

export function CampoDaPergunta({
  pergunta,
  valor,
  erro,
  aoMudar,
  tituloRef,
  nivel = 1,
}: CampoDaPerguntaProps) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  const { tipo, config } = pergunta;
  const base = `q-${pergunta.id}`;
  const ajuda = ajudaDoTipo(pergunta, valor);
  const descritores =
    [
      pergunta.descricao ? `${base}-desc` : null,
      ajuda ? `${base}-ajuda` : null,
      erro ? `${base}-erro` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  /** Props comuns dos campos de texto (rótulo = o título da pergunta). */
  const doCampo = {
    id: base,
    className: "pesquisa-campo",
    "aria-labelledby": `${base}-titulo`,
    "aria-describedby": descritores,
    "aria-invalid": erro ? true : undefined,
    "aria-required": pergunta.obrigatoria ? true : undefined,
  } as const;

  let controle: ReactNode;
  switch (tipo) {
    case "texto_curto":
      controle = (
        <input
          type="text"
          maxLength={LIMITE_TEXTO_CURTO}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => aoMudar(e.target.value)}
          {...doCampo}
        />
      );
      break;

    case "paragrafo":
      controle = (
        <textarea
          rows={6}
          maxLength={LIMITE_PARAGRAFO}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => aoMudar(e.target.value)}
          {...doCampo}
        />
      );
      break;

    case "data":
      controle = (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => aoMudar(mascararDataDigitada(e.target.value))}
          {...doCampo}
        />
      );
      break;

    case "numero":
      controle = (
        <input
          type="text"
          inputMode={config.inteiro ? "numeric" : "decimal"}
          autoComplete="off"
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => aoMudar(e.target.value)}
          {...doCampo}
        />
      );
      break;

    case "sim_nao":
      controle = (
        <GrupoDeRadios
          base={base}
          descritores={descritores}
          erro={erro}
          disposicao="linha"
          marcado={typeof valor === "string" ? valor : null}
          aoMarcar={aoMudar}
          opcoes={[
            { valor: "sim", rotulo: "Sim" },
            { valor: "nao", rotulo: "Não" },
          ]}
        />
      );
      break;

    case "concordancia":
      controle = (
        <GrupoDeRadios
          base={base}
          descritores={descritores}
          erro={erro}
          disposicao="lista"
          marcado={typeof valor === "number" ? String(valor) : null}
          aoMarcar={(v) => aoMudar(Number(v))}
          opcoes={CONCORDANCIA.map((rotulo, i) => ({
            valor: String(i + 1),
            rotulo,
          }))}
        />
      );
      break;

    case "estrelas":
      controle = (
        <GrupoDeRadios
          base={base}
          descritores={descritores}
          erro={erro}
          disposicao="estrelas"
          marcado={typeof valor === "number" ? String(valor) : null}
          aoMarcar={(v) => aoMudar(Number(v))}
          opcoes={intervalo(1, 5).map((n) => ({
            valor: String(n),
            rotulo: <span aria-hidden="true">★</span>,
            complemento: n === 1 ? "1 estrela" : `${n} estrelas`,
          }))}
        />
      );
      break;

    case "nota_0_10":
    case "escala": {
      const de = tipo === "escala" ? (config.minimo ?? 1) : 0;
      const ate = tipo === "escala" ? (config.maximo ?? 5) : 10;
      const extremos: readonly [string, string] =
        tipo === "escala"
          ? [config.rotuloMinimo || "Mínimo", config.rotuloMaximo || "Máximo"]
          : config.enps
            ? ["Nada provável", "Muito provável"]
            : ["Mínimo", "Máximo"];
      controle = (
        <GrupoDeRadios
          base={base}
          descritores={descritores}
          erro={erro}
          disposicao="linha"
          marcado={typeof valor === "number" ? String(valor) : null}
          aoMarcar={(v) => aoMudar(Number(v))}
          extremos={extremos}
          opcoes={intervalo(de, ate).map((n) => ({
            valor: String(n),
            rotulo: String(n),
          }))}
        />
      );
      break;
    }

    case "escolha_unica": {
      const v: EscolhaRascunho =
        valor && typeof valor === "object" && "opcao" in valor
          ? valor
          : { opcao: null, outro: null };
      const opcoes: OpcaoDoGrupo[] = (config.opcoes ?? []).map((o) => ({
        valor: o.id,
        rotulo: o.texto,
      }));
      if (config.outro) opcoes.push({ valor: OUTRO, rotulo: "Outro" });
      controle = (
        <>
          <GrupoDeRadios
            base={base}
            descritores={descritores}
            erro={erro}
            disposicao="lista"
            marcado={v.outro !== null ? OUTRO : v.opcao}
            aoMarcar={(id) =>
              aoMudar(
                id === OUTRO
                  ? { opcao: null, outro: v.outro ?? "" }
                  : { opcao: id, outro: null },
              )
            }
            opcoes={opcoes}
          />
          {v.outro !== null ? (
            <CampoOutro
              base={base}
              valor={v.outro}
              aoMudar={(t) => aoMudar({ opcao: null, outro: t })}
            />
          ) : null}
        </>
      );
      break;
    }

    case "multipla_escolha": {
      const v: MultiplaRascunho =
        valor && typeof valor === "object" && "opcoes" in valor
          ? valor
          : { opcoes: [], outro: null };
      const maximo = config.maximo;
      const total = v.opcoes.length + (v.outro !== null ? 1 : 0);
      const cheio = maximo !== undefined && total >= maximo;
      const itens = [
        ...(config.opcoes ?? []).map((o) => ({ id: o.id, texto: o.texto })),
        ...(config.outro ? [{ id: OUTRO, texto: "Outro" }] : []),
      ];
      const alternar = (id: string, marcar: boolean) => {
        if (id === OUTRO) {
          aoMudar({ opcoes: v.opcoes, outro: marcar ? (v.outro ?? "") : null });
          return;
        }
        aoMudar({
          opcoes: marcar ? [...v.opcoes, id] : v.opcoes.filter((x) => x !== id),
          outro: v.outro,
        });
      };
      controle = (
        <>
          <div
            role="group"
            aria-labelledby={`${base}-titulo`}
            aria-describedby={descritores}
            aria-invalid={erro ? true : undefined}
            className="pesquisa-opcoes pesquisa-opcoes--lista"
          >
            {itens.map((o) => {
              const marcado =
                o.id === OUTRO ? v.outro !== null : v.opcoes.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={[
                    "pesquisa-opcao pesquisa-opcao--caixa",
                    marcado ? "pesquisa-opcao--marcada" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!marcado && cheio}
                    onChange={(e) => alternar(o.id, e.target.checked)}
                  />
                  <span className="pesquisa-opcao__rotulo">{o.texto}</span>
                </label>
              );
            })}
          </div>
          {v.outro !== null ? (
            <CampoOutro
              base={base}
              valor={v.outro}
              aoMudar={(t) => aoMudar({ opcoes: v.opcoes, outro: t })}
            />
          ) : null}
        </>
      );
      break;
    }
  }

  return (
    <div className="pesquisa-pergunta" data-pergunta={pergunta.id}>
      <Titulo
        id={`${base}-titulo`}
        ref={nivel === 1 ? tituloRef : undefined}
        tabIndex={nivel === 1 ? -1 : undefined}
        className={`pesquisa-pergunta__texto pesquisa-pergunta__texto--${nivel}`}
      >
        {pergunta.texto}
        <MarcaObrigatoria obrigatoria={pergunta.obrigatoria} />
      </Titulo>
      {pergunta.descricao ? (
        <p id={`${base}-desc`} className="pesquisa-pergunta__descricao">
          {pergunta.descricao}
        </p>
      ) : null}
      {ajuda ? (
        <p id={`${base}-ajuda`} className="pesquisa-pergunta__ajuda">
          {ajuda}
        </p>
      ) : null}
      {controle}
      <MensagemDeErro id={`${base}-erro`} erro={erro} />
    </div>
  );
}
