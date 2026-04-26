import { Star, Trash2 } from 'lucide-react';
import { DeviceCard } from '../DeviceCard.jsx';

export function FavoritesView({ devices, zones, onSet, favorites }) {
  const list = favorites.ids
    .map(id => devices[id])
    .filter(Boolean);

  return (
    <div>
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="panel-title">Favoritter</h2>
          <p className="mt-1 text-xl font-semibold">
            {list.length} <span className="text-nx-mute text-sm font-normal">pinnede enheter</span>
          </p>
        </div>
        {list.length > 0 && (
          <button onClick={favorites.clear} className="btn text-xs" aria-label="Fjern alle favoritter">
            <Trash2 size={13} aria-hidden="true" /> NULLSTILL
          </button>
        )}
      </header>

      {list.length === 0 ? (
        <div className="mt-8 panel p-8 text-center">
          <Star size={28} className="mx-auto text-nx-mute" aria-hidden="true" />
          <p className="mt-3 text-sm text-nx-mute max-w-md mx-auto">
            Ingen favoritter ennå. Gå til <span className="text-nx-cyan">Enheter</span> eller <span className="text-nx-cyan">Rom</span>, og klikk stjerne-ikonet ⭐ på enhetene du bruker oftest. De vises da her for rask tilgang.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(d => (
            <DeviceCard
              key={d.id}
              device={d}
              zoneName={zones?.[d.zone]?.name}
              onSet={onSet}
              isFavorite
              onToggleFavorite={favorites.toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
