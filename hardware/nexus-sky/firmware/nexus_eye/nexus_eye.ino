#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include <atomic>
#include "config.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Copy secrets.example.h to secrets.h and configure Wi-Fi before building."
#endif

static std::atomic<bool> cameraReady{false};
static char deviceId[32];
static std::atomic<uint32_t> capturedFrames{0}, captureFailures{0};
static uint32_t lastCameraRetry = 0;
static std::atomic<int> cameraError{ESP_FAIL};
static httpd_handle_t apiServer = nullptr, streamServer = nullptr;
static SemaphoreHandle_t cameraMutex;
static uint32_t lastReconnect = 0;
static const char *BOUNDARY = "nexus-eye-frame";

static esp_err_t health(httpd_req_t *req) {
  char body[768];
  snprintf(body, sizeof(body),
    "{\"device\":\"nexus-eye\",\"version\":\"0.2.0\",\"schema_version\":\"1.0.0\","
    "\"device_id\":\"%s\",\"device_type\":\"esp32-cam\",\"camera_ready\":%s,"
    "\"camera_error\":%d,\"camera_error_name\":\"%s\",\"wifi_connected\":%s,\"rssi_dbm\":%d,"
    "\"uptime_ms\":%llu,\"free_heap\":%lu,\"psram\":%s,"
    "\"frames_captured\":%lu,\"capture_failures\":%lu,\"max_fps\":%d,\"jpeg_quality\":%d}",
    deviceId, cameraReady ? "true" : "false", cameraError.load(), esp_err_to_name(cameraError.load()),
    WiFi.status() == WL_CONNECTED ? "true" : "false", WiFi.RSSI(),
    (unsigned long long)(esp_timer_get_time() / 1000), (unsigned long)ESP.getFreeHeap(),
    psramFound() ? "true" : "false", (unsigned long)capturedFrames.load(),
    (unsigned long)captureFailures.load(), NEXUS_MAX_FPS, NEXUS_JPEG_QUALITY);
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  return httpd_resp_send(req, body, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t unavailable(httpd_req_t *req, const char *message) {
  httpd_resp_set_status(req, "503 Service Unavailable");
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  char body[256];
  snprintf(body, sizeof(body), "{\"error\":\"%s\",\"device_id\":\"%s\",\"source\":\"OFFLINE\"}", message, deviceId);
  return httpd_resp_send(req, body, HTTPD_RESP_USE_STRLEN);
}

static bool acquireCamera(httpd_req_t *req) {
  if (!cameraReady) {
    unavailable(req, "Camera unavailable");
    return false;
  }
  if (xSemaphoreTake(cameraMutex, pdMS_TO_TICKS(250)) != pdTRUE) {
    unavailable(req, "Camera busy");
    return false;
  }
  return true;
}

static esp_err_t snapshot(httpd_req_t *req) {
  if (!acquireCamera(req)) return ESP_OK;
  camera_fb_t *fb = esp_camera_fb_get();
  esp_err_t result;
  if (!fb) { captureFailures++; result = unavailable(req, "Capture failed"); }
  else {
    capturedFrames++;
    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Cache-Control", "no-store");
    result = httpd_resp_send(req, (const char *)fb->buf, fb->len);
    esp_camera_fb_return(fb);
  }
  xSemaphoreGive(cameraMutex);
  return result;
}

static esp_err_t stream(httpd_req_t *req) {
  if (!acquireCamera(req)) return ESP_OK;
  httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=nexus-eye-frame");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store");
  esp_err_t result = ESP_OK;
  while (WiFi.status() == WL_CONNECTED) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) { captureFailures++; result = ESP_FAIL; break; }
    capturedFrames++;
    char header[128];
    int n = snprintf(header, sizeof(header),
      "--%s\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
      BOUNDARY, (unsigned)fb->len);
    result = httpd_resp_send_chunk(req, header, n);
    if (result == ESP_OK) result = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    if (result == ESP_OK) result = httpd_resp_send_chunk(req, "\r\n", 2);
    esp_camera_fb_return(fb);
    if (result != ESP_OK) break;
    vTaskDelay(pdMS_TO_TICKS(1000 / NEXUS_MAX_FPS)); // capped bandwidth, no AI here
  }
  xSemaphoreGive(cameraMutex);
  // A disconnected stream must return failure so HTTPD closes its socket.
  return result == ESP_OK ? ESP_FAIL : result;
}

static bool startServers() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.send_wait_timeout = 3;
  config.recv_wait_timeout = 3;
  config.lru_purge_enable = true;
  if (httpd_start(&apiServer, &config) != ESP_OK) return false;
  httpd_uri_t h = {}; h.uri = "/status"; h.method = HTTP_GET; h.handler = health;
  httpd_uri_t s = {}; s.uri = "/capture"; s.method = HTTP_GET; s.handler = snapshot;
  if (httpd_register_uri_handler(apiServer, &h) != ESP_OK ||
      httpd_register_uri_handler(apiServer, &s) != ESP_OK) {
    httpd_stop(apiServer); apiServer = nullptr; return false;
  }
  // Compatibility routes for earlier clients.
  h.uri = "/health"; s.uri = "/snapshot";
  if (httpd_register_uri_handler(apiServer, &h) != ESP_OK ||
      httpd_register_uri_handler(apiServer, &s) != ESP_OK) {
    httpd_stop(apiServer); apiServer = nullptr; return false;
  }
  config.server_port = 81;
  config.ctrl_port += 1; // separate server keeps health available during streaming
  config.max_open_sockets = 1;
  if (httpd_start(&streamServer, &config) != ESP_OK) {
    httpd_stop(apiServer); apiServer = nullptr; return false;
  }
  httpd_uri_t m = {}; m.uri = "/stream"; m.method = HTTP_GET; m.handler = stream;
  if (httpd_register_uri_handler(streamServer, &m) != ESP_OK) {
    httpd_stop(streamServer); streamServer = nullptr;
    httpd_stop(apiServer); apiServer = nullptr; return false;
  }
  return true;
}

static void initCamera() {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0; c.ledc_timer = LEDC_TIMER_0;
  // Espressif's AI-Thinker pin map. Verify actual board and sensor before use.
  c.pin_d0 = 5; c.pin_d1 = 18; c.pin_d2 = 19; c.pin_d3 = 21;
  c.pin_d4 = 36; c.pin_d5 = 39; c.pin_d6 = 34; c.pin_d7 = 35;
  c.pin_xclk = 0; c.pin_pclk = 22; c.pin_vsync = 25; c.pin_href = 23;
  c.pin_sccb_sda = 26; c.pin_sccb_scl = 27; c.pin_pwdn = 32; c.pin_reset = -1;
  c.xclk_freq_hz = 20000000; c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size = psramFound() ? NEXUS_FRAME_SIZE : FRAMESIZE_QVGA;
  c.jpeg_quality = NEXUS_JPEG_QUALITY; c.fb_count = 1;
  c.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  c.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  cameraError = cameraMutex ? esp_camera_init(&c) : ESP_ERR_NO_MEM;
  cameraReady = cameraError == ESP_OK;
  Serial.printf("NEXUS EYE 0.2 camera=%s error=%s\n", cameraReady ? "ready" : "failed", esp_err_to_name(cameraError.load()));
}

void setup() {
  Serial.begin(115200);
  snprintf(deviceId, sizeof(deviceId), "eye-%012llx", (unsigned long long)ESP.getEfuseMac());
  pinMode(4, OUTPUT); digitalWrite(4, LOW);
  cameraMutex = xSemaphoreCreateMutex();
  initCamera();
  WiFi.mode(WIFI_STA); WiFi.setHostname("nexus-eye");
  WiFi.setAutoReconnect(true);
  WiFi.begin(NEXUS_WIFI_SSID, NEXUS_WIFI_PASSWORD);
}

void loop() {
  static bool wasConnected = false;
  bool connected = WiFi.status() == WL_CONNECTED;
  if (connected != wasConnected) Serial.printf("Wi-Fi %s device=%s\n", connected ? "connected" : "disconnected", deviceId);
  if (connected && !wasConnected) Serial.printf("Camera IP: %s\n", WiFi.localIP().toString().c_str());
  wasConnected = connected;
  if (connected && !apiServer) {
    if (!startServers()) { Serial.println("HTTP startup failed; retrying"); delay(1000); }
  }
  if (!connected && (uint32_t)(millis() - lastReconnect) >= 10000) {
    lastReconnect = millis(); WiFi.reconnect();
  }
  if (!cameraReady && (uint32_t)(millis() - lastCameraRetry) >= 30000) {
    lastCameraRetry = millis();
    esp_camera_deinit();
    initCamera();
  }
  static uint32_t lastHeartbeat = 0;
  if ((uint32_t)(millis() - lastHeartbeat) >= 10000) {
    lastHeartbeat = millis();
    Serial.printf("heartbeat device=%s wifi=%d camera=%d heap=%lu\n", deviceId,
                  connected, cameraReady.load(), (unsigned long)ESP.getFreeHeap());
  }
  delay(100);
}
