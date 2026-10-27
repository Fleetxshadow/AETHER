import { NextRequest, NextResponse } from 'next/server';
import {
  cameraAccess,
  cameraList,
  saveCamera,
  viewerCamera,
  setCameraCookie,
  clearCameraCookie,
} from '@/lib/cameras/server';
import { sameOrigin, boundedBody, rateLimit, ResponseError } from '@/lib/response-server';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    const access = await cameraAccess(request);
    if (!access)
      return NextResponse.json({ authorized: false, canManage: false, cameras: [] }, { headers });
    rateLimit(`camera-list:${access.principal}`, 120);
    const cameras = await cameraList();
    const response = NextResponse.json(
      { authorized: true, canManage: access.operator, cameras: cameras.map(viewerCamera) },
      { headers },
    );
    if (request.headers.has('authorization')) setCameraCookie(response, access, request);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ResponseError
            ? error.message
            : 'Camera registry unavailable. Demonstration remains available.',
      },
      { status: error instanceof ResponseError ? error.status : 503, headers },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const access = await cameraAccess(request);
    if (!access?.operator) throw new ResponseError('Authorized operator required.', 403);
    rateLimit(`camera-register:${access.principal}`, 20);
    const { record, storage } = await saveCamera(JSON.parse(await boundedBody(request)));
    return NextResponse.json({ camera: viewerCamera(record), storage }, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ResponseError
            ? error.message
            : 'Camera registration unavailable or invalid. Check approved configuration.',
      },
      { status: error instanceof ResponseError ? error.status : 400, headers },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    const response = NextResponse.json({ signedOut: true }, { headers });
    await clearCameraCookie(response, request);
    return response;
  } catch {
    return NextResponse.json({ error: 'Same-origin request required.' }, { status: 403, headers });
  }
}
