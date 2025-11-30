import fs from "fs/promises";
import path from "path";
import logger from "../../utils/logger.js";

export class DocumentProcessor {
  constructor(docsPath) {
    this.docsPath = docsPath;
  }

  async loadAllDocuments() {
    const documents = [];
    await this.processDirectory(this.docsPath, documents);
    logger.info(`Loaded ${documents.length} documents`);
    return documents;
  }

  async processDirectory(dir, documents, basePath = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        await this.processDirectory(fullPath, documents, relativePath);
      } else if (entry.name.endsWith(".md")) {
        const doc = await this.processMarkdownFile(fullPath, relativePath);
        if (doc) documents.push(doc);
      }
    }
  }

  async processMarkdownFile(filePath, relativePath) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const { frontmatter, mainContent } = this.parseFrontmatter(content);

      // Chunk document into smaller pieces for better retrieval
      const chunks = this.chunkDocument(mainContent, 500); // 500 words per chunk

      return chunks.map((chunk, index) => ({
        id: `${relativePath}_chunk_${index}`,
        filePath: relativePath,
        title: frontmatter.titulo || path.basename(filePath, ".md"),
        category: frontmatter.categoria || "geral",
        tags: frontmatter.tags || [],
        difficulty: frontmatter.dificuldade || "intermediario",
        content: chunk,
        fullContent: mainContent,
        metadata: {
          chunkIndex: index,
          totalChunks: chunks.length,
          lastUpdate:
            frontmatter.ultima_atualizacao || new Date().toISOString(),
        },
      }));
    } catch (error) {
      logger.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  parseFrontmatter(content) {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, mainContent: content };
    }

    const frontmatterText = match[1];
    const mainContent = match[2];

    const frontmatter = {};
    frontmatterText.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split(":");
      if (key && valueParts.length > 0) {
        let value = valueParts.join(":").trim();

        // Parse arrays
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim());
        }

        frontmatter[key.trim()] = value;
      }
    });

    return { frontmatter, mainContent };
  }

  chunkDocument(content, maxWords = 500) {
    // Remove excessive whitespace
    const cleanContent = content.replace(/\n{3,}/g, "\n\n").trim();

    // Split by headers first
    const sections = cleanContent.split(/(?=^#{1,3} )/m);

    const chunks = [];
    let currentChunk = "";
    let wordCount = 0;

    for (const section of sections) {
      const sectionWords = section.split(/\s+/).length;

      if (wordCount + sectionWords > maxWords && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = section;
        wordCount = sectionWords;
      } else {
        currentChunk += "\n\n" + section;
        wordCount += sectionWords;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [cleanContent];
  }
}




















