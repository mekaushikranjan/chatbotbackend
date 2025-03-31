import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Define the Google Gemini API URL using your API key from the environment
const GOOGLE_GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// In-memory conversation store
const conversations = {};

// Helper to ensure session management
function getSessionId(req) {
  let sessionId = req.headers['x-session-id'] || req.query.sessionId;
  if (!sessionId) {
    sessionId = uuidv4(); // Generate unique session ID if missing
  }
  if (!conversations[sessionId]) {
    conversations[sessionId] = [{ role: 'system', content: 'You are a helpful AI assistant.' }];
  }
  return sessionId;
}

// Helper function to call the Google Gemini API and extract the generated text
async function getAIResponse(userMessage) {
  try {
    const payload = {
      contents: [
        {
          parts: [
            {
              text: userMessage
            }
          ]
        }
      ]
    };

    const response = await axios.post(GOOGLE_GEMINI_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    // Expected response structure:
    // {
    //   "candidates": [
    //     {
    //       "content": {
    //         "parts": [
    //           { "text": "Generated text here" }
    //         ]
    //       }
    //     }
    //   ]
    // }
    if (data && Array.isArray(data.candidates) && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && Array.isArray(candidate.content.parts) && candidate.content.parts.length > 0) {
        return candidate.content.parts[0].text || 'No response generated.';
      }
    }
    return 'No response generated.';
  } catch (error) {
    console.error('Error fetching AI response:', error.response?.data || error.message);
    return 'The AI is currently unavailable. Please try again later.';
  }
}

// Root Route
app.get('/', (req, res) => {
  res.send('AI Chatbot Backend is Running!');
});

// Chat Route
app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const sessionId = getSessionId(req);
  conversations[sessionId].push({ role: 'user', content: message });

  try {
    const aiResponse = await getAIResponse(message);
    conversations[sessionId].push({ role: 'bot', content: aiResponse });
    res.json({ reply: { content: aiResponse, sessionId } });
  } catch (error) {
    console.error('Error during chat:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Conversation History
app.get('/history', (req, res) => {
  const sessionId = getSessionId(req);
  res.json({ sessionId, history: conversations[sessionId] });
});

// Reset Conversation
app.post('/reset', (req, res) => {
  const sessionId = getSessionId(req);
  conversations[sessionId] = [{ role: 'system', content: 'You are a helpful AI assistant.' }];
  res.json({ message: 'Conversation has been reset.', sessionId });
});

// Server Initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
