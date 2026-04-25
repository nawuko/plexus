import React from 'react';
import { clsx } from 'clsx';
import { Activity, AlertTriangle } from 'lucide-react';
import { formatDuration } from '../../lib/format';
import type { QuotaCheckResult, QuotaStatus } from '../../types/quota';

interface ZenmuxQuotaDisplayProps {
  result: QuotaCheckResult;
  isCollapsed: boolean;
}

const statusColors: Record<QuotaStatus, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
  exhausted: 'bg-danger',
};

export const ZenmuxQuotaDisplay: React.FC<ZenmuxQuotaDisplayProps> = ({ result, isCollapsed }) => {
  if (!result.success) {
    return (
      <div className="px-2 py-2">
        <div
          className={clsx('flex items-center gap-2 text-danger', isCollapsed && 'justify-center')}
        >
          <AlertTriangle size={16} />
          {!isCollapsed && <span className="text-xs">Error</span>}
        </div>
      </div>
    );
  }

  const windows = result.windows || [];
  const fiveHourWindow = windows.find((w) => w.windowType === 'rolling_five_hour');
  const sevenDayWindow = windows.find((w) => w.windowType === 'rolling_weekly');

  const worstStatus: QuotaStatus = [
    fiveHourWindow?.status,
    sevenDayWindow?.status,
  ].reduce<QuotaStatus>((acc, s) => {
    const order: QuotaStatus[] = ['ok', 'warning', 'critical', 'exhausted'];
    return s && order.indexOf(s) > order.indexOf(acc) ? s : acc;
  }, 'ok');

  if (isCollapsed) {
    return (
      <div className="px-2 py-2 flex justify-center">
        <Activity
          size={18}
          className={clsx(
            worstStatus === 'ok' && 'text-success',
            worstStatus === 'warning' && 'text-warning',
            (worstStatus === 'critical' || worstStatus === 'exhausted') && 'text-danger'
          )}
        />
      </div>
    );
  }

  const renderWindow = (label: string, window: (typeof windows)[0] | undefined) => {
    if (!window) return null;
    return (
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-text-secondary">{label}</span>
          {window.resetInSeconds !== undefined && window.resetInSeconds !== null && (
            <span className="text-[10px] text-text-muted ml-auto">
              {formatDuration(window.resetInSeconds)}
            </span>
          )}
        </div>
        <div className="relative h-2">
          <div className="h-2 rounded-md bg-bg-hover overflow-hidden mr-7">
            <div
              className={clsx(
                'h-full rounded-md transition-all duration-500 ease-out',
                statusColors[window.status || 'ok']
              )}
              style={{ width: `${Math.min(100, Math.max(0, window.utilizationPercent))}%` }}
            />
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center text-[10px] font-semibold text-text">
            {Math.round(window.utilizationPercent)}%
          </div>
        </div>
        {window.remaining !== undefined && window.limit !== undefined && (
          <div className="text-[10px] text-text-muted">
            {Math.round(window.remaining)} / {Math.round(window.limit)} flows remaining
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-2 py-1 space-y-2">
      <div className="flex items-center gap-2 min-w-0">
        <Activity size={14} className="text-text" />
        <span className="text-xs font-semibold text-text whitespace-nowrap">Zenmux</span>
      </div>
      {renderWindow('5-Hour', fiveHourWindow)}
      {renderWindow('7-Day', sevenDayWindow)}
    </div>
  );
};
