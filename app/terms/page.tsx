import type { Metadata } from 'next';
import { CAMPAIGN } from '@/lib/env';
import { naira } from '@/lib/format';
import { LEGAL } from '@/lib/legal';
import { LegalPage, Mail, type Section } from '../legal-page';

export const metadata: Metadata = {
  title: 'Terms of Contribution | Smartan Impact Exchange',
  description: 'The terms that apply when you lay a brick in the Smartan House facility campaign. Impact Units are contributions, not investments.',
};

const unit = naira(CAMPAIGN.unitPriceKobo);
const target = naira(CAMPAIGN.targetKobo);

const sections: Section[] = [
  {
    id: 'about',
    title: 'About this campaign',
    body: (
      <>
        <p>The Smartan Impact Exchange (&ldquo;SIX&rdquo;) is a fundraising campaign run by {LEGAL.entity} (&ldquo;Smartan House&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) to build the new Smartan House facility and the Acorn Incubator Hub. The campaign target is {target}, campaign ID {CAMPAIGN.id}.</p>
        <p>These terms apply to every contribution made through this website. By making a contribution you agree to them.</p>
      </>
    ),
  },
  {
    id: 'not-an-investment',
    title: 'Impact Units are not an investment',
    body: (
      <>
        <p className="legal__callout">A contribution is a gift towards the facility. You do not buy anything that has financial value, and you should only contribute money you are happy to give.</p>
        <p>Each {unit} you contribute is recorded as one Impact Unit, shown on the site as one &ldquo;brick&rdquo;. Impact Units are a way of counting and recognising contributions. They are not shares, stocks, bonds, securities, deposits, loans, tokens or investment products of any kind. An Impact Unit:</p>
        <ul>
          <li>gives no ownership of, or interest in, the facility, its land, Smartan House or any related organisation;</li>
          <li>pays no dividends, interest, profit share or return of any kind, and will never be repaid or redeemed;</li>
          <li>carries no voting, governance or control rights;</li>
          <li>cannot be sold, transferred, traded, exchanged or used as payment, and has no resale value.</li>
        </ul>
        <p>The website uses the language and look of a stock exchange (an &ldquo;exchange&rdquo;, an &ldquo;opening bell&rdquo;, live figures) as a way of presenting the campaign. It is not an exchange, trading platform or marketplace, and nothing on it is an offer of securities or financial advice.</p>
      </>
    ),
  },
  {
    id: 'contributions',
    title: 'Making a contribution',
    body: (
      <>
        <ul>
          <li>The minimum contribution is one brick ({unit}). Contributions are made in whole bricks, in Nigerian naira.</li>
          <li>Payments are processed by Paystack, a licensed payment provider. Card and bank details are entered on Paystack&rsquo;s pages and are never seen or stored by us. Paystack&rsquo;s own terms also apply to the payment.</li>
          <li>A contribution counts once Paystack confirms the payment. You then receive a Builder number, a receipt number and, where email is available, a receipt by email.</li>
          <li>You must be 18 or over, or have the permission of a parent or guardian, and the money must be yours to give.</li>
          <li>We may decline or refund any contribution we reasonably believe is fraudulent, unlawful or made in error.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'use-of-funds',
    title: 'How contributions are used',
    body: (
      <>
        <p>Contributions are used to build, equip and open the new Smartan House facility and the Acorn Incubator Hub, as described on this site.</p>
        <ul>
          <li>Budget figures shown on the site are our plan. Individual amounts may move between budget lines as the build progresses.</li>
          <li>Allocations and spending are published in the Transparency ledger once they are verified, together with their reference and, where available, the source document.</li>
          <li>If the target is not reached, or the plan has to change, contributions will be applied to the parts of the facility, or the Smartan House programmes, closest to the purpose you gave for. Contributions are not returned because the target is not met.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'refunds',
    title: 'Refunds',
    body: (
      <>
        <p>Contributions are final once confirmed. We will refund a payment that was made twice, or for the wrong amount by mistake, if you contact us within {LEGAL.refundDays} days of paying at <Mail /> with your receipt number. Refunds are returned through Paystack to the original payment method, and can take several working days to arrive.</p>
      </>
    ),
  },
  {
    id: 'recognition',
    title: 'The Builder wall and your Builder card',
    body: (
      <>
        <p>When you contribute you choose how you appear publicly: your first name and last initial, with your city if you gave one, or anonymously by Builder number only. That choice is used on the live Builder wall and on your Builder card page, which anyone with the link can open.</p>
        <p>You can switch to anonymous at any time by emailing <Mail />. Recognition is limited to what is described on this site; a contribution does not give naming rights or any other benefit unless we agree it with you in writing.</p>
      </>
    ),
  },
  {
    id: 'website',
    title: 'Using this website',
    body: (
      <>
        <p>Please do not misuse the site: do not attempt to interfere with it, access data that is not yours, or submit false details. Live figures are updated automatically and may briefly lag behind the latest payments.</p>
        <p>The Smartan House name, logo, photographs and designs on this site belong to Smartan House or are used with permission, and may not be used without our consent.</p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Our responsibility',
    body: (
      <>
        <p>We run the campaign in good faith and take care to keep the information on this site accurate. Timelines, renders and plans show our intentions and may change. To the extent the law allows, we are not liable for any indirect loss arising from your use of the site or your contribution, and our total liability to you will not exceed the amount you contributed. Nothing in these terms limits any right you have under Nigerian law that cannot be limited.</p>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and governing law',
    body: (
      <>
        <p>We may update these terms, for example if the campaign changes. The version in force when you contribute applies to that contribution. These terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>Questions about these terms, a contribution or a refund: <Mail />. Please include your receipt number (for example SIX-2026-000123) if you have one.</p>,
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="SMARTAN IMPACT EXCHANGE"
      title="Terms of Contribution"
      intro={<p>The short version: you are giving towards a building, not buying an investment. Each {unit} lays one brick. You get a Builder number and a receipt, and we publish how the money is used.</p>}
      sections={sections}
      other={{ href: '/privacy', label: 'Privacy Policy' }}
    />
  );
}
