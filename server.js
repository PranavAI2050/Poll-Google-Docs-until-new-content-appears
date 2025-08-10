// require('dotenv').config();
// const express = require('express');
// const axios = require('axios');
// const cors = require('cors'); 

// const app = express();
// app.use(express.json());
// app.use(cors());

// app.post('/start-flow', async (req, res) => {
//     const { topic, jsontemplate, url } = req.body;

//     if (!topic || !jsontemplate || !url) {
//         return res.status(400).json({ error: 'Missing required fields' });
//     }

//     try {
//         // Step 1: Call Flowise API
//         console.log('Calling Flowise...');
//         await axios.post(
//             process.env.FLOWISE_API_URL,
//             {
//                 overrideConfig: { topic, jsontemplate, url }
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${process.env.FLOWISE_API_KEY}`,
//                     'Content-Type': 'application/json'
//                 }
//             }
//         );

//         // Step 2: Poll Google Docs API every 10 seconds
//         console.log('Polling Google Docs API...');
//         const pollInterval = 10000; // 10 seconds

//         const checkDoc = async () => {
//             const docRes = await axios.get(`${process.env.GOOGLE_DOC_API_URL}?documentId=${process.env.DOCUMENT_ID}`);
//             if (docRes.data.message === 'Document is empty') {
//                 return null;
//             } else {
//                 return docRes.data.previousContent;
//             }
//         };

//         let attempts = 0;
//         const maxAttempts = 30; // 5 minutes max

//         const poll = async () => {
//             const result = await checkDoc();
//             attempts++;

//             if (result) {
//                 res.json({ status: 'done', content: result });
//                 return;
//             }

//             if (attempts >= maxAttempts) {
//                 res.status(408).json({ error: 'Timeout waiting for document content' });
//                 return;
//             }

//             setTimeout(poll, pollInterval);
//         };

//         poll();

//     } catch (err) {
//         console.error('Error:', err.message);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }
// });

// // Start server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });


require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors()); // Enable CORS for all origins
app.use(express.json());

app.post('/start-flow', async (req, res) => {
  const { topic, jsontemplate, url } = req.body;

  if (!topic || !jsontemplate || !url) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Call Flowise API but ignore response/errors so polling can continue immediately
    console.log('Calling Flowise API...');
    axios.post(
      process.env.FLOWISE_API_URL,
      { overrideConfig: { topic, jsontemplate, url } },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLOWISE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    ).catch((err) => {
      console.warn('Flowise API call failed or timed out, continuing anyway...', err.message);
    });

    // Poll Google Docs API until content found or timeout
    console.log('Polling Google Docs API...');
    const pollInterval = 10000; // 10 seconds
    const maxAttempts = 30; // 5 minutes max
    let attempts = 0;

    const checkDoc = async () => {
      try {
        const docRes = await axios.get(`${process.env.GOOGLE_DOC_API_URL}?documentId=${process.env.DOCUMENT_ID}`);
        if (docRes.data.message === 'Document is empty') {
          return null;
        }
        return docRes.data.previousContent;
      } catch (err) {
        console.warn('Error polling Google Docs API:', err.message);
        return null;
      }
    };

    const poll = async () => {
      const content = await checkDoc();
      attempts++;

      if (content) {
        return res.json({ status: 'done', content });
      }

      if (attempts >= maxAttempts) {
        return res.status(408).json({ error: 'Timeout waiting for document content' });
      }

      setTimeout(poll, pollInterval);
    };

    poll();

  } catch (err) {
    console.error('Unexpected server error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
