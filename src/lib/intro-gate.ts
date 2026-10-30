// First-visit decision for the AETHER intro film, shared by the pre-paint script (layout) and
// the client controller so the gate is visible on the very first paint for new visitors, never
// flashes for returning ones, and stays hidden entirely without JavaScript.
export const introSeenKey = 'aether-intro-v1';
export const introSoundKey = 'aether-intro-sound';
const preferencesKey = 'nexus-preferences-v2';
const forcedPattern = /[?&]intro(=|&|$)/;
const skipPattern = /[?&]skip-intro(=|&|$)/;

export function introDecision(): 'fresh' | 'seen' {
  try {
    if (location.pathname !== '/') return 'seen';
    if (skipPattern.test(location.search)) return 'seen';
    if (forcedPattern.test(location.search)) return 'fresh';
    const stored = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
    const still =
      matchMedia('(prefers-reduced-motion: reduce)').matches || stored?.state?.motion === false;
    return still ? 'seen' : 'fresh';
  } catch {
    return 'seen';
  }
}

// Pre-paint script: the intro film opens on every visit to the homepage unless reduced motion or skip-intro is requested.
export const introPrepaintScript = `(function(){var v='seen';try{if(location.pathname==='/'){if(${skipPattern}.test(location.search))v='seen';else if(${forcedPattern}.test(location.search))v='fresh';else{var p=JSON.parse(localStorage.getItem(${JSON.stringify(preferencesKey)})||'{}');var still=matchMedia('(prefers-reduced-motion: reduce)').matches||(p&&p.state&&p.state.motion===false);if(!still)v='fresh'}}}catch(e){}document.documentElement.setAttribute('data-intro',v)})()`;
