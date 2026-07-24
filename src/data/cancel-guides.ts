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
  // ── More streaming ──
  { slug: 'apple-tv-plus', name: 'Apple TV+', difficulty: 'easy', steps: ['iPhone: Settings → Apple ID → Subscriptions → Apple TV+ → Cancel', 'Or: tv.apple.com → Account → Settings → Subscriptions → Cancel'] },
  { slug: 'sling-tv', name: 'Sling TV', difficulty: 'easy', directLink: 'https://www.sling.com/account/cancel', steps: ['Go to sling.com/account', 'Click "Cancel Subscription"', 'Sling will offer a discount — skip it', 'Confirm'] },
  { slug: 'fubo-tv', name: 'FuboTV', difficulty: 'medium', steps: ['Go to fubo.tv/account', 'Click "Cancel Subscription"', 'Fubo will try retention — keep clicking through', 'Confirm'] },
  { slug: 'starz', name: 'Starz', difficulty: 'easy', steps: ['Go to starz.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'showtime', name: 'Showtime', difficulty: 'easy', steps: ['Go to showtime.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'amc-plus', name: 'AMC+', difficulty: 'easy', steps: ['Go to amcplus.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'crunchyroll', name: 'Crunchyroll', difficulty: 'easy', steps: ['Go to crunchyroll.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'twitch-sub', name: 'Twitch Subscriptions', difficulty: 'medium', steps: ['Go to twitch.tv/subscriptions', 'Click the sub you want to cancel', 'Click "Cancel Subscription"', 'Repeat for each sub. No bulk cancel.'], warning: 'Each subscription must be canceled individually. No bulk option.' },
  // ── Music & audio ──
  { slug: 'pandora-plus', name: 'Pandora Plus/Premium', difficulty: 'easy', directLink: 'https://www.pandora.com/account', steps: ['Go to pandora.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'siriusxm', name: 'SiriusXM', difficulty: 'hard', steps: ['Call 1-866-635-5027', 'Tell them you want to cancel', 'They will try HARD to keep you. Stay firm.', 'You CANNOT cancel online. Phone only.'], warning: 'SiriusXM requires a phone call to cancel. They are notorious for aggressive retention tactics.' },
  { slug: 'tidal', name: 'Tidal', difficulty: 'easy', steps: ['Go to tidal.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  // ── Software & productivity ──
  { slug: 'microsoft-365', name: 'Microsoft 365', difficulty: 'easy', directLink: 'https://account.microsoft.com/services', steps: ['Go to account.microsoft.com/services', 'Find Microsoft 365', 'Click "Manage" → "Cancel"', 'Confirm'], warning: 'You\'ll lose access to Office apps. Files stay in OneDrive (free tier).' },
  { slug: 'google-one', name: 'Google One', difficulty: 'easy', directLink: 'https://one.google.com/account', steps: ['Go to one.google.com/account', 'Click "Cancel membership"', 'Confirm'], warning: 'You drop back to 15GB free. Files over 15GB may become inaccessible.' },
  { slug: 'icloud-plus', name: 'iCloud+', difficulty: 'easy', steps: ['iPhone: Settings → Apple ID → iCloud → Manage Storage → Change Storage Plan → Downgrade to Free', 'Or: Mac → System Settings → Apple ID → iCloud → Manage → Downgrade'] },
  { slug: 'notion-plus', name: 'Notion Plus', difficulty: 'easy', steps: ['Go to notion.so/settings/billing', 'Click "Cancel plan"', 'Confirm'], warning: 'You drop to free tier. All pages stay, but some features are limited.' },
  { slug: 'evernote', name: 'Evernote', difficulty: 'easy', steps: ['Go to evernote.com/account/billing', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'canva-pro', name: 'Canva Pro', difficulty: 'easy', steps: ['Go to canva.com/settings/billing', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'grammarly-premium', name: 'Grammarly Premium', difficulty: 'easy', steps: ['Go to grammarly.com/account/subscription', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'norton-antivirus', name: 'Norton Antivirus', difficulty: 'hard', steps: ['Go to my.norton.com/account', 'Find your subscription', 'Click "Cancel"', 'Norton may require a phone call for some plans.'], warning: 'Some Norton plans require phone cancellation. They use aggressive retention scripts.' },
  { slug: 'mcafee', name: 'McAfee', difficulty: 'hard', steps: ['Go to myaccount.mcafee.com', 'Find your subscription', 'Click "Cancel"', 'Some plans require phone: 1-866-622-3911'], warning: 'May require phone call. They will offer discounts to stay.' },
  { slug: 'lastpass', name: 'LastPass Premium', difficulty: 'easy', steps: ['Go to lastpass.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: '1password', name: '1Password', difficulty: 'easy', steps: ['Go to 1password.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  // ── Food & delivery ──
  { slug: 'hello-fresh', name: 'HelloFresh', difficulty: 'easy', steps: ['Go to hellofresh.com/account/settings', 'Click "Cancel Plan"', 'HelloFresh will ask why — pick any reason', 'Confirm'], warning: 'Cancel at least 5 days before your next delivery to avoid being charged.' },
  { slug: 'blue-apron', name: 'Blue Apron', difficulty: 'easy', steps: ['Go to blueapron.com/account/settings', 'Click "Cancel Subscription"', 'Confirm'], warning: 'Cancel at least 5 days before your next delivery.' },
  { slug: 'uber-one', name: 'Uber One', difficulty: 'medium', steps: ['App → Account → Uber One → Manage Membership → End Membership', 'Uber may show multiple "are you sure?" screens — keep clicking'], warning: 'FTC sued Uber over this. Cancel requires up to 32 actions across 23 screens.' },
  { slug: 'grubhub-plus', name: 'Grubhub+', difficulty: 'easy', steps: ['App → Account → Grubhub+ → Manage → Cancel Subscription', 'Confirm'] },
  { slug: 'instacart-plus', name: 'Instacart+', difficulty: 'easy', steps: ['App → Account → Instacart+ → Manage → Cancel', 'Confirm'] },
  // ── Fitness ──
  { slug: 'peloton', name: 'Peloton', difficulty: 'easy', steps: ['Go to onepeloton.com/membership', 'Click "Cancel Subscription"', 'Confirm'], warning: 'You lose access to classes. Your bike/tread still works in "Just Ride" mode.' },
  { slug: 'classpass', name: 'ClassPass', difficulty: 'easy', steps: ['App → Account → Settings → Cancel Membership', 'Confirm'], warning: 'Unused credits do NOT roll over. Use them before canceling.' },
  { slug: 'calm', name: 'Calm', difficulty: 'medium', steps: ['iPhone: Settings → Apple ID → Subscriptions → Calm → Cancel', 'Android: Play Store → Subscriptions → Calm → Cancel', 'Web: calm.com/account → Cancel'] },
  { slug: 'headspace', name: 'Headspace', difficulty: 'medium', steps: ['iPhone: Settings → Apple ID → Subscriptions → Headspace → Cancel', 'Android: Play Store → Subscriptions → Headspace → Cancel'] },
  { slug: 'fitbit-premium', name: 'Fitbit Premium', difficulty: 'easy', steps: ['App → Account → Fitbit Premium → Manage → Cancel', 'Confirm'] },
  { slug: 'myfitnesspal-premium', name: 'MyFitnessPal Premium', difficulty: 'easy', steps: ['App → Settings → Premium → Cancel Subscription', 'Confirm'] },
  { slug: 'strava', name: 'Strava Premium', difficulty: 'easy', steps: ['Go to strava.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  // ── Dating ──
  { slug: 'bumble', name: 'Bumble Boost/Premium', difficulty: 'medium', steps: ['iPhone: Settings → Apple ID → Subscriptions → Bumble → Cancel', 'Android: Play Store → Subscriptions → Bumble → Cancel'], warning: 'Deleting the app does NOT cancel. Must cancel through app store.' },
  { slug: 'hinge', name: 'Hinge Preferred', difficulty: 'medium', steps: ['iPhone: Settings → Apple ID → Subscriptions → Hinge → Cancel', 'Android: Play Store → Subscriptions → Hinge → Cancel'], warning: 'Deleting the app does NOT cancel.' },
  { slug: 'match', name: 'Match.com', difficulty: 'hard', steps: ['Go to match.com/settings', 'Click "Manage Subscription"', 'Click "Cancel"', 'Match may require you to confirm multiple times'], warning: 'Match auto-renews. Cancel at least 24 hours before renewal.' },
  // ── Gaming ──
  { slug: 'xbox-game-pass', name: 'Xbox Game Pass', difficulty: 'easy', directLink: 'https://account.microsoft.com/services', steps: ['Go to account.microsoft.com/services', 'Find Xbox Game Pass', 'Click "Manage" → "Cancel"', 'Confirm'] },
  { slug: 'playstation-plus', name: 'PlayStation Plus', difficulty: 'easy', directLink: 'https://www.playstation.com/en-us/playstation-network/management/', steps: ['Go to playstation.com → Account → Subscriptions', 'Find PS Plus', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'nintendo-online', name: 'Nintendo Switch Online', difficulty: 'easy', steps: ['Go to accounts.nintendo.com', 'Shop Menu → Nintendo Switch Online → Cancel', 'Confirm'], warning: 'Cloud save backups are deleted after canceling.' },
  { slug: 'ea-play', name: 'EA Play', difficulty: 'easy', steps: ['Go to ea.com/account', 'Find EA Play subscription', 'Click "Cancel"', 'Confirm'] },
  // ── News & media ──
  { slug: 'wall-street-journal', name: 'Wall Street Journal', difficulty: 'hard', steps: ['Call 1-800-568-7625', 'Tell them you want to cancel', 'They will try retention — stay firm', 'Some plans allow online cancel: wsj.com/account'], warning: 'WSJ often requires a phone call. Online cancel is not available for all plans.' },
  { slug: 'washington-post', name: 'Washington Post', difficulty: 'medium', steps: ['Go to washingtonpost.com/myaccount', 'Click "Cancel Subscription"', 'They will offer a discount — skip it', 'Confirm'] },
  { slug: 'the-atlantic', name: 'The Atlantic', difficulty: 'easy', steps: ['Go to theatlantic.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'substack', name: 'Substack Newsletters', difficulty: 'medium', steps: ['Go to substack.com/account', 'Find the newsletter', 'Click "Cancel Subscription"', 'Repeat for each one. No bulk cancel.'], warning: 'Each newsletter is a separate subscription. Cancel them individually.' },
  { slug: 'medium', name: 'Medium', difficulty: 'easy', steps: ['Go to medium.com/me/membership', 'Click "Cancel Membership"', 'Confirm'] },
  // ── Shopping & retail ──
  { slug: 'walmart-plus', name: 'Walmart+', difficulty: 'easy', steps: ['Go to walmart.com/account', 'Click "Walmart+" → "Cancel"', 'Confirm'] },
  { slug: 'amazon-subscribe-save', name: 'Amazon Subscribe & Save', difficulty: 'easy', steps: ['Go to amazon.com/auto-deliveries', 'Find the item you want to cancel', 'Click "Cancel Subscription"', 'Repeat for each item'] },
  { slug: 'barkbox', name: 'BarkBox', difficulty: 'medium', steps: ['Go to barkbox.com/account', 'Click "Cancel Subscription"', 'They will offer a discount — skip it', 'Confirm'], warning: '6-month and 12-month plans have early cancellation fees.' },
  // ── Education ──
  { slug: 'chegg', name: 'Chegg', difficulty: 'easy', steps: ['Go to chegg.com/myaccount', 'Click "Cancel Subscription"', 'Confirm'], warning: 'Cancel before your next billing date. No refunds for partial months.' },
  { slug: 'coursera-plus', name: 'Coursera Plus', difficulty: 'easy', steps: ['Go to coursera.org/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'skillshare', name: 'Skillshare', difficulty: 'easy', steps: ['Go to skillshare.com/account/settings', 'Click "Cancel Membership"', 'Confirm'] },
  { slug: 'masterclass', name: 'MasterClass', difficulty: 'easy', steps: ['Go to masterclass.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'duolingo-plus', name: 'Duolingo Plus/Super', difficulty: 'medium', steps: ['iPhone: Settings → Apple ID → Subscriptions → Duolingo → Cancel', 'Android: Play Store → Subscriptions → Duolingo → Cancel'] },
  { slug: 'babbel', name: 'Babbel', difficulty: 'easy', steps: ['Go to babbel.com/account', 'Click "Cancel Subscription"', 'Confirm'] },
  // ── Cloud & backup ──
  { slug: 'onedrive', name: 'OneDrive', difficulty: 'easy', steps: ['Go to account.microsoft.com/services', 'Find OneDrive', 'Click "Manage" → "Cancel"', 'Confirm'] },
  { slug: 'creative-cloud', name: 'Adobe Creative Cloud', difficulty: 'hard', directLink: 'https://account.adobe.com/plans', steps: ['Go to account.adobe.com/plans', 'Click "Manage plan" → "Cancel"', 'WARNING: Annual plans charged monthly have a 50% early termination fee of remaining months.'], warning: 'Annual plan early cancel = 50% penalty of remaining months. Monthly plans: no fee.' },
  // ── Ad-free / misc ──
  { slug: 'reddit-premium', name: 'Reddit Premium', difficulty: 'easy', steps: ['Go to reddit.com/settings/premium', 'Click "Cancel Subscription"', 'Confirm'] },
  { slug: 'discord-nitro', name: 'Discord Nitro', difficulty: 'easy', steps: ['Go to discord.com/settings/billing', 'Click "Cancel" next to Nitro', 'Confirm'] },

];

export function getGuide(slug: string): CancelGuide | undefined {
  return cancelGuides.find(g => g.slug === slug);
}
