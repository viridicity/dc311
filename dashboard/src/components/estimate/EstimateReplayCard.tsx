import { quickPickDisplayLabel } from '../../lib/quickPickLabels';
import { QUICK_PICK_CHIP_CLASS } from '../shared/surfaceStyles';

interface EstimateReplayCardProps {
  title: string;
  promptLine?: string | null;
  suggestTypes: string[];
  onSelectType: (serviceType: string) => void;
}

export default function EstimateReplayCard({
  title,
  promptLine,
  suggestTypes,
  onSelectType,
}: EstimateReplayCardProps) {
  if (!promptLine) return null;

  return (
    <section className="bg-surface border border-border rounded-lg mb-2">
      <div className="px-4 py-2.5 border-b border-border">
        <h3 className="text-body font-medium text-gray-900 mb-0">{title}</h3>
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-gray-700 mb-0">{promptLine}</p>
        {suggestTypes.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {suggestTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onSelectType(type)}
                className={QUICK_PICK_CHIP_CLASS}
              >
                {quickPickDisplayLabel(type)}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
