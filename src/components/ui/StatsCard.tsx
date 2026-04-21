import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { useAppStore } from '../../store'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  className?: string
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary-600',
  iconBg = 'bg-primary-50',
  trend,
  className,
}: StatsCardProps) {
  const { isDarkMode } = useAppStore()

  return (
    <div className={clsx('card p-5 flex flex-col gap-3', className)}>
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between">
        <p className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
          {title}
        </p>
        <div className={clsx('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0', iconBg, iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`text-3xl font-extrabold leading-none tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          {value}
        </p>
        {subtitle && (
          <p className={`text-xs mt-1.5 font-medium ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className={clsx(
          'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg w-fit',
          trend.value >= 0
            ? isDarkMode ? 'text-emerald-400 bg-emerald-900/30' : 'text-emerald-600 bg-emerald-50'
            : isDarkMode ? 'text-red-400 bg-red-900/30' : 'text-red-500 bg-red-50'
        )}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
        </div>
      )}
    </div>
  )
}
