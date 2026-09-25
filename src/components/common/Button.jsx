import { Link } from 'react-router-dom'

export default function Button({
  children,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600'
  const variants = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 shadow-lg shadow-blue-700/20',
    accent: 'bg-amber-400 text-slate-900 hover:bg-amber-300 shadow-lg shadow-amber-400/20',
    outline: 'border-2 border-white/80 text-white hover:bg-white hover:text-slate-900',
    ghost: 'text-blue-700 hover:bg-blue-50',
    dark: 'bg-slate-900 text-white hover:bg-slate-800',
  }
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm sm:text-base',
    lg: 'px-8 py-4 text-base sm:text-lg',
  }
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
