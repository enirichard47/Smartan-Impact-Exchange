import type { Metadata } from 'next';
import { LEGAL } from '@/lib/legal';
import { LegalPage, Mail, type Section } from '../legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy | Smartan Impact Exchange',
  description: 'What the Smartan Impact Exchange collects when you contribute, why, who processes it, and your rights under the Nigeria Data Protection Act 2023.',
};

const sections: Section[] = [
  {
    id: 'who',
    title: 'Who we are',
    body: (
      <p>{LEGAL.entity} (&ldquo;Smartan House&rdquo;, &ldquo;we&rdquo;) runs the Smartan Impact Exchange campaign and is the data controller for the personal data described here. We handle it in line with the Nigeria Data Protection Act 2023. Contact us about anything in this policy at <Mail />.</p>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <p>We only collect what we need to record your contribution and send your receipt. There are no accounts and no passwords.</p>
        <table className="legal__table">
          <thead><tr><th>What</th><th>When</th></tr></thead>
          <tbody>
            <tr><td>Full name and email address</td><td>Required when you contribute, for your receipt and Builder record</td></tr>
            <tr><td>Phone number and city</td><td>Optional; only if you choose to give them</td></tr>
            <tr><td>How you want to appear on the Builder wall</td><td>First name and initial, or anonymous</td></tr>
            <tr><td>Contribution details: amount, bricks, date and time, payment channel (card, transfer or USSD), Paystack reference, receipt and Builder numbers</td><td>Recorded when Paystack confirms your payment</td></tr>
            <tr><td>Standard technical data such as IP address and browser type</td><td>Kept briefly in our hosting provider&rsquo;s security and error logs</td></tr>
          </tbody>
        </table>
        <p><strong>We never receive your card or bank details.</strong> You enter them on Paystack&rsquo;s pages, and Paystack only tells us whether the payment succeeded.</p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'Why we use it',
    body: (
      <ul>
        <li><strong>To process your contribution</strong> and send your receipt and Builder card (necessary to do what you asked us to).</li>
        <li><strong>To recognise you publicly</strong>, in the way you chose, on the Builder wall and your Builder card page (your choice when contributing).</li>
        <li><strong>To keep accurate financial records</strong>, reconcile payments and handle refunds (our legal and accounting obligations).</li>
        <li><strong>To prevent fraud and keep the site secure</strong> (our legitimate interest in protecting the campaign and its Builders).</li>
        <li><strong>To contact you about your contribution</strong> if something needs your attention. We do not send marketing emails, and we never sell or rent your data.</li>
      </ul>
    ),
  },
  {
    id: 'public',
    title: 'What is public',
    body: (
      <>
        <p>If you choose &ldquo;first name and initial&rdquo;, the public site shows that name (for example &ldquo;Richard O.&rdquo;), your city if you gave one, your Builder number, the number of bricks you laid and when. If you choose anonymous, only your Builder number and bricks are shown.</p>
        <p>Your email address, phone number, full surname and payment references are never shown publicly. You can switch to anonymous at any time by emailing <Mail />.</p>
      </>
    ),
  },
  {
    id: 'share',
    title: 'Who we share it with',
    body: (
      <>
        <p>We use a small number of service providers who process data only on our instructions:</p>
        <table className="legal__table">
          <thead><tr><th>Provider</th><th>What for</th></tr></thead>
          <tbody>
            <tr><td>Paystack</td><td>Taking and confirming payments</td></tr>
            <tr><td>Supabase</td><td>The database that holds contribution records</td></tr>
            <tr><td>Resend</td><td>Sending receipt emails</td></tr>
            <tr><td>Vercel</td><td>Hosting the website</td></tr>
          </tbody>
        </table>
        <p>Some of these providers store data on servers outside Nigeria. Where that happens we rely on the safeguards the Nigeria Data Protection Act 2023 requires, such as the provider&rsquo;s contractual data protection commitments. We may also disclose data where the law requires it, for example to a regulator or court.</p>
      </>
    ),
  },
  {
    id: 'keep',
    title: 'How long we keep it',
    body: (
      <p>We keep contribution records for as long as we need them for the campaign and for our accounting, tax and audit obligations, and then delete or anonymise them. Hosting logs are kept for a short period by our providers. If a checkout is started but never paid, its details are kept only as long as needed to reconcile payments.</p>
    ),
  },
  {
    id: 'security',
    title: 'Keeping it safe',
    body: (
      <p>All traffic to this site is encrypted. Contribution records are held in a database that cannot be read from the public website; only our server and authorised campaign administrators can access them. Payments are confirmed directly with Paystack rather than trusted from the browser.</p>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
        <ul>
          <li>tell you what personal data we hold about you and give you a copy;</li>
          <li>correct anything that is wrong or incomplete;</li>
          <li>delete your data, where we are not required to keep it (for example, financial records we must retain);</li>
          <li>stop or restrict using it, including removing you from public display;</li>
          <li>send your data to you or to someone else in a portable format.</li>
        </ul>
        <p>Email <Mail /> from the address you contributed with, and include your receipt or Builder number if you have it. We will respond within the time the law requires. If you are unhappy with how we handle your data, you can complain to the Nigeria Data Protection Commission (NDPC).</p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <>
        <p>This site does not use advertising or analytics cookies, and does not track you across other sites. It stores three small preferences in your own browser, which never leave your device:</p>
        <ul>
          <li>your light or dark theme choice;</li>
          <li>whether you turned the sound on for the opening sequence;</li>
          <li>whether you have already seen the opening sequence, so it does not replay every visit.</li>
        </ul>
        <p>Campaign administrators signing in to the admin area receive a single sign-in cookie. Paystack may set its own cookies on its payment pages.</p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>Contributions should be made by adults, or by young people with a parent&rsquo;s or guardian&rsquo;s permission. We do not knowingly collect data from children without that permission; if you believe we have, contact us and we will remove it.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>We will update this page if the way we handle data changes, and change the effective date above.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="SMARTAN IMPACT EXCHANGE"
      title="Privacy Policy"
      intro={<p>The short version: we ask for your name and email so we can record your contribution and send your receipt. Phone and city are optional. We never see your card details, we never sell your data, and you choose how you appear on the Builder wall.</p>}
      sections={sections}
      other={{ href: '/terms', label: 'Terms of Contribution' }}
    />
  );
}
