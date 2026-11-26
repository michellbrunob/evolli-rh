/**
 * T215 — a aparência de cada tipo de ausência, num lugar só: o ícone (no
 * histórico, na próxima ausência e no registro) e a cor do ponto ao lado
 * do nome (das cores de turno do sistema). A cor nunca é o único sinal: o
 * nome do tipo vem sempre escrito.
 */
import {
  IconeAviao,
  IconeBolo,
  IconeCasa,
  type IconeDoEcossistema,
  IconeFaltaJustificada,
  IconeFaltaSemJustificativa,
  IconeFamilia,
  IconeHospital,
  IconeSaude,
} from "../../../ui/icones";
import type { TipoAusencia } from "./tiposAusencia";

export const ICONE_DO_TIPO: Readonly<Record<TipoAusencia, IconeDoEcossistema>> =
  {
    ferias: IconeAviao,
    licenca_medica: IconeSaude,
    licenca_maternidade: IconeFamilia,
    licenca_paternidade: IconeFamilia,
    afastamento: IconeHospital,
    falta_justificada: IconeFaltaJustificada,
    falta_sem_justificativa: IconeFaltaSemJustificativa,
    day_off: IconeBolo,
    home_office: IconeCasa,
  };

export const COR_DO_TIPO: Readonly<Record<TipoAusencia, string>> = {
  ferias: "var(--turno-verde-agua)",
  licenca_medica: "var(--turno-tangerina)",
  licenca_maternidade: "var(--turno-violeta)",
  licenca_paternidade: "var(--turno-indigo)",
  afastamento: "var(--turno-cinza)",
  falta_justificada: "var(--turno-laranja)",
  falta_sem_justificativa: "var(--status-danger-ink)",
  day_off: "var(--turno-roxo)",
  home_office: "var(--turno-ciano)",
};
