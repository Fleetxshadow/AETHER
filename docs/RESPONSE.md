# AETHER RESPONSE — local demonstration

Open `/command/response`. The original ten city observation modules remain intact. RESPONSE is a separate workspace with separate incident records and current report timestamps.

## What works

- English, Hindi and Hinglish text intake. Local keyword extraction proposes category, urgency, affected count and supplied location. Missing facts become explicit questions. This is deterministic extraction, not a live LLM; negation, nuanced urgency and mixed-language ambiguity require human assessment.
- Optional browser SpeechRecognition/webkitSpeechRecognition and speechSynthesis. Consent precedes microphone activation. Final transcripts remain editable before submission; interim transcripts are transient. Language changes and end/stop controls abort recognition and speech. Browser services and installed Hindi voices vary; text fallback stays available.
- Private report queue, urgent-first ordering, human notes, assignment, report/location verification, unconfirmed status, simulated referral and closure. Urgent referral can bypass verification. No report is labeled a prank or discarded for missing evidence.
- Linked SKY evidence requests: requested, pending, available, unavailable. Available imagery is a synthetic demonstration illustration, not a recording of the caller's actual location. No drone launch or flight-control integration.
- Interactive conceptual incident map: voluntary coordinates, accessible marker buttons, overlay selection, zoom, collision placement and linked recorded infrastructure/traffic/water/road observations. Outside-area and unknown locations stay in the list. `src/lib/geo-contracts.ts` owns GeoJSON and future routing contracts; no routing engine or route-safety guarantee exists.
- Incoming-call overlay and accept/report/handoff/end simulation. Accepted calls display **DEMO CONNECTED** and **No phone/audio connection — simulated conversation**. Signed local webhook lifecycle also works. Neither channel connects to a telephone network.

## Example conversation and browser voice separation

Accepting a demo call loads a visibly simulated Hinglish waterlogging conversation and submits one demo incident for operator review. Only the caller's statements enter the existing extraction schema: category `FLOOD`, caller description and `Sector 51, Gurugram`. Coordinates remain unknown; no Gurugram marker is invented. The final assistant line claims the report was added only after the server confirms the save. A failed save exposes a retry without claiming success.

Play, pause and restart reveal transcript lines as text; they do not play received or synthesized audio. Replay never submits another incident. End Demo Call cancels playback. Browser microphone consent, recognition and welcome speech are disabled throughout example mode, including after ending the call. **Start separate browser report** clears the sample draft and location before browser intake resumes, while retaining saved reports. Browser-originated reports use their own channel.

## Provider-neutral telephone boundary

`src/lib/telephony.ts` defines verified inbound-event normalization and session lifecycle, with separate audio-stream, speech-recognition and speech-synthesis contracts. Audio chunks specify encoding and sample rate; streaming contracts accept cancellation. Sessions carry language, state, incident linkage and demo/authorized-test provenance. English, Hindi and Hinglish selection, consented transcript extraction and human handoff reuse the existing call schema.

The only implementation is the free local signed-demo adapter, wired into `/api/response/webhook`. Its audio, recognition and synthesis adapters are explicitly `null`; live/authorized telephone ingestion is disabled. No credentials are hardcoded. A future authorized Indian provider such as Exotel must implement its own signature verification, event translation and media adapters, and complete provider onboarding. There is no outbound dialing or automatic emergency-service calling.

## Local operator access

Run `node scripts/response-setup.mjs` once. It creates random server-only credentials in `.env.local` without printing them or overwriting existing values. Use the value of `NEXUS_OPERATOR_PASSWORD` in the operator sign-in field. `.env.local` is ignored by Git. Restart Next if needed after environment changes. `NEXUS_DEMO_WEBHOOK_SECRET` is a separate credential for local signed event testing, not a telephony-provider key.

The demo uses one local operator role, not production identity management. Do not share these credentials or use real sensitive reports. No public deployment was performed.

## Trust boundaries and retention

Incident inputs and mutations use strict Zod schemas. Operational actions require a server-authenticated operator, not a client toggle. Reporter access/deletion is restricted to their session's separate principal UUID. Opaque session secrets are HttpOnly, SameSite=Strict, scoped to `/api/response`, and Secure on HTTPS; local HTTP is for development. Mutations check Origin against browser request Host and reject cross-site requests. Password comparison uses constant-time SHA-256 digest comparison.

Bodies are bounded to 12 KB; reports to 300, sessions to 1,000 and call sessions to 300. Mutations allow 40 requests per principal per minute; operator login has a global 8/minute limit; signed demo webhooks 60/minute. Capacity/rate errors retain a direct pathway to manual 112. These are local demo safeguards, not a distributed abuse-control service.

Reports and sessions expire after 30 minutes, with unreferenced expiry timers and request-time pruning. Data lives only in process memory; server restart deletes it. Transcripts and callback details are never put in localStorage or application logs. No audio is stored. Phone-like strings in statement/location/landmark are redacted without callback consent. This heuristic is not a general PII detector. Browser vendors may process voice outside AETHER; this is disclosed before consent. Review mutations use expected-version checks and append server timestamps to human audit history. Explicit deletion removes the incident, contact and its history. Demo call metadata has the same 30-minute lifetime.

Production would require approved authentication/roles, a protected durable database, encryption, retention/legal review, trusted HTTPS/proxy configuration, backups/deletion policy and distributed concurrency/rate controls. The in-memory single-process store is intentionally not suitable for multi-instance dispatch operations.

## Signed local webhook protocol

`POST /api/response/webhook` accepts the strict `callEventSchema` from `src/lib/response.ts`:

```json
{
  "eventId": "a unique UUID",
  "sessionId": "a call UUID",
  "type": "incoming",
  "language": "en-IN",
  "transcriptionConsent": false
}
```

Event types: incoming, connected, language, transcript, handoff, ended, error. Start with incoming. Transcript requires at least three characters and `transcriptionConsent: true`. One submitted incident per demo call; end/error closes the session. Error recovery uses a new call or browser text fallback. Handoff is a state change only, with `externalContactConfirmed: false`.

Headers: `x-nexus-timestamp` is epoch milliseconds, within five minutes; `x-nexus-signature` is lowercase hex HMAC-SHA256 of the **exact** UTF-8 `timestamp + '.' + rawBody`, keyed by `NEXUS_DEMO_WEBHOOK_SECRET`. Unique event IDs prevent replay for 30 minutes. Invalid or stale signatures, missing consent, unknown/closed sessions and duplicate events are rejected. There are no outbound dialing endpoints.

This is the AETHER demo protocol, **not** Twilio or Exotel webhook verification. A future authorized provider must translate its verified events into this lifecycle and supply appropriate recognition/TTS services. No dedicated test number, provider credential, KYC approval or live provider adapter is configured.

## India provider research

Reviewed official sources on 13 October 2026:

- [Twilio India voice guidelines](https://www.twilio.com/en-us/guidelines/in/voice): local emergency-service calling is marked unavailable. Outbound calls to India are restricted to international numbers; recipient consent and carrier restrictions apply. International emergency-calling documentation must not be assumed to support Indian emergency dispatch.
- [Twilio restricted call guidance](https://help.twilio.com/articles/223180528-What-kind-of-phone-calls-can-t-be-made-using-Twilio): programmable notifications must not replace contacting actual emergency services.
- [Exotel onboarding](https://docs.exotel.com/business-phone-system/onboarding?hl=en-IN): KYC approval is required before virtual-number assignment; an assigned Exophone and approved flow are needed. Suitability for this specific incident-intake use case requires provider confirmation and authorized, consenting test recipients.
- [India 112 official FAQ](https://112.gov.in/faq): 112 is the official emergency assistance number. The UI offers a manual `tel:112` link. Automated tests inspect its href and never activate it.

No phone calls or external organizational messages were made. No emergency service was contacted. No dispatch or arrival assurance is displayed.

## Validation commands

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run start -- --port 3002
node scripts/evolution-qa.mjs
node scripts/refinements-qa.mjs
```

`NEXUS_QA_URL` overrides the QA base URL. The script reads local secrets without printing them. API tests verify trust boundaries and workflow; visual tests cover four palettes, four required viewports, normal/reduced motion, 3D city/drone and command maps. Speech fixtures explicitly test browser API-event wiring rather than actual acoustic recognition. Results/screenshots are under `docs/evolution/verified/`; staged design evidence is preserved separately.

The final refinement matrix and screenshots live in `docs/refinements-v2/verified/`; see [final refinement report](FINAL-REFINEMENTS-V2.md) for current proof and limitations. Native acoustic recognition has not been verified. The tested system's native speech attempt returned `synthesis-failed`, and no Hindi voice was installed. Plain HTTP LAN access may not support secure-context microphone or location APIs; text intake remains available.
