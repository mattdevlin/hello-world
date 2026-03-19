import 'dotenv/config';

export const config = {
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    portalId: process.env.HUBSPOT_PORTAL_ID,
  },
  gmail: {
    credentialsPath: process.env.GMAIL_CREDENTIALS_PATH || './credentials.json',
    tokenPath: process.env.GMAIL_TOKEN_PATH || './token.json',
  },
};
