/**
 * T216 — Perfil comportamental (DISC): o perfil completo de uma pessoa
 * (painel e relatório): percentuais, distribuição, radar, o perfil e o
 * conteúdo dele, e a área do mapa de talentos.
 */
import { areaPorId } from "./areas";
import { FATOR, FATORES, corDoFator } from "./fatores";
import { BarrasDisc, LetraDoFator, RadarDisc } from "./graficosDisc";
import {
  ROTULO_DA_INTENSIDADE,
  TEXTO_DA_INTENSIDADE,
  codigoDoPerfil,
  conteudoDoPerfil,
} from "./perfis";
import type { PerfilDisc } from "./tiposDisc";
import "./Disc.css";

export function CartoesDosFatores({ perfil }: { readonly perfil: PerfilDisc }) {
  return (
    <ul
      className="disc__grade disc__grade--4"
      aria-label="Percentual por fator"
    >
      {FATORES.map((f) => (
        <li
          key={f}
          className="disc__cartao"
          style={{ ["--cor-do-fator" as string]: corDoFator(f) }}
        >
          <span className="disc__cartao-topo">
            <LetraDoFator fator={f} tamanho="sm" />
            <span>{FATOR[f].nome}</span>
            {f === perfil.predominante ? (
              <span className="pesquisas__selo pesquisas__selo--destaque">
                Predominante
              </span>
            ) : null}
          </span>
          <p className="disc__cartao-numero">{`${perfil.percentuais[f]}%`}</p>
          <span className="disc__trilha-mini" aria-hidden="true">
            <span style={{ width: `${perfil.percentuais[f]}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PerfilDaPessoa({
  perfil,
  sujeito = "A pessoa",
}: {
  readonly perfil: PerfilDisc;
  /** "A pessoa" ou "O time". */
  readonly sujeito?: string;
}) {
  const c = conteudoDoPerfil(perfil.classe);
  const area = areaPorId(perfil.posicao.area);
  return (
    <div className="disc">
      <CartoesDosFatores perfil={perfil} />
      <div className="disc__grade">
        <section className="disc__cartao" aria-label="Distribuição">
          <h2 className="disc__subtitulo">Distribuição</h2>
          <BarrasDisc
            percentuais={perfil.percentuais}
            rotulo="Distribuição dos fatores"
          />
        </section>
        <section className="disc__cartao" aria-label="Mapa comportamental">
          <h2 className="disc__subtitulo">Mapa comportamental</h2>
          <RadarDisc
            percentuais={perfil.percentuais}
            rotulo="Mapa comportamental"
          />
        </section>
      </div>

      <section className="disc__cartao disc__time" aria-label="Perfil">
        <div className="disc__time-cabeca">
          <span className="disc__letras">
            {perfil.classe.fatores.map((f) => (
              <LetraDoFator key={f} fator={f} tamanho="md" />
            ))}
          </span>
          <h2 className="disc__time-titulo">
            {c.titulo}{" "}
            <span className="disc__codigo">
              {codigoDoPerfil(perfil.classe)}
            </span>
          </h2>
          <span className="pesquisas__selo">
            {ROTULO_DA_INTENSIDADE[perfil.classe.intensidade]}
          </span>
        </div>
        <p>{c.resumo}</p>
        <p className="pesquisas__suave">
          {`${sujeito}: ${TEXTO_DA_INTENSIDADE[perfil.classe.intensidade]}`}
        </p>
      </section>

      <dl className="disc__linhas" aria-label="O que move">
        <div>
          <dt>Medo básico</dt>
          <dd>{c.medo}</dd>
        </div>
        <div>
          <dt>O que motiva</dt>
          <dd>{c.motivacao}</dd>
        </div>
        <div>
          <dt>O que valoriza</dt>
          <dd>{c.valoriza}</dd>
        </div>
        <div>
          <dt>Valor para a empresa</dt>
          <dd>{c.valor}</dd>
        </div>
        <div>
          <dt>Estilo de comunicação</dt>
          <dd>{c.comunicacao}</dd>
        </div>
        <div>
          <dt>Estilo de liderança</dt>
          <dd>{c.lideranca}</dd>
        </div>
        <div>
          <dt>Ambiente ideal</dt>
          <dd>{c.ambiente}</dd>
        </div>
      </dl>

      <div className="disc__grade">
        <section className="disc__cartao" aria-label="Pontos fortes">
          <h2 className="disc__subtitulo">Pontos fortes</h2>
          <ul className="disc__lista">
            {c.fortes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="disc__cartao" aria-label="Pontos de atenção">
          <h2 className="disc__subtitulo">Pontos de atenção</h2>
          <ul className="disc__lista">
            {c.atencao.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="disc__cartao" aria-label="Para desenvolver">
          <h2 className="disc__subtitulo">Para desenvolver</h2>
          <ul className="disc__lista">
            {c.desenvolvimento.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
        <section className="disc__cartao" aria-label="O que gera estresse">
          <h2 className="disc__subtitulo">O que gera estresse</h2>
          <ul className="disc__lista">
            {c.estresse.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>

      {area ? (
        <section className="disc__destaque" aria-label="Área de talento">
          <LetraDoFator fator={area.fator} tamanho="md" />
          <div>
            <p className="disc__destaque-titulo">{`Área de talento: ${area.nome}`}</p>
            <p>{area.frase}</p>
            <p className="pesquisas__suave">
              {`Combina com: ${area.cargos.join(", ")}.`}
            </p>
          </div>
        </section>
      ) : null}

      <section className="disc__destaque" aria-label="Síntese">
        <div>
          <p className="disc__destaque-titulo">Síntese</p>
          <p>{c.sintese}</p>
        </div>
      </section>
    </div>
  );
}
