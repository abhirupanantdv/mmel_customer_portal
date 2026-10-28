import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export function Button({ className, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={cn('btn', `btn-${variant}`, className)} {...props} />
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('card', className)}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <span className={cn('badge', `badge-${tone}`)}>{children}</span>
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('input', className)} {...props} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p>{action}</div>
}

export function Progress({ value }: { value: number }) {
  return <div className="progress" aria-label={`${value}% used`}><span style={{ width: `${Math.min(100, value)}%` }} /></div>
}
