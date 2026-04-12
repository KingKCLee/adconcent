import { Lock, X, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface UpgradePromptProps {
  feature: string;
  description: string;
  usage?: string;
  onClose: () => void;
}

export function UpgradePrompt({ feature, description, usage, onClose }: UpgradePromptProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-7 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center mb-5">
          <Lock className="w-7 h-7 text-white" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {feature} 기능이 잠겨있습니다
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {description}
        </p>

        {/* Usage */}
        {usage && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm font-medium text-amber-800">{usage}</p>
          </div>
        )}

        {/* Warning */}
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-2">
          <span className="text-base">🚨</span>
          <p className="text-sm font-semibold text-red-700">광고비가 새고 있습니다</p>
        </div>

        {/* CTA */}
        <Link
          to="/dashboard/billing"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Starter로 업그레이드 (월 9,900원)
        </Link>

        <button
          onClick={onClose}
          className="block w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3 py-2"
        >
          나중에
        </button>
      </div>
    </div>
  );
}
