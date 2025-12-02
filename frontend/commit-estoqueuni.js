// commit-estoqueuni.js
import { spawnSync } from "child_process";
import axios from "axios";
import dotenv from "dotenv";
import readline from "readline";
import path from "node:path";
import fs from "fs";
import { fileURLToPath } from "node:url";

const SPAWN_BUFFER = 50 * 1024 * 1024;

// Obter diretório raiz do git
const gitRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
  maxBuffer: SPAWN_BUFFER,
  cwd: process.cwd()
});

const REPO_ROOT = gitRootResult.error || gitRootResult.status !== 0
  ? path.resolve(process.cwd(), "../../../")
  : gitRootResult.stdout.trim();

process.chdir(REPO_ROOT);

// Carregar .env do backend
const backendEnvPath = REPO_ROOT.endsWith('apps/estoqueuni')
  ? path.resolve(REPO_ROOT, "backend/.env")
  : path.resolve(REPO_ROOT, "apps/estoqueuni/backend/.env");

console.log(`🔍 Tentando carregar .env de: ${backendEnvPath}`);
console.log(`🔍 Arquivo existe? ${fs.existsSync(backendEnvPath)}`);

if (fs.existsSync(backendEnvPath)) {
  const result = dotenv.config({ path: backendEnvPath, override: true });
  if (result.error) {
    console.warn(`⚠️  Erro ao carregar .env:`, result.error.message);
  } else {
    console.log(`✅ .env carregado com sucesso`);
  }
} else {
  console.warn(`⚠️  Arquivo .env não encontrado: ${backendEnvPath}`);
}

// Configuração do provider
const MODELO_USADO_NO_COMMIT = process.env.MODELO_usado_no_commit;
const OPENAI_MODEL_ENV = process.env.OPENAI_MODEL;
const OPENAI_API_KEY_ENV = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const TARGET_OPENAI_MODEL =
  MODELO_USADO_NO_COMMIT === "OPENAI_MODEL" ? OPENAI_MODEL_ENV : MODELO_USADO_NO_COMMIT;

console.log(`🔍 MODELO_usado_no_commit: ${MODELO_USADO_NO_COMMIT || 'não definido'}`);
console.log(`🔍 OPENAI_MODEL: ${OPENAI_MODEL_ENV || 'não definido'}`);
console.log(`🔍 OPENAI_API_KEY: ${OPENAI_API_KEY_ENV ? 'EXISTE' : 'NÃO EXISTE'}`);
console.log(`🔍 GEMINI_API_KEY: ${GEMINI_API_KEY ? 'EXISTE' : 'NÃO EXISTE'}`);
console.log(`🔍 GEMINI_MODEL: ${GEMINI_MODEL}`);

// Determinar qual provider usar
const USAR_OPENAI_POR_CONFIG =
  TARGET_OPENAI_MODEL &&
  OPENAI_MODEL_ENV &&
  TARGET_OPENAI_MODEL === OPENAI_MODEL_ENV &&
  OPENAI_API_KEY_ENV;

console.log(`🔍 USAR_OPENAI_POR_CONFIG: ${USAR_OPENAI_POR_CONFIG ? 'SIM' : 'NÃO'}`);

const AI_PROVIDER = USAR_OPENAI_POR_CONFIG
  ? "openai"
  : GEMINI_API_KEY
  ? "gemini"
  : OPENAI_API_KEY_ENV
  ? "openai"
  : null;

const OPENAI_API_KEY = OPENAI_API_KEY_ENV;
const OPENAI_MODEL = USAR_OPENAI_POR_CONFIG ? OPENAI_MODEL_ENV : "gpt-4o-mini";

if (!AI_PROVIDER) {
  console.error("❌ Nenhuma chave de IA configurada. Configure GEMINI_API_KEY ou OPENAI_API_KEY no .env");
  process.exit(1);
}

if (USAR_OPENAI_POR_CONFIG) {
  console.log(`✅ Usando: OpenAI (${OPENAI_MODEL}) - via MODELO_usado_no_commit`);
} else {
  console.log(`✅ Usando: ${AI_PROVIDER === "openai" ? `OpenAI (${OPENAI_MODEL})` : `Gemini (${GEMINI_MODEL})`}`);
}

// Funções auxiliares
const run = (cmd, args = [], opts = {}) => {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    maxBuffer: SPAWN_BUFFER,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Comando falhou: ${cmd} ${args.join(" ")}`);
};

const runGet = (cmd, args = [], opts = {}) => {
  const res = spawnSync(cmd, args, {
    encoding: "utf-8",
    maxBuffer: SPAWN_BUFFER,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Comando falhou: ${cmd} ${args.join(" ")}`);
  return (res.stdout || "").toString().trim();
};

const ensureChangesToCommit = () => {
  const porcelainResult = spawnSync("git", ["status", "--porcelain", "."], {
    encoding: "utf-8",
    maxBuffer: SPAWN_BUFFER,
  });
  if (
    porcelainResult.error ||
    porcelainResult.status !== 0 ||
    !porcelainResult.stdout.trim()
  ) {
    console.log("Nenhuma alteração para commitar. Abortando.");
    process.exit(0);
  }
};

const buildStagedContext = () => {
  try {
    const nameStatus = runGet("git", ["diff", "--staged", "--name-status"]);
    const shortstat = runGet("git", ["diff", "--staged", "--shortstat"]);

    let patch = "";
    try {
      patch = runGet("git", [
        "diff",
        "--staged",
        "-U0",
        "--diff-filter=d",
        "--",
        ".",
        ":(exclude)package-lock.json",
        ":(exclude)pnpm-lock.yaml",
        ":(exclude)yarn.lock",
        ":(exclude)*.lock",
        ":(exclude)dist",
        ":(exclude)build",
        ":(exclude)*.jpg",
        ":(exclude)*.jpeg",
        ":(exclude)*.png",
        ":(exclude)*.gif",
        ":(exclude)*.svg",
        ":(exclude)*.webp",
      ]);
    } catch (err) {
      patch = "(patch muito grande, usando apenas lista de arquivos)";
    }

    const MAX_PATCH = 4500;
    if (patch.length > MAX_PATCH) {
      patch = patch.slice(0, MAX_PATCH) + "\n…(truncado)";
    }

    const branch = runGet("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const repo = runGet("git", ["rev-parse", "--show-toplevel"]).split("/").pop();

    return `repo: ${repo}\nbranch: ${branch}\n` +
           `arquivos (name-status):\n${nameStatus || "(vazio)"}\n\n` +
           `shortstat:\n${shortstat || "(vazio)"}\n\n` +
           `patch relevante (trechos):\n${patch || "(vazio)"}\n`;
  } catch (err) {
    console.warn("⚠️  Erro ao construir contexto:", err.message);
    try {
      const nameStatus = runGet("git", ["diff", "--staged", "--name-only"]);
      return `Arquivos modificados:\n${nameStatus}`;
    } catch {
      return "Não foi possível obter contexto do git";
    }
  }
};

const ensureBranch = (targetBranch) => {
  const currentBranch = runGet("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (currentBranch === targetBranch) return;

  console.log(`\n[git] Alternando branch para ${targetBranch}…`);
  try {
    runGet("git", ["rev-parse", "--verify", targetBranch]);
    run("git", ["checkout", targetBranch]);
  } catch {
    run("git", ["checkout", "-B", targetBranch]);
  }
};

const normalizeCommit = (raw) => {
  if (!raw) return "";
  let s = String(raw)
    .replace(/```/g, "")
    .replace(/^["'""`]+|["'""`]+$/g, "")
    .replace(/\r/g, "")
    .trim();

  const lines = s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  
  const firstValid =
    lines.find((l) => /^[a-z]+(\([\w\-./,@ ]+\))?:\s+.+/i.test(l)) ||
    lines[0] ||
    "";

  let title = firstValid.replace(/\s+/g, " ").trim();
  const MAX = 300;
  if (title.length > MAX) title = title.slice(0, MAX - 1) + "…";
  return title;
};

const generateAIMessageWithGemini = async (context) => {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não definida.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: "Você gera mensagens de commit no padrão Conventional Commits (pt-BR). " +
                  "Com base no CONTEXTO abaixo (arquivos alterados e trechos do diff), " +
                  'responda **APENAS** com UMA única linha no formato "tipo(scope opcional): descrição". ' +
                  "Sem explicações, sem crases, sem markdown, sem múltiplas linhas. " +
                  "A descrição deve refletir precisamente as mudanças. " +
                  "Tipos possíveis: feat, fix, perf, refactor, chore, test, docs, build, ci. " +
                  "Máximo de 300 caracteres.\n\n" +
                  "--- CONTEXTO ---\n" +
                  context,
          }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 100,
        },
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 14000,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    const raw = resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) throw new Error("Resposta vazia do Gemini.");
    return normalizeCommit(raw);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
};

const generateAIMessageWithOpenAI = async (context) => {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não definida.");
  if (!OPENAI_MODEL) throw new Error("OPENAI_MODEL não definido.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const userContent =
      "Você gera mensagens de commit no padrão Conventional Commits (pt-BR). " +
      'Com base no CONTEXTO abaixo (arquivos alterados e trechos do diff), ' +
      'responda **APENAS** com UMA única linha no formato "tipo(scope opcional): descrição". ' +
      "Sem explicações, sem crases, sem markdown, sem múltiplas linhas. " +
      "A descrição deve refletir precisamente as mudanças. " +
      "Tipos possíveis: feat, fix, perf, refactor, chore, test, docs, build, ci. " +
      "Máximo de 300 caracteres.\n\n" +
      "--- CONTEXTO ---\n" +
      context;

    const resp = await axios.post(
      "https://api.openai.com/v1/responses",
      {
        model: OPENAI_MODEL,
        max_output_tokens: 400,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "Você gera mensagens de commit no padrão Conventional Commits (pt-BR).",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: userContent,
              },
            ],
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 14000,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    const outputData = resp?.data || {};
    const output = outputData.output || [];
    const raw = [
      ...(typeof outputData.output_text === "string" ? [outputData.output_text] : []),
      ...(typeof outputData.response?.output_text === "string" ? [outputData.response.output_text] : []),
      ...output
        .flatMap((chunk) => {
          if (!chunk || !Array.isArray(chunk.content)) return [];
          return chunk.content;
        })
        .map((part) => {
          if (!part) return "";
          if (typeof part === "string") return part;
          if (typeof part.text === "string") return part.text;
          if (typeof part.output_text === "string") return part.output_text;
          if (typeof part.value === "string") return part.value;
          if (Array.isArray(part.content))
            return part.content
              .map((item) => (item?.text ? item.text : item?.value || item?.output_text || ""))
              .join("\n");
          return "";
        }),
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!raw) {
      console.error("⚠️  Resposta sem conteúdo da OpenAI:", JSON.stringify(resp?.data || {}, null, 2));
      throw new Error("Resposta vazia da OpenAI.");
    }
    return normalizeCommit(raw);
  } catch (err) {
    clearTimeout(timeout);
    console.error("⚠️  Detalhe do erro da OpenAI:", err?.response?.data || err.message || err);
    if (err?.response?.data) {
      try {
        console.error("⚠️  Resposta bruta da OpenAI:", JSON.stringify(err.response.data, null, 2));
      } catch {
        /* ignore */
      }
    }
    if (err?.response && err.response.data && !err.response.data.output && err.response.data.response) {
      try {
        console.error("⚠️  Campo response da OpenAI:", JSON.stringify(err.response.data.response, null, 2));
      } catch {
        /* ignore */
      }
    }
    throw err;
  }
};

const generateAIMessage = async (context) => {
  if (AI_PROVIDER === "gemini") {
    return await generateAIMessageWithGemini(context);
  } else if (AI_PROVIDER === "openai") {
    return await generateAIMessageWithOpenAI(context);
  }
  throw new Error(`Provider desconhecido: ${AI_PROVIDER}`);
};

const promptManualCommitMessage = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));
  
  try {
    while (true) {
      const answer = (await question("\nInforme a descrição do commit: ")).trim();
      if (answer) {
        return answer;
      }
      console.log("Descrição não pode ser vazia. Tente novamente.");
    }
  } finally {
    rl.close();
  }
};

const hasRemote = (remoteName = "origin") => {
  try {
    runGet("git", ["remote", "get-url", remoteName]);
    return true;
  } catch {
    return false;
  }
};

// Main
(async function main() {
  try {
    const TARGET_BRANCH = process.env.ESTOQUEUNI_COMMIT_BRANCH || "main";
    
    ensureChangesToCommit();
    ensureBranch(TARGET_BRANCH);
    run("git", ["add", "--all", "."]);

    let commitMessage = "";

    try {
      console.log("\n🤖 Gerando mensagem de commit com IA...");
      const ctx = buildStagedContext();
      commitMessage = await generateAIMessage(ctx);

      if (!commitMessage) throw new Error("IA não retornou mensagem de commit.");
      console.log("\n✅ Mensagem gerada:", commitMessage);
    } catch (error) {
      console.log("\n⚠️  Falha ao gerar com IA:", error.message);
      console.log("📝 Digite a mensagem de commit manualmente:\n");
      commitMessage = await promptManualCommitMessage();
      console.log("\n✅ Mensagem informada:", commitMessage);
    }

    run("git", ["commit", "-m", commitMessage]);

    if (hasRemote("origin")) {
      try {
        run("git", ["push"]);
        console.log("\n✅ Push realizado com sucesso!");
      } catch (err) {
        run("git", ["push", "-u", "origin", TARGET_BRANCH]);
        console.log("\n✅ Push realizado com sucesso!");
      }
    } else {
      console.log("\nℹ️  Nenhum remoto configurado. Commit criado apenas localmente.");
    }
  } catch (err) {
    console.error("\n❌ Erro:", err.message || err);
    process.exit(1);
  }
})();
