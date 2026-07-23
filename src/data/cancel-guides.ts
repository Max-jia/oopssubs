export interface CancelGuide {
  slug: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: string[];
  directLink?: string;
  warning?: string;
}

export const cancelGuides: CancelGuide[] = [
  {
    slug: 'netflix',
    name: 'Netflix',
    difficulty: 'easy',
    directLink: 'https://www.netflix.com/cancelplan',
    steps: [
      'Go to netflix.com/cancelplan',
      'Click "Finish Cancellation"',
      'Done. You\'ll still have access until the end of your billing period.',
    ],
  },
  {
    slug: 'spotify',
    name: 'Spotify Premium',
    difficulty: 'easy',
    directLink: 'https://www.spotify.com/us/account/change-plan/',
    steps: [
      'Go to spotify.com/account',
      'Under "Your plan", click "Change plan"',
      'Scroll down to "Cancel Premium" and click it',
      'Spotify will offer you a cheaper plan — click past it',
      'Confirm cancellation',
    ],
    warning: 'You\'ll lose downloaded songs. Playlists and saved music stay on the free tier.',
  },
  {
    slug: 'amazon-prime',
    name: 'Amazon Prime',
    difficulty: 'medium',
    directLink: 'https://www.amazon.com/mc/prime',
    steps: [
      'Go to amazon.com/mc/prime',
      'Click "End membership"',
      'Amazon will show you several "are you sure?" pages — keep clicking',
      'On the last page, click "Cancel My Benefits"',
      'Confirm on the final page',
    ],
    warning: 'If you\'ve used Prime benefits this month, you may not get a refund. Cancel right before renewal.',
  },
  {
    slug: 'hulu',
    name: 'Hulu',
    difficulty: 'easy',
    steps: ['Go to hulu.com/account', 'Under "Your Subscription", click "Cancel"', 'Skip the retention offer', 'Confirm'],
  },
  {
    slug: 'disney-plus',
    name: 'Disney+',
    difficulty: 'easy',
    steps: ['Go to disneyplus.com/account', 'Click your subscription', 'Click "Cancel Subscription"', 'Confirm'],
  },
  {
    slug: 'apple-music',
    name: 'Apple Music',
    difficulty: 'easy',
    steps: ['iPhone: Settings → Apple ID → Subscriptions → Apple Music → Cancel', 'Android: Apple Music app → Menu → Account → Manage Subscription → Cancel'],
  },
  {
    slug: 'youtube-premium',
    name: 'YouTube Premium',
    difficulty: 'easy',
    directLink: 'https://www.youtube.com/paid_memberships',
    steps: ['Go to youtube.com/paid_memberships', 'Click "Manage membership"', 'Click "Deactivate"', 'Confirm'],
  },
  {
    slug: 'hbo-max',
    name: 'Max (HBO)',
    difficulty: 'easy',
    steps: ['Go to max.com/subscription', 'Click "Cancel subscription"', 'Confirm'],
  },
  {
    slug: 'adobe-cc',
    name: 'Adobe Creative Cloud',
    difficulty: 'hard',
    directLink: 'https://account.adobe.com/plans',
    steps: ['Go to account.adobe.com/plans', 'Click "Manage plan" → "Cancel your plan"', 'Decline the retention offer', 'WARNING: Annual plan early cancel = 50% penalty of remaining months. Monthly plans: no fee.'],
    warning: 'Annual plan early cancellation costs 50% of remaining months. Check your plan type first.',
  },
  {
    slug: 'amazon-audible',
    name: 'Audible',
    difficulty: 'medium',
    steps: ['Go to audible.com → Account Details → Cancel membership', 'Decline the "3 months half off" offer', 'Decline any additional offers', 'Confirm'],
    warning: 'Downloaded audiobooks stay in your library after canceling.',
  },
  {
    slug: 'nytimes',
    name: 'New York Times',
    difficulty: 'hard',
    steps: ['Online cancel may not be available depending on your plan.', 'Try: nytimes.com/account → Subscription → Cancel', 'If not available: call 866-273-3612', 'Or use the chat feature on the contact page', 'Be prepared: they will try hard to keep you. Stay firm.'],
    warning: 'NYT makes cancellation intentionally difficult. Phone may be required.',
  },
  {
    slug: 'planet-fitness',
    name: 'Planet Fitness',
    difficulty: 'hard',
    steps: ['Go to your home club IN PERSON', 'Fill out a cancellation form at the front desk', 'OR send certified mail with your name, ID, and cancellation request', 'Some locations: try planetfitness.com/login'],
    warning: 'Most locations still require in-person or certified mail cancellation. Yes, in 2026.',
  },
  {
    slug: 'doordash-dashpass',
    name: 'DoorDash DashPass',
    difficulty: 'easy',
    steps: ['App → Account → Manage DashPass', 'Tap "End Subscription"', 'Confirm'],
  },
  {
    slug: 'tinder-plus',
    name: 'Tinder Plus/Gold',
    difficulty: 'medium',
    steps: ['iPhone: Settings → Apple ID → Subscriptions → Tinder → Cancel', 'Android: Play Store → Subscriptions → Tinder → Cancel'],
    warning: 'Deleting the app does NOT cancel the subscription. Use the app store.',
  },
  {
    slug: 'linkedin-premium',
    name: 'LinkedIn Premium',
    difficulty: 'easy',
    steps: ['Go to linkedin.com/premium/manage', 'Click "Cancel subscription"', 'Skip the discount offer', 'Confirm'],
  },
  {
    slug: 'paramount-plus',
    name: 'Paramount+',
    difficulty: 'easy',
    directLink: 'https://www.paramountplus.com/settings',
    steps: ['Go to paramountplus.com/settings', 'Click "Cancel subscription"', 'Confirm'],
  },
  {
    slug: 'peacock',
    name: 'Peacock',
    difficulty: 'medium',
    steps: ['Go to peacocktv.com/account', 'Under "Your Plan", click "Cancel Plan"', 'Skip the retention deal', 'Confirm'],
  },
  {
    slug: 'dropbox-plus',
    name: 'Dropbox Plus',
    difficulty: 'easy',
    steps: ['Go to dropbox.com/account/plan', 'Click "Cancel plan"', 'Confirm'],
    warning: 'Files not deleted. You drop to free tier (2GB limit).',
  },
  {
    slug: 'onlyfans',
    name: 'OnlyFans',
    difficulty: 'medium',
    steps: ['Profile → Following → Click creator → "Subscribed" → "Unsubscribe"', 'Repeat for each creator'],
    warning: 'You must unsubscribe from each creator individually. No bulk cancel.',
  },
  {
    slug: 'amazon-kindle-unlimited',
    name: 'Kindle Unlimited',
    difficulty: 'easy',
    steps: ['Go to amazon.com/kindleunlimited → Manage Membership', 'Click "Cancel Kindle Unlimited Membership"', 'Confirm'],
    warning: 'Borrowed books removed. Access until end of billing period.',
  },
];

export function getGuide(slug: string): CancelGuide | undefined {
  return cancelGuides.find(g => g.slug === slug);
}
