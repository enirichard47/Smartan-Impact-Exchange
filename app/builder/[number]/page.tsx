import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { getBuilder } from '@/lib/builders';
import { env } from '@/lib/env';
import { brickWall, WALL } from '@/lib/brick-wall';
import { builderId, num, plural, watMonth } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params;
  const b = await getBuilder(Number(number));
  if (!b) return { title: 'Builder not found' };
  const title = `${b.name || `Builder ${builderId(b.number)}`} is building the new Smartan House facility`;
  const description = `${plural(b.bricks, 'brick')} laid. Every ₦10,000 lays one brick. Become a Builder.`;
  return { title, description, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function BuilderPage({ params }: Props) {
  const { number } = await params;
  const b = await getBuilder(Number(number));
  if (!b) notFound();

  const host = env.siteUrl.replace(/^https?:\/\//, '');
  return (
    <main className="bpage">
      <a className="bpage__brand" href="/" aria-label="Smartan Impact Exchange home">
        <img src="/assets/logo-mark.png" alt="" width={36} height={34} />
        <span>Smartan Impact Exchange</span>
      </a>

      <section className="bc" aria-label={`Builder card ${builderId(b.number)}`}>
        <div className="bc__in">
          <div className="bc__top">
            <span className="bc__brand">SMARTAN IMPACT EXCHANGE</span>
            <img className="bc__logo" src="/assets/logo-mark.png" alt="" width={64} height={64} />
          </div>
          <div className="bc__mid">
            <div>
              <h1 className="bc__im">I'm a<br />Builder.</h1>
              {b.name ? <p className="bc__name">{b.name}{b.city ? `, ${b.city}` : ''}</p> : null}
            </div>
            <svg className="bc__wall" viewBox={`0 0 ${WALL.width} ${WALL.height}`} aria-hidden="true">
              {brickWall(b.bricks).map(k => (
                <rect
                  key={k.i} x={k.x} y={k.y} width={WALL.w} height={WALL.h} rx={1}
                  className={k.laid ? (k.last ? 'is-laid is-last' : 'is-laid') : undefined}
                  style={k.laid ? ({ '--i': k.i } as CSSProperties) : undefined}
                />
              ))}
            </svg>
          </div>
          <div className="bc__rule"></div>
          <dl className="bc__stats">
            <div><dt>BUILDER</dt><dd className="is-accent">{builderId(b.number)}</dd></div>
            <div><dt>BRICKS LAID</dt><dd>{num(b.bricks)}</dd></div>
            <div><dt>SINCE</dt><dd>{watMonth(b.since)}</dd></div>
          </dl>
          <div className="bc__foot"><span>THE NEW SMARTAN HOUSE</span><span>{host}</span></div>
        </div>
      </section>

      <div className="bpage__cta">
        <a className="btn btn--primary" href="/?give=1">Lay a brick too</a>
        <a className="btn btn--ghost" href="/#facility">See the facility</a>
      </div>
      <p className="bpage__fine">Every ₦10,000 lays one brick. Impact Units are campaign contributions, not investments or securities. <a href="/terms">Terms</a> <a href="/privacy">Privacy</a></p>
    </main>
  );
}
