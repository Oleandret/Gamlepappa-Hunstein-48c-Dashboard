/** Voice is unavailable until the reviewed isolated integration is configured.
 * Chat has its own connection status; do not imply that all AI is disconnected.
 */
export function AIConnection() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.20em]"
      role="status" aria-label="Taleassistent ikke konfigurert">
      <span className="h-1.5 w-1.5 rounded-full bg-nx-amber" aria-hidden="true" />
      <span className="text-nx-mute">TALEASSISTENT</span>
      <span className="text-nx-amber">Ikke konfigurert</span>
    </div>
  );
}
