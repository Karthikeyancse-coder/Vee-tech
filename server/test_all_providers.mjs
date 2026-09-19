import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function testAll() {
  console.log('Testing all configured providers:\n');

  // 1. NewsAPI
  try {
    const res = await axios.get(`https://newsapi.org/v2/everything?q=Infosys&pageSize=3&apiKey=${process.env.NEWSAPI_KEY}`, { timeout: 6000 });
    console.log('✅ NewsAPI: OK, status:', res.data.status, 'total:', res.data.totalResults);
  } catch (err) {
    console.log('❌ NewsAPI:', err.response?.status, err.response?.data?.message || err.message);
  }

  // 2. GNews
  try {
    const res = await axios.get(`https://gnews.io/api/v4/search?q=Infosys&max=3&token=${process.env.GNEWS_API_KEY}`, { timeout: 6000 });
    console.log('✅ GNews: OK, total:', res.data.totalArticles);
  } catch (err) {
    console.log('❌ GNews:', err.response?.status, err.response?.data?.message || err.message);
  }

  // 3. Currents API
  try {
    const res = await axios.get(`https://api.currentsapi.services/v1/search?keywords=Infosys&apiKey=${process.env.CURRENTS_API_KEY}`, { timeout: 6000 });
    console.log('✅ Currents: OK, status:', res.data.status, 'news count:', res.data.news?.length);
  } catch (err) {
    console.log('❌ Currents:', err.response?.status, err.response?.data?.message || err.message);
  }

  // 4. The Guardian
  try {
    const res = await axios.get(`https://content.guardianapis.com/search?q=Infosys&api-key=${process.env.GUARDIAN_API_KEY}`, { timeout: 6000 });
    console.log('✅ The Guardian: OK, status:', res.data.response?.status, 'total:', res.data.response?.total);
  } catch (err) {
    console.log('❌ The Guardian:', err.response?.status, err.response?.data?.message || err.message);
  }

  // 5. Google RSS
  try {
    const res = await axios.get('https://news.google.com/rss/search?q=Infosys&hl=en-IN&gl=IN&ceid=IN:en', { timeout: 6000 });
    console.log('✅ Google News RSS: OK, length:', res.data?.length);
  } catch (err) {
    console.log('❌ Google News RSS:', err.message);
  }

  // 6. Economic Times RSS
  try {
    const res = await axios.get('https://economictimes.indiatimes.com/tech/ites/rssfeeds/13357555.cms', { timeout: 6000 });
    console.log('✅ Economic Times RSS: OK, length:', res.data?.length);
  } catch (err) {
    console.log('❌ Economic Times RSS:', err.message);
  }
}

testAll();
