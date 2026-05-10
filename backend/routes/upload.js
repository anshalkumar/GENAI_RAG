import express from 'express';
import multer from 'multer';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
class TextLoader {
  constructor(filePath) {
    this.filePath = filePath;
  }
  async load() {
    const text = fs.readFileSync(this.filePath, 'utf-8');
    return [{ pageContent: text, metadata: { source: this.filePath } }];
  }
}
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const extension = path.extname(originalName).toLowerCase();

    let loader;
    if (extension === '.pdf') {
      loader = new PDFLoader(filePath);
    } else if (extension === '.txt') {
      loader = new TextLoader(filePath);
    } else if (extension === '.csv') {
      loader = new CSVLoader(filePath);
    } else if (extension === '.docx') {
      loader = new DocxLoader(filePath);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file type. Please upload .pdf, .txt, .csv, or .docx' });
    }

    const docs = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 200,
    });
    
    const splitDocs = await textSplitter.splitDocuments(docs);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "gemini-embedding-2", // Standard gemini embedding model
    });

    const dbPath = path.join(process.cwd(), 'db');
    
    let vectorStore;
    if (fs.existsSync(path.join(dbPath, 'hnswlib.index'))) {
      vectorStore = await HNSWLib.load(dbPath, embeddings);
      await vectorStore.addDocuments(splitDocs);
    } else {
      vectorStore = await HNSWLib.fromDocuments(splitDocs, embeddings);
    }
    
    await vectorStore.save(dbPath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ message: 'File processed and indexed successfully', chunks: splitDocs.length });
  } catch (error) {
    console.error('Error during upload/processing:', error);
    res.status(500).json({ error: 'Internal server error during processing. Check logs.' });
  }
});

export default router;
