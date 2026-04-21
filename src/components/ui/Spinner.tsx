import { clsx } from 'clsx'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-7 h-7 border-[3px]',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full border-gray-200 dark:border-[#2d3548] border-t-primary-500 animate-spin',
        sizes[size],
        className
      )}
    />
  )
}

export function LoadingOverlay({ message = 'Procesando...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <Spinner size="lg" />
      {message && <p className="text-sm text-gray-400 dark:text-slate-500 font-medium">{message}</p>}
    </div>
  )
}
