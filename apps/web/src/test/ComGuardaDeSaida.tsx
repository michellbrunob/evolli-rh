/**
 * T200 — monta uma tela como o shell monta: com o registro de edições da
 * T189 e a guarda de saída. Sem isto, a guarda vira "deixa sair sempre" e as
 * confirmações de saída não aparecem.
 */
import type { ReactNode } from "react";
import {
  ProvedorDeEdicoes,
  useRegistroDeEdicoes,
} from "../app/edicoesPendentes";
import { ProvedorDeGuarda } from "../app/guardaDeSaida";

export function ComGuardaDeSaida({ children }: { children?: ReactNode }) {
  const registro = useRegistroDeEdicoes();
  return (
    <ProvedorDeEdicoes registro={registro}>
      <ProvedorDeGuarda>{children}</ProvedorDeGuarda>
    </ProvedorDeEdicoes>
  );
}
