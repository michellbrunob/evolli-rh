import { useEffect, useState } from "react";
import { consultarCpfEmUso } from "../../api/colaboradoresClient";

/** T215 — o aviso do CPF repetido, igual ao da recusa do servidor. */
export const MENSAGEM_CPF_EM_USO = "Este CPF já está cadastrado nesta empresa.";

/** Espera curta depois do último dígito, para não consultar a cada tecla. */
const ESPERA_MS = 400;

/**
 * T215 — confere, enquanto o RH digita, se o CPF já está cadastrado na
 * empresa ativa. Só consulta o CPF completo e com dígitos verificadores
 * válidos (`valido`); devolve `true` apenas quando a resposta é do CPF que
 * está no campo agora (a resposta fica presa ao CPF consultado). Resposta velha, falha de rede ou CPF trocado não
 * acusam nada — o servidor confere de novo ao gravar.
 */
export function useCpfEmUso(
  cpfDigitado: string,
  valido: (digitos: string) => boolean,
  ignorarColaboradorId?: string,
): boolean {
  const digitos = cpfDigitado.replace(/\D/g, "");
  const consultavel = digitos.length === 11 && valido(digitos);
  const [emUso, setEmUso] = useState<string | null>(null);

  useEffect(() => {
    if (!consultavel) return;
    const espera = setTimeout(() => {
      (ignorarColaboradorId
        ? consultarCpfEmUso(digitos, ignorarColaboradorId)
        : consultarCpfEmUso(digitos)
      ).then(
        (resposta) => {
          if (resposta === true) setEmUso(digitos);
        },
        () => undefined,
      );
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [digitos, consultavel, ignorarColaboradorId]);

  return consultavel && emUso === digitos;
}
