import express from 'express';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { query, history = [] } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const dbPath = path.join(process.cwd(), 'db');
    if (!fs.existsSync(path.join(dbPath, 'hnswlib.index'))) {
       return res.status(400).json({ error: 'No documents have been indexed yet. Please upload a file first.' });
    }

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2",
    });

    const vectorStore = await HNSWLib.load(dbPath, embeddings);
    const retriever = vectorStore.asRetriever({ k: 4 });
    const searchedChunks = await retriever.invoke(query);

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0,
    });

    const system_prompt = `You are a helpful and conversational AI Assistant. Your task is to answer the user's questions based strictly on the context provided below, which comes from an uploaded document.
    
Rules: 
- Always maintain a polite and conversational tone.
- You MUST answer the user's questions based ONLY on the provided context.
- If the answer to the user's question cannot be found in the provided context, politely inform the user that you do not have that information in the uploaded document. Do not attempt to guess or provide information from outside the context.
- Never mention the "context block" or "uploaded document" in a robotic way, just act naturally as an assistant who has read the document.

Context: ${JSON.stringify(searchedChunks.map(c => c.pageContent))}`;

    const messages = [
        ["system", system_prompt]
    ];
    
    history.forEach(msg => {
      if (msg.role && msg.content) {
         messages.push([msg.role, msg.content]);
      }
    });
    
    messages.push(["human", query]);

    const response = await llm.invoke(messages);

    res.json({ answer: response.content });

  } catch (error) {
    console.error('Error during chat:', error);
    res.status(500).json({ error: 'Internal server error during chat' });
  }
});

export default router;
