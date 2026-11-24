import { useCallback, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import type { TaskLocation } from '../types/task';

interface PlaceSearchInputProps {
  value: TaskLocation;
  onChange: (location: TaskLocation) => void;
  placeholder?: string;
}

export const EMPTY_LOCATION: TaskLocation = {
  locationName: null,
  locationAddress: null,
  latitude: null,
  longitude: null,
  placeId: null,
};

export function PlaceSearchInput({
  value,
  onChange,
  placeholder = 'Search a real place or address...',
}: PlaceSearchInputProps) {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const { suggestions, isLoading, error, resetSession } =
    useAutocompleteSuggestions(query);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setFetchingDetails(true);
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
        });
        const lat = place.location?.lat() ?? null;
        const lng = place.location?.lng() ?? null;
        onChange({
          locationName:
            place.displayName ??
            suggestion.placePrediction.mainText?.text ??
            'Pinned Place',
          locationAddress:
            place.formattedAddress ??
            suggestion.placePrediction.text.text ??
            null,
          latitude: lat,
          longitude: lng,
          placeId: place.id ?? null,
        });
        setQuery('');
        resetSession();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('RESOURCE_EXHAUSTED')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      } finally {
        setFetchingDetails(false);
      }
    },
    [placesLib, onChange, resetSession]
  );

  if (value.locationName) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-lg border border-[#D8CCF5] bg-[#F3EFFC] px-3 py-2.5 text-xs">
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#4C1D95]" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#1F1235]">
              {value.locationName}
            </p>
            {value.locationAddress && (
              <p className="truncate text-[#5B4F73]">
                {value.locationAddress}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(EMPTY_LOCATION)}
          aria-label="Remove location"
          className="rounded p-1 text-[#5B4F73] hover:bg-white hover:text-[#1F1235] cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6D5F8A]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!placesLib || fetchingDetails}
          placeholder={
            placesLib ? placeholder : 'Places search loading...'
          }
          className="h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] pl-9 pr-9 text-sm text-[#1F1235] placeholder:text-[#7E709B] focus:border-[#4C1D95] focus:bg-white focus:outline-none disabled:opacity-60"
        />
        {(isLoading || fetchingDetails) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#4C1D95]" />
        )}
      </div>

      {error && <p className="mt-1 text-xs text-[#BE123C]">{error}</p>}

      {suggestions.length > 0 && (
        <ul className="absolute z-40 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#E4DCF5] bg-white py-1 shadow-lg">
          {suggestions.map((suggestion, idx) => {
            const label = suggestion.placePrediction?.text.text ?? '';
            return (
              <li key={`${label}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-[#1F1235] hover:bg-[#F3EFFC] transition-colors cursor-pointer"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4C1D95]" />
                  <span className="line-clamp-2">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
