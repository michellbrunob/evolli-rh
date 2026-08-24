/**
 * Shell do Painel Administrativo Web + vitrine da biblioteca de componentes
 * (UI-F01 + UI-F02).
 *
 * Apenas o envoltório visual neutro e uma demonstração dos componentes de
 * apresentação reutilizáveis — sem dado de domínio, sem tela de módulo, sem
 * autenticação e sem fluxo de negócio. A presença deste shell não concede nem
 * implica autorização: cada tela futura continuará dependendo da decisão do
 * servidor por papel, escopo e objeto
 * (docs/modules/painel-administrativo-web-v1.md, §3.6).
 *
 * O cliente CSRF (`../api/csrfClient`) permanece isolado e NÃO é importado aqui:
 * não há login nem sessão nesta fundação.
 */
import "./tokens.css";
import "./app-shell.css";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Surface,
} from "../components";

export function App() {
  return (
    <div className="app-shell">
      <a className="app-shell__skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>

      <header className="app-shell__topbar">
        <div className="app-shell__topbar-inner">
          <span className="app-shell__brand">Evolli RH</span>
          <span className="app-shell__brand-tag">Painel Administrativo</span>
        </div>
      </header>

      <main
        id="conteudo-principal"
        className="app-shell__main"
        tabIndex={-1}
        aria-labelledby="shell-titulo"
      >
        <div className="app-shell__stack">
          <PageHeader
            headingLevel={1}
            titleId="shell-titulo"
            title="Biblioteca de componentes"
            description="Base visual reutilizável para as próximas telas administrativas. Esta página apenas demonstra os componentes — não há dados nem funcionalidade de domínio."
            actions={
              <>
                <Button variant="secondary">Ação secundária</Button>
                <Button variant="primary">Ação primária</Button>
              </>
            }
          />

          <section className="demo-group" aria-labelledby="grupo-botoes">
            <h2 id="grupo-botoes" className="demo-group__title">
              Botões
            </h2>
            <div className="demo-row">
              <Button variant="primary">Primária</Button>
              <Button variant="secondary">Secundária</Button>
              <Button variant="subtle">Discreta</Button>
              <Button variant="primary" disabled>
                Indisponível
              </Button>
            </div>
          </section>

          <section className="demo-group" aria-labelledby="grupo-superficies">
            <h2 id="grupo-superficies" className="demo-group__title">
              Superfícies
            </h2>
            <div className="demo-row">
              <Surface as="article" padding="lg" style={{ maxWidth: "24rem" }}>
                <h3 style={{ margin: 0 }}>Cartão neutro</h3>
                <p style={{ margin: "var(--space-xs) 0 0" }}>
                  Superfície reutilizável com borda sutil e cantos arredondados,
                  sem sombra e sem gradiente.
                </p>
              </Surface>
            </div>
          </section>

          <section className="demo-group" aria-labelledby="grupo-estados">
            <h2 id="grupo-estados" className="demo-group__title">
              Indicadores de estado
            </h2>
            <div className="demo-row">
              <StatusBadge variant="neutral">Neutro</StatusBadge>
              <StatusBadge variant="success">Concluído</StatusBadge>
              <StatusBadge variant="warning">Atenção</StatusBadge>
              <StatusBadge variant="danger">Falha</StatusBadge>
              <StatusBadge variant="info">Informação</StatusBadge>
            </div>
          </section>

          <section className="demo-group" aria-labelledby="grupo-vazio">
            <h2 id="grupo-vazio" className="demo-group__title">
              Estado vazio
            </h2>
            <EmptyState
              headingLevel={3}
              icon="—"
              title="Nada para exibir ainda"
              description="Quando houver conteúdo disponível para o seu acesso, ele aparece nesta área."
              action={<Button variant="primary">Ação primária</Button>}
            />
          </section>
        </div>
      </main>

      <footer className="app-shell__footer">
        <div className="app-shell__footer-inner">
          <span className="app-shell__footer-brand">Evolli RH</span>
          <span>Painel Administrativo — fundação visual</span>
          <span>Ambiente interno · sem dados reais</span>
        </div>
      </footer>
    </div>
  );
}
