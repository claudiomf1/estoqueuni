// commit-ia.js
import { spawnSync } from "child_process";
import axios from "axios";
import dotenv from "dotenv";
import readline from "readline";
import path from "node:path";

const SPAWN_BUFFER = 50 * 1024 * 1024;

const run = (cmd, args = [], opts = {}) => {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    maxBuffer: SPAWN_BUFFER,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0)
    throw new Error(`Comando falhou: ${cmd} ${args.join(" ")}`);
};

const runGet = (cmd, args = [], opts = {}) => {
  const res = spawnSync(cmd, args, {
    encoding: "utf-8",
    maxBuffer: SPAWN_BUFFER,
    ...opts,
  });
  if (res.error) throw res.error;
  if (res.status !== 0)
    throw new Error(`Comando falhou: ${cmd} ${args.join(" ")}`);
  return (res.stdout || "").toString().trim();
};

const gitRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
});

let REPO_ROOT = "";
if (gitRootResult.error || gitRootResult.status !== 0) {
  REPO_ROOT = path.resolve(process.cwd());
  console.warn(
    "[commit-ia] Não foi possível obter o diretório raiz via git, utilizando diretório atual:",
    REPO_ROOT
  );
} else {
  REPO_ROOT = gitRootResult.stdout.trim();
}

// Diretório do script (onde está o .env do estoqueuni)
const SCRIPT_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname));

process.chdir(REPO_ROOT);

// Arquivo .env centralizado na raiz do projeto estoqueuni (onde está o script)
const centralizedEnvPath = path.resolve(SCRIPT_DIR, ".env");

const ENV_PATHS = [
  // Permite override via variável de ambiente (útil para testes/CI)
  process.env.ESTOQUEUNI_ENV_PATH,
  // Arquivo centralizado (única fonte de verdade)
  centralizedEnvPath,
].filter(Boolean);

// Carregar .env
let envLoaded = false;
for (const envPath of ENV_PATHS) {
  const result = dotenv.config({ path: envPath, override: false });
  if (result.error && result.error.code !== "ENOENT") {
    console.warn(`[commit-ia] Falha ao carregar ${envPath}:`, result.error);
  } else if (!result.error) {
    envLoaded = true;
    console.log(`[commit-ia] Arquivo .env carregado: ${envPath}`);
  }
}

// Suporte para Gemini, OpenAI ou Claude (Anthropic)
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.EstoqueUni_Gemini ||
  process.env.ESTOQUEUNI_GEMINI ||
  process.env.ESTOQUEUNI_GEMINI_API_KEY ||
  process.env.ESTOQUEUNI_GEMINI_TOKEN ||
  process.env.ESTOQUEUNI_GEMINI_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const OPENAI_API_KEY =
  process.env.EstoqueUni_GPT || process.env.ESTOQUEUNI_GPT;
const ANTHROPIC_API_KEY =
  process.env.EstoqueUni_CLAUDE || process.env.ESTOQUEUNI_CLAUDE;

const AI_PROVIDER = GEMINI_API_KEY
  ? "gemini"
  : ANTHROPIC_API_KEY
  ? "claude"
  : OPENAI_API_KEY
  ? "openai"
  : null;

if (AI_PROVIDER === "gemini") {
  console.log("Usando Gemini (Google): SIM 🚀");
} else if (AI_PROVIDER === "claude") {
  console.log("Usando Claude (Anthropic): SIM ✨");
} else if (AI_PROVIDER === "openai") {
  console.log("Usando OpenAI: SIM");
} else {
  console.log("Nenhuma chave de IA configurada (Gemini, OpenAI ou Claude)");
}

const createPrompt = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const question = (prompt) =>
    new Promise((resolve) => rl.question(prompt, resolve));
  return {
    question,
    close: () => rl.close(),
  };
};

const ensureChangesToCommit = () => {
  const porcelainResult = spawnSync(
    "git",
    ["status", "--porcelain"],
    {
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    }
  );
  if (
    porcelainResult.error ||
    porcelainResult.status !== 0 ||
    !porcelainResult.stdout.trim()
  ) {
    console.log(
      "Nenhuma alteração para commitar. Abortando."
    );
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
        ":(exclude)*.ico",
        ":(exclude)*.pdf",
        ":(exclude)*.woff",
        ":(exclude)*.woff2",
        ":(exclude)*.ttf",
        ":(exclude)*.eot",
      ]);
    } catch (err) {
      console.warn(
        "⚠️  Erro ao gerar patch completo, usando apenas lista de arquivos:",
        err.message
      );
      patch = "(patch muito grande, usando apenas lista de arquivos)";
    }

    const MAX_CTX = 6000;
    const MAX_PATCH = 4500;
    if (patch.length > MAX_PATCH)
      patch = patch.slice(0, MAX_PATCH) + "\n…(truncado)";

    const branch = runGet("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const repo = runGet("git", ["rev-parse", "--show-toplevel"])
      .split("/")
      .pop();

    let ctx =
      `repo: ${repo}\nbranch: ${branch}\n` +
      `arquivos (name-status):\n${nameStatus || "(vazio)"}\n\n` +
      `shortstat:\n${shortstat || "(vazio)"}\n\n` +
      `patch relevante (trechos):\n${patch || "(vazio)"}\n`;

    if (ctx.length > MAX_CTX)
      ctx = ctx.slice(0, MAX_CTX) + "\n…(contexto truncado)";
    return ctx;
  } catch (err) {
    console.warn("⚠️  Erro ao construir contexto completo:", err.message);
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
    run("git", ["rev-parse", "--verify", targetBranch]);
    run("git", ["checkout", targetBranch]);
  } catch {
    run("git", ["checkout", "-B", targetBranch]);
  }
};

const ensureRemoteForBranch = (targetBranch) => {
  try {
    runGet("git", ["rev-parse", "--abbrev-ref", `${targetBranch}@{u}`]);
  } catch {
    console.warn(
      `[Aviso] Nenhum upstream configurado para a branch ${targetBranch}. O push configurará automaticamente.`
    );
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
  const to = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text:
                  "Você gera mensagens de commit no padrão Conventional Commits (pt-BR). " +
                  "Com base no CONTEXTO abaixo (arquivos alterados e trechos do diff), " +
                  'responda **APENAS** com UMA única linha no formato "tipo(scope opcional): descrição". ' +
                  "Sem explicações, sem crases, sem markdown, sem múltiplas linhas. " +
                  "A descrição deve refletir precisamente as mudanças. " +
                  "Tipos possíveis: feat, fix, perf, refactor, chore, test, docs, build, ci. " +
                  "Máximo de 300 caracteres.\n\n" +
                  "--- CONTEXTO ---\n" +
                  context,
              },
            ],
          },
        ],
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
    clearTimeout(to);
    const raw = resp?.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!raw) throw new Error("Resposta vazia do Gemini.");
    return normalizeCommit(raw);
  } catch (err) {
    clearTimeout(to);
    throw err;
  }
};

const generateAIMessageWithClaude = async (context) => {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não definida.");

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 100,
        temperature: 0.2,
        system:
          "Você gera mensagens de commit no padrão Conventional Commits (pt-BR).",
        messages: [
          {
            role: "user",
            content:
              "Com base no CONTEXTO abaixo (arquivos alterados e trechos do diff), " +
              'responda **APENAS** com UMA única linha no formato "tipo(scope opcional): descrição". ' +
              "Sem explicações, sem crases, sem markdown, sem múltiplas linhas. " +
              "A descrição deve refletir precisamente as mudanças. " +
              "Tipos possíveis: feat, fix, perf, refactor, chore, test, docs, build, ci. " +
              "Máximo de 300 caracteres.\n\n" +
              "--- CONTEXTO ---\n" +
              context,
          },
        ],
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 14000,
        signal: controller.signal,
      }
    );
    clearTimeout(to);
    const raw = resp?.data?.content?.[0]?.text?.trim();
    if (!raw) throw new Error("Resposta vazia do Claude.");
    return normalizeCommit(raw);
  } catch (err) {
    clearTimeout(to);
    throw err;
  }
};

const generateAIMessageWithOpenAI = async (context) => {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não definida.");

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "Você gera mensagens de commit no padrão Conventional Commits (pt-BR).",
          },
          {
            role: "user",
            content:
              "Com base no CONTEXTO abaixo (arquivos alterados e trechos do diff), " +
              'responda **APENAS** com UMA única linha no formato "tipo(scope opcional): descrição". ' +
              "Sem explicações, sem crases, sem markdown, sem múltiplas linhas. " +
              "A descrição deve refletir precisamente as mudanças. " +
              "Tipos possíveis: feat, fix, perf, refactor, chore, test, docs, build, ci. " +
              "Máximo de 300 caracteres.\n\n" +
              "--- CONTEXTO ---\n" +
              context,
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
    clearTimeout(to);
    const raw = resp?.data?.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Resposta vazia da OpenAI.");
    return normalizeCommit(raw);
  } catch (err) {
    clearTimeout(to);
    throw err;
  }
};

const generateAIMessage = async (context) => {
  if (!AI_PROVIDER) {
    throw new Error(
      "Nenhuma chave de IA configurada. Adicione EstoqueUni_Gemini, EstoqueUni_CLAUDE ou EstoqueUni_GPT no .env"
    );
  }

  if (AI_PROVIDER === "gemini") {
    return await generateAIMessageWithGemini(context);
  } else if (AI_PROVIDER === "claude") {
    return await generateAIMessageWithClaude(context);
  } else {
    return await generateAIMessageWithOpenAI(context);
  }
};

const promptManualCommitMessage = async (prompt) => {
  while (true) {
    const answer = (
      await prompt.question("\nInforme a descrição do commit: ")
    ).trim();
    if (answer) {
      return answer;
    }
    console.log("Descrição não pode ser vazia. Tente novamente.");
  }
};

const TARGET_BRANCH =
  process.env.ESTOQUEUNI_COMMIT_BRANCH ||
  process.env.RUNTIME_COMMIT_BRANCH ||
  "main";

const hasRemote = (remoteName = "origin") => {
  try {
    runGet("git", ["remote", "get-url", remoteName]);
    return true;
  } catch (error) {
    return false;
  }
};

(async function main() {
  try {
    ensureChangesToCommit();
    ensureBranch(TARGET_BRANCH);
    ensureRemoteForBranch(TARGET_BRANCH);

    run("git", ["add", "--all", "."]);

    let commitMessage = "";

    try {
      console.log("\n🤖 Gerando mensagem de commit com IA...");
      const ctx = buildStagedContext();
      commitMessage = await generateAIMessage(ctx);

      if (!commitMessage)
        throw new Error("IA não retornou mensagem de commit.");
      console.log("\n✅ Mensagem gerada pela IA:", commitMessage);
    } catch (error) {
      console.log("\n⚠️  Falha ao gerar com IA:", error.message);
      console.log("📝 Digite a mensagem de commit manualmente:\n");

      const prompt = createPrompt();
      try {
        commitMessage = await promptManualCommitMessage(prompt);
        console.log("\n✅ Mensagem informada manualmente:", commitMessage);
      } finally {
        prompt.close();
      }
    }

    run("git", ["commit", "-m", commitMessage]);

    if (hasRemote("origin")) {
      try {
        run("git", ["push"]);
        console.log("\n✅ Push realizado com sucesso!");
      } catch (err) {
        console.log(
          "[git] Tentativa de push padrão falhou, configurando upstream…"
        );
        run("git", ["push", "-u", "origin", TARGET_BRANCH]);
        console.log("\n✅ Push realizado com sucesso!");
      }
    } else {
      console.log(
        "\nℹ️ Nenhum remoto configurado (origin). Commit criado apenas localmente."
      );
    }
  } catch (err) {
    console.error("\n❌ Erro:", err.message || err);
    process.exit(1);
  }
})();

