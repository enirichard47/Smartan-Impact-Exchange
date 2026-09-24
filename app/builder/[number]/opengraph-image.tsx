import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { brickWall, WALL } from '@/lib/brick-wall';
import { getBuilder } from '@/lib/builders';
import { env } from '@/lib/env';
import { builderId, num, watMonth } from '@/lib/format';

// The preview image WhatsApp, X, LinkedIn etc. show when a Builder link is shared.
// Same design as the Builder card (css .bc), laid out at 1200×630.
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Smartan Impact Exchange Builder card';

const MUTED = 'rgba(245,247,250,.5)';

async function logo() {
  try {
    const png = await readFile(path.join(process.cwd(), 'public/assets/logo-mark.png'));
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const [b, mark] = await Promise.all([getBuilder(Number(number)), logo()]);
  const host = env.siteUrl.replace(/^https?:\/\//, '');
  const wallWidth = 440;
  const s = wallWidth / WALL.width;
  const stats: [string, string, string][] = b
    ? [['BUILDER', builderId(b.number), '#3FA2E8'], ['BRICKS LAID', num(b.bricks), '#F5F7FA'], ['SINCE', watMonth(b.since), '#F5F7FA']]
    : [];

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0A0D12', color: '#F5F7FA', padding: '64px 72px 56px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 6, color: 'rgba(245,247,250,.62)' }}>SMARTAN IMPACT EXCHANGE</div>
          {mark ? <img src={mark} width={64} height={64} alt="" /> : null}
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 112, fontWeight: 700, letterSpacing: -5, lineHeight: 0.95 }}>
              <span>I'm a</span><span>Builder.</span>
            </div>
            {b?.name ? <div style={{ display: 'flex', marginTop: 24, fontSize: 32, color: 'rgba(245,247,250,.7)' }}>{b.city ? `${b.name}, ${b.city}` : b.name}</div> : null}
          </div>
          <svg width={wallWidth} height={WALL.height * s} viewBox={`0 0 ${WALL.width} ${WALL.height}`}>
            {brickWall(b?.bricks ?? 0).map(k => (
              <rect
                key={k.i} x={k.x} y={k.y} width={WALL.w} height={WALL.h} rx={1} strokeWidth={0.5}
                fill={k.last ? '#3FA2E8' : k.laid ? '#0076C6' : 'rgba(245,247,250,.035)'}
                stroke={k.last ? '#7CC4F4' : k.laid ? '#0A86DC' : 'rgba(245,247,250,.14)'}
              />
            ))}
          </svg>
        </div>

        <div style={{ display: 'flex', height: 3, background: '#0076C6', marginBottom: 28 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 72 }}>
            {b
              ? stats.map(([label, value, colour]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 16, letterSpacing: 4, color: MUTED }}>{label}</span>
                    <span style={{ fontSize: 36, marginTop: 8, color: colour }}>{value}</span>
                  </div>
                ))
              : <span style={{ fontSize: 30 }}>Every ₦10,000 lays one brick.</span>}
          </div>
          <span style={{ fontSize: 22, letterSpacing: 3, color: 'rgba(245,247,250,.85)' }}>{host}</span>
        </div>
      </div>
    ),
    size,
  );
}
