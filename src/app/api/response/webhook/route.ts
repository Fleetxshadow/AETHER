import { NextRequest } from 'next/server';
import {
  acceptEvent,
  boundedBody,
  rateLimit,
  responseFailure,
  responseJson,
  ResponseError,
} from '@/lib/response-server';
import { acceptTelephoneEvent, createDemoTelephonyAdapter } from '@/lib/telephony';
export const runtime = 'nodejs';
// NEXUS local-demo protocol. This is NOT a Twilio/Exotel signature adapter.
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.NEXUS_DEMO_WEBHOOK_SECRET;
    if (!secret) throw new ResponseError('Demo webhook disabled.', 503);
    const raw = await boundedBody(request);
    const adapter = createDemoTelephonyAdapter(secret);
    const event = acceptTelephoneEvent(adapter, raw, request.headers);
    rateLimit('signed-demo-webhooks', 60);
    acceptEvent(event.eventId);
    return responseJson(adapter.handleInbound(event));
  } catch (error) {
    return responseFailure(error);
  }
}
