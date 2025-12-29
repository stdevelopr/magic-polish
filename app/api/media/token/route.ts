import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

type TokenRequest = {
  roomId: string;
  participantName: string;
  role: 'teacher' | 'student';
};

type VideoGrant = {
  room: string;
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
};

type LiveKitClaims = {
  iss: string;
  sub: string;
  name: string;
  metadata?: string;
  nbf: number;
  iat: number;
  exp: number;
  video: VideoGrant;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(claims: LiveKitClaims, apiSecret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${signature}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<TokenRequest>;

  if (!body.roomId || !body.participantName || !body.role) {
    return NextResponse.json({ error: 'Missing roomId, participantName, or role.' }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    const missing = [
      !apiKey ? 'LIVEKIT_API_KEY' : null,
      !apiSecret ? 'LIVEKIT_API_SECRET' : null
    ].filter(Boolean);
    return NextResponse.json({ error: 'Server misconfigured.', missing }, { status: 500 });
  }

  const identity = `${body.participantName}-${crypto.randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const claims: LiveKitClaims = {
    iss: apiKey,
    sub: identity,
    name: body.participantName,
    metadata: JSON.stringify({ role: body.role }),
    nbf: now,
    iat: now,
    exp: now + 60 * 60,
    video: {
      room: body.roomId,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  return NextResponse.json({ token: signJwt(claims, apiSecret) });
}
