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
  ArrowRight,
  ArrowRight2,
  Building,
  Calendar,
  Clock,
  Copy,
  Danger,
  ColorSwatch,
  Cup,
  DocumentDownload,
  DocumentText,
  DocumentUpload,
  Devices,
  Edit2,
  Element3,
  Element4,
  Eye,
  Filter,
  EyeSlash,
  Gift,
  Hierarchy,
  InfoCircle,
  KeySquare,
  Lock,
  MessageQuestion,
  Messages1,
  More,
  People,
  Personalcard,
  Profile,
  Profile2User,
  ProfileCircle,
  Rank,
  Receipt,
  Refresh2,
  Repeat,
  Routing2,
  SearchNormal1,
  Star1,
  Send2,
  SecurityUser,
  ShieldCross,
  ShieldSearch,
  Setting,
  ShieldTick,
  TickCircle,
  Trash,
  UserAdd,
  Warning2,
  type Icon,
  Briefcase,
  Airplane,
  Bank,
  Cake,
  ClipboardClose,
  ClipboardText,
  Health,
  Hospital,
  Lovely,
  CalendarAdd,
  Call,
  Forbidden2,
  Setting4,
  Status,
  UserRemove,
  Home2,
  Location,
  MessageText1,
  Money2,
  Sms,
  Teacher,
  Timer1,
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
/** T215 — Segurança › Sessões ativas e › Permissões de acesso. */
export const IconeSessoes = decorativo(Devices, "Bulk");
export const IconePermissoes = decorativo(KeySquare, "Bulk");
/** T215 — busca e Filtrar da lista de Colaboradores. */
export const IconeBuscar = decorativo(SearchNormal1, "Linear");
export const IconeFiltrar = decorativo(Filter, "Bulk");
/** T215 — ficha do colaborador (abas, cartões e faixa de resumo). */
export const IconeMaleta = decorativo(Briefcase, "Bulk");
export const IconeTelefone = decorativo(Call, "Bulk");
export const IconeCasa = decorativo(Home2, "Bulk");
export const IconeLocal = decorativo(Location, "Bulk");
export const IconeComentario = decorativo(MessageText1, "Bulk");
export const IconeDinheiro = decorativo(Money2, "Bulk");
export const IconeEmail = decorativo(Sms, "Bulk");
export const IconeFormacao = decorativo(Teacher, "Bulk");
export const IconeTempo = decorativo(Timer1, "Bulk");
export const IconeRelogio = decorativo(Clock, "Bulk");
/** T215 — copiar (ex.: "Copiar semana anterior"). */
export const IconeCopiar = decorativo(Copy, "Bulk");
/** T215 — repetir (ex.: "Repetir esta semana até…"). */
export const IconeRepetir = decorativo(Repeat, "Linear");
/** T215 — visão salva (estrela). */
export const IconeEstrela = decorativo(Star1, "Linear");
/** T215 — documento (ex.: acordos e convenção). */
export const IconeDocumento = decorativo(DocumentText, "Bulk");
/** T215 — enviar ou publicar. */
export const IconeEnviar = decorativo(Send2, "Bulk");
/** T215 — aplicar um modelo (escala do catálogo). */
export const IconeModelo = decorativo(Element4, "Bulk");
/** T215 — aviso de atenção (avisos da escala). */
export const IconeAviso = decorativo(Danger, "Bulk");
export const IconePresente = decorativo(Gift, "Bulk");
export const IconeEmpresa = decorativo(Building, "Bulk");
export const IconeEquipe = decorativo(Profile2User, "Bulk");
export const IconeAparencia = decorativo(ColorSwatch, "Bulk");
/** T215 — ficha: menu ⋯ e seções da edição do colaborador. */
export const IconeRegistrarAusencia = decorativo(CalendarAdd, "Bulk");
export const IconeStatus = decorativo(Status, "Bulk");
export const IconeDesligar = decorativo(UserRemove, "Bulk");
export const IconeDesativar = decorativo(Forbidden2, "Bulk");
export const IconeBanco = decorativo(Bank, "Bulk");
export const IconeCamposExtras = decorativo(Setting4, "Bulk");
/** T215 — os tipos de ausência (histórico, próxima ausência e registro). */
export const IconeAviao = decorativo(Airplane, "Bulk");
export const IconeSaude = decorativo(Health, "Bulk");
export const IconeFamilia = decorativo(Lovely, "Bulk");
export const IconeHospital = decorativo(Hospital, "Bulk");
export const IconeFaltaJustificada = decorativo(ClipboardText, "Bulk");
export const IconeFaltaSemJustificativa = decorativo(ClipboardClose, "Bulk");
export const IconeBolo = decorativo(Cake, "Bulk");

// ---- Ações (Bulk) --------------------------------------------------------
export const IconeEditar = decorativo(Edit2, "Bulk");
export const IconeAdicionarPessoa = decorativo(UserAdd, "Bulk");
export const IconePlanilha = decorativo(DocumentText, "Bulk");
export const IconeSucesso = decorativo(TickCircle, "Bulk");
/** T212 — baixar um modelo de arquivo. */
export const IconeBaixarArquivo = decorativo(DocumentDownload, "Bulk");
/** T212 — enviar (escolher) um arquivo. */
export const IconeEnviarArquivo = decorativo(DocumentUpload, "Bulk");
/** T212 — aviso curto, informativo. */
export const IconeInformacao = decorativo(InfoCircle, "Bulk");

// ---- T213 — documentos do colaborador (Bulk) ------------------------------
/** Arquivo em análise pelo antivírus. */
export const IconeEmVerificacao = decorativo(ShieldSearch, "Bulk");
/** Arquivo recusado pelo antivírus. */
export const IconeReprovado = decorativo(ShieldCross, "Bulk");
/** Envio que não chegou ao servidor. */
export const IconeNaoEnviado = decorativo(Warning2, "Bulk");
export const IconeVer = decorativo(Eye, "Bulk");
export const IconeRemover = decorativo(Trash, "Bulk");
export const IconeTentarDeNovo = decorativo(Refresh2, "Linear");
/** Os três pontos de "mais ações". */
export const IconeMaisAcoes = decorativo(More, "Linear");

// ---- Glifos de interface (Linear) ----------------------------------------
export const IconeVoltar = decorativo(ArrowLeft2, "Linear");
export const IconeAvancar = decorativo(ArrowRight2, "Linear");
export const IconeAbrir = decorativo(ArrowDown2, "Linear");
export const IconeMais = decorativo(Add, "Linear");
/** O "mais" girado 45°: o X de fechar, no mesmo traço. */
export const IconeFechar = decorativo(Add, "Linear", "ev-icone--fechar");
/** Login: mostrar e esconder a senha, entrar e o aviso de acesso restrito. */
export const IconeMostrarSenha = decorativo(Eye, "Linear");
export const IconeOcultarSenha = decorativo(EyeSlash, "Linear");
export const IconeEntrar = decorativo(ArrowRight, "Linear");
export const IconeCadeado = decorativo(Lock, "Linear");
