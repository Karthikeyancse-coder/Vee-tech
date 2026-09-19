import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const newsdataKey = process.env.NEWSDATA_API_KEY;

async function testNewsDataReg() {
  try {
    const regResp = await axios.post(
      `https://newsdata.io/api/1/websocket/register?apikey=${newsdataKey}&q=Infosys&language=en`,
      {},
      { timeout: 8000 }
    );
    console.log('✅ NewsData Register POST Success:', regResp.status, regResp.data);
  } catch (err) {
    console.log('⚠️ NewsData Register POST Error:', err.response?.status, err.response?.data || err.message);
  }

  try {
    const regGetResp = await axios.get(
      `https://newsdata.io/api/1/websocket/register?apikey=${newsdataKey}&q=Infosys&language=en`,
      { timeout: 8000 }
    );
    console.log('✅ NewsData Register GET Success:', regGetResp.status, regGetResp.data);
  } catch (err) {
    console.log('⚠️ NewsData Register GET Error:', err.response?.status, err.response?.data || err.message);
  }
}

testNewsDataReg();
