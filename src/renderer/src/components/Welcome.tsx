interface Props {
  onOpen(): void
  error: string | null
}

export function Welcome({ onOpen, error }: Props) {
  return (
    <div className="welcome">
      <div className="welcome__card">
        <h1 className="welcome__title">GitOno</h1>
        <p>Compará dos ramas de un repositorio lado a lado, sin cambiarte de rama ni clonarlo dos veces.</p>
        <button className="button button--primary" onClick={onOpen}>
          Abrir repositorio…
        </button>
        <p className="muted small">
          Elegí la carpeta de un repo que ya tengas clonado. Funciona con GitHub, GitLab o cualquier servidor Git.
        </p>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
