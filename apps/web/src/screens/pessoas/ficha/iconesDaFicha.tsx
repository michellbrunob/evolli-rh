/**
 * T215 — os ícones da ficha (abas, cartões, faixa de resumo e Portal), todos
 * do ponto único de ícones (`ui/icones`), decorativos.
 */
import {
  IconeCalendario,
  IconeCasa,
  IconeComentario,
  IconeCarteira,
  IconeEmail,
  IconeFormacao,
  IconeLocal,
  IconeMaleta,
  IconePerfil,
  IconePesquisas,
  IconePlanilha,
  IconePresente,
  IconeRelogio,
  IconeTelefone,
  IconeTempo,
} from "../../../ui/icones";

const ABA = 16;
const CARTAO = 18;
const RESUMO = 18;

export const IconeAbaDados = () => <IconePerfil tamanho={ABA} />;
export const IconeAbaSalarios = () => <IconeCarteira tamanho={ABA} />;
export const IconeAbaFerias = () => <IconeCalendario tamanho={ABA} />;
export const IconeAbaEscala = () => <IconeRelogio tamanho={ABA} />;
export const IconeAbaBeneficios = () => <IconePresente tamanho={ABA} />;
export const IconeAbaPesquisas = () => <IconePesquisas tamanho={ABA} />;
export const IconeAbaDocumentos = () => <IconePlanilha tamanho={ABA} />;
export const IconeAbaDesenvolvimento = () => <IconeFormacao tamanho={ABA} />;
export const IconeAbaComentarios = () => <IconeComentario tamanho={ABA} />;

export const IconeCartaoProfissionais = () => <IconeMaleta tamanho={CARTAO} />;
export const IconeCartaoPessoais = () => <IconePerfil tamanho={CARTAO} />;
export const IconeCartaoEndereco = () => <IconeLocal tamanho={CARTAO} />;
export const IconeCartaoEmergencia = () => <IconeTelefone tamanho={CARTAO} />;

export const IconeResumoEmail = () => (
  <IconeEmail tamanho={RESUMO} className="ficha-ref__resumo-icone" />
);
export const IconeResumoTelefone = () => (
  <IconeTelefone tamanho={RESUMO} className="ficha-ref__resumo-icone" />
);
export const IconeResumoTempo = () => (
  <IconeTempo tamanho={RESUMO} className="ficha-ref__resumo-icone" />
);
export const IconeResumoHorario = () => (
  <IconeRelogio tamanho={RESUMO} className="ficha-ref__resumo-icone" />
);
export const IconePortal = () => <IconeCasa tamanho={18} />;
