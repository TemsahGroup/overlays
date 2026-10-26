import { useEffect, useState } from 'react';
import { STATUS_STALE_MS, subscribeStatus, type StatusMessage } from '../../integrations/tikfinity/eventApi/statusChannel';
import type { Layout } from '../types';
import { LIVE_STATUS_LABEL, NotRunningHelp } from './LiveStatusPanel';

interface Props {
  layout: Layout;
  configId: string | null;
  giftName: string;
}

export function SetupGuide({ layout, configId, giftName }: Props) {
  const [w, h] = layout === '16:9' ? [1920, 1080] : [1080, 1920];
  // Status published by overlay tabs of this browser. The builder itself never connects.
  const [latest, setLatest] = useState<{ msg: StatusMessage; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setLatest(null);
    return subscribeStatus((msg) => {
      if (msg.configId === configId) setLatest({ msg, at: Date.now() });
    });
  }, [configId]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);
  const reported = latest && now - latest.at < STATUS_STALE_MS ? latest.msg : null;
  const status = reported?.state.status ?? 'disconnected';
  const verified = !!reported?.state.verifiedGiftAt;
  return (
    <>
      <section className="section">
        <h2>OBS setup</h2>
        <ol className="steps">
          <li>Save the configuration and copy the <b>portable overlay URL</b>.</li>
          <li>
            OBS → Sources → <b>+</b> → <b>Browser</b>. Paste the URL.
          </li>
          <li>
            Set width <b>{w}</b> and height <b>{h}</b>. Clear any <code>background-color</code> in Custom CSS.
          </li>
          <li>Place the source above your camera.</li>
          <li>
            To check placement, add <code>&amp;demo=1</code> at the end of the URL (plays a TEST gift every 6 s), then remove it.
          </li>
          <li>Keep this app running (or hosted) while you stream — OBS loads it like a web page.</li>
        </ol>
      </section>

      <section className="section">
        <h2>TikFinity connection</h2>
        <div className={`conn conn--${status}`}>
          <span className="conn-dot" />
          <b>{LIVE_STATUS_LABEL[status]}</b>
          <span className={`chip ${verified ? 'chip--tikfinity' : 'chip--mock'}`}>{verified ? 'LIVE GIFTS VERIFIED' : 'NOT VERIFIED LIVE'}</span>
        </div>
        <p className="hint">
          {reported
            ? reported.state.detail
            : 'No overlay of this configuration is open in this browser. The live connection runs only inside the overlay page (OBS), never in the builder.'}
        </p>
        <ol className="steps">
          <li>
            Install and start <b>TikFinity Desktop</b> on the <b>same computer</b> as OBS, and connect it to your LIVE. Its Event API is
            documented at{' '}
            <a href="https://tikfinity.zerody.one/tiktok/dapi" target="_blank" rel="noreferrer">
              tikfinity.zerody.one/tiktok/dapi
            </a>{' '}
            (<code>ws://localhost:21213/</code>).
          </li>
          <li>The overlay connects automatically. Real “{giftName}” gifts then play this effect; test gifts keep their TEST chip.</li>
          <li>
            To see the connection status, open the overlay URL with <code>&amp;setup=1</code> (for example as a temporary OBS source, or in
            a browser tab on the streaming PC). Remove it for the stream.
          </li>
          <li>
            Add <code>&amp;live=0</code> to an overlay URL to disable the live connection.
          </li>
        </ol>
        {(status === 'error' || status === 'disconnected') && reported && <NotRunningHelp />}
        <p className="hint">
          “Connected” only means TikFinity Desktop answered. The integration counts as live only after a real gift has been received
          (LIVE GIFTS VERIFIED).
        </p>
      </section>
    </>
  );
}
