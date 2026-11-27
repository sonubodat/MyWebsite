---
title: Privacy Policy
updated: 27 November 2026
---

This Privacy Policy explains what information the TapTap mobile game ("TapTap", "the game") collects, why, who receives it, how long it is kept and what choices you have. TapTap is a free mobile game for iOS and Android where two players tap as fast as they can in a real-time match. It also offers practice, bot and same-device two-player modes.

The publisher named at the bottom of this page ("we", "us") is responsible for your information and is the data controller (the "Data Fiduciary" under India's Digital Personal Data Protection Act, 2023). TapTap is not offered in mainland China.

This policy covers the TapTap app, its game servers and its support and deletion requests. It does not cover other websites, apps or services that you reach through a link, an advertisement or your device's share sheet.

## The short version
- We collect a display name you choose, a random device ID, your match results and basic technical data.
- We do not ask for your real name, email, phone number, contacts, photos, microphone, camera or precise location to play.
- Analytics and session replay are used with your consent. Session replay is only for adults, and text and images on screen are masked.
- Ads are shown by Google AdMob. Ads are personalised only if you agree in the consent form.
- We do not sell your personal information for money.
- TapTap is not for children under 13.
- You can change analytics and ad choices at any time in Settings, and you can delete your account.

## Words used in this policy
- **Personal information**: information that identifies you or can reasonably be linked to you or your device, including a random ID.
- **Player ID**: the random identifier of your game account.
- **Device ID**: a random code the game creates and keeps in your phone's secure storage. It is not your hardware serial number, IMEI or phone number.
- **Processing**: anything done with information, such as collecting, storing, using, sharing or deleting it.
- **Provider**: a company that processes information to help run the game.

## Where the information comes from
- **From you**: the display name, username, avatar and cosmetics you choose, your age-screen answer, your privacy choices, reports you send, and what you write when you contact us.
- **Automatically from the game**: matches, taps, scores, rewards, technical data, crash reports and usage events.
- **From your device and the network**: device model, operating system, app version, IP address and, if you allow it, your advertising identifier.
- **From other players**: reports, blocks, friend requests and challenge links that involve you.
- **From advertising providers**: confirmation that a rewarded video was completed so the reward can be given.

## What we collect and why

| Data | Why | Who receives it | How long |
|---|---|---|---|
| Device ID: random code in the phone's secure storage | Guest sign-in | Supabase, Render | On your phone until you log out, reset or reinstall. On our servers until account deletion |
| Player ID: random account ID | Account, matchmaking, leaderboards, analytics link | Supabase, Render, Redis Cloud, PostHog | Until account deletion |
| Display name, username, avatar, cosmetics | Show you in matches, leaderboards, friend search and challenge links | Supabase, Render. Other players can see them | Until you change them or delete your account |
| Match records: taps, scores, results, streaks, bot or human opponent | Run matches, statistics, fairness | Supabase, Render, summaries to PostHog | Kept after deletion in anonymised form |
| Coins, wallet, rewards and ad reward records | Correct balances, prevent fraud | Supabase, Render | Kept after deletion in anonymised form |
| Career progress, friends, blocks, social settings | Game features | Supabase, Render | Until you remove them or delete your account |
| Reports you send, with an optional short note | Safety | Supabase, Render | Reports you sent are removed on deletion. Reports about a deleted account are kept anonymised for 90 days |
| Anti-cheat signals: tap timing pattern, risk level | Detect cheating | Supabase, Render | As long as needed to keep matches fair |
| IP address | Rate limiting and security | Redis Cloud, Render | About 60 seconds in rate limit counters. Server logs follow the host's retention |
| Sign-in tokens, stored as hashes | Keep you signed in safely | Supabase, Render | Revoked on account deletion |
| Online status and matchmaking state | Find opponents | Redis Cloud | Seconds to 5 minutes |
| Usage events, device model, OS, app version, crash reports | Understand and fix the game | PostHog (United States) | Only with your consent. Kept under our PostHog retention settings |
| Session replay with text and images masked | Find confusing screens | PostHog (United States) | Adults who allow analytics only |
| Match and economy events sent by our servers | Product and economy measurement | PostHog (United States) | Sent for every player. The in-app analytics switch does not currently stop these |
| Advertising ID, approximate location from IP, device information, ad interactions | Show, measure and fraud-check ads | Google AdMob and Google consent form | Under [Google's policies](https://policies.google.com/technologies/ads) |
| Consent choices and age group. Date of birth is not stored | Record your choices, apply age rules | Supabase, Render | Until account deletion |
| Support and deletion requests: email, player tag, reference number | Answer you | Email provider, Supabase | Deletion request contact removed 30 days after the request closes |

## What we do not collect
TapTap does not ask for or read your contacts, photo library, camera, microphone, calendar, health data, SMS, call logs or precise location. The game has no real-money purchases, so we receive no payment card or bank details.

## Device permissions
- **Internet**: needed to play online, load ads and save progress.
- **Android advertising ID**: used by Google AdMob for ads and ad measurement.
- **iPhone tracking permission (App Tracking Transparency)**: iOS asks whether ads may use your advertising identifier. If you say no, the identifier is not used for tracking and the game still works.
- **Sharing**: when you share a challenge, your device's own share sheet opens. We do not see your contacts or which person you choose.

## How we use information
We use information to:
- create and secure your guest account
- match you with opponents, run matches and calculate results
- keep leaderboards, statistics, career progress, rewards and balances
- show friends, challenges and cosmetic items
- filter names and handle reports and blocks
- detect cheating, bots, fraud and abuse of rewards or ads
- find and fix crashes and bugs and improve the game
- show ads and give rewards for rewarded videos
- answer your questions and carry out your requests
- meet legal duties and defend legal claims

We do not use your information to make decisions about credit, employment, insurance or housing.

## Advertising
TapTap is free and shows ads from Google AdMob. Optional rewarded videos give in-game power-ups.

Where the law requires it, Google's consent form asks for your choice before personalised ads are shown. If you do not agree, you may still see non-personalised ads, which are based on things such as the game you are in and your approximate location from your IP address.

Google processes advertising data under its own terms. See [how Google uses information from apps that use its services](https://policies.google.com/technologies/partner-sites) and [Google's advertising policy](https://policies.google.com/technologies/ads). We do not control the content of third-party ads.

## Analytics, crash reports and session replay
We use PostHog to see which screens are used, where problems happen and why the game crashes. Events are linked to your random Player ID, not to your name or email.

With your consent, adults may also have session replay recorded: a reconstruction of screens and taps, with text and images masked. You can turn analytics off in Settings, Privacy choices.

Our game servers also send match and economy events to PostHog so we can balance the game. The in-app analytics switch does not currently stop these server events. You can object to them by emailing us.

## Who we share information with
We share information only as follows:

| Recipient | Role | Their privacy information |
|---|---|---|
| Supabase | Database | [supabase.com/privacy](https://supabase.com/privacy) |
| Render | Server hosting | [render.com/privacy](https://render.com/privacy) |
| Redis Cloud | Matchmaking, rate limits, live state | [redis.io/legal/privacy-policy](https://redis.io/legal/privacy-policy/) |
| PostHog | Analytics, crash reports, session replay | [posthog.com/privacy](https://posthog.com/privacy) |
| Google (AdMob and consent form) | Advertising | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Apple and Google | App distribution through their stores | Their own store policies |
| Other players | See your display name, avatar, cosmetics, rank and public statistics | Not applicable |
| Authorities, courts, advisers | When the law requires it, or to protect players, the game or legal rights | Not applicable |
| A future owner | If the game is sold, merged or transferred, subject to this policy | Not applicable |

We do not sell your personal information for money. Advertising through AdMob with personalised ads may be treated as "sharing" or "targeted advertising" under some US state laws; you can opt out as described under "Your choices".

## What other players can see
Other players can see your display name, username, avatar, cosmetic items, rank, results and public match statistics, including on leaderboards, in friend search and in challenge links you share. Anyone who has a challenge link can open it. Do not use your real name or other personal information as your display name.

## Bots
If no player is found quickly, you may play a computer-controlled opponent with a made-up name.

## Legal bases (EEA, UK and Switzerland)

| Purpose | Legal basis |
|---|---|
| Running your account, matches, progress and features | Performance of a contract with you |
| Analytics, session replay, personalised ads | Your consent |
| Anti-cheat, security, fraud prevention, non-personalised ads, server game-balance events, correct records for opponents | Our legitimate interests in a fair, safe and working game |
| Answering rights requests, recording deletions, responding to authorities | Legal obligation |

You may withdraw consent at any time. Withdrawing it does not make earlier processing unlawful.

## Automated checks
Anti-cheat checks look at tap timing patterns and give a risk level. They help us find scripts and auto-tappers. If a score, reward or account is affected and you think this is wrong, email us with your player tag and ask for a person to review it.

## Children and teenagers
TapTap is not directed at children under 13, or under a higher minimum age where your country sets one.

You enter your date of birth on a neutral age screen. Under 13: the game is not available, no account is created and no analytics are collected. We use the date once to work out your age group and do not store it.

Players aged 13 to 17 do not get session replay, and usage analytics is off unless turned on. Ads are non-personalised by default. In India and the United States teens see standard ad settings unless the region requires consent. A parent or guardian should review this policy with anyone under the age of majority.

If you think a child under 13 used TapTap, email us with the display name. We close the account and delete its data.

## How long we keep information
The table above gives the period for each kind of data. In general we keep information while your account exists and as long as needed for the purpose it was collected, then delete or anonymise it. Guest accounts inactive for 24 months are anonymised. We may keep information longer where the law requires it or where it is needed for a legal claim. Copies in backups expire on each provider's schedule.

## Deleting your account and data
You can delete your account in the app or through our request process. See [delete your TapTap account](/taptap/delete-account). Deletion removes or anonymises account data as shown in the table. Match records, reward records and some safety reports stay in anonymised form so that other players' results and balances remain correct.

Uninstalling the game removes it from your phone but does not by itself delete server data. Information already held by Google, such as advertising data, is managed under Google's own controls.

## Your choices
- **Analytics and session replay**: Settings, Privacy choices.
- **Ads**: Settings, Privacy choices, Ad privacy options.
- **iPhone tracking**: device Settings, Privacy and Security, Tracking.
- **Android ads**: device Settings, Google, Ads, where you can reset or delete your advertising ID.
- **Display name and avatar**: change them in the game.
- **Blocking and reporting players**: from within the game.

## Your rights
Depending on where you live, you may have the right to:
- know whether we hold information about you and get a copy of it
- correct information that is wrong or incomplete
- delete information
- restrict or object to some processing
- receive your information in a portable format
- withdraw consent
- opt out of sale, sharing or targeted advertising
- appeal a refusal of your request
- not be treated worse for using a right

Email the address at the bottom of this page with your display name or player tag. Because accounts are anonymous, we may ask for your deletion code or other details that show the account is yours. We answer within the time the law requires. Using a right costs nothing unless a request is clearly excessive or the law allows a fee.

### European Economic Area, United Kingdom and Switzerland
You have the GDPR or UK GDPR rights listed above and may complain to your local supervisory authority, or to the Information Commissioner's Office in the UK.

### United States, including California
Residents of California and other states with privacy laws may ask to know, access, correct and delete personal information and to opt out of sale or sharing. The categories we collect are identifiers, game activity, device and network information, approximate location from IP address, advertising information and what you send us. We do not knowingly sell or share the personal information of players under 16 for money. You may use an authorised agent if you give them written permission.

### India
Under the Digital Personal Data Protection Act, 2023 you may ask to access, correct and erase your personal data, withdraw consent, nominate a person to act for you, and raise a grievance. See the [grievance officer](/grievance-officer). If it is not resolved, you may approach the Data Protection Board of India.

### Brazil, Canada, Australia and other places
You may have rights to access, correct and delete information and to complain to your privacy regulator. Email us and we will handle your request under the law that applies to you.

## International transfers
We are based in India and our providers, including Google, PostHog, Supabase, Render and Redis Cloud, may process information in the United States and other countries. Privacy laws there may differ from yours. Where the law requires a transfer safeguard, such as standard contractual clauses, we rely on the safeguards offered by those providers.

## Security
Data travels over HTTPS and WSS, results are checked on our servers and sign-in tokens are hashed. Access to our systems is limited. No system is completely secure, and we cannot guarantee that information will never be accessed, lost or changed without permission. If a breach affects you, we will tell you and the authorities where the law requires it.

## Do Not Track
TapTap is an app and does not respond to browser "Do Not Track" signals. Use the in-app and device controls described above.

## Changes to this policy
We may update this policy when the game, our providers or the law change. The date at the top shows the latest version. Material changes are shown in the app for you to accept.

## Contact
For questions, requests or complaints about privacy, email the address at the bottom of this page and mention "TapTap". See also [support](/taptap/support), [terms](/taptap/terms) and the [grievance officer](/grievance-officer).
