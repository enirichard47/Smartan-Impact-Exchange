export default function NotFound() {
  return (
    <main className="bpage">
      <a className="bpage__brand" href="/"><img src="/assets/logo-mark.png" alt="" width={36} height={34} /><span>Smartan Impact Exchange</span></a>
      <h1 className="bpage__title">We couldn't find that Builder.</h1>
      <p className="bpage__fine">The link may be mistyped, or the payment is still being confirmed.</p>
      <div className="bpage__cta"><a className="btn btn--primary" href="/?give=1">Become a Builder</a></div>
    </main>
  );
}
