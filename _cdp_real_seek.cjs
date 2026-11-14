// Seek validation: click/drag ytmFsProgressBar -> currentTime jumps to ~30%, NOT 0:00
async function main() {
    const list = await (await fetch('http://localhost:9222/json/list')).json();
    const page = list.find(t => t.type === 'page');
    if (!page) { console.log('NO PAGE'); process.exit(0); }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const p = pending.get(msg.id); pending.delete(msg.id);
            msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
        } else if (msg.method) events.push(msg);
    };
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    function send(m, p = {}) {
        return new Promise((resolve, reject) => {
            const mid = ++id; pending.set(mid, { resolve, reject });
            ws.send(JSON.stringify({ id: mid, method: m, params: p }));
        });
    }
    await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:8777/index.html' });
    await new Promise(r => setTimeout(r, 9000));

    const expr = `(async () => {
        const out = {};
        try {
            const ep = new Audio();
            eval('audioPlayer = ep');
            ep.volume = 0;
            const song = { id: 'song_wav', title: 'Silence Test', artist: 'Test', movie: '', albumCover: '', audioUrl: 'http://localhost:8777/_silence.wav', duration: 30 };
            window.playSong(song, [song]);
            for (let i = 0; i < 40; i++) {
                await new Promise(r => setTimeout(r, 250));
                if (isFinite(ep.duration) && ep.duration > 0) break;
            }
            out.duration = ep.duration;
            await new Promise(r => setTimeout(r, 1000));
            out.startedAt = ep.currentTime;
            out.startedPlaying = !ep.paused;

            // Open fullscreen so ytmFsProgressBar exists
            if (typeof YTMusic !== 'undefined' && YTMusic.toggleFullscreenPlayer) {
                YTMusic.toggleFullscreenPlayer();
            }
            await new Promise(r => setTimeout(r, 500));

            const bar = document.getElementById('ytmFsProgressBar');
            if (!bar) { out.noBar = true; return out; }
            const r = bar.getBoundingClientRect();
            out.barRect = { left: r.left, width: r.width };

            // Click-drag to ~30% (=> ~9s on a 30s clip)
            const targetX = r.left + r.width * 0.3;
            ['touchstart', 'mousedown'].forEach(t => {
                bar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: targetX, clientY: 10, view: window }));
            });
            ['touchmove', 'mousemove'].forEach(t => {
                bar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: targetX, clientY: 10, view: window }));
            });
            ['touchend', 'mouseup', 'click'].forEach(t => {
                bar.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: targetX, clientY: 10, view: window }));
            });
            await new Promise(r2 => setTimeout(r2, 600));

            out.seekedTo = ep.currentTime;                      // expect ~9s (30%)
            out.fsTimeLabel = document.getElementById('ytmFsCurrentTime') ? document.getElementById('ytmFsCurrentTime').textContent : null;
            out.fsProgressFilledWidth = document.getElementById('ytmFsProgressFilled') ? document.getElementById('ytmFsProgressFilled').style.width : null;
            out.mapTimeLabel = document.getElementById('mapCurrentTime') ? document.getElementById('mapCurrentTime').textContent : null;
            out.mapProgressFilledWidth = document.getElementById('mapProgressFilled') ? document.getElementById('mapProgressFilled').style.width : null;
        } catch (e) {
            out.err = String(e && e.stack ? e.stack : e);
        }
        return JSON.stringify(out);
    })()`;

    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    let val = r.result && r.result.value;
    try { val = JSON.parse(val); } catch (_) {}
    console.log('RESULT:', JSON.stringify(val, null, 2));

    const errs = events.filter(e => e.method === 'Runtime.exceptionThrown')
        .map(e => { const d = e.params.exceptionDetails; return (d.exception && d.exception.description || d.text || '').slice(0, 500); });
    console.log('EXCEPTIONS:', JSON.stringify(errs));
    ws.close();
    process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });

