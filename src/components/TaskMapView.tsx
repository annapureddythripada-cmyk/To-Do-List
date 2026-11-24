import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { Compass, MapPin, Navigation, Pencil, Plus } from 'lucide-react';
import type { Task, TaskLocation, TaskPriority } from '../types/task';
import { PlaceSearchInput, EMPTY_LOCATION } from './PlaceSearchInput';

interface TaskMapViewProps {
  tasks: Task[];
  mapsApiKey: string;
  onEditTask: (task: Task) => void;
  onAttachLocation: (taskId: string, location: TaskLocation) => Promise<void>;
  onOpenAddModal: () => void;
}

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 };

function MapViewportController({
  pinnedTasks,
  focusedTask,
}: {
  pinnedTasks: Task[];
  focusedTask: Task | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (
      focusedTask &&
      focusedTask.latitude !== null &&
      focusedTask.longitude !== null
    ) {
      map.panTo({ lat: focusedTask.latitude, lng: focusedTask.longitude });
      map.setZoom(14);
      return;
    }

    if (pinnedTasks.length === 1) {
      const only = pinnedTasks[0];
      if (only.latitude !== null && only.longitude !== null) {
        map.panTo({ lat: only.latitude, lng: only.longitude });
        map.setZoom(13);
      }
    } else if (pinnedTasks.length > 1 && typeof google !== 'undefined') {
      const bounds = new google.maps.LatLngBounds();
      for (const t of pinnedTasks) {
        if (t.latitude !== null && t.longitude !== null) {
          bounds.extend({ lat: t.latitude, lng: t.longitude });
        }
      }
      map.fitBounds(bounds, 64);
    }
  }, [map, pinnedTasks, focusedTask]);

  return null;
}

function getPinStyle(priority: TaskPriority, completed: boolean) {
  if (completed) {
    return { background: '#15803D', borderColor: '#14532D', glyphColor: '#FFFFFF' };
  }
  if (priority === 'High') {
    return { background: '#BE123C', borderColor: '#881337', glyphColor: '#FFFFFF' };
  }
  if (priority === 'Medium') {
    return { background: '#4C1D95', borderColor: '#3B0764', glyphColor: '#FFFFFF' };
  }
  return { background: '#7C3AED', borderColor: '#5B21B6', glyphColor: '#FFFFFF' };
}

export function TaskMapView({
  tasks,
  mapsApiKey,
  onEditTask,
  onAttachLocation,
  onOpenAddModal,
}: TaskMapViewProps) {
  const pinnedTasks = useMemo(
    () => tasks.filter((t) => t.latitude !== null && t.longitude !== null),
    [tasks]
  );
  const unpinnedTasks = useMemo(
    () => tasks.filter((t) => t.latitude === null || t.longitude === null),
    [tasks]
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assignTaskId, setAssignTaskId] = useState<string>('');
  const [assignLocation, setAssignLocation] =
    useState<TaskLocation>(EMPTY_LOCATION);
  const [savingPin, setSavingPin] = useState(false);

  const selectedTask = useMemo(
    () => pinnedTasks.find((t) => t.id === selectedTaskId) ?? null,
    [pinnedTasks, selectedTaskId]
  );

  const handleAssignSubmit = useCallback(async () => {
    if (!assignTaskId || assignLocation.latitude === null) return;
    setSavingPin(true);
    try {
      await onAttachLocation(assignTaskId, assignLocation);
      setSelectedTaskId(assignTaskId);
      setAssignTaskId('');
      setAssignLocation(EMPTY_LOCATION);
    } finally {
      setSavingPin(false);
    }
  }, [assignTaskId, assignLocation, onAttachLocation]);

  if (!mapsApiKey) {
    return (
      <div className="rounded-xl border border-[#E4DCF5] bg-white p-8 text-center">
        <MapPin className="mx-auto h-8 w-8 text-[#4C1D95]" />
        <h2 className="mt-3 font-display text-lg font-bold text-[#1F1235]">
          Google Maps Key Required
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5B4F73]">
          Configure your Google Maps Platform API key in Settings &gt; Secrets
          as <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
          to view task pins and search places.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-4">
        <div className="rounded-xl border border-[#E4DCF5] bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-[#1F1235]">
              Pin a Task to a Place
            </h2>
            <span className="font-mono-tabular text-xs font-medium text-[#5B4F73]">
              {pinnedTasks.length} pinned
            </span>
          </div>

          {unpinnedTasks.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="map-task-select"
                  className="block text-xs font-medium text-[#5B4F73]"
                >
                  Choose Task
                </label>
                <select
                  id="map-task-select"
                  value={assignTaskId}
                  onChange={(e) => setAssignTaskId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-[#E4DCF5] bg-[#FAF8FF] px-3 text-sm text-[#1F1235] focus:border-[#4C1D95] focus:outline-none cursor-pointer"
                >
                  <option value="">Select an unpinned task...</option>
                  {unpinnedTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-medium text-[#5B4F73] mb-1">
                  Search Location
                </span>
                <PlaceSearchInput
                  value={assignLocation}
                  onChange={setAssignLocation}
                  placeholder="Search address, office, coffee shop..."
                />
              </div>

              <button
                type="button"
                disabled={
                  !assignTaskId || assignLocation.latitude === null || savingPin
                }
                onClick={handleAssignSubmit}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#3B0764] px-4 text-sm font-semibold text-white hover:bg-[#4C1D95] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Navigation className="h-4 w-4" />
                <span>{savingPin ? 'Pinning...' : 'Pin Task on Map'}</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-[#FAF8FF] p-4 text-xs text-[#5B4F73]">
              All current tasks already have map locations, or create a new task
              with a location.
              <button
                type="button"
                onClick={onOpenAddModal}
                className="mt-3 inline-flex items-center gap-1.5 font-semibold text-[#4C1D95] hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create task with location</span>
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E4DCF5] bg-white p-5">
          <h3 className="font-display text-sm font-bold text-[#1F1235]">
            Pinned Locations ({pinnedTasks.length})
          </h3>
          {pinnedTasks.length === 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-[#5B4F73]">
              No tasks are pinned to a location yet. Select a task above or
              attach a place when creating or editing a task.
            </p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {pinnedTasks.map((task) => {
                const isSelected = task.id === selectedTaskId;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#4C1D95] bg-[#F3EFFC]'
                          : 'border-[#E4DCF5] bg-[#FAF8FF] hover:border-[#C4B5FD]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#1F1235]">
                          {task.title}
                        </span>
                        <Compass className="h-3.5 w-3.5 shrink-0 text-[#4C1D95]" />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#5B4F73]">
                        {task.locationName}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="xl:col-span-8">
        <div
          className="relative w-full overflow-hidden rounded-xl border border-[#E4DCF5] bg-[#F3EFFC]"
          style={{ height: '580px' }}
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={DEFAULT_CENTER}
            defaultZoom={11}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MapViewportController
              pinnedTasks={pinnedTasks}
              focusedTask={selectedTask}
            />

            {pinnedTasks.map((task) => {
              if (task.latitude === null || task.longitude === null) return null;
              const pinColors = getPinStyle(
                task.priority,
                task.status === 'Completed'
              );
              return (
                <AdvancedMarker
                  key={task.id}
                  position={{ lat: task.latitude, lng: task.longitude }}
                  title={task.title}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <Pin
                    background={pinColors.background}
                    borderColor={pinColors.borderColor}
                    glyphColor={pinColors.glyphColor}
                  />
                </AdvancedMarker>
              );
            })}

            {selectedTask &&
              selectedTask.latitude !== null &&
              selectedTask.longitude !== null && (
                <InfoWindow
                  position={{
                    lat: selectedTask.latitude,
                    lng: selectedTask.longitude,
                  }}
                  onCloseClick={() => setSelectedTaskId(null)}
                  maxWidth={280}
                >
                  <div className="p-1 text-[#1F1235]">
                    <p className="font-display text-sm font-bold">
                      {selectedTask.title}
                    </p>
                    {selectedTask.locationName && (
                      <p className="mt-1 text-xs font-medium text-[#4C1D95]">
                        {selectedTask.locationName}
                      </p>
                    )}
                    {selectedTask.locationAddress && (
                      <p className="mt-0.5 text-xs text-[#5B4F73]">
                        {selectedTask.locationAddress}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E4DCF5] pt-2 text-xs">
                      <span className="font-medium">
                        {selectedTask.priority} · {selectedTask.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditTask(selectedTask)}
                        className="inline-flex items-center gap-1 font-semibold text-[#4C1D95] hover:underline cursor-pointer"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                </InfoWindow>
              )}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}
