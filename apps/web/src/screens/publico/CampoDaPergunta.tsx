/**
 * T216 — o controle de cada um dos 11 tipos de pergunta, na página pública.
 *
 * Escalas, notas, estrelas, sim/não e escolha única são `input type="radio"`
 * nativos num `fieldset` com `legend` (o teclado do navegador vale: Tab entra
 * no grupo, as setas trocam a opção). A aparência de botão vem do rótulo; o
 * círculo nativo fica só para o leitor de tela. Múltipla escolha usa caixas de
 * seleção do padrão do sistema.
 */
import type { ReactNode } from "react";
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
}

function intervalo(de: number, ate: number): number[] {
  const saida: number[] = [];
  for (let n = de; n <= ate; n++) saida.push(n);
  return saida;
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
  /** Complemento só para o leitor de tela (ex.: "estrelas"). */
  readonly complemento?: string;
}

/** Grupo de botões rádio (escala, nota, estrelas, sim/não, escolha única). */
function GrupoDeRadios({
  pergunta,
  erro,
  opcoes,
  marcado,
  aoMarcar,
  disposicao,
  ajuda,
  extremos,
  depois,
}: {
  readonly pergunta: Pergunta;
  readonly erro: string | null;
  readonly opcoes: readonly OpcaoDoGrupo[];
  readonly marcado: string | null;
  readonly aoMarcar: (valor: string) => void;
  readonly disposicao: "linha" | "lista" | "estrelas";
  readonly ajuda?: string | null;
  readonly extremos?: readonly [string, string] | null;
  readonly depois?: ReactNode;
}) {
  const base = `q-${pergunta.id}`;
  const descritores = [
    pergunta.descricao ? `${base}-desc` : null,
    ajuda ? `${base}-ajuda` : null,
    extremos ? `${base}-extremos` : null,
    erro ? `${base}-erro` : null,
  ].filter(Boolean);
  const valorMarcado = marcado === null ? null : Number(marcado);
  return (
    <fieldset
      className="pesquisa-pergunta"
      data-pergunta={pergunta.id}
      aria-describedby={descritores.length ? descritores.join(" ") : undefined}
      aria-invalid={erro ? true : undefined}
    >
      <legend className="pesquisa-pergunta__texto">
        {pergunta.texto}
        <MarcaObrigatoria obrigatoria={pergunta.obrigatoria} />
      </legend>
      {pergunta.descricao ? (
        <p id={`${base}-desc`} className="pesquisa-pergunta__descricao">
          {pergunta.descricao}
        </p>
      ) : null}
      {ajuda ? (
        <p id={`${base}-ajuda`} className="pesquisa-pergunta__descricao">
          {ajuda}
        </p>
      ) : null}
      <div className={`pesquisa-opcoes pesquisa-opcoes--${disposicao}`}>
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
      {extremos ? (
        <p id={`${base}-extremos`} className="pesquisa-extremos">
          <span>{extremos[0]}</span>
          <span>{extremos[1]}</span>
        </p>
      ) : null}
      {depois}
      <MensagemDeErro id={`${base}-erro`} erro={erro} />
    </fieldset>
  );
}

/** Campo de texto livre para "Outro". */
function CampoOutro({
  pergunta,
  valor,
  aoMudar,
}: {
  readonly pergunta: Pergunta;
  readonly valor: string;
  readonly aoMudar: (texto: string) => void;
}) {
  const id = `q-${pergunta.id}-outro`;
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

function CampoDeTexto({
  pergunta,
  valor,
  erro,
  aoMudar,
  ajuda,
  children,
}: {
  readonly pergunta: Pergunta;
  readonly valor: string;
  readonly erro: string | null;
  readonly aoMudar: (v: string) => void;
  readonly ajuda?: string | null;
  readonly children: (props: {
    id: string;
    value: string;
    onChange: (v: string) => void;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
    "aria-required"?: true;
    className: string;
  }) => ReactNode;
}) {
  const base = `q-${pergunta.id}`;
  const descritores = [
    pergunta.descricao ? `${base}-desc` : null,
    ajuda ? `${base}-ajuda` : null,
    erro ? `${base}-erro` : null,
  ].filter(Boolean);
  const props: Parameters<typeof children>[0] = {
    id: base,
    value: valor,
    onChange: aoMudar,
    className: "pesquisa-campo",
  };
  if (descritores.length) props["aria-describedby"] = descritores.join(" ");
  if (erro) props["aria-invalid"] = true;
  if (pergunta.obrigatoria) props["aria-required"] = true;
  return (
    <div className="pesquisa-pergunta" data-pergunta={pergunta.id}>
      <label htmlFor={base} className="pesquisa-pergunta__texto">
        {pergunta.texto}
        <MarcaObrigatoria obrigatoria={pergunta.obrigatoria} />
      </label>
      {pergunta.descricao ? (
        <p id={`${base}-desc`} className="pesquisa-pergunta__descricao">
          {pergunta.descricao}
        </p>
      ) : null}
      {ajuda ? (
        <p id={`${base}-ajuda`} className="pesquisa-pergunta__descricao">
          {ajuda}
        </p>
      ) : null}
      {children(props)}
      <MensagemDeErro id={`${base}-erro`} erro={erro} />
    </div>
  );
}

function textoDoNumero(n: number): string {
  return String(n).replace(".", ",");
}

export function CampoDaPergunta({
  pergunta,
  valor,
  erro,
  aoMudar,
}: CampoDaPerguntaProps) {
  const { tipo, config } = pergunta;

  switch (tipo) {
    case "texto_curto":
    case "paragrafo": {
      const limite =
        tipo === "texto_curto" ? LIMITE_TEXTO_CURTO : LIMITE_PARAGRAFO;
      const texto = typeof valor === "string" ? valor : "";
      return (
        <CampoDeTexto
          pergunta={pergunta}
          valor={texto}
          erro={erro}
          aoMudar={aoMudar}
          ajuda={`Até ${limite} caracteres.`}
        >
          {({ onChange, ...p }) =>
            tipo === "texto_curto" ? (
              <input
                type="text"
                maxLength={limite}
                onChange={(e) => onChange(e.target.value)}
                {...p}
              />
            ) : (
              <textarea
                rows={5}
                maxLength={limite}
                onChange={(e) => onChange(e.target.value)}
                {...p}
              />
            )
          }
        </CampoDeTexto>
      );
    }

    case "data":
      return (
        <CampoDeTexto
          pergunta={pergunta}
          valor={typeof valor === "string" ? valor : ""}
          erro={erro}
          aoMudar={(v) => aoMudar(mascararDataDigitada(v))}
          ajuda="No formato dd/mm/aaaa."
        >
          {({ onChange, ...p }) => (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              onChange={(e) => onChange(e.target.value)}
              {...p}
            />
          )}
        </CampoDeTexto>
      );

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
      const ajuda = partes.length
        ? `${partes.join(", ")}.`.replace(/^./, (c) => c.toUpperCase())
        : null;
      return (
        <CampoDeTexto
          pergunta={pergunta}
          valor={typeof valor === "string" ? valor : ""}
          erro={erro}
          aoMudar={aoMudar}
          ajuda={ajuda}
        >
          {({ onChange, ...p }) => (
            <input
              type="text"
              inputMode={inteiro ? "numeric" : "decimal"}
              autoComplete="off"
              onChange={(e) => onChange(e.target.value)}
              {...p}
            />
          )}
        </CampoDeTexto>
      );
    }

    case "sim_nao":
      return (
        <GrupoDeRadios
          pergunta={pergunta}
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

    case "concordancia":
      return (
        <GrupoDeRadios
          pergunta={pergunta}
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

    case "estrelas":
      return (
        <GrupoDeRadios
          pergunta={pergunta}
          erro={erro}
          disposicao="estrelas"
          marcado={typeof valor === "number" ? String(valor) : null}
          aoMarcar={(v) => aoMudar(Number(v))}
          ajuda={
            typeof valor === "number"
              ? `Você deu ${valor} de 5 estrelas.`
              : "De 1 a 5 estrelas."
          }
          opcoes={intervalo(1, 5).map((n) => ({
            valor: String(n),
            rotulo: <span aria-hidden="true">★</span>,
            complemento: n === 1 ? "1 estrela" : `${n} estrelas`,
          }))}
        />
      );

    case "nota_0_10":
    case "escala": {
      const de = tipo === "escala" ? (config.minimo ?? 1) : 0;
      const ate = tipo === "escala" ? (config.maximo ?? 5) : 10;
      const extremos: readonly [string, string] | null =
        tipo === "escala"
          ? config.rotuloMinimo || config.rotuloMaximo
            ? [
                config.rotuloMinimo ? `${de}: ${config.rotuloMinimo}` : "",
                config.rotuloMaximo ? `${ate}: ${config.rotuloMaximo}` : "",
              ]
            : null
          : ["0: nada provável", "10: muito provável"];
      return (
        <GrupoDeRadios
          pergunta={pergunta}
          erro={erro}
          disposicao="linha"
          marcado={typeof valor === "number" ? String(valor) : null}
          aoMarcar={(v) => aoMudar(Number(v))}
          extremos={tipo === "nota_0_10" && !config.enps ? null : extremos}
          opcoes={intervalo(de, ate).map((n) => ({
            valor: String(n),
            rotulo: String(n),
          }))}
        />
      );
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
      return (
        <GrupoDeRadios
          pergunta={pergunta}
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
          depois={
            v.outro !== null ? (
              <CampoOutro
                pergunta={pergunta}
                valor={v.outro}
                aoMudar={(t) => aoMudar({ opcao: null, outro: t })}
              />
            ) : null
          }
        />
      );
    }

    case "multipla_escolha": {
      const v: MultiplaRascunho =
        valor && typeof valor === "object" && "opcoes" in valor
          ? valor
          : { opcoes: [], outro: null };
      const base = `q-${pergunta.id}`;
      const maximo = config.maximo;
      const total = v.opcoes.length + (v.outro !== null ? 1 : 0);
      const cheio = maximo !== undefined && total >= maximo;
      const ajuda =
        maximo !== undefined
          ? `Escolha até ${maximo === 1 ? "1 opção" : `${maximo} opções`}.`
          : "Escolha quantas opções quiser.";
      const descritores = [
        pergunta.descricao ? `${base}-desc` : null,
        `${base}-ajuda`,
        erro ? `${base}-erro` : null,
      ].filter(Boolean);
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
      return (
        <fieldset
          className="pesquisa-pergunta"
          data-pergunta={pergunta.id}
          aria-describedby={descritores.join(" ")}
          aria-invalid={erro ? true : undefined}
        >
          <legend className="pesquisa-pergunta__texto">
            {pergunta.texto}
            <MarcaObrigatoria obrigatoria={pergunta.obrigatoria} />
          </legend>
          {pergunta.descricao ? (
            <p id={`${base}-desc`} className="pesquisa-pergunta__descricao">
              {pergunta.descricao}
            </p>
          ) : null}
          <p id={`${base}-ajuda`} className="pesquisa-pergunta__descricao">
            {ajuda}
          </p>
          <div className="pesquisa-opcoes pesquisa-opcoes--lista">
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
              pergunta={pergunta}
              valor={v.outro}
              aoMudar={(t) => aoMudar({ opcoes: v.opcoes, outro: t })}
            />
          ) : null}
          <MensagemDeErro id={`${base}-erro`} erro={erro} />
        </fieldset>
      );
    }
  }
}
