import { execFile } from 'child_process'
import type { MediaControlAction, NowPlaying } from '@shared/types'

function osascriptJS(body: string, timeout = 4000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-l', 'JavaScript', '-e', body],
      { timeout },
      (err, stdout) => (err ? reject(err) : resolve(stdout.trim()))
    )
  })
}

// Reads Now Playing from Spotify / Apple Music via JXA. `.running()` is checked
// first so we never launch a player just to query it. Telling a running app may
// trigger a one-time Automation permission prompt; on denial we resolve null.
// The whole probe is wrapped: Application(name) throws -2700 for an app that
// isn't installed (e.g. no Spotify), and app.running() throws likewise.
const PROBE = `
function probe(name) {
  try {
    var app = Application(name);
    if (!app.running()) return null;
    var state = app.playerState();
    if (state === 'stopped') return null;
    var t = app.currentTrack;
    var info = { app: name, playing: state === 'playing' };
    try { info.title = t.name(); } catch (e) {}
    try { info.artist = t.artist(); } catch (e) {}
    try { info.album = t.album(); } catch (e) {}
    try {
      var d = t.duration();
      info.durationMs = Math.round(name === 'Spotify' ? d : d * 1000);
    } catch (e) {}
    try { info.positionMs = Math.round(app.playerPosition() * 1000); } catch (e) {}
    if (name === 'Spotify') { try { info.artworkUrl = t.artworkUrl(); } catch (e) {} }
    return info;
  } catch (e) {
    return null;
  }
}
var picks = [probe('Spotify'), probe('Music')].filter(function (p) { return p; });
var chosen = picks.filter(function (p) { return p.playing; })[0] || picks[0] || null;
JSON.stringify(chosen);
`

export async function getNowPlaying(): Promise<NowPlaying | null> {
  try {
    const out = await osascriptJS(PROBE)
    if (!out || out === 'null') return null
    return JSON.parse(out) as NowPlaying
  } catch {
    return null
  }
}

export async function controlMedia(action: MediaControlAction): Promise<void> {
  const method =
    action === 'next' ? 'nextTrack' : action === 'prev' ? 'previousTrack' : 'playpause'
  // Re-derive the active player, then send the command to it.
  const body = `
function active() {
  function st(name){ try{ var a=Application(name); if(!a.running()) return null; var s=a.playerState(); return s==='stopped'?null:{name:name,playing:s==='playing'}; }catch(e){ return null; } }
  var picks=[st('Spotify'), st('Music')].filter(function(p){return p;});
  return (picks.filter(function(p){return p.playing;})[0]||picks[0]||null);
}
var a = active();
if (a) { Application(a.name).${method}(); }
'ok';
`
  try {
    await osascriptJS(body)
  } catch {
    // ignore — player gone or permission denied
  }
}
