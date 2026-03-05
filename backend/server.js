// ==========================
// 📄 server.js – SIA LLM Hybrid Backend (OpenAI + Ollama)
// ==========================
import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import cors from "cors";
import chalk from "chalk";

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔧 Configurações
const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = "gpt-4o-mini";
const OLLAMA_MODEL = "phi3"; // você pode trocar por "llama3" ou "phi3"
const PORT = process.env.PORT || 3001;

// 🎨 Log colorido
function log(msg, color = "white") {
  const fn = chalk[color] || chalk.white;
  console.log(fn(`[${new Date().toLocaleTimeString()}] ${msg}`));
}

/* ==========================================================
   🧠 Função genérica de inferência (OpenAI ou Ollama)
   ========================================================== */
async function callLLM(messages, max_tokens = 1600, temperature = 0.4) {
  // Se houver chave OpenAI
  if (OPENAI_KEY) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          temperature,
          max_tokens,
        }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    } catch (err) {
      if (err.message.includes("insufficient_quota")) {
        log("⚠️ Sem créditos na OpenAI — alternando para Ollama local", "yellow");
        return await callOllama(messages);
      }
      throw err;
    }
  }

  // Caso não haja API Key → usa Ollama local
  return await callOllama(messages);
}

/* ==========================================================
   🧩 Chamada direta ao Ollama local
   ========================================================== */
async function callOllama(messages) {
  try {
    const resp = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages,
      }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const content =
      data.message?.content?.trim() || data.messages?.[0]?.content?.trim() || "";
    return content;
  } catch (err) {
    log(`❌ Erro ao usar Ollama: ${err.message}`, "red");
    throw new Error("ollama-failed");
  }
}



function extractJsonObject(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/* ==========================================================
   1️⃣ /api/llm/infer → Impacto técnico resumido
   ========================================================== */
app.post("/api/llm/infer", async (req, res) => {
  const { filename, findings = [], codeSnippet = "" } = req.body;
  if (!Array.isArray(findings)) return res.status(400).json({ error: "bad input" });

  log(`📊 Inferindo impacto de ${findings.length} vulnerabilidades (${filename})`, "cyan");

  const prompt = `
Você é um analista de segurança blockchain. 
Resuma o impacto de cada vulnerabilidade em 1–2 frases e atribua uma gravidade (crítico, alto, médio, baixo).

Arquivo: ${filename}
Trecho analisado:
${codeSnippet.slice(0, 1200)}

Vulnerabilidades:
${findings
  .map(
    (f, i) =>
      `${i + 1}) ${f.title} (${f.severity}) - ${f.description} [SWC: ${
        f.swc || "N/A"
      }]`
  )
  .join("\n")}

Responda apenas em JSON válido:
[
  {"idx": <número>, "businessImpact": "<texto>", "impactSeverity": "<string>"}
]
`;

  try {
    const text = await callLLM([
      { role: "system", content: "Você é um especialista em segurança de contratos inteligentes." },
      { role: "user", content: prompt },
    ]);

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\[.*\]/s);
      if (m) parsed = JSON.parse(m[0]);
    }

    if (!parsed) {
      log("⚠️ Saída inesperada da LLM – usando fallback genérico", "yellow");
      parsed = findings.map((f, i) => ({
        idx: i,
        businessImpact: `A vulnerabilidade "${f.title}" pode comprometer a integridade ou disponibilidade do contrato.`,
        impactSeverity: f.severity.toLowerCase(),
      }));
    }

    res.json({ findings: parsed });
  } catch (err) {
    log(`🔥 Erro: ${err.message}`, "red");
    res.status(500).json({ error: err.message });
  }
});

/* ==========================================================
   2️⃣ /api/llm/report-executivo → Relatório executivo em português
   ========================================================== */
app.post("/api/llm/report-executivo", async (req, res) => {
  const { filename, findings = [] } = req.body;
  log(`🧾 Gerando relatório executivo (${findings.length} vulnerabilidades)`, "blue");

  const prompt = `
Você é um consultor de segurança blockchain. 
Crie um RELATÓRIO EXECUTIVO em português, claro e não técnico.

Estrutura:
1️⃣ RESUMO EXECUTIVO — visão geral dos riscos.
2️⃣ IMPACTO DE NEGÓCIO — o que pode acontecer na prática.
3️⃣ EXEMPLOS DE CENÁRIOS — exemplos reais ou hipotéticos.
4️⃣ RECOMENDAÇÕES — boas práticas de mitigação.
5️⃣ CONCLUSÃO — fechamento com priorização de correções.

Vulnerabilidades detectadas:
${findings.map((f, i) => `${i + 1}) ${f.title} (${f.severity}) - ${f.description}`).join("\n")}
`;

  try {
    const text = await callLLM([
      { role: "system", content: "Você é um especialista em auditoria blockchain e deve escrever relatórios executivos em português." },
      { role: "user", content: prompt },
    ]);

    if (!text || text.trim().length < 20) {
      throw new Error("Resposta vazia ou inválida da LLM");
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/\.[^/.]+$/, "")}-relatorio-executivo.txt"`
    );

    log(`✅ Relatório executivo gerado (${text.length} caracteres)`, "green");
    return res.send(text);
  } catch (err) {
    log(`🔥 Erro: ${err.message}`, "red");
    res.status(500).send("Erro ao gerar relatório executivo.");
  }
});



/* ==========================================================
   3️⃣ /api/smart-forge → Explicação + geração de teste Foundry
   ========================================================== */
app.post("/api/smart-forge", async (req, res) => {
  const { code = "" } = req.body || {};

  if (!code || typeof code !== "string" || code.trim().length < 20) {
    return res.status(400).json({
      error: "Código Solidity inválido. Cole um contrato com conteúdo suficiente.",
    });
  }

  const prompt = `
Você é um auditor de smart contracts especialista em Solidity e Foundry.
Analise o contrato enviado e responda SOMENTE em JSON válido com este formato:
{
  "explanation": "texto didático em português explicando a lógica principal e funções públicas",
  "generatedTest": "código completo de um arquivo Foundry .t.sol com testes unitários e fuzzing"
}

Regras obrigatórias:
- generatedTest deve ser um teste funcional Foundry, com pragma compatível e import de forge-std/Test.sol.
- O contrato de teste deve cobrir as principais funções public/external encontradas no contrato.
- Inclua ao menos 2 testes de fuzzing com parâmetros realistas e suposições (vm.assume) quando necessário.
- NÃO inclua markdown, comentários fora do JSON, nem cercas de código.

Contrato Solidity:
${code}
`;

  try {
    const llmResponse = await callLLM(
      [
        {
          role: "system",
          content:
            "Responda estritamente em JSON válido. Você gera explicações e testes Foundry de alta qualidade.",
        },
        { role: "user", content: prompt },
      ],
      2200,
      0.2
    );

    const parsed = extractJsonObject(llmResponse);
    if (!parsed?.explanation || !parsed?.generatedTest) {
      throw new Error("Resposta inválida da LLM para smart-forge");
    }

    return res.json({
      explanation: String(parsed.explanation).trim(),
      generatedTest: String(parsed.generatedTest).trim(),
    });
  } catch (err) {
    log(`🔥 Erro no /api/smart-forge: ${err.message}`, "red");
    return res.status(502).json({
      error:
        "Não foi possível gerar a análise inteligente agora. Tente novamente em instantes.",
      details: err.message,
    });
  }
});


app.listen(PORT, () => {
  console.log(chalk.green(`🚀 LLM hybrid server listening on port ${PORT}`));
  if (OPENAI_KEY) log("🔑 Usando API da OpenAI", "cyan");
  else log("💻 Usando Ollama local (modo offline)", "yellow");
});
