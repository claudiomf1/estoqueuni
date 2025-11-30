export class StreamHandler {
  static async handleStream(generator, res) {
    try {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of generator) {
        if (chunk.type === "chunk") {
          res.write(
            `data: ${JSON.stringify({
              type: "chunk",
              content: chunk.content,
            })}\n\n`
          );
        } else if (chunk.type === "done") {
          res.write(
            `data: ${JSON.stringify({
              type: "done",
              metadata: chunk.metadata,
            })}\n\n`
          );
        } else if (chunk.type === "error") {
          res.write(
            `data: ${JSON.stringify({ type: "error", error: chunk.error })}\n\n`
          );
        }
      }

      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`
      );
      res.end();
    }
  }

  static formatSSE(data) {
    return `data: ${JSON.stringify(data)}\n\n`;
  }
}




















