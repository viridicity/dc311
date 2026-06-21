import { LoadProgress } from '../../api/dataTypes';
import { SITE_TITLE } from '../../lib/site';

interface AppHeaderProps {
  builtAt: string | null;
  rowCount: number;
  dateLabel: string;
  isLoading: boolean;
  loadProgress: LoadProgress | null;
  onProfileClick: () => void;
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19.5c.9-2.8 3.2-4.5 6.5-4.5s5.6 1.7 6.5 4.5" />
      <circle cx="12" cy="12" r="9.25" />
    </svg>
  );
}

export default function AppHeader({
  builtAt,
  rowCount,
  dateLabel,
  isLoading,
  loadProgress,
  onProfileClick,
}: AppHeaderProps) {
  return (
    <header className="bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <h1 className="flex items-center gap-3 font-mono text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-neutral-100 mb-1">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            aria-hidden="true"
            className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0"
          />
          {SITE_TITLE}
        </h1>

        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 font-mono text-caption text-neutral-400 space-y-0.5">
            <p className="mb-0">{builtAt ? `Data snapshot: ${builtAt}` : 'Loading…'}</p>
            {(rowCount > 0 || dateLabel) && (
              <p className="mb-0">
                {rowCount > 0 && `${rowCount.toLocaleString()} requests`}
                {rowCount > 0 && dateLabel ? ' · ' : ''}
                {dateLabel}
              </p>
            )}
            {isLoading && loadProgress && (
              <p className="font-mono text-caption text-neutral-500 mt-2 mb-0">
                Loading shard {loadProgress.loaded + 1} of {loadProgress.total}
                {loadProgress.currentShard && ` (${loadProgress.currentShard})`}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onProfileClick}
            className="shrink-0 inline-flex items-center gap-2 min-h-[44px] px-2.5 sm:px-3 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors"
            aria-label="Open profile"
          >
            <ProfileIcon />
            <span className="hidden sm:inline text-caption font-medium">Profile</span>
          </button>
        </div>
      </div>
    </header>
  );
}
