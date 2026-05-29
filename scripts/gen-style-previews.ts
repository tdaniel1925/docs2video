import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_DIR = path.join(__dirname, "..", "public", "style-previews");

const styles = [
  {
    name: "executive-blueprint",
    file: "executive-blueprint.png",
    prompt:
      "Professional business illustration in executive blueprint style. Clean architectural composition with navy and slate backgrounds, crisp white geometric lines, isometric office/business elements. Subtle grid patterns, muted gold accents. A scene showing business growth — abstract building rising with connected nodes and data flows. No text, no logos. Premium consulting aesthetic like McKinsey meets Bloomberg. 1920x1080 landscape, fill entire canvas.",
  },
  {
    name: "modern-editorial",
    file: "modern-editorial.png",
    prompt:
      "Professional business illustration in modern editorial magazine style. Bold flat shapes with a limited 3-4 color palette (navy, coral, cream, charcoal). Strong negative space, abstract human figures as simple geometric shapes. Inspired by The Economist or Harvard Business Review illustrations. A scene showing strategic planning — abstract figures around a table with rising chart elements. No text, no logos. Smart, sophisticated, minimal. 1920x1080 landscape, fill entire canvas.",
  },
  {
    name: "gradient-studio",
    file: "gradient-studio.png",
    prompt:
      "Professional business illustration in gradient studio style. Smooth gradient backgrounds transitioning from deep purple to electric blue. Frosted glass UI elements floating in space, clean geometric shapes, soft glows. Apple keynote aesthetic. A scene showing technology and innovation — abstract floating screens and data orbs connected by light streams. No text, no logos. Minimal, modern, tech-forward. 1920x1080 landscape, fill entire canvas.",
  },
  {
    name: "ink-paper",
    file: "ink-paper.png",
    prompt:
      "Professional business illustration in ink and paper style. Warm cream paper texture background with thin precise ink line drawings. Selective single accent color (deep teal) for key elements. A scene showing financial planning — hand-drawn style graphs, a family silhouette, a house outline, connected by flowing ink lines. Feels like a premium annual report illustration. No text, no logos. Professional, understated, trustworthy. 1920x1080 landscape, fill entire canvas.",
  },
  {
    name: "neon-data",
    file: "neon-data.png",
    prompt:
      "Professional business illustration in neon data style. Dark charcoal background with glowing neon accents — electric blue, cyan, bright green. Abstract network visualization with connected nodes, flowing data streams, hexagonal grid patterns. A scene showing digital transformation — a central glowing hub radiating connections outward. Feels like a fintech dashboard visualization. No text, no logos. Modern, cutting-edge, high-energy. 1920x1080 landscape, fill entire canvas.",
  },
  {
    name: "luxe-minimal",
    file: "luxe-minimal.png",
    prompt:
      "Professional business illustration in luxe minimal style. Ultra-clean white and warm cream background with rich jewel-tone accent shapes (emerald, sapphire, ruby). Geometric abstract compositions with gold/bronze metallic touches. A scene showing wealth and security — abstract geometric shapes forming a protective arch over diamond-like crystal elements. No text, no logos. Inspired by luxury brand visual identity. Premium, elegant, restrained. 1920x1080 landscape, fill entire canvas.",
  },
];

async function generateImage(style: (typeof styles)[number]) {
  const outputPath = path.join(OUTPUT_DIR, style.file);
  console.log(`[${style.name}] Generating...`);

  try {
    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt: style.prompt,
      size: "1536x1024",
      quality: "high",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`[${style.name}] No image data in response`);
      return;
    }

    fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));
    console.log(`[${style.name}] Saved to ${outputPath}`);
  } catch (err: any) {
    console.error(`[${style.name}] Error: ${err.message ?? err}`);
  }
}

async function main() {
  console.log(`Output directory: ${OUTPUT_DIR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const style of styles) {
    await generateImage(style);
  }

  console.log("\nDone. Generated images:");
  for (const f of fs.readdirSync(OUTPUT_DIR)) {
    const stat = fs.statSync(path.join(OUTPUT_DIR, f));
    console.log(`  ${f} — ${(stat.size / 1024).toFixed(0)} KB`);
  }
}

main();
