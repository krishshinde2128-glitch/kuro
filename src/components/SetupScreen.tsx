import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PET_IDS, PET_PROFILES } from '../game/petState';
import type { PetId } from '../game/petState';

interface SetupScreenProps {
  defaultName?: string;
  defaultPet?: PetId;
  defaultPetName?: string;
  onStart: (userName: string, petId: PetId, petName: string) => void;
}

export function SetupScreen({
  defaultName = '',
  defaultPet = 'Kuro',
  defaultPetName,
  onStart,
}: SetupScreenProps) {
  const [name, setName] = useState(defaultName);
  const [selectedPet, setSelectedPet] = useState<PetId>(defaultPet);
  const [petName, setPetName] = useState(defaultPetName?.trim() || defaultPet);
  const [petNameEdited, setPetNameEdited] = useState(
    Boolean(defaultPetName && defaultPetName.trim() !== defaultPet)
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelectSpecies = (petId: PetId) => {
    setSelectedPet(petId);
    if (!petNameEdited) {
      setPetName(petId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = name.trim();
    if (!trimmedUser) {
      setValidationError('Please enter your name so your companion knows who to greet.');
      return;
    }
    const finalPetName = petName.trim() || selectedPet;
    setValidationError(null);
    onStart(trimmedUser, selectedPet, finalPetName);
  };

  return (
    <main className="min-h-screen bg-[#1E1E2E] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Choose Your Desk Companion
          </h1>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
            Introduce yourself, pick a companion, and give them a name. You can always rename them or switch companions later in User Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="setup-user-name"
                className="block text-sm font-medium text-zinc-900 mb-1.5"
              >
                Your Name
              </label>
              <input
                id="setup-user-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Enter your name (e.g., Alex)"
                autoFocus
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="setup-pet-name"
                className="block text-sm font-medium text-zinc-900 mb-1.5"
              >
                Pet&apos;s Name
              </label>
              <input
                id="setup-pet-name"
                type="text"
                value={petName}
                onChange={(e) => {
                  const val = e.target.value;
                  setPetName(val);
                  setPetNameEdited(val.trim().length > 0 && val.trim() !== selectedPet);
                }}
                placeholder={`Name your companion (default: ${selectedPet})`}
                maxLength={40}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
            </div>
          </div>

          {validationError && (
            <p role="alert" className="-mt-3 text-xs text-red-600">
              {validationError}
            </p>
          )}

          <div>
            <span className="block text-sm font-medium text-zinc-900 mb-2">
              Select Companion
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PET_IDS.map((petId) => {
                const profile = PET_PROFILES[petId];
                const active = petId === selectedPet;
                return (
                  <button
                    key={petId}
                    type="button"
                    onClick={() => handleSelectSpecies(petId)}
                    aria-pressed={active}
                    className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 last:odd:sm:col-span-2 ${
                      active
                        ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                        : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {profile.title}
                      </div>
                      <div className="text-xs font-medium text-zinc-500">
                        {profile.species}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {profile.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              data-start="true"
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <span>Meet My Companion</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
