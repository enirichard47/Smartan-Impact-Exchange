import renderCard from '../opengraph-image';

export const dynamic = 'force-dynamic';

// GET /builder/123/download: the Builder card image as a file to save (the receipt
// email links here). Same picture as the share preview, but the browser downloads it
// instead of opening it, named e.g. smartan-builder-000123.png.
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) return new Response('Not found', { status: 404 });
  const image = await renderCard({ params: Promise.resolve({ number }) });
  const body = await image.arrayBuffer();
  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="smartan-builder-${number.padStart(6, '0')}.png"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
