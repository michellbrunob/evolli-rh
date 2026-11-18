/**
 * T210 — a marca Evolli, só pelos SVGs locais da pasta de marca
 * (`assets/brand`). Nada é redesenhado nem recolorido aqui: cada tom é um
 * arquivo — o azul oficial (#0066CC) sobre superfícies claras e o branco
 * (mesma geometria, só o preenchimento) sobre superfícies escuras ou na cor
 * de ação.
 *
 * Versões por contexto:
 * - **horizontal** — topo do menu, barra superior, Hub, login;
 * - **simbolo** — menu recolhido e espaços compactos (ícone do app);
 * - **vertical** — telas institucionais, login e carregamento.
 *
 * Nome acessível "Evolli" (`alt`). Quando o nome já está escrito ao lado, a
 * marca é decorativa (`alt=""`), para não ser lida duas vezes.
 *
 * Tamanho: a largura vem da proporção do próprio arquivo (sem distorção);
 * o símbolo nunca fica abaixo de 24 px e a horizontal nunca abaixo de
 * 156 px de largura — abaixo disso, use o símbolo.
 */
import horizontalAzul from "../../assets/brand/evolli-horizontal.svg";
import horizontalBranco from "../../assets/brand/evolli-horizontal-branco.svg";
import simboloAzul from "../../assets/brand/evolli-symbol.svg";
import simboloBranco from "../../assets/brand/evolli-symbol-branco.svg";
import verticalAzul from "../../assets/brand/evolli-vertical.svg";
import verticalBranco from "../../assets/brand/evolli-vertical-branco.svg";
import "./MarcaEvolli.css";

export type VarianteDaMarca = "horizontal" | "simbolo" | "vertical";
export type TomDaMarca = "azul" | "branco";

const ARQUIVO: Readonly<
  Record<VarianteDaMarca, Readonly<Record<TomDaMarca, string>>>
> = {
  horizontal: { azul: horizontalAzul, branco: horizontalBranco },
  simbolo: { azul: simboloAzul, branco: simboloBranco },
  vertical: { azul: verticalAzul, branco: verticalBranco },
};

/** Largura ÷ altura, da `viewBox` de cada arquivo. */
const PROPORCAO: Readonly<Record<VarianteDaMarca, number>> = {
  horizontal: 560 / 116,
  simbolo: 1,
  vertical: 96 / 63,
};

const ALTURA_PADRAO: Readonly<Record<VarianteDaMarca, number>> = {
  horizontal: 33,
  simbolo: 28,
  vertical: 72,
};

/** Mínimos da marca: símbolo 24 px; horizontal 156 px de largura. */
const ALTURA_MINIMA: Readonly<Record<VarianteDaMarca, number>> = {
  horizontal: Math.ceil(156 / PROPORCAO.horizontal),
  simbolo: 24,
  vertical: 24,
};

export interface MarcaEvolliProps {
  readonly variante?: VarianteDaMarca;
  readonly tom?: TomDaMarca;
  /** Altura em px; a largura segue a proporção do arquivo. */
  readonly altura?: number;
  /** O nome "Evolli" já está escrito ao lado: não ler duas vezes. */
  readonly decorativa?: boolean;
  readonly className?: string;
  /**
   * Até esta largura de janela (px), o navegador troca a assinatura pelo
   * símbolo (`<picture>`): abaixo de 156 px de largura disponível, a prancha
   * da marca pede o símbolo. Continua uma imagem só, com o mesmo nome.
   */
  readonly simboloAte?: number;
}

const ALTURA_DO_SIMBOLO_COMPACTO = 28;

export function MarcaEvolli({
  variante = "horizontal",
  tom = "azul",
  altura,
  decorativa = false,
  className,
  simboloAte,
}: MarcaEvolliProps) {
  const h = Math.max(
    altura ?? ALTURA_PADRAO[variante],
    ALTURA_MINIMA[variante],
  );
  const w = Math.round(h * PROPORCAO[variante]);
  const imagem = (
    <img
      className={[`marca-evolli marca-evolli--${variante}`, className]
        .filter(Boolean)
        .join(" ")}
      src={ARQUIVO[variante][tom]}
      width={w}
      height={h}
      alt={decorativa ? "" : "Evolli"}
      draggable={false}
      decoding="async"
    />
  );
  if (simboloAte === undefined || variante === "simbolo") return imagem;
  return (
    <picture className="marca-evolli__quadro">
      <source
        media={`(max-width: ${simboloAte}px)`}
        srcSet={ARQUIVO.simbolo[tom]}
        width={ALTURA_DO_SIMBOLO_COMPACTO}
        height={ALTURA_DO_SIMBOLO_COMPACTO}
      />
      {imagem}
    </picture>
  );
}
