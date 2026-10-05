# Currency Tier List

Rank fungible currencies and non-fungible collections on one board, then post the list to X.

The main switch is **Currencies** (fungible) and **NFTs** (non-fungible). A posted list has 15 to 50 entries. The community page shows the tier each asset lands in most often.

## Setup

```bash
npm install
npm run seed
npm run dev
```

Coin and NFT names and logos come from the CoinGecko Pro API and are stored in Postgres. `npm run seed` is enough to refresh that catalog; the app does not keep market caps up to date.

## Posting to X

Create an app at [developer.x.com](https://developer.x.com/en/portal/dashboard) with OAuth 2.0 and Read and write permissions. Set the callback URL to:

`http://localhost:3000/api/auth/callback/twitter`

Put the client id and secret in `.env.local` as `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`, then restart. Sign in on the site and use **Post to X**. The tweet is the public link to that user’s list.
