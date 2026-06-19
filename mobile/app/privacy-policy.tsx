import { LegalDocument } from '@/components/LegalDocument';

export default function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="June 19, 2026"
      intro="This policy explains what information Trove collects, how it's used, and the choices you have. Trove is a shopping discovery app — we help you find products that match your taste and connect you to the brands that sell them."
      sections={[
        {
          heading: 'Information we collect',
          body:
            'Account information: your email address, username, and display name. ' +
            'Taste profile: the brands, aesthetics, and categories you select during onboarding, and any changes you make to them later. ' +
            'Activity: products you save, boards you create, search queries, and the products you view or tap on. ' +
            'Social information: people you follow, boards you collaborate on, and products you share with other users inside the app. ' +
            'We do not collect payment information — purchases happen on the brand’s own website, not in Trove.',
        },
        {
          heading: 'How we use your information',
          body:
            'We use your taste profile and activity to personalize the products and brands shown in your feed. ' +
            'We use your account information to operate your account, your boards, and the social features you choose to use (following, sharing, collaborative boards). ' +
            'When you tap "Shop now" on a product, we send you to that brand’s website through a tracked affiliate link, which may earn Trove a commission if you purchase. We do not see your payment details or what you buy on the brand’s site — we only know that a click happened.',
        },
        {
          heading: 'Who we share information with',
          body:
            'We do not sell your personal information. We share data with two kinds of third parties: Supabase, our backend infrastructure provider, which stores your account and app data on our behalf; and affiliate networks and brand partners, which receive anonymized click data when you tap through to their site, not your Trove profile or identity.',
        },
        {
          heading: 'Other people on Trove',
          body:
            'Your username, display name, and any boards you mark public are visible to other Trove users. If you follow someone or accept a board invitation, they may be able to see boards or content you’ve chosen to share. Products you save to a personal (non-public) board are only visible to you, unless you invite a collaborator to that specific board.',
        },
        {
          heading: 'Your choices and rights',
          body:
            'You can update your taste preferences at any time. You can make a board private or public, and add or remove collaborators, at any time. You can permanently delete your account from Profile → Delete Account — this removes your profile, boards, saved items, and social connections. This action cannot be undone. If you have questions about your data, contact us at the email below.',
        },
        {
          heading: 'Children’s privacy',
          body:
            'Trove is not directed at children under 13, and we do not knowingly collect information from anyone under 13. If you believe a child has created an account, contact us and we’ll remove it.',
        },
        {
          heading: 'Data retention',
          body:
            'We retain your account information for as long as your account is active. If you delete your account, your profile, boards, saved items, and social connections are permanently removed from our systems.',
        },
        {
          heading: 'Changes to this policy',
          body:
            'If we make material changes to this policy, we’ll update the date above and, where appropriate, notify you in the app.',
        },
        {
          heading: 'Contact us',
          body: 'Questions about this policy or your data? Email us at privacy@hellotrove.app.',
        },
      ]}
    />
  );
}
