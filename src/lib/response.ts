import { z } from 'zod';

export const languages = ['en-IN', 'hi-IN', 'hinglish'] as const;
export type IntakeLanguage = (typeof languages)[number];
export const categories = ['medical', 'fire', 'flood', 'road', 'other'] as const;
export const statuses = [
  'RECEIVED',
  'TRIAGE',
  'OPERATOR REVIEW',
  'VERIFIED',
  'UNCONFIRMED',
  'REFERRED',
  'CLOSED',
] as const;
export const coordinatesSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const intakeSchema = z
  .object({
    text: z.string().trim().min(3).max(2000),
    language: z.enum(languages),
    location: z.string().trim().max(160).default(''),
    landmark: z.string().trim().max(160).default(''),
    coordinates: coordinatesSchema.nullable().default(null),
    callback: z
      .string()
      .trim()
      .max(25)
      .regex(/^[+\d ()-]*$/)
      .default(''),
    callbackConsent: z.boolean().default(false),
    channel: z.enum(['text', 'browser-voice', 'simulated-call']).default('text'),
  })
  .strict()
  .refine((v) => !v.callback || v.callbackConsent, { message: 'Callback consent required' });
export type Intake = z.infer<typeof intakeSchema>;
export const incidentSchema = z.object({
  id: z.string(),
  owner: z.string(),
  source: z.literal('DEMO'),
  version: z.number().int().positive(),
  category: z.enum(categories),
  description: z.string().max(2000),
  language: z.enum(languages),
  location: z.string(),
  landmark: z.string(),
  coordinates: coordinatesSchema.nullable(),
  locationVerified: z.boolean(),
  urgency: z.enum(['urgent', 'review']),
  affected: z.number().int().nonnegative().nullable(),
  reportedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  callback: z.string(),
  callbackConsent: z.boolean(),
  uncertainties: z.array(z.string()),
  status: z.enum(statuses),
  operator: z.string(),
  evidence: z.enum(['not requested', 'requested', 'pending', 'available', 'unavailable']),
  channel: z.enum(['text', 'browser-voice', 'simulated-call']),
  externalContactConfirmed: z.literal(false),
  history: z.array(z.object({ at: z.string().datetime(), actor: z.string(), event: z.string() })),
});
export type Incident = z.infer<typeof incidentSchema>;
export const reviewSchema = z
  .object({
    id: z.string().max(80),
    version: z.number().int().positive(),
    action: z.enum([
      'assign',
      'triage',
      'review',
      'verify',
      'unconfirmed',
      'refer',
      'close',
      'evidence-request',
      'evidence-pending',
      'evidence-available',
      'evidence-unavailable',
      'location-verify',
    ]),
    note: z.string().trim().min(3).max(500),
  })
  .strict();
export type Review = z.infer<typeof reviewSchema>;
export function redactContact(text: string) {
  return text.replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[contact redacted]');
}
// Deterministic demo extraction, deliberately not represented as LLM inference.
export function extractIncident(input: Intake) {
  const text = input.callbackConsent ? input.text : redactContact(input.text);
  const category = /fire|smoke|aag|dhua|आग|धुआं|धुआँ/i.test(text)
    ? 'fire'
    : /flood|water|paani|baarish|बाढ़|पानी|बारिश/i.test(text)
      ? 'flood'
      : /injur|unconscious|breath|medical|ambulance|ghayal|behosh|घायल|बेहोश|सांस/i.test(text)
        ? 'medical'
        : /accident|crash|road|sadak|दुर्घटना|सड़क/i.test(text)
          ? 'road'
          : 'other';
  const urgent =
    /fire|unconscious|not breathing|trapped|severe|urgent|aag|behosh|फंसे|फँसे|बेहोश|आग|सांस नहीं/i.test(
      text,
    );
  const people = text.match(/(\d{1,3})\s*(?:people|persons|log|injured|लोग|व्यक्ति|घायल)/i);
  const location =
    (input.callbackConsent ? input.location : redactContact(input.location)) ||
    text.match(/(?:\bat\b|\bnear\b|\bmein\b|स्थान[:：]?|पास)\s+([^.!?\n]{3,100})/i)?.[1]?.trim() ||
    '';
  const uncertainties = ['Unverified caller report; local keyword extraction may miss meaning.'];
  if (!location) uncertainties.push('Location not supplied. Where is this happening?');
  if (!input.coordinates)
    uncertainties.push('No geographic coordinates supplied; report remains unplaced.');
  if (!people) uncertainties.push('Number affected unknown. Share only if already known.');
  if (category === 'other')
    uncertainties.push('Category unclear. What kind of assistance is needed?');
  return {
    category: category as Incident['category'],
    description: text,
    location,
    landmark: input.callbackConsent ? input.landmark : redactContact(input.landmark),
    coordinates: input.coordinates,
    urgency: urgent ? ('urgent' as const) : ('review' as const),
    affected: people ? Number(people[1]) : null,
    uncertainties,
  };
}
export function applyReview(record: Incident, input: Review, now: string): Incident {
  const next = { ...record, version: record.version + 1, history: [...record.history] };
  const moves: Partial<Record<Review['action'], Incident['status']>> = {
    triage: 'TRIAGE',
    review: 'OPERATOR REVIEW',
    verify: 'VERIFIED',
    unconfirmed: 'UNCONFIRMED',
    refer: 'REFERRED',
    close: 'CLOSED',
  };
  const allowed: Record<Incident['status'], Review['action'][]> = {
    RECEIVED: ['triage', 'refer'],
    TRIAGE: ['review', 'refer'],
    'OPERATOR REVIEW': ['verify', 'unconfirmed', 'refer'],
    VERIFIED: ['refer', 'close'],
    UNCONFIRMED: ['review', 'refer', 'close'],
    REFERRED: ['close'],
    CLOSED: [],
  };
  if (record.status === 'CLOSED') throw new Error('Closed reports are read-only.');
  if (moves[input.action]) {
    if (!allowed[record.status].includes(input.action))
      throw new Error('Invalid review transition.');
    next.status = moves[input.action]!;
  } else if (input.action === 'assign') next.operator = 'Local demo operator';
  else if (input.action === 'location-verify') {
    if (!record.coordinates || !record.location)
      throw new Error('Supplied coordinates and location required.');
    next.locationVerified = true;
  } else if (input.action === 'evidence-request') next.evidence = 'requested';
  else if (input.action === 'evidence-pending') {
    if (record.evidence !== 'requested') throw new Error('Request evidence first.');
    next.evidence = 'pending';
  } else if (input.action === 'evidence-available' || input.action === 'evidence-unavailable') {
    if (!['requested', 'pending'].includes(record.evidence))
      throw new Error('Request evidence first.');
    next.evidence = input.action === 'evidence-available' ? 'available' : 'unavailable';
  }
  next.history.push({
    at: now,
    actor: 'Local demo operator',
    event: `${input.action}: ${redactContact(input.note)}${input.action === 'refer' ? ' — SIMULATED handoff; no external contact.' : ''}`,
  });
  return incidentSchema.parse(next);
}
export type CallState =
  | 'idle'
  | 'incoming'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'human-handoff'
  | 'ended'
  | 'error';
export const callEventSchema = z
  .object({
    eventId: z.string().uuid(),
    sessionId: z.string().uuid(),
    type: z.enum(['incoming', 'connected', 'transcript', 'language', 'handoff', 'ended', 'error']),
    language: z.enum(languages).default('en-IN'),
    text: z.string().max(2000).optional(),
    transcriptionConsent: z.boolean().default(false),
  })
  .strict()
  .refine(
    (e) =>
      e.type !== 'transcript' || (e.transcriptionConsent && !!e.text && e.text.trim().length >= 3),
    { message: 'Transcript and consent required' },
  );
export type CallEvent = z.infer<typeof callEventSchema>;
