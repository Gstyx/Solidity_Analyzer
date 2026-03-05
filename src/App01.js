import React, { useState, useEffect } from "react";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";
const apiUrl = (path) => `${API_BASE_URL}${path}`;


// Full multi-page analyzer: main menu + individual tool pages
// Pages: MenuPage, SlitherPage, MythrilPage, ForgePage

export default function SolidityAnalyzerApp() {
  const [page, setPage] = useState("menu");
  const [code, setCode] = useState("// Paste or upload your Solidity contract here\n");

  const renderPage = () => {
    switch (page) {
      case "slither":
        return <SlitherPage code={code} setCode={setCode} goHome={() => setPage("menu")} />;
      case "mythril":
        return <MythrilPage code={code} setCode={setCode} goHome={() => setPage("menu")} />;
      case "forge":
        return <ForgePage code={code} setCode={setCode} goHome={() => setPage("menu")} />;
      default:
        return <MenuPage setPage={setPage} />;
    }
  };

  return <div>{renderPage()}</div>;
}

// ------------------ Menu Page ------------------
function MenuPage({ setPage }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0f0f10', color: '#e6eef8' }}>
      <h1 className="text-3xl font-bold mb-8">Solidity Analysis Suite</h1>
      <p className="text-gray-400 mb-8">Escolha uma ferramenta de análise abaixo:</p>
      <div className="flex gap-6">
        <MenuButton label="Slither" onClick={() => setPage('slither')} desc="Análise estática de vulnerabilidades" />
        <MenuButton label="Mythril" onClick={() => setPage('mythril')} desc="Análise simbólica e execução simbólica" />
        <MenuButton label="Forge (Foundry)" onClick={() => setPage('forge')} desc="Testes automatizados e fuzzing" />
      </div>
    </div>
  );
}

function MenuButton({ label, desc, onClick }) {
  return (
    <div className="p-6 w-60 rounded-xl border border-gray-700 bg-[#111113] hover:bg-[#17181a] cursor-pointer transition" onClick={onClick}>
      <h2 className="text-xl font-semibold mb-2 text-green-400">{label}</h2>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}

// ------------------ Slither Page ------------------

/* -----------------------
   CONFIG / METADATA
   ----------------------- */


// severity metadata
const severityMeta = {
  High: { color: "#ef4444", rank: 3 },
  Medium: { color: "#f59e0b", rank: 2 },
  Low: { color: "#10b981", rank: 1 },
  Informational: { color: "#94a3b8", rank: 0 },
};
function severityColor(sev) {
  return severityMeta[sev]?.color || "#94a3b8";
}

/* -----------------------
   ANALYZER (SIMULATED) -> adds swc where possible
   ----------------------- */

function mapToSwc(title, description) {
  const text = (title + " " + description).toLowerCase();

  const swcTable = [
    { id: "SWC-100", keywords: ["function default visibility"], category: "Visibility" },
    { id: "SWC-101", keywords: ["integer overflow", "unchecked arithmetic"], category: "Arithmetic" },
    { id: "SWC-102", keywords: ["outdated compiler", "old compiler", "pragma 0.4", "0.5"], category: "Environment" },
    { id: "SWC-103", keywords: ["floating pragma"], category: "Environment" },
    { id: "SWC-104", keywords: ["unchecked call", "external call without check"], category: "External Calls" },
    { id: "SWC-105", keywords: ["unprotected function", "public function", "access control"], category: "Access Control" },
    { id: "SWC-106", keywords: ["selfdestruct", "suicide"], category: "Denial of Service" },
    { id: "SWC-107", keywords: ["reentrancy", "call.value", "call with value"], category: "Reentrancy" },
    { id: "SWC-108", keywords: ["state variable shadowing"], category: "Data Consistency" },
    { id: "SWC-109", keywords: ["uninitialized storage", "storage pointer"], category: "Data Consistency" },
    { id: "SWC-110", keywords: ["assert violation"], category: "Error Handling" },
    { id: "SWC-111", keywords: ["assembly", "yul"], category: "Low-Level Code" },
    { id: "SWC-112", keywords: ["delegatecall"], category: "Low-Level Code" },
    { id: "SWC-113", keywords: ["dos with revert", "loop", "unbounded loop"], category: "Denial of Service" },
    { id: "SWC-114", keywords: ["tx.origin"], category: "Access Control" },
    { id: "SWC-115", keywords: ["authorization through tx.origin"], category: "Access Control" },
    { id: "SWC-116", keywords: ["timestamp", "now", "block.timestamp"], category: "Environment" },
    { id: "SWC-117", keywords: ["signature malleability"], category: "Cryptography" },
    { id: "SWC-118", keywords: ["incorrect constructor"], category: "Initialization" },
    { id: "SWC-119", keywords: ["lack of event", "no events", "no log"], category: "Auditability" },
    { id: "SWC-120", keywords: ["insecure randomness", "keccak256", "blockhash"], category: "Randomness" },
    { id: "SWC-121", keywords: ["signature replay", "nonce"], category: "Authentication" },
    { id: "SWC-122", keywords: ["lack of proper validation", "unvalidated"], category: "Input Validation" },
    { id: "SWC-123", keywords: ["require before transfer", "insufficient gas griefing"], category: "Gas" },
    { id: "SWC-124", keywords: ["write to arbitrary storage"], category: "Access Control" },
    { id: "SWC-125", keywords: ["incorrect inheritance order"], category: "Logic" },
    { id: "SWC-126", keywords: ["insufficient gas griefing"], category: "Gas" },
    { id: "SWC-127", keywords: ["arbitrary jump", "delegatecall"], category: "Low-Level Code" },
    { id: "SWC-128", keywords: ["doS", "loop"], category: "Denial of Service" },
    { id: "SWC-129", keywords: ["typographical error"], category: "Maintainability" },
    { id: "SWC-130", keywords: ["shadowed variable"], category: "Maintainability" },
    { id: "SWC-131", keywords: ["hardcoded address", "magic number"], category: "Maintainability" },
    { id: "SWC-132", keywords: ["fallback"], category: "Access Control" },
    { id: "SWC-133", keywords: ["hash collision", "abi.encodepacked"], category: "Data Integrity" },
    { id: "SWC-134", keywords: ["unexpected ether", "receive"], category: "Access Control" },
  ];

  for (const entry of swcTable) {
    if (entry.keywords.some((kw) => text.includes(kw))) {
      return { swc: entry.id, category: entry.category };
    }
  }
  return { swc: null, category: "Uncategorized" };
}

function analyzeCode(source) {
  const results = [];
  const lines = source.split("\n");

  const push = (title, description, severity, location) => {
    const { swc, category } = mapToSwc(title, description);
    results.push({
      title,
      description,
      severity,
      location,
      swc,
      category,
      businessImpact: null,
    });
  };

  /* =========================================================
     🔒 LINE-BASED RULES
     ========================================================= */
  lines.forEach((l, idx) => {
    const line = l.toLowerCase();

    // Reentrancy - low-level call
    if (/\.\s*call\s*\(/.test(line) && /value/.test(line)) {
      push(
        "Potential Reentrancy via call with value",
        "Use of .call{value:...}() may enable reentrancy. Apply Checks-Effects-Interactions pattern or ReentrancyGuard.",
        "High",
        `line ${idx + 1}`
      );
    }

    // send / transfer
    if (/(\.send\s*\(|\.transfer\s*\()/.test(line)) {
      push(
        "Use of send/transfer",
        "transfer() and send() may fail due to gas cost changes. Prefer call() and verify success with (bool ok,).",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // tx.origin
    if (/tx\.origin/.test(line)) {
      push(
        "Use of tx.origin for authorization",
        "tx.origin can be spoofed by intermediate contracts. Always use msg.sender for access control.",
        "High",
        `line ${idx + 1}`
      );
    }

    // delegatecall
    if (/delegatecall\s*\(/.test(line)) {
      push(
        "delegatecall to external address",
        "delegatecall executes code of another contract in caller context. Ensure target is trusted and immutable.",
        "High",
        `line ${idx + 1}`
      );
    }

    // inline assembly
    if (/\bassembly\b/.test(line)) {
      push(
        "Inline Assembly Detected",
        "Inline assembly can bypass compiler safety checks. Audit manually and test thoroughly.",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // selfdestruct
    if (/selfdestruct\s*\(/.test(line)) {
      push(
        "selfdestruct usage",
        "Contract can be destroyed, potentially locking or losing funds. Avoid unless strictly necessary.",
        "High",
        `line ${idx + 1}`
      );
    }

    // block.timestamp or now
    if (/block\.timestamp|now\b/.test(line)) {
      push(
        "Timestamp dependence",
        "Using block.timestamp or now can be manipulated slightly by miners; unsafe for randomness or critical logic.",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // block.number for time logic
    if (/block\.number/.test(line)) {
      push(
        "Block number used for timing",
        "Block number is not constant time; can vary with network conditions. Use block.timestamp for wall-clock time.",
        "Low",
        `line ${idx + 1}`
      );
    }

    // abi.encodePacked with variable length args (hash collision)
    if (/abi\.encodepacked\s*\(.*,(.*string|.*bytes)/.test(line)) {
      push(
        "Potential Hash Collision in abi.encodePacked",
        "Using abi.encodePacked with dynamic types can cause hash collisions. Prefer abi.encode.",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // Unrestricted Ether receive()
    if (/function\s+receive\s*\(\)\s*external/.test(line) && !/onlyowner|require\s*\(/i.test(source)) {
      push(
        "Unrestricted Ether receive() function",
        "Ether can be sent directly without validation. Add access control or event logging.",
        "Low",
        `line ${idx + 1}`
      );
    }

    // low-level staticcall
    if (/\.staticcall\s*\(/.test(line)) {
      push(
        "Use of staticcall",
        "Ensure return value of staticcall is validated. Ignoring failures may lead to incorrect assumptions.",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // magic numbers
    if (/\b\d{5,}\b/.test(line) && !/10{18}/.test(line)) {
      push(
        "Magic Number Detected",
        "Large hardcoded numeric values can harm readability and maintainability. Use constants.",
        "Low",
        `line ${idx + 1}`
      );
    }

    // Hardcoded addresses
    if (/0x[a-f0-9]{20,}/i.test(line)) {
      push(
        "Hardcoded Address",
        "Avoid hardcoded contract or wallet addresses. Store them in configurable state variables or constants.",
        "Low",
        `line ${idx + 1}`
      );
    }

    // External calls without check
    if (/\.call\s*\(/.test(line) && !/require|assert|if\s*\(.*success/i.test(source)) {
      push(
        "External call without success check",
        "External calls should always verify return status (bool success) to avoid silent failures.",
        "Medium",
        `line ${idx + 1}`
      );
    }

    // Uninitialized storage pointer (var A = B; without memory keyword)
    if (/storage\s+\w+\s*;/.test(line) && /memory|calldata/.test(line) === false) {
      push(
        "Possible Uninitialized Storage Pointer",
        "Uninitialized storage variables can overwrite existing storage slots accidentally.",
        "High",
        `line ${idx + 1}`
      );
    }
  });

  /* =========================================================
     🧱 FILE-LEVEL HEURISTICS
     ========================================================= */

  // public functions with no ownership protection
  if (/function\s+.*(public|external)/.test(source) && !/onlyOwner|AccessControl|Ownable/i.test(source)) {
    push(
      "Public function without access control",
      "Functions exposed publicly can modify state without restriction. Add onlyOwner or role-based access modifiers.",
      "High",
      "file"
    );
  }

  // unchecked arithmetic
  if (/unchecked\s*\{/.test(source)) {
    push(
      "Unchecked Arithmetic Block",
      "Solidity 0.8.x has built-in overflow checks. Using unchecked{...} disables them — review carefully.",
      "Medium",
      "file"
    );
  }

  // absence of SafeMath pre-0.8
  if (/pragma\s+solidity\s+\^?0\.[0-7]+\./.test(source) && !/SafeMath/i.test(source)) {
    push(
      "Unsafe Arithmetic (pre-0.8 without SafeMath)",
      "Older compilers lack overflow protection. Include SafeMath or upgrade to 0.8.x.",
      "High",
      "file"
    );
  }

  // loop gas limit
  const forLoops = source.match(/for\s*\([^\)]*\)\s*\{/g);
  if (forLoops && forLoops.length > 3) {
    push(
      "Excessive Loop Complexity",
      "Nested or multiple loops can hit gas limits. Optimize or refactor into smaller iterations.",
      "Low",
      "file"
    );
  }

  // No events for state changes
  if (/set|update|transfer|mint|burn|approve/i.test(source) && !/event\s+/i.test(source)) {
    push(
      "No events for critical state changes",
      "Emit events for visibility when modifying balances, ownership, or permissions.",
      "Informational",
      "file"
    );
  }

  // floating pragma
  if (/pragma\s+solidity\s+\^/.test(source) === false) {
    push(
      "Floating or missing pragma version",
      "Use fixed pragma (e.g. pragma solidity ^0.8.20) to avoid accidental compilation with older versions.",
      "Low",
      "file"
    );
  }

  // Low entropy random generation
  if (/keccak256\s*\(\s*abi\.encodepacked\s*\(.*block\.(timestamp|number)/.test(source)) {
    push(
      "Insecure Randomness from Block Data",
      "Block attributes are predictable. Use Chainlink VRF or commit-reveal schemes for secure randomness.",
      "High",
      "file"
    );
  }

  // authorization via msg.sender == address(...)
  if (/msg\.sender\s*==\s*address\s*\(/.test(source)) {
    push(
      "Weak Authorization Logic",
      "Comparing msg.sender to a specific address hardcodes logic and reduces flexibility. Prefer role-based access.",
      "Medium",
      "file"
    );
  }

  // fallback without access control
  if (/function\s+fallback\s*\(/.test(source) && !/onlyOwner|require\s*\(/i.test(source)) {
    push(
      "Unrestricted fallback function",
      "Fallback functions can receive data or Ether unexpectedly. Add restrictions or logging.",
      "Low",
      "file"
    );
  }

  // Large contract size
  const byteSize = new Blob([source]).size;
  if (byteSize > 24576) {
    push(
      "Large Contract Size",
      "Contract exceeds EVM size limits (~24KB). Consider splitting into smaller modules or using proxies.",
      "Informational",
      "file"
    );
  }

  /* =========================================================
     🧩 DEDUP + SORT
     ========================================================= */
  const dedup = [];
  const seen = new Set();
  for (const r of results) {
    const key = `${r.title}|${r.location}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(r);
    }
  }

  dedup.sort((a, b) => severityMeta[b.severity].rank - severityMeta[a.severity].rank);
  return dedup;
}

/* -----------------------
   LLM INFERENCE: frontend function that calls backend LLM endpoint
   - POST /api/llm/infer { filename, findings, codeSnippet }
   - backend should return array of businessImpact strings (or enriched findings)
   Fallback: localHeuristicInference(findings)
   ----------------------- */

async function callLLMInferenceEndpoint(findings, filename, codeSnippet) {
  // Note: adapt endpoint and auth as you like. This expects JSON { findings, filename, codeSnippet }
  // The endpoint should return: { findings: [{ idx, businessImpact }] } OR enriched findings.
  try {
    const resp = await fetch(apiUrl("/api/llm/infer"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, findings, codeSnippet }),
    });
    if (!resp.ok) throw new Error("LLM endpoint error");
    const data = await resp.json();
    return data.findings || null;
  } catch (err) {
    console.warn("LLM call failed:", err);
    return null;
  }
}

// Simple local heuristic fallback when LLM endpoint is absent
function localHeuristicInference(findings) {
  return findings.map((f) => {
    let impact = "Unknown business impact. Further analysis required.";
    const t = (f.title + " " + f.description).toLowerCase();
    if (t.includes("reentrancy") || t.includes("call{value") || t.includes(".call(")) {
      impact = "An attacker may repeatedly withdraw funds, potentially draining contract balances and causing financial loss.";
    } else if (t.includes("tx.origin")) {
      impact = "Improper authorization may allow attackers to bypass access control leading to unauthorized actions.";
    } else if (t.includes("selfdestruct")) {
      impact = "Contract can be destroyed by unauthorized party causing permanent loss of functionality and funds.";
    } else if (t.includes("unchecked")) {
      impact = "Integer overflow/underflow can corrupt accounting; attackers could mint or steal tokens or manipulate balances.";
    } else if (t.includes("delegatecall")) {
      impact = "Untrusted delegatecall can lead to full takeover of contract storage and logic, allowing theft or loss of control.";
    } else if (t.includes("events")) {
      impact = "Lack of events reduces auditability; harder incident response and forensic analysis.";
    } else if (t.includes("ownership") || t.includes("onlyowner")) {
      impact = "Missing access control could allow anyone to perform privileged operations (e.g., minting, pausing).";
    }
    return { ...f, businessImpact: impact };
  });
}

/* -----------------------
   SARIF GENERATOR: include swc + businessImpact in properties
   ----------------------- */
function generateSarif(filename, vulns) {
  const uniqueRules = {};
  vulns.forEach((v) => {
    const ruleId = v.swc || v.title.replace(/\s+/g, "_").toLowerCase();
    const swcLink = v.swc
      ? `https://swcregistry.io/docs/${v.swc}`
      : null;

    if (!uniqueRules[ruleId]) {
      uniqueRules[ruleId] = {
        id: ruleId,
        shortDescription: { text: v.title },
        fullDescription: { text: v.description },
        properties: {
          category: v.category || "Uncategorized",
          swc: v.swc,
          swcLink,
        },
        defaultConfiguration: {
          level: v.severity.toLowerCase(),
        },
      };
    }
  });

  return {
    $schema: "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "SIA Solidity Analyzer",
            informationUri: "https://example.com/sia",
            rules: Object.values(uniqueRules),
          },
        },
        results: vulns.map((v) => {
          const ruleId = v.swc || v.title.replace(/\s+/g, "_").toLowerCase();
          const line = parseInt((v.location || "").replace(/\D/g, "")) || 1;
          const swcLink = v.swc
            ? `https://swcregistry.io/docs/${v.swc}`
            : null;

          return {
            ruleId,
            level: v.severity.toLowerCase(),
            message: { text: v.description },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: filename },
                  region: { startLine: line },
                },
              },
            ],
            properties: {
              swc: v.swc,
              category: v.category,
              swcLink,
              businessImpact: v.businessImpact || null,
            },
          };
        }),
      },
    ],
  };
}

/* -----------------------
   COMPONENT
   ----------------------- */

function SlitherPage(goHome) {
  const [code, setCode] = useState("// Paste or upload your Solidity contract here\n");
  const [filename, setFilename] = useState("contract.sol");
  const [vulns, setVulns] = useState([]);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInferring, setIsInferring] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sia_history_v1");
    if (saved) setHistory(JSON.parse(saved));
  }, []);
  useEffect(() => {
    localStorage.setItem("sia_history_v1", JSON.stringify(history));
  }, [history]);

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      try {
        const findings = analyzeCode(code);
        setVulns(findings);
        const entry = {
          id: Date.now(),
          filename,
          timestamp: new Date().toISOString(),
          codeSnippet: code.slice(0, 400),
          findings,
          notes,
        };
        setHistory((h) => [entry, ...h].slice(0, 50));
      } finally {
        setIsAnalyzing(false);
      }
    }, 400);
  };

  const handleUpload = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFilename(f.name);
    const reader = new FileReader();
    reader.onload = (ev) => setCode(String(ev.target.result));
    reader.readAsText(f);
  };

  const downloadSARIF = () => {
    const sarif = generateSarif(filename, vulns);
    const blob = new Blob([JSON.stringify(sarif, null, 2)], { type: "application/sarif+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-sia-report.sarif.json`;
    a.click();
  };

  const clearHistory = () => {
    if (!window.confirm("Clear saved analysis history?")) return;
    setHistory([]);
  };

  // LLM inference runner (calls backend then fallback)
  const runLLMInference = async () => {
    if (vulns.length === 0) {
      alert("Run analysis first.");
      return;
    }
    setIsInferring(true);
    try {
      // attempt backend LLM first
      const remote = await callLLMInferenceEndpoint(vulns, filename, code.slice(0, 2000));
      if (remote && Array.isArray(remote)) {
        // remote expected to return an array of { idx, businessImpact } or enriched findings
        // We'll try to merge by index or by title
        const enriched = vulns.map((v, i) => {
          const r = remote[i] || remote.find((x) => x.title === v.title) || {};
          return { ...v, businessImpact: r.businessImpact || r.impact || v.businessImpact || null };
        });
        setVulns(enriched);
      } else {
        // fallback local heuristic
        const enriched = localHeuristicInference(vulns);
        setVulns(enriched);
      }
      // update history latest entry (optional)
      setHistory((h) => {
        if (h.length === 0) return h;
        const newest = { ...h[0], findings: (vulns || []) };
        return [newest, ...h.slice(1)];
      });
    } finally {
      setIsInferring(false);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "#0f0f10", color: "#e6eef8" }}>
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Solidity IA Analyzer</h1>
            <p className="text-sm text-gray-400">Static vulnerability analysis + SWC mapping + LLM contextual inference</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="px-3 py-2 rounded bg-gray-800 text-sm cursor-pointer border border-gray-700">
              Upload
              <input type="file" accept=".sol" className="hidden" onChange={handleUpload} />
            </label>
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 rounded bg-gradient-to-r from-green-600 to-green-500 text-black font-medium"
            >
              {isAnalyzing ? "Analyzing..." : "Run Analysis"}
            </button>
            <button onClick={runLLMInference} className="px-3 py-2 rounded border border-gray-700 text-sm">
              {isInferring ? "Inferring..." : "Run LLM Inference"}
            </button>
            <button
              onClick={async () => {
                if (vulns.length === 0) {
                  alert("Execute a análise antes de gerar o relatório executivo.");
                  return;
                }

                const resp = await fetch(apiUrl("/api/llm/report-executivo"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ filename, findings: vulns }),
                });

                const blob = await resp.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${filename.replace(/\.[^/.]+$/, "")}-relatorio-executivo.txt`;
                a.click();
              }}
              className="px-3 py-2 rounded border border-gray-700 text-sm bg-gradient-to-r from-blue-600 to-blue-500 text-white"
            >
              Gerar Relatório Executivo
            </button>
            <button onClick={downloadSARIF} className="px-3 py-2 rounded border border-gray-700 text-sm">Export SARIF</button>
          </div>
        </header>

        <main className="grid grid-cols-12 gap-6">
          <section className="col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">File</span>
                <input
                  className="bg-transparent border-b border-gray-700 text-sm outline-none px-2 py-1 w-48"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Notes</span>
                <input
                  className="bg-transparent border-b border-gray-700 text-sm outline-none px-2 py-1 w-64"
                  placeholder="Optional notes about this analysis"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#09090a" }}>
              <textarea
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-[480px] p-4 font-mono text-sm bg-transparent text-gray-100 placeholder-gray-600"
              />
            </div>

            <div className="mt-3 flex gap-3">
              <button onClick={() => { setCode(""); setVulns([]); }} className="px-3 py-2 rounded border border-gray-700 text-sm">Clear</button>
              <button onClick={() => { navigator.clipboard.writeText(code); }} className="px-3 py-2 rounded border border-gray-700 text-sm">Copy</button>
            </div>
          </section>

          <aside className="col-span-5">
            <div className="rounded-xl p-4 border border-gray-800 mb-4" style={{ background: "#0b0b0c" }}>
              <h2 className="text-lg font-medium mb-2">Vulnerabilities</h2>
              {vulns.length === 0 ? (
                <div className="text-sm text-gray-400">No findings yet. Run analysis.</div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-auto pr-2">
                  {vulns.map((v, i) => (
                      <div key={i} className="p-3 rounded-lg border" style={{ borderColor: '#1f2937', background: '#071014' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="w-3 h-3 rounded-full" style={{ background: severityColor(v.severity) }} />
                              <div className="font-semibold">{v.title}</div>

                              {/* SWC ID link */}
                              {v.swc && (
                                <a
                                  href={`https://swcregistry.io/docs/${v.swc}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:underline"
                                >
                                  {v.swc}
                                </a>
                              )}

                              {/* Categoria */}
                              <span
                                className="text-xs text-gray-300 px-2 py-0.5 rounded border border-gray-700"
                                style={{ background: '#0a121a' }}
                              >
                                {v.category || "Uncategorized"}
                              </span>
                            </div>

                            <div className="text-xs text-gray-400 mt-1">{v.location}</div>
                          </div>

                          <div
                            className="text-sm font-medium"
                            style={{ color: severityColor(v.severity) }}
                          >
                            {v.severity}
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-300">{v.description}</div>

                        {v.businessImpact && (
                          <div className="mt-2 text-xs text-yellow-200 bg-black/20 p-2 rounded">
                            <strong>Business Impact:</strong> {v.businessImpact}
                          </div>
                        )}
                      </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex gap-3 text-xs text-gray-400">
                <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: "#ef4444" }} className="rounded-full" />High</div>
                <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: "#f59e0b" }} className="rounded-full" />Medium</div>
                <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: "#10b981" }} className="rounded-full" />Low</div>
                <div className="flex items-center gap-2"><div style={{ width: 12, height: 12, background: "#94a3b8" }} className="rounded-full" />Info</div>
              </div>
            </div>

            <div className="rounded-xl p-4 border border-gray-800" style={{ background: '#071018' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">History</h3>
                <div className="text-sm text-gray-400">{history.length} saved</div>
              </div>

              <div className="max-h-56 overflow-auto space-y-2">
                {history.length === 0 && <div className="text-sm text-gray-400">No past analyses saved.</div>}
                {history.map((h) => (
                  <div key={h.id} className="p-3 rounded border border-gray-800 hover:bg-gray-900 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{h.filename}</div>
                        <div className="text-xs text-gray-400">{new Date(h.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="text-xs text-gray-400">{h.findings.length} findings</div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button className="px-2 py-1 rounded border border-gray-700 text-xs" onClick={() => { setCode(h.codeSnippet); setVulns(h.findings); setFilename(h.filename); }}>Load</button>
                      <button className="px-2 py-1 rounded border border-gray-700 text-xs" onClick={() => { const blob = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${h.filename}-${h.id}.json`; a.click(); URL.revokeObjectURL(url); }}>Export</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex justify-end">
                <button onClick={clearHistory} className="px-3 py-2 rounded border border-gray-700 text-sm">Clear history</button>
              </div>
            </div>
          </aside>

          <section className="col-span-12 mt-6">
            <div className="rounded-xl border border-gray-800 p-4" style={{ background: '#081018' }}>
              <h2 className="text-lg font-medium mb-2">Detailed Report</h2>
              <div className="text-sm text-gray-300 mb-3">Summary for: <span className="font-mono">{filename}</span></div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded border" style={{ borderColor: '#12202b', background: '#07131a' }}>
                  <div className="text-xs text-gray-400">High</div>
                  <div className="text-2xl font-semibold" style={{ color: "#ef4444" }}>{vulns.filter(v=>v.severity==='High').length}</div>
                </div>
                <div className="p-3 rounded border" style={{ borderColor: '#12202b', background: '#07131a' }}>
                  <div className="text-xs text-gray-400">Medium</div>
                  <div className="text-2xl font-semibold" style={{ color: "#f59e0b" }}>{vulns.filter(v=>v.severity==='Medium').length}</div>
                </div>
                <div className="p-3 rounded border" style={{ borderColor: '#12202b', background: '#07131a' }}>
                  <div className="text-xs text-gray-400">Low</div>
                  <div className="text-2xl font-semibold" style={{ color: "#10b981" }}>{vulns.filter(v=>v.severity==='Low').length}</div>
                </div>
              </div>

              <div className="mt-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-200 font-mono p-3 rounded border border-gray-800 bg-[#061017]">
{vulns.length === 0 ? 'No findings to display.' :
vulns.map((v,i)=>`[${v.severity}] ${v.title} (${v.location}) ${v.swc ? `[${v.swc}]` : ''}\n  - ${v.description}\n  - Business impact: ${v.businessImpact || 'N/A'}\n`).join('\n')}
                </pre>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}

// ------------------ Mythril Page ------------------
function MythrilPage({ code, setCode, goHome }) {
  const [depth, setDepth] = useState(5);
  const [timeout, setTimeoutVal] = useState(30);
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const runMythril = () => {
    setIsRunning(true);
    setTimeout(() => {
      setResults([
        { title: 'Integer Overflow', severity: 'High', description: 'Arithmetic operation may overflow.' },
        { title: 'Unchecked Call', severity: 'Medium', description: 'Low-level call result not validated.' }
      ]);
      setIsRunning(false);
    }, 1000);
  };

  return (
    <ToolLayout name="Mythril" goHome={goHome}>
      <div className="flex gap-4 mb-4 text-sm text-gray-300">
        <div>
          <label>Profundidade simbólica</label>
          <input type="number" value={depth} min={1} max={20} onChange={(e)=>setDepth(e.target.value)} className="bg-gray-900 border border-gray-700 p-1 rounded w-20 ml-2" />
        </div>
        <div>
          <label>Timeout (seg)</label>
          <input type="number" value={timeout} min={10} max={300} onChange={(e)=>setTimeoutVal(e.target.value)} className="bg-gray-900 border border-gray-700 p-1 rounded w-20 ml-2" />
        </div>
      </div>
      <Editor code={code} setCode={setCode} />
      <RunButton label="Executar Mythril" isRunning={isRunning} onClick={runMythril} />
      <ResultsList results={results} />
    </ToolLayout>
  );
}

// ------------------ Forge Page ------------------
function ForgePage({ code, setCode, goHome }) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("explanation");
  const [forgeResult, setForgeResult] = useState({ explanation: "", generatedTest: "" });
  const [errorMessage, setErrorMessage] = useState("");

  const runForge = async () => {
    if (!code?.trim()) {
      setErrorMessage("Cole um contrato Solidity antes de iniciar a análise inteligente.");
      return;
    }

    setErrorMessage("");
    setIsRunning(true);

    try {
      const resp = await fetch(apiUrl("/api/smart-forge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Falha ao gerar análise e testes com IA.");
      }

      setForgeResult({
        explanation: data.explanation || "Sem explicação retornada.",
        generatedTest: data.generatedTest || "Sem código de teste retornado.",
      });
    } catch (err) {
      const message = (err?.message || "").toLowerCase();
      const isNetworkError =
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("network error");

      const networkHint = isNetworkError
        ? "Erro de rede: verifique se o backend está rodando e se REACT_APP_API_BASE_URL está configurada corretamente."
        : err.message || "Tente novamente em instantes.";

      setErrorMessage(`Não foi possível concluir a análise com IA. ${networkHint}`);
      setForgeResult({ explanation: "", generatedTest: "" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <ToolLayout name="Forge (Foundry)" goHome={goHome}>
      <div className="text-sm text-gray-400 mb-3">
        Envie seu contrato para a IA gerar explicação didática + testes Foundry com fuzzing.
      </div>

      <Editor code={code} setCode={setCode} />
      <RunButton label="Gerar análise e testes com IA" isRunning={isRunning} onClick={runForge} />

      {isRunning && (
        <div className="mb-4 p-3 rounded-lg border border-emerald-700 bg-emerald-900/20 text-emerald-300 text-sm animate-pulse">
          A IA está analisando seu contrato e gerando testes...
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-lg border border-red-700 bg-red-900/20 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-gray-800 bg-[#071014] overflow-hidden">
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab("explanation")}
            className={`px-4 py-2 text-sm ${activeTab === "explanation" ? "text-emerald-300 border-b-2 border-emerald-400" : "text-gray-400"}`}
          >
            Explicação do Contrato
          </button>
          <button
            onClick={() => setActiveTab("test")}
            className={`px-4 py-2 text-sm ${activeTab === "test" ? "text-emerald-300 border-b-2 border-emerald-400" : "text-gray-400"}`}
          >
            Código de Teste Gerado (.t.sol)
          </button>
        </div>

        <div className="p-4">
          {activeTab === "explanation" ? (
            <div className="text-sm leading-7 text-gray-200 whitespace-pre-wrap min-h-[180px]">
              {forgeResult.explanation || "Execute a análise para visualizar a explicação inteligente do contrato."}
            </div>
          ) : (
            <pre className="text-xs sm:text-sm whitespace-pre-wrap overflow-auto rounded-lg border border-gray-800 bg-[#0b0b0c] p-4 text-gray-200 min-h-[220px]">
              <code>
                {forgeResult.generatedTest || "O código de teste Foundry gerado pela IA aparecerá aqui."}
              </code>
            </pre>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}

// ------------------ Shared Components ------------------
function ToolLayout({ name, goHome, children }) {
  return (
    <div className="min-h-screen p-8" style={{ background: '#0f0f10', color: '#e6eef8' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">{name}</h1>
          <button onClick={goHome} className="px-3 py-2 rounded border border-gray-700 text-sm text-gray-300 hover:text-green-400">Voltar ao menu</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Editor({ code, setCode }) {
  return (
    <textarea
      spellCheck={false}
      value={code}
      onChange={(e)=>setCode(e.target.value)}
      className="w-full h-[300px] p-4 font-mono text-sm bg-[#09090a] text-gray-100 rounded-xl border border-gray-800 mb-4"
    />
  );
}

function RunButton({ label, isRunning, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-2 rounded bg-green-600 text-black font-medium mb-4">
      {isRunning ? 'Executando...' : label}
    </button>
  );
}

function ResultsList({ results }) {
  if (!results || results.length === 0)
    return <div className="text-sm text-gray-400">Nenhum resultado disponível.</div>;
  return (
    <div className="space-y-3">
      {results.map((r, i)=>(
        <div key={i} className="p-4 border border-gray-800 rounded-lg bg-[#071014]">
          <div className="flex justify-between mb-2">
            <div className="font-semibold">{r.title}</div>
            <span className="text-xs bg-gray-800 px-2 py-1 rounded">{r.severity}</span>
          </div>
          <div className="text-sm text-gray-300">{r.description}</div>
        </div>
      ))}
    </div>
  );
}
