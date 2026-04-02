const fs = require("fs/promises");
const path = require("path");

const VIDEO_URL = "https://www.youtube.com/watch?v=YwLjcEtAOYo";
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../youtube-transcripts/finn-thormeier-video.md"
);

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "this",
  "from",
  "have",
  "your",
  "about",
  "they",
  "them",
  "their",
  "there",
  "what",
  "when",
  "where",
  "which",
  "will",
  "just",
  "into",
  "than",
  "then",
  "also",
  "because",
  "would",
  "could",
  "should",
  "some",
  "more",
  "most",
  "very",
  "over",
  "under",
  "each",
  "been",
  "being",
  "while",
  "we",
  "our",
  "you",
  "i",
  "to",
  "of",
  "in",
  "is",
  "it",
  "on",
  "a",
  "an",
  "as",
  "at",
  "or",
  "be",
  "are",
  "if",
  "do",
  "did",
  "not",
  "can",
]);

const CONCEPT_BUCKETS = [
  {
    title: "Audience and Positioning",
    keywords: [
      "audience",
      "buyer",
      "founder",
      "persona",
      "niche",
      "icp",
      "positioning",
      "category",
    ],
  },
  {
    title: "Content Strategy",
    keywords: [
      "content",
      "post",
      "story",
      "insight",
      "framework",
      "value",
      "educate",
      "narrative",
      "hook",
    ],
  },
  {
    title: "Distribution and Engagement",
    keywords: [
      "linkedin",
      "comment",
      "dm",
      "message",
      "engagement",
      "reach",
      "network",
      "conversation",
      "community",
    ],
  },
  {
    title: "Pipeline and Conversion",
    keywords: [
      "lead",
      "pipeline",
      "demo",
      "sales",
      "revenue",
      "convert",
      "customer",
      "meeting",
      "call",
    ],
  },
];

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\[(?:Music|Applause)\]/gi, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function sentenceSplit(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35);
}

function scoreSentences(sentences) {
  const freq = new Map();
  const words = sentences
    .join(" ")
    .toLowerCase()
    .match(/[a-z][a-z'-]{2,}/g);

  for (const w of words || []) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return sentences
    .map((sentence) => {
      const tokens = sentence.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
      const score = tokens.reduce((sum, t) => sum + (freq.get(t) || 0), 0);
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);
}

function bucketConcepts(sentences) {
  const concepts = [];

  for (const bucket of CONCEPT_BUCKETS) {
    const matches = sentences.filter(({ sentence }) =>
      bucket.keywords.some((k) => sentence.toLowerCase().includes(k))
    );

    if (matches.length) {
      concepts.push({
        title: bucket.title,
        points: matches.slice(0, 2).map((m) => m.sentence),
      });
    }
  }

  return concepts;
}

async function main() {
  try {
    const { YoutubeTranscript } = await import(
      "youtube-transcript/dist/youtube-transcript.esm.js"
    );
    const transcript = await YoutubeTranscript.fetchTranscript(VIDEO_URL);

    const transcriptText = transcript
      .map((row) => cleanText(row.text))
      .filter(Boolean)
      .join(" ");

    const sentences = sentenceSplit(transcriptText);
    const scored = scoreSentences(sentences);
    const topSummary = scored.slice(0, 6).map((s) => s.sentence);
    const conceptGroups = bucketConcepts(scored);

    const markdown = [
      "# B2B SaaS LinkedIn Strategy - Finn Thormeier (Video Notes)",
      "",
      `- Source: ${VIDEO_URL}`,
      `- Generated: ${new Date().toISOString()}`,
      `- Transcript chunks processed: ${transcript.length}`,
      "",
      "## Executive Summary",
      "",
      ...topSummary.map((line) => `- ${line}`),
      "",
      "## Core Concepts",
      "",
      ...(conceptGroups.length
        ? conceptGroups.flatMap((group) => [
            `### ${group.title}`,
            "",
            ...group.points.map((p) => `- ${p}`),
            "",
          ])
        : ["- No concept groups were confidently extracted from the transcript.", ""]),
      "## Clean Transcript (timestamps removed)",
      "",
      transcriptText,
      "",
    ].join("\n");

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, markdown, "utf8");
    console.log(`Transcript summary written to: ${OUTPUT_PATH}`);
  } catch (error) {
    console.error("Failed to fetch or process transcript.");
    console.error(error?.message || error);
    process.exit(1);
  }
}

main();
