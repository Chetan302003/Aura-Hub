import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  hoverable?: boolean;
  variant?: 'default' | 'neon' | 'subtle';
}

export function GlassCard({ 
  children, 
  className, 
  noPadding = false, 
  hoverable = false,
  variant = 'default'
}: GlassCardProps) {
  return (
    <div 
      className={cn(
        variant === 'neon' ? 'glass-card-neon' : 
        variant === 'subtle' ? 'glass-card' : 
        'glass-card',
        !noPadding && "p-4 sm:p-5 lg:p-6",
        hoverable && "glass-card-hover cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  color?: 'green' | 'cyan' | 'purple' | 'amber' | 'rose' | 'blue';
}

const colorClasses = {
  green: {
    card: '',
    icon: 'icon-bg-green',
    text: 'text-primary',
  },
  cyan: {
    card: 'stat-card-cyan',
    icon: 'icon-bg-cyan',
    text: 'text-cyan',
  },
  purple: {
    card: 'stat-card-purple',
    icon: 'icon-bg-purple',
    text: 'text-purple',
  },
  amber: {
    card: 'stat-card-amber',
    icon: 'icon-bg-amber',
    text: 'text-amber',
  },
  rose: {
    card: 'stat-card-rose',
    icon: 'icon-bg-rose',
    text: 'text-rose',
  },
  blue: {
    card: '',
    icon: 'icon-bg-blue',
    text: 'text-blue',
  },
};

export function StatCard({ 
  title, 
  value, 
  icon, 
  subtitle, 
  trend, 
  className,
  color = 'green'
}: StatCardProps) {
  const colors = colorClasses[color];
  
  return (
    <div className={cn("stat-card", colors.card, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 sm:space-y-2 min-w-0 flex-1">
          <p className="text-muted-foreground text-xs sm:text-sm font-medium truncate">{title}</p>
          <p className={cn(
            "text-xl sm:text-2xl lg:text-3xl font-bold truncate",
            color === 'green' ? 'gradient-text' : colors.text
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-muted-foreground text-xs truncate">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trend.isPositive ? "text-primary" : "text-destructive"
            )}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground hidden sm:inline">vs last week</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("p-2.5 sm:p-3 rounded-xl shrink-0", colors.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// Colorful mini stat for grids
interface MiniStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'green' | 'cyan' | 'purple' | 'amber' | 'rose' | 'blue';
}

export function MiniStat({ label, value, icon, color = 'green' }: MiniStatProps) {
  const colors = colorClasses[color];
  
  return (
    <div className="p-3 sm:p-4 rounded-xl bg-secondary/50 text-center">
      {icon && (
        <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg mx-auto mb-2 flex items-center justify-center", colors.icon)}>
          {icon}
        </div>
      )}
      <p className={cn("text-lg sm:text-xl lg:text-2xl font-bold", colors.text)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
    </div>
  );
}
