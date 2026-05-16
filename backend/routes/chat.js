import express from 'express';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { z } from "zod";
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

    // 1. Relevance Grader
    const graderLlm = llm.withStructuredOutput(
      z.object({
        score: z.enum(["yes", "no"]).describe("Relevance score, 'yes' if the document is relevant to the query, 'no' otherwise"),
      }),
      { name: "grade_document" }
    );

    const graderPrompt = `You are a grader assessing relevance of a retrieved document to a user question.
If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.
It does not need to be a stringent test. The goal is to filter out erroneous retrievals.
Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question.`;

    const relevantChunks = [];
    for (const chunk of searchedChunks) {
      const messages = [
        ["system", graderPrompt],
        ["human", `Retrieved document: \n\n ${chunk.pageContent} \n\n User question: ${query}`]
      ];
      try {
        const grade = await graderLlm.invoke(messages);
        if (grade && grade.score === "yes") {
          relevantChunks.push(chunk.pageContent);
        }
      } catch (e) {
        console.error("Grader error:", e);
      }
    }

    // 2. Web Search Fallback
    let finalContext = "";
    let isFromWeb = false;

    if (relevantChunks.length === 0) {
      console.log("No relevant chunks found in document. Falling back to web search.");
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (tavilyKey) {
        try {
          const tool = new TavilySearchResults({
            maxResults: 3,
            apiKey: tavilyKey,
          });
          const searchResults = await tool.invoke(query);
          finalContext = searchResults; // String output from Tavily tool invoke
          isFromWeb = true;
        } catch (e) {
          console.error("Tavily search error:", e);
          finalContext = "No relevant context found in document, and web search failed due to an error.";
        }
      } else {
        console.warn("TAVILY_API_KEY not found in environment. Web search skipped.");
        finalContext = "No relevant context found in the uploaded document, and web search is not configured.";
      }
    } else {
      finalContext = relevantChunks.join("\n\n");
    }

    // 3. Final Generation
    const system_prompt = `You are a helpful and conversational AI Assistant. Your task is to answer the user's questions based strictly on the context provided below.
    
Rules: 
- Always maintain a polite and conversational tone.
- You MUST answer the user's questions based ONLY on the provided context.
- If the answer to the user's question cannot be found in the provided context, politely inform the user that you do not have that information. Do not attempt to guess or provide information from outside the context.
- Never mention the "context block" or "uploaded document" in a robotic way, just act naturally as an assistant who has read the context.

Context source: ${isFromWeb ? 'Web Search' : 'Uploaded Document'}
Context: ${finalContext}`;

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
