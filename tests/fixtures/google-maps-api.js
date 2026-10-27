/* Browser-only API test double. No Google geographic data or real service calls. */
(() => {
  const previous = window.google.maps;
  const listeners = new WeakMap();
  const evidence = (window.__mapsEvidence = {
    maps: [],
    cameras: [],
    traffic: [],
    lines: [],
    circles: [],
    dataLayers: [],
    featureUpdates: [],
  });
  function trigger(target, event, detail) {
    const events = listeners.get(target) || [];
    for (const listener of [...events])
      if (listener.event === event) {
        if (listener.once) listener.remove();
        listener.callback(detail);
      }
  }
  function addListener(target, event, callback, once = false) {
    const events = listeners.get(target) || [];
    listeners.set(target, events);
    const listener = {
      event,
      callback,
      once,
      remove() {
        const index = events.indexOf(listener);
        if (index >= 0) events.splice(index, 1);
      },
    };
    events.push(listener);
    return listener;
  }
  const world = ({ lng, lat }) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    return { x: (lng + 180) / 360, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI) };
  };
  class TestMap {
    constructor(div, options) {
      this.div = div;
      this.options = options;
      this.center = options.center;
      this.zoom = options.zoom;
      this.layers = new Set();
      div.replaceChildren();
      const label = document.createElement('div');
      label.textContent = 'GOOGLE MAPS API TEST DOUBLE · NO REAL GEOGRAPHY';
      label.style.cssText =
        'position:absolute;inset:0;display:grid;place-items:center;background:#273d42;color:white;font:12px sans-serif;padding:30px;text-align:center';
      this.pane = document.createElement('div');
      this.pane.style.cssText = 'position:absolute;inset:0;overflow:hidden';
      div.append(label, this.pane);
      evidence.maps.push(this);
      setTimeout(() => trigger(this, 'tilesloaded'), 60);
    }
    getDiv() {
      return this.div;
    }
    setOptions(options) {
      Object.assign(this.options, options);
    }
    setMapTypeId(type) {
      this.type = type;
    }
    getZoom() {
      return this.zoom;
    }
    setZoom(zoom) {
      this.zoom = zoom;
      evidence.cameras.push({ method: 'setZoom', zoom });
      this.redraw();
    }
    panTo(center) {
      this.center = center;
      evidence.cameras.push({ method: 'panTo', center });
      this.redraw();
    }
    moveCamera(camera) {
      Object.assign(this, camera);
      evidence.cameras.push({ method: 'moveCamera', ...camera });
      this.redraw();
    }
    redraw() {
      this.layers.forEach((layer) => layer.draw());
    }
    project(position) {
      const point = world(position),
        center = world(this.center),
        scale = 256 * 2 ** this.zoom;
      return {
        x: (point.x - center.x) * scale + this.div.clientWidth / 2,
        y: (point.y - center.y) * scale + this.div.clientHeight / 2,
      };
    }
  }
  class OverlayView {
    setMap(map) {
      if (this.map) {
        this.map.layers.delete(this);
        this.onRemove();
      }
      this.map = map;
      if (map) {
        map.layers.add(this);
        this.onAdd();
        this.draw();
      }
    }
    getPanes() {
      return { overlayMouseTarget: this.map.pane };
    }
    getProjection() {
      return {
        fromLatLngToDivPixel: (p) => this.map.project(p),
        fromLatLngToContainerPixel: (p) => this.map.project(p),
      };
    }
    static preventMapHitsAndGesturesFrom() {}
  }
  class LatLng {
    constructor(position) {
      Object.assign(this, position);
    }
  }
  class TrafficLayer {
    setMap(map) {
      evidence.traffic.push(!!map);
    }
  }
  class Polyline {
    constructor(options) {
      this.options = options;
      evidence.lines.push(this);
    }
    addListener(event, callback) {
      return addListener(this, event, callback);
    }
    setMap(map) {
      this.options.map = map;
    }
    setOptions(options) {
      Object.assign(this.options, options);
    }
  }
  class DataFeature {
    constructor(row, owner) {
      this.id = row.id;
      this.geometry = row.geometry;
      this.properties = row.properties || {};
      this.owner = owner;
    }
    getId() {
      return this.id;
    }
    getGeometry() {
      return { getType: () => this.geometry.type };
    }
    getProperty(name) {
      return this.properties[name];
    }
    setProperty(name, value) {
      this.properties[name] = value;
      this.owner.draw();
    }
  }
  class Data {
    constructor({ map }) {
      this.features = new Map();
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      evidence.dataLayers.push(this);
      this.setMap(map);
    }
    setMap(map) {
      if (this.map) {
        this.map.layers.delete(this);
        this.svg.remove();
      }
      this.map = map;
      if (map) {
        map.layers.add(this);
        map.pane.prepend(this.svg);
        this.draw();
      }
    }
    setStyle(style) {
      this.style = style;
      this.draw();
    }
    addListener(event, callback) {
      return addListener(this, event, callback);
    }
    getFeatureById(id) {
      return this.features.get(id);
    }
    addGeoJson(value) {
      return (value.type === 'FeatureCollection' ? value.features : [value]).map((row) => {
        const f = new DataFeature(row, this);
        this.features.set(row.id, f);
        evidence.featureUpdates.push({ action: 'add', id: row.id });
        this.draw();
        return f;
      });
    }
    remove(feature) {
      this.features.delete(feature.id);
      evidence.featureUpdates.push({ action: 'remove', id: feature.id });
      this.draw();
    }
    draw() {
      if (!this.map) return;
      this.svg.replaceChildren();
      for (const feature of this.features.values()) {
        const g = feature.geometry,
          paths =
            g.type === 'LineString'
              ? [g.coordinates]
              : g.type === 'Polygon'
                ? g.coordinates
                : g.coordinates.flat();
        const d = paths
          .map(
            (ring) =>
              ring
                .map((coordinate, i) => {
                  const p = this.map.project({ lng: coordinate[0], lat: coordinate[1] });
                  return `${i ? 'L' : 'M'} ${p.x} ${p.y}`;
                })
                .join(' ') + (g.type === 'LineString' ? '' : ' Z'),
          )
          .join(' ');
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const style = typeof this.style === 'function' ? this.style(feature) : {};
        element.setAttribute('d', d);
        element.dataset.featureId = feature.id;
        element.setAttribute(
          'fill',
          g.type === 'LineString' ? 'none' : style.fillColor || '#43cbe5',
        );
        element.setAttribute('fill-opacity', String(style.fillOpacity ?? 0.2));
        element.setAttribute('stroke', style.strokeColor || '#35d3bc');
        element.setAttribute('stroke-width', String(style.strokeWeight || 3));
        element.style.pointerEvents = 'all';
        element.addEventListener('click', () => trigger(this, 'click', { feature }));
        this.svg.append(element);
      }
    }
  }
  class Circle {
    constructor(options) {
      this.options = options;
      evidence.circles.push(this);
    }
    setMap(map) {
      this.options.map = map;
    }
  }
  const api = Object.assign(previous, {
    Map: TestMap,
    OverlayView,
    LatLng,
    TrafficLayer,
    Polyline,
    Circle,
    Data,
    event: {
      addListenerOnce: (target, event, callback) => addListener(target, event, callback, true),
      trigger,
      clearInstanceListeners: (target) => listeners.delete(target),
    },
  });
  api.importLibrary = async () => api;
  previous.__ib__();
})();
