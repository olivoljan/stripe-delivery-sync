import Stripe from 'stripe';
import { google } from 'googleapis';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  try {
    // Fetch charges from the past 24 hours
    const since = Math.floor(Date.now() / 1000) - 86400;
    const charges = await stripe.charges.list({
      created: { gte: since },
      limit: 100,
    });

    let delivered = 0;
    let canceled = 0;
    charges.data.forEach((charge) => {
      if (charge.status === 'succeeded') {
        delivered += 1;
      } else if (charge.status === 'canceled' || charge.refunded) {
        canceled += 1;
      }
    });
    const planned = delivered + canceled;

    // Authenticate with Google Sheets API
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Data',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString().split('T')[0], planned, delivered, canceled]],
      },
    });

    res.status(200).json({ success: true, planned, delivered, canceled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
