export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="label">404</p>
      <h1 className="text-2xl">Essa página não existe.</h1>
      <p className="text-sm text-ink-soft">Talvez o link esteja velho, ou você digitou errado.</p>
      <a
        href="/"
        className="mt-2 rounded-full bg-clay px-6 py-2.5 font-medium text-paper"
      >
        Voltar pro início
      </a>
    </div>
  );
}
