import chokidar from "chokidar";
import { DocumentProcessor } from "./documentProcessor.js";
import { HybridRetrieval } from "./hybridRetrieval.js";
import logger from "../../utils/logger.js";

export class UpdatePipeline {
  constructor(docsPath) {
    this.docsPath = docsPath;
    this.processor = new DocumentProcessor(docsPath);
    this.retrieval = new HybridRetrieval();
    this.watcher = null;
  }

  async initialIndex() {
    logger.info("Starting initial indexing...");
    const documents = await this.processor.loadAllDocuments();
    const flatDocs = documents.flat();
    await this.retrieval.indexDocuments(flatDocs);
    logger.info("✅ Initial indexing complete");
  }

  startWatching() {
    this.watcher = chokidar.watch(`${this.docsPath}/**/*.md`, {
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on("change", async (path) => {
      logger.info(`Document changed: ${path}`);
      await this.reindexDocument(path);
    });

    this.watcher.on("add", async (path) => {
      logger.info(`Document added: ${path}`);
      await this.reindexDocument(path);
    });

    logger.info("📁 Watching for documentation changes...");
  }

  async reindexDocument(filePath) {
    try {
      const relativePath = filePath.replace(this.docsPath + "/", "");
      const doc = await this.processor.processMarkdownFile(
        filePath,
        relativePath
      );

      if (doc) {
        await this.retrieval.indexDocuments(doc);
        logger.info(`✅ Reindexed: ${relativePath}`);
      }
    } catch (error) {
      logger.error(`Error reindexing ${filePath}:`, error);
    }
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      logger.info("Stopped watching for changes");
    }
  }
}




















