// Existing agents, on the provider's own origin. No provider script, credentials,
// microphone delegation or message bridge enters the authenticated dashboard.
export function VoiceAssistant({ section }) {
  if (section === 'avatar' || section === 'chat') return null;
  const agent = section === 'oversikt' ? 'SCOI5nAeUm2P90tPlhxJ' : 'agent_4501kc02r47xec2s0r87f0awxdj6';
  return <a href={`https://elevenlabs.io/app/talk-to?agent_id=${agent}`} target="_blank" rel="noopener noreferrer"
    referrerPolicy="no-referrer" aria-label="Åpne ElevenLabs-taleassistent i ny fane"
    className={`fixed bottom-4 ${section === 'hus-3d' ? 'left-24' : 'right-4'} z-50 flex items-center gap-3 rounded-2xl border border-nx-cyan/50 bg-nx-bg px-4 py-3 shadow-glow-soft hover:border-nx-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-nx-cyan`}>
    <span aria-hidden="true" className="h-8 w-8 rounded-full bg-gradient-to-br from-nx-cyan to-nx-purple" />
    <span><span className="block text-sm text-nx-cyan">ElevenLabs · Taleassistent</span>
      <span className="block text-xs text-nx-mute">Åpne i ny fane ↗</span></span>
  </a>;
}
