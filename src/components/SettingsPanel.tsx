import { useEffect, useState } from 'react';
import { Check, Volume2, RotateCcw } from 'lucide-react';
import { PET_IDS, PET_PROFILES } from '../game/petState';
import type { PetId } from '../game/petState';

interface SettingsPanelProps {
  userName: string;
  petName: string;
  selectedPet: PetId;
  volume: number;
  muted: boolean;
  onSaveSettings: (updates: {
    userName: string;
    petName: string;
    selectedPet: PetId;
    volume: number;
  }) => void;
  onVolumePreview: (volume: number) => void;
  onTestAudio: () => void;
  onResetSetup: () => void;
}

export function SettingsPanel({
  userName,
  petName,
  selectedPet,
  volume,
  muted,
  onSaveSettings,
  onVolumePreview,
  onTestAudio,
  onResetSetup,
}: SettingsPanelProps) {
  const [draftUserName, setDraftUserName] = useState(userName);
  const [draftPetName, setDraftPetName] = useState(petName);
  const [draftPet, setDraftPet] = useState<PetId>(selectedPet);
  const [draftVolume, setDraftVolume] = useState(Math.round(volume * 100));
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    setDraftUserName(userName);
    setDraftPetName(petName);
    setDraftPet(selectedPet);
  }, [userName, petName, selectedPet]);

  useEffect(() => {
    setDraftVolume(Math.round(volume * 100));
  }, [volume]);

  const handleSelectSpecies = (nextPet: PetId) => {
    const wasDefaultSpeciesName = PET_IDS.some(
      (id) => id.toLowerCase() === draftPetName.trim().toLowerCase()
    );
    setDraftPet(nextPet);
    if (!draftPetName.trim() || wasDefaultSpeciesName) {
      setDraftPetName(nextPet);
    }
    setSavedBanner(false);
  };

  const handleVolumeSliderChange = (pct: number) => {
    setDraftVolume(pct);
    onVolumePreview(pct / 100);
    setSavedBanner(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = draftUserName.trim() || userName;
    const cleanPet = draftPetName.trim() || draftPet;
    onSaveSettings({
      userName: cleanUser,
      petName: cleanPet,
      selectedPet: draftPet,
      volume: draftVolume / 100,
    });
    setSavedBanner(true);
  };

  return (
    <section
      aria-label="User and companion settings"
      className="bg-white border border-zinc-200 rounded-2xl flex flex-col min-h-[540px] lg:min-h-[600px] overflow-hidden shadow-sm"
    >
      <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">User Settings</h2>
          <p className="text-xs text-zinc-500">
            Update your name, rename your pet, switch companions, or adjust master audio volume
          </p>
        </div>
        {savedBanner && (
          <span
            role="status"
            className="text-xs font-medium text-emerald-700 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-5 flex flex-col justify-between gap-6">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-user-name"
                className="block text-xs font-semibold text-zinc-700 mb-1.5"
              >
                Your Name
              </label>
              <input
                id="settings-user-name"
                type="text"
                value={draftUserName}
                onChange={(e) => {
                  setDraftUserName(e.target.value);
                  setSavedBanner(false);
                }}
                maxLength={40}
                placeholder="Your name"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="settings-pet-name"
                className="block text-xs font-semibold text-zinc-700 mb-1.5"
              >
                Pet&apos;s Name
              </label>
              <input
                id="settings-pet-name"
                type="text"
                value={draftPetName}
                onChange={(e) => {
                  setDraftPetName(e.target.value);
                  setSavedBanner(false);
                }}
                maxLength={40}
                placeholder={`Default: ${draftPet}`}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-zinc-700 mb-2">
              Companion Species
            </span>
            <div
              role="group"
              aria-label="Select companion species"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              {PET_IDS.map((petId) => {
                const profile = PET_PROFILES[petId];
                const active = petId === draftPet;
                return (
                  <button
                    key={petId}
                    type="button"
                    onClick={() => handleSelectSpecies(petId)}
                    aria-pressed={active}
                    className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col gap-1 last:odd:sm:col-span-2 ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div className="text-sm font-semibold text-zinc-900">{petId}</div>
                    <div className="text-xs text-zinc-600">{profile.species}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="settings-volume-slider"
                className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5"
              >
                <Volume2 className="w-4 h-4 text-zinc-600" />
                <span>Master Audio Volume (Lo-Fi, Rain & SFX)</span>
              </label>
              <span
                data-testid="volume-percent"
                className="text-xs font-mono font-semibold tabular-nums text-zinc-900"
              >
                {muted ? 'Muted' : `${draftVolume}%`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="settings-volume-slider"
                type="range"
                min={0}
                max={100}
                value={draftVolume}
                onChange={(e) => handleVolumeSliderChange(Number(e.target.value))}
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <button
                type="button"
                onClick={onTestAudio}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0"
              >
                Test Sound
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onResetSetup}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Room &amp; Setup</span>
          </button>

          <button
            type="submit"
            className="min-h-[42px] px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Save Settings
          </button>
        </div>
      </form>
    </section>
  );
}
