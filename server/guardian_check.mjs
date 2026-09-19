import axios from 'axios';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const key = process.env.GUARDIAN_API_KEY;
const q = encodeURIComponent('(Infosys OR TCS OR Wipro OR Accenture)');
const url = `https://content.guardianapis.com/search?q=${q}&show-fields=headline&order-by=newest&page-size=5&api-key=${key}`;

const res = await axios.get(url, { timeout: 10000 });
const results = res.data?.response?.results || [];
const now = Date.now();

console.log(`Guardian total matching articles: ${res.data?.response?.total}`);
console.log('');

for (const r of results) {
  const rawPub = r.webPublicationDate;
  // This is the EXACT field the Guardian adapter reads: r.webPublicationDate
  // It's a full ISO-8601 UTC string, e.g. "2026-09-19T14:23:05Z"
  const parsedMs = new Date(rawPub).getTime();
  const lagSec = Math.round((now - parsedMs) / 1000);
  const lagHours = (lagSec / 3600).toFixed(2);
  console.log(`RAW webPublicationDate: "${rawPub}" [full ISO-8601 UTC — NO timezone ambiguity]`);
  console.log(`Lag seconds: ${lagSec} | Lag hours: ${lagHours}h`);
  console.log(`Title: ${r.webTitle?.slice(0, 100)}`);
  console.log(`Section: ${r.sectionId}`);
  console.log('---');
}
