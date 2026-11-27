/**
 * T215 — seletor da gaveta de escala, no desenho da referência: o gatilho
 * mostra o nome em destaque e a descrição ao lado; a lista agrupa as opções
 * (rótulo do grupo em caixa alta), cada uma com nome e descrição, um ponto de
 * cor opcional e ✓ na escolhida.
 *
 * Acessível pelo menu do Radix: o gatilho tem o nome do campo
 * (`aria-label`), abre com Enter, Espaço ou setas; as opções são
 * `menuitemradio` com `aria-checked`; Escape fecha e devolve o foco.
 */
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Fragment } from "react";
import { IconeSucesso } from "../../../../ui/icones";

export interface OpcaoRica {
  readonly valor: string;
  readonly nome: string;
  readonly descricao?: string;
  /** Cor do ponto (um valor CSS, ex.: `var(--turno-1)`). */
  readonly cor?: string;
}

export interface GrupoRico {
  /** Sem rótulo: a lista não mostra cabeçalho para o grupo. */
  readonly rotulo?: string;
  readonly opcoes: readonly OpcaoRica[];
}

interface Props {
  readonly id: string;
  readonly rotulo: string;
  readonly valor: string;
  readonly grupos: readonly GrupoRico[];
  readonly onEscolher: (valor: string) => void;
  readonly desabilitado?: boolean;
  readonly invalido?: boolean;
  readonly descritoPor?: string;
}

function Ponto({ cor }: { readonly cor: string | undefined }) {
  return cor ? (
    <span
      className="seletor-rico__ponto"
      style={{ background: cor }}
      aria-hidden="true"
    />
  ) : null;
}

export function SeletorRico({
  id,
  rotulo,
  valor,
  grupos,
  onEscolher,
  desabilitado = false,
  invalido = false,
  descritoPor,
}: Props) {
  const escolhida = grupos
    .flatMap((g) => g.opcoes)
    .find((o) => o.valor === valor);
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        id={id}
        type="button"
        className="seletor-rico__gatilho"
        aria-label={rotulo}
        disabled={desabilitado}
        aria-invalid={invalido ? "true" : undefined}
        aria-describedby={descritoPor}
      >
        <span className="seletor-rico__valor">
          <Ponto cor={escolhida?.cor} />
          <strong>{escolhida?.nome ?? "Selecione"}</strong>
          {escolhida?.descricao ? (
            <span className="seletor-rico__descricao">
              {escolhida.descricao}
            </span>
          ) : null}
        </span>
        <span className="seletor-rico__seta" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="seletor-rico__lista"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          loop
        >
          <Menu.RadioGroup value={valor} onValueChange={onEscolher}>
            {grupos.map((g, i) => (
              <Fragment key={g.rotulo ?? `grupo-${i}`}>
                {i > 0 ? (
                  <Menu.Separator className="seletor-rico__separador" />
                ) : null}
                {g.rotulo ? (
                  <Menu.Label className="seletor-rico__grupo">
                    {g.rotulo}
                  </Menu.Label>
                ) : null}
                {g.opcoes.map((o) => (
                  <Menu.RadioItem
                    key={o.valor}
                    value={o.valor}
                    className="seletor-rico__opcao"
                  >
                    <Ponto cor={o.cor} />
                    <span className="seletor-rico__textos">
                      <span className="seletor-rico__nome">{o.nome}</span>
                      {o.descricao ? (
                        <span className="seletor-rico__descricao">
                          {o.descricao}
                        </span>
                      ) : null}
                    </span>
                    <Menu.ItemIndicator className="seletor-rico__marca">
                      <IconeSucesso tamanho={16} />
                    </Menu.ItemIndicator>
                  </Menu.RadioItem>
                ))}
              </Fragment>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
