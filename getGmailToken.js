// getGmailTokens_desktop.js  (patched)
const { google } = require('googleapis');
const open       = require('open').default;   // ← .default added
const http       = require('http');

const CLIENT_ID     = '552455817014-pk326dqisou3tuq7nu8iekia1l2cp3ic.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI  = 'http://localhost:5485/oauth2callback';

const oauth2Client  = new google.auth.OAuth2(
  CLIENT_ID, CLIENT_SECRET, REDIRECT_URI
);

const SCOPES = ['https://mail.google.com/'];
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES
});

open(authUrl)          // now works
  .catch(() => console.log('\nOpen this URL manually:\n' + authUrl));

console.log('Waiting for Google OAuth response…');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) return;

  const url  = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');

  res.end('✅ Authorization received. You can close this tab.');
  server.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\nTOKENS:\n', JSON.stringify(tokens, null, 2));
    console.log('\nSave the refresh_token in .env as GMAIL_REFRESH_TOKEN');
  } catch (err) {
    console.error('\n❌ Error exchanging code:\n',
                  err.response?.data || err.message);
  }
}).listen(5485, () =>
  console.log('Listening on http://localhost:5485')
);