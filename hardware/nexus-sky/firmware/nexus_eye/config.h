#pragma once
// Non-secret, build-time quality controls. Keep one framebuffer and <=10 fps.
#ifndef NEXUS_FRAME_SIZE
#define NEXUS_FRAME_SIZE FRAMESIZE_QVGA
#endif
#ifndef NEXUS_JPEG_QUALITY
#define NEXUS_JPEG_QUALITY 14
#endif
#ifndef NEXUS_MAX_FPS
#define NEXUS_MAX_FPS 5
#endif
static_assert(NEXUS_MAX_FPS >= 1 && NEXUS_MAX_FPS <= 10, "FPS must be 1..10");
static_assert(NEXUS_JPEG_QUALITY >= 10 && NEXUS_JPEG_QUALITY <= 40, "JPEG quality must be 10..40 (lower is better)");
static_assert(NEXUS_FRAME_SIZE == FRAMESIZE_QVGA || NEXUS_FRAME_SIZE == FRAMESIZE_VGA,
              "Only conservative QVGA/VGA are supported; VGA requires PSRAM");
