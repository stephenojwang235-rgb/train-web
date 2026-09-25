import Button from '../../components/common/Button.jsx'

export default function NotFound() {
  return (
    <div className="container-shell py-24 text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">Pole! The page you are looking for wandered off campus.</p>
      <div className="mt-8">
        <Button to="/">Back home</Button>
      </div>
    </div>
  )
}
