import React from 'react';

interface TierUpgradeNudgeProps {
  sourceId: string;  // e.g. 'chatgpt_export', 'openai', 'anthropic', 'copilot'
  currentTier: 'C';
}

export function TierUpgradeNudge({ sourceId, currentTier }: TierUpgradeNudgeProps) {
  // Determine the message based on the source
  const getUpgradeMessage = () => {
    if (sourceId === 'chatgpt_export' || sourceId === 'claude_export') {
      return 'Connect with an API key to get exact token counts, per-model cost breakdown, and daily spend trends';
    } else if (sourceId === 'openai') {
      return 'Your API key has limited permissions. Use an admin/org key to access full usage data';
    } else if (sourceId === 'anthropic') {
      return 'Your API key has limited permissions. Use an admin/org key to access full usage data';
    } else if (sourceId === 'copilot') {
      return 'Your organization account has limited visibility. Connect with organization admin keys to unlock detailed usage patterns';
    }
    return 'Connect with an API key to unlock deeper insights and advanced analytics';
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 text-xl">💡</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-indigo-900 mb-2">
            Unlock deeper insights
          </h3>
          <p className="text-sm text-indigo-800">
            {getUpgradeMessage()}
          </p>
        </div>
      </div>
    </div>
  );
}
