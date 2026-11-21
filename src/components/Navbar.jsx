import HybridStatusBadge from './HybridStatusBadge.jsx'

export default function Navbar({ mode }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <a href="/" className="font-display text-xl font-medium tracking-tight text-fg">
          Ghostline
        </a>
        <HybridStatusBadge mode={mode} />
      </div>
    </header>
  )
}
