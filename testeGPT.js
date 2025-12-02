import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("Defina OPENAI_API_KEY no ambiente antes de executar este script.");
}

const openai = new OpenAI({ apiKey });

const response = await openai.models.list();
response.data.forEach(m => console.log(m.id));
