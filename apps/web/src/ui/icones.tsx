/**
 * T209 — ícones do ecossistema: Iconsax (`iconsax-react`, MIT), decisão da
 * proprietária de 2026-11-17 (um desenho só no produto inteiro).
 *
 * - **Bulk** (duas camadas, a de fundo com opacidade) para módulos, itens de
 *   navegação e ações com significado (empresa, perfil, editar, adicionar
 *   pessoa…);
 * - **Linear** (traço) para os glifos de interface: setas, fechar, mais e o
 *   visto.
 *
 * Um ponto só de entrada: as telas pedem o ícone pelo papel dele, e a troca
 * de pacote ou de variante fica aqui. Sempre decorativos (`aria-hidden`): o
 * nome vem do texto ao lado ou do rótulo do botão.
 */
import {
  Add,
  ArrowDown2,
  ArrowLeft2,
  ArrowRight2,
  Building,
  Calendar,
  Clock,
  ColorSwatch,
  Cup,
  DocumentDownload,
  DocumentText,
  DocumentUpload,
  Edit2,
  Element3,
  Eye,
  Gift,
  Hierarchy,
  InfoCircle,
  MessageQuestion,
  Messages1,
  People,
  Personalcard,
  Profile,
  Profile2User,
  ProfileCircle,
  Rank,
  Receipt,
  Routing2,
  SecurityUser,
  Setting,
  ShieldTick,
  TickCircle,
  UserAdd,
  type Icon,
} from "iconsax-react";

export interface IconeProps {
  /** Tamanho em px (padrão 18). */
  readonly tamanho?: number;
  readonly className?: string;
}

/** Um ícone do ecossistema (o que menus e telas guardam e desenham). */
export type IconeDoEcossistema = (props: IconeProps) => JSX.Element;

function decorativo(
  Componente: Icon,
  variante: "Bulk" | "Linear",
  classeExtra?: string,
): IconeDoEcossistema {
  function IconeDecorativo({ tamanho = 18, className }: IconeProps) {
    const classes = [classeExtra, className].filter(Boolean).join(" ");
    return (
      <Componente
        variant={variante}
        size={tamanho}
        color="currentColor"
        aria-hidden="true"
        focusable="false"
        {...(classes ? { className: classes } : {})}
      />
    );
  }
  return IconeDecorativo;
}

// ---- Módulos e itens de navegação (Bulk) ---------------------------------
export const IconePainel = decorativo(Element3, "Bulk");
export const IconePessoas = decorativo(Profile2User, "Bulk");
export const IconeEstrutura = decorativo(Hierarchy, "Bulk");
export const IconeJornada = decorativo(Clock, "Bulk");
export const IconeLideranca = decorativo(People, "Bulk");
export const IconeAdministracao = decorativo(SecurityUser, "Bulk");
export const IconeConfiguracoes = decorativo(Setting, "Bulk");
export const IconeDemonstracao = decorativo(Eye, "Bulk");
export const IconePortal = decorativo(Messages1, "Bulk");
export const IconeRecrutamento = decorativo(Personalcard, "Bulk");
export const IconePesquisas = decorativo(Rank, "Bulk");
export const IconeCalendario = decorativo(Calendar, "Bulk");
export const IconeFolha = decorativo(Receipt, "Bulk");
export const IconeBeneficios = decorativo(Gift, "Bulk");
export const IconeHubBeneficios = decorativo(Cup, "Bulk");
export const IconeSuporte = decorativo(MessageQuestion, "Bulk");
export const IconeRoadmap = decorativo(Routing2, "Bulk");

// ---- Conta e empresa (Bulk) ----------------------------------------------
export const IconePerfil = decorativo(Profile, "Bulk");
export const IconeConta = decorativo(ProfileCircle, "Bulk");
export const IconeSeguranca = decorativo(ShieldTick, "Bulk");
export const IconeEmpresa = decorativo(Building, "Bulk");
export const IconeEquipe = decorativo(Profile2User, "Bulk");
export const IconeAparencia = decorativo(ColorSwatch, "Bulk");

// ---- Ações (Bulk) --------------------------------------------------------
export const IconeEditar = decorativo(Edit2, "Bulk");
export const IconeAdicionarPessoa = decorativo(UserAdd, "Bulk");
export const IconePlanilha = decorativo(DocumentText, "Bulk");
export const IconeRelogio = decorativo(Clock, "Bulk");
export const IconeSucesso = decorativo(TickCircle, "Bulk");
/** T212 — baixar um modelo de arquivo. */
export const IconeBaixarArquivo = decorativo(DocumentDownload, "Bulk");
/** T212 — enviar (escolher) um arquivo. */
export const IconeEnviarArquivo = decorativo(DocumentUpload, "Bulk");
/** T212 — aviso curto, informativo. */
export const IconeInformacao = decorativo(InfoCircle, "Bulk");

// ---- Glifos de interface (Linear) ----------------------------------------
export const IconeVoltar = decorativo(ArrowLeft2, "Linear");
export const IconeAvancar = decorativo(ArrowRight2, "Linear");
export const IconeAbrir = decorativo(ArrowDown2, "Linear");
export const IconeMais = decorativo(Add, "Linear");
/** O "mais" girado 45°: o X de fechar, no mesmo traço. */
export const IconeFechar = decorativo(Add, "Linear", "ev-icone--fechar");
