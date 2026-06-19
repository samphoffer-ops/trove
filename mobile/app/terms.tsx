import { LegalDocument } from '@/components/LegalDocument';

export default function Terms() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated="June 19, 2026"
      intro="These terms govern your use of Trove. By creating an account, you agree to them."
      sections={[
        {
          heading: 'The service',
          body:
            'Trove is a shopping discovery app that helps you find products and brands matched to your taste, organize them into boards, and share them with friends. Trove does not sell products and is not the merchant of record for anything you purchase — when you tap "Shop now," you leave Trove and buy directly from the brand, under that brand’s own terms.',
        },
        {
          heading: 'Your account',
          body:
            'You need an account to use Trove. You’re responsible for keeping your login credentials secure and for activity that happens under your account. You must provide accurate information when you sign up, and you may not impersonate another person or brand.',
        },
        {
          heading: 'Acceptable use',
          body:
            'Use Trove respectfully. Don’t post or share content that is illegal, infringing, harassing, or that you don’t have the right to share. Don’t attempt to scrape, reverse-engineer, or disrupt the service, or use it to spam other users.',
        },
        {
          heading: 'Your content',
          body:
            'Boards, saved items, and messages you create remain yours. By sharing a board publicly or inviting a collaborator, you’re granting those other users the ability to view (and, for collaborators, add to) that content within Trove. You can delete your boards or your account at any time.',
        },
        {
          heading: 'Affiliate links and purchases',
          body:
            'Product links in Trove may be affiliate links — Trove may earn a commission if you make a purchase after clicking one, at no extra cost to you. Trove is not responsible for the products, pricing, availability, shipping, returns, or customer service of any third-party brand you purchase from. Disputes about a purchase are between you and that brand.',
        },
        {
          heading: 'Account termination',
          body:
            'You can delete your account at any time from Profile → Delete Account. We may suspend or terminate accounts that violate these terms.',
        },
        {
          heading: 'Disclaimers',
          body:
            'Trove is provided "as is." We work to keep product information accurate, but prices, availability, and details on brand websites can change after we display them, and we don’t guarantee they’re always current. To the fullest extent permitted by law, Trove disclaims warranties of any kind and is not liable for indirect or consequential damages arising from your use of the app.',
        },
        {
          heading: 'Changes to these terms',
          body: 'We may update these terms from time to time. If we make material changes, we’ll update the date above.',
        },
        {
          heading: 'Governing law',
          body: 'These terms are governed by the laws of [Your State/Country] — to be finalized before launch.',
        },
        {
          heading: 'Contact us',
          body: 'Questions about these terms? Email us at support@shoptrove.app.',
        },
      ]}
    />
  );
}
