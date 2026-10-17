// Standard ElevenLabs ConvAI-widget, slik den var før herdingen: to agenter
// avhengig av side. Skriptet lastes i client/index.html (låst versjon + SRI).
// `key` tvinger remount når man bytter mellom oversikt og andre seksjoner,
// slik at widgeten plukker opp den nye agent-id-en. Skrudd av på 'avatar' og
// 'chat'. Orb-fargene matcher dashboardets nx-cyan / nx-purple.
export const VOICE_AGENTS = {
  oversikt: 'SCOI5nAeUm2P90tPlhxJ',
  andre: 'agent_4501kc02r47xec2s0r87f0awxdj6'
};

export function VoiceAssistant({ section }) {
  if (section === 'avatar' || section === 'chat') return null;
  const key = section === 'oversikt' ? 'oversikt' : 'andre';
  return (
    <elevenlabs-convai
      key={`agent-${key}`}
      agent-id={VOICE_AGENTS[key]}
      avatar-orb-color-1="#22e6ff"
      avatar-orb-color-2="#7d5cff"
      variant="compact"
      placement="bottom-right"
    ></elevenlabs-convai>
  );
}
