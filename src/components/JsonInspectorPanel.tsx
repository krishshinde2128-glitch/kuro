import { getMoodForHappiness, VALID_ANIMATIONS, VALID_BG_COLORS } from '../game/petState';
import type { MoodBgColor, PetAnimation, PetBrainResponse } from '../game/petState';

interface JsonInspectorPanelProps {
  lastResponse: PetBrainResponse;
  currentAnimation: PetAnimation;
  currentBgColor: MoodBgColor;
  currentHappiness: number;
  currentHunger: number;
  onPreviewAnimation: (anim: PetAnimation) => void;
  onPreviewBgColor: (color: MoodBgColor) => void;
  onPreviewHappiness: (happiness: number) => void;
  onPreviewHunger: (hunger: number) => void;
}

const COLOR_LABELS: Record<MoodBgColor, string> = {
  '#1E1E2E': 'Default Night',
  '#8B0000': 'Angry Deep Red',
  '#1F2937': 'Sad Dark Blue',
  '#D4AF37': 'Excited Warm Gold',
};

const HAPPINESS_PRESETS = [
  { label: 'Low · Angry (15)', value: 15 },
  { label: 'Near Mad · Sad (35)', value: 35 },
  { label: 'Calm (60)', value: 60 },
  { label: 'Hyped (85)', value: 85 },
];

const HUNGER_PRESETS = [
  { label: 'Starving (15)', value: 15 },
  { label: 'Hungry (35)', value: 35 },
  { label: 'Fed (65)', value: 65 },
  { label: 'Full (90)', value: 90 },
];

export function JsonInspectorPanel({
  lastResponse,
  currentAnimation,
  currentBgColor,
  currentHappiness,
  currentHunger,
  onPreviewAnimation,
  onPreviewBgColor,
  onPreviewHappiness,
  onPreviewHunger,
}: JsonInspectorPanelProps) {
  const happinessMood = getMoodForHappiness(currentHappiness);
  const hungerLabel =
    currentHunger <= 25
      ? 'Starving · Drops Happiness'
      : currentHunger <= 45
        ? 'Hungry · Lowers Happiness'
        : currentHunger < 75
          ? 'Sustained'
          : 'Well Fed';

  return (
    <section
      aria-label="Structured JSON brain output inspector"
      className="bg-white border border-zinc-200 rounded-2xl flex flex-col min-h-[540px] lg:min-h-[600px] overflow-hidden shadow-sm"
    >
      <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Pet Engine JSON Output</h2>
          <p className="text-xs text-zinc-500">Live strict 8-field JSON driving animation, audio, room, mood & alerts</p>
        </div>
        <span className="text-xs font-mono text-zinc-500 whitespace-nowrap shrink-0">
          application/json
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-zinc-700 mb-2">Latest Parsed Response</h3>
          <pre
            data-testid="json-output-pre"
            className="p-4 rounded-xl bg-[#16181F] text-zinc-100 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words overflow-x-auto"
          >
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label
              htmlFor="json-happiness-slider"
              className="text-xs font-semibold text-zinc-700"
            >
              Happiness Level
            </label>
            <span
              data-testid="json-happiness-readout"
              className="text-xs font-mono text-zinc-700"
            >
              {currentHappiness}/100 · {happinessMood.label}
            </span>
          </div>

          <input
            id="json-happiness-slider"
            type="range"
            min={0}
            max={100}
            value={currentHappiness}
            onChange={(e) => onPreviewHappiness(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {HAPPINESS_PRESETS.map((preset) => {
              const active = currentHappiness === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onPreviewHappiness(preset.value)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors truncate ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500">
            0–25: Angry &amp; Red (#8B0000) · 26–45: Sad &amp; Blue (#1F2937) · 46–74: Calm · 75–100: Hyped
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label
              htmlFor="json-hunger-slider"
              className="text-xs font-semibold text-zinc-700"
            >
              Hunger Level (Fuel)
            </label>
            <span
              data-testid="json-hunger-readout"
              className="text-xs font-mono text-zinc-700"
            >
              {currentHunger}/100 · {hungerLabel}
            </span>
          </div>

          <input
            id="json-hunger-slider"
            type="range"
            min={0}
            max={100}
            value={currentHunger}
            onChange={(e) => onPreviewHunger(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {HUNGER_PRESETS.map((preset) => {
              const active = currentHunger === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onPreviewHunger(preset.value)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors truncate ${
                    active
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-500">
            Low hunger (&le;45) lowers happiness too: 26–45 shifts Sad &amp; Blue, &le;25 triggers Angry &amp; Red.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs font-semibold text-zinc-700">Preview 2D Animations</h3>
            <span className="text-xs text-zinc-500">Active: {currentAnimation}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {VALID_ANIMATIONS.map((anim) => {
              const active = anim === currentAnimation;
              return (
                <button
                  key={anim}
                  type="button"
                  onClick={() => onPreviewAnimation(anim)}
                  className={`min-h-[40px] px-3 py-2 rounded-lg border text-xs font-mono text-left transition-colors truncate ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  {anim}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-xs font-semibold text-zinc-700">Preview Mood Theme</h3>
            <span className="text-xs font-mono text-zinc-500">{currentBgColor}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VALID_BG_COLORS.map((hex) => {
              const active = hex === currentBgColor;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => onPreviewBgColor(hex)}
                  className={`min-h-[40px] px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-50 text-zinc-900'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="w-3 h-3 rounded-sm border border-zinc-300 shrink-0"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="truncate">{COLOR_LABELS[hex]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
