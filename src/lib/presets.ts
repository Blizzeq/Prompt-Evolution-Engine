import type { TaskPreset } from "./engine/types";

export const PRESETS: TaskPreset[] = [
  {
    id: "sentiment",
    name: "Sentiment Classification",
    description: "Classify text as positive, negative, or neutral",
    icon: "MessageCircle",
    taskDescription:
      "Classify the sentiment of the given text as exactly one of: positive, negative, or neutral.",
    testCases: [
      {
        input: "I absolutely love this product! Best purchase ever.",
        expectedOutput: "positive",
        weight: 1.0,
      },
      {
        input: "This is the worst customer service I have ever experienced.",
        expectedOutput: "negative",
        weight: 1.0,
      },
      {
        input: "The package arrived on Tuesday.",
        expectedOutput: "neutral",
        weight: 1.0,
      },
      {
        input: "I guess it works fine, nothing special though.",
        expectedOutput: "neutral",
        weight: 1.0,
      },
      {
        input: "Wow, exceeded all my expectations! Highly recommend!",
        expectedOutput: "positive",
        weight: 1.0,
      },
      {
        input: "Broken on arrival. Waste of money. Never buying again.",
        expectedOutput: "negative",
        weight: 1.0,
      },
      {
        input: "The color is blue and it weighs 2kg.",
        expectedOutput: "neutral",
        weight: 1.0,
      },
      {
        input: "Pretty disappointed with the quality for this price.",
        expectedOutput: "negative",
        weight: 1.0,
      },
    ],
    suggestedConfig: {
      populationSize: 8,
      generations: 10,
      evalMethod: "llm-judge",
    },
    seedPrompts: [
      "Classify the sentiment of the following text as positive, negative, or neutral.\n\nText: {input}",
    ],
  },
  {
    id: "summarization",
    name: "Text Summarization",
    description: "Summarize text in exactly one sentence",
    icon: "FileText",
    taskDescription:
      "Summarize the given text in exactly one clear, concise sentence that captures the main point.",
    testCases: [
      {
        input:
          "The European Central Bank announced yesterday that it will raise interest rates by 0.25 percentage points, marking the tenth consecutive increase in its fight against inflation. ECB President Christine Lagarde stated that while inflation has decreased from its peak, it remains above the 2% target.",
        expectedOutput:
          "The ECB raised interest rates for the tenth consecutive time to combat inflation that remains above target.",
        weight: 1.0,
      },
      {
        input:
          "A new study published in Nature found that global tree cover has increased by 7.1% since 1982, primarily due to reforestation efforts in China and Europe. However, tropical regions continue to lose forest at an alarming rate.",
        expectedOutput:
          "Global tree cover grew 7.1% since 1982 from reforestation in China and Europe, despite ongoing tropical forest loss.",
        weight: 1.0,
      },
      {
        input:
          "Tesla reported Q3 earnings that beat analyst expectations, with revenue of $25.2 billion and deliveries of 462,890 vehicles. The company attributed the strong results to price cuts that stimulated demand.",
        expectedOutput:
          "Tesla beat Q3 expectations with $25.2B revenue and 462,890 deliveries, driven by demand-boosting price cuts.",
        weight: 1.0,
      },
      {
        input:
          "Researchers at MIT have developed a new battery technology using aluminum and sulfur that could store renewable energy at one-sixth the cost of current lithium-ion batteries. The materials are abundant and the manufacturing process is simpler.",
        expectedOutput:
          "MIT researchers created an aluminum-sulfur battery that could store renewable energy at one-sixth the cost of lithium-ion.",
        weight: 1.0,
      },
      {
        input:
          "The WHO declared the end of the mpox global health emergency after cases dropped by 90% worldwide. Officials credited vaccination campaigns and public health measures for the decline.",
        expectedOutput:
          "The WHO ended the mpox emergency after a 90% global case drop attributed to vaccination and public health efforts.",
        weight: 1.0,
      },
    ],
    suggestedConfig: {
      populationSize: 6,
      generations: 8,
      evalMethod: "llm-judge",
    },
  },
  {
    id: "extraction",
    name: "Entity Extraction",
    description: "Extract structured data from unstructured text",
    icon: "Search",
    taskDescription:
      'Extract the person name, company, and role from the given text. Return as JSON: {"name": "...", "company": "...", "role": "..."}',
    testCases: [
      {
        input:
          "We are pleased to announce that Maria Garcia has been appointed as the new Chief Technology Officer at Stripe.",
        expectedOutput:
          '{"name": "Maria Garcia", "company": "Stripe", "role": "Chief Technology Officer"}',
        weight: 1.0,
      },
      {
        input:
          "In an interview, John Smith, a senior engineer at Google, discussed the future of quantum computing.",
        expectedOutput:
          '{"name": "John Smith", "company": "Google", "role": "senior engineer"}',
        weight: 1.0,
      },
      {
        input:
          "The keynote was delivered by Dr. Sarah Chen, who serves as VP of Research at OpenAI.",
        expectedOutput:
          '{"name": "Dr. Sarah Chen", "company": "OpenAI", "role": "VP of Research"}',
        weight: 1.0,
      },
      {
        input:
          "Amazon's CEO Andy Jassy announced new AI initiatives during the annual shareholder meeting.",
        expectedOutput:
          '{"name": "Andy Jassy", "company": "Amazon", "role": "CEO"}',
        weight: 1.0,
      },
      {
        input:
          "Former intern turned lead designer, Aiko Tanaka now heads the UX team at Figma.",
        expectedOutput:
          '{"name": "Aiko Tanaka", "company": "Figma", "role": "lead designer"}',
        weight: 1.0,
      },
    ],
    suggestedConfig: {
      populationSize: 8,
      generations: 10,
      evalMethod: "llm-judge",
    },
  },
  {
    id: "code-review",
    name: "Code Review",
    description: "Identify bugs and suggest fixes in code snippets",
    icon: "Bug",
    taskDescription:
      "Review the given code snippet. Identify the bug, explain it in one sentence, and provide the corrected code.",
    testCases: [
      {
        input:
          'function sum(arr) {\n  let total = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    total += arr[i];\n  }\n  return total;\n}',
        expectedOutput:
          "Bug: Off-by-one error — loop condition should be i < arr.length, not i <= arr.length, which causes undefined to be added.",
        weight: 1.0,
      },
      {
        input:
          'const users = [{ name: "Alice" }, { name: "Bob" }];\nconst names = users.map(user => { user.name });',
        expectedOutput:
          "Bug: Arrow function with curly braces but no return statement. Should be user => user.name or user => { return user.name; }.",
        weight: 1.0,
      },
      {
        input:
          'async function getData() {\n  const res = fetch("/api/data");\n  return res.json();\n}',
        expectedOutput:
          "Bug: Missing await before fetch() call. Without await, res is a Promise, not a Response, so .json() fails.",
        weight: 1.0,
      },
    ],
    suggestedConfig: {
      populationSize: 6,
      generations: 8,
      evalMethod: "llm-judge",
    },
  },
];
