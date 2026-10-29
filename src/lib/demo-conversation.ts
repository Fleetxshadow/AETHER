import { intakeSchema } from './response';
export const demoConversation = [
  { speaker: 'Caller', text: 'Hello, hamare area mein road par paani bhar gaya hai.' },
  { speaker: 'AETHER AI', text: 'I understand. Could you share the location or a nearby landmark?' },
  { speaker: 'Caller', text: 'Near Sector 51, Gurugram.' },
] as const;
// Only caller statements enter the incident extractor. Assistant dialogue is never caller evidence.
export const demoConversationIntake = intakeSchema.parse({
  text: demoConversation
    .filter((line) => line.speaker === 'Caller')
    .map((line) => line.text)
    .join(' '),
  location: 'Sector 51, Gurugram',
  language: 'hinglish',
  channel: 'simulated-call',
});
export function conversationConclusion(saved: boolean, failed: boolean) {
  return saved
    ? "Thank you. I've added this as a simulated waterlogging report for operator review."
    : failed
      ? 'The demo report could not be saved. Please use Submit demo report to retry; no service has been contacted.'
      : 'Preparing the simulated waterlogging report for operator review…';
}
