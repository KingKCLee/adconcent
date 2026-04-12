import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  title: string;
  auto?: string;
  manual?: string;
  children?: React.ReactNode;
}

export default function HelpTooltip({ title, auto, manual, children }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        className="ml-2 w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs font-medium hover:bg-blue-50 hover:text-blue-600 border border-gray-200 flex items-center justify-center transition-colors"
        title="도움말"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm"
          style={{ top: '100%' }}
        >
          <div className="absolute -top-2 left-3 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />

          <div className="font-medium text-gray-900 mb-3 pb-2 border-b border-gray-100">
            {title}
          </div>

          {auto && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs font-medium text-green-700 mb-1">
                <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">자</span>
                시스템 자동 처리
              </div>
              <div className="text-gray-600 text-xs leading-relaxed pl-5">{auto}</div>
            </div>
          )}

          {manual && (
            <div className="mb-3">
              <div className="flex items-center gap-1 text-xs font-medium text-blue-700 mb-1">
                <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs">수</span>
                고객이 할 것
              </div>
              <div className="text-gray-600 text-xs leading-relaxed pl-5">{manual}</div>
            </div>
          )}

          {children && <div className="text-gray-600 text-xs leading-relaxed">{children}</div>}
        </div>
      )}
    </div>
  );
}
