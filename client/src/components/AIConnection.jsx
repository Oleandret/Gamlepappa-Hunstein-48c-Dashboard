/** Launch availability is not a claim that a voice conversation is connected. */
export function AIConnection() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.20em]"
      role="status" aria-label="Taleassistent åpnes i ny fane">
      <span className="h-1.5 w-1.5 rounded-full bg-nx-amber" aria-hidden="true" />
      <span className="text-nx-mute">TALEASSISTENT</span>
      <span className="text-nx-mute">Ny fane</span>
    </div>
  );
}
