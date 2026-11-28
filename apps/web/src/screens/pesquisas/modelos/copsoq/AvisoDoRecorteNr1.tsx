/**
 * T216 — NR-1 anônima: "Separar respostas por" nasce com Departamento
 * ligado (o inventário por área depende dele). Desligado, este aviso diz
 * que a aba Por grupo e o inventário por área ficam sem o recorte por
 * departamento (ou só com o outro campo ligado).
 */
import type { CampoGrupo } from "../../../../api/pesquisasClient";
import { CAMPOS_DE_GRUPO } from "../../SepararRespostasPor";

export function AvisoDoRecorteNr1({
  separarPor,
}: {
  readonly separarPor: readonly CampoGrupo[];
}) {
  if (separarPor.includes("departamento")) return null;
  const outros = CAMPOS_DE_GRUPO.filter((c) => separarPor.includes(c.campo))
    .map((c) => c.nome)
    .join(" e ");
  return (
    <p
      className="pesquisas__nota"
      role="note"
      aria-label="Sem recorte por departamento"
    >
      {outros
        ? `Sem Departamento, a aba Por grupo e o inventário por área ficam só com ${outros}.`
        : "Sem Departamento, a aba Por grupo e o inventário por área ficam sem recorte."}
    </p>
  );
}
