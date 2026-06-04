// src/plugins/GenerateImage.js
// Standalone image generation plugin using NVIDIA FLUX.1-schnell

import fs from 'fs';
import path from 'path';
import { callOllama, MODELS } from '../layers/OutputLayer.js';
import Logger from '../utils/Logger.js';
import { fileURLToPath } from 'url';

const PROMPT_ENHANCER_SYS = `You are a professional Prompt Engineer for advanced image generation models like FLUX.1.
Your task is to take a simple or raw user description and translate it into a highly descriptive, visually stunning, and detailed prompt.

To make the prompt incredibly specific, you must explicitly describe the following components:
1. Art Style & Medium: Define a specific visual style (e.g., modern 3D volumetric render, cinematic keyframe photograph, intricate digital fantasy illustration, vector flat design, cyberpunk digital art, classical oil painting).
2. Subject Details: Elaborate on the primary subject, describing its features, textures, materials, and active state (e.g., "metallic chrome limbs", "translucent glowing glass core", "smooth matte plastic surfaces").
3. Lighting & Atmosphere: Specify the exact lighting mood (e.g., dramatic volumetric light shafts, warm golden hour sunbeams, moody blue and neon pink rim lighting, soft studio key lights, glowing bioluminescent aura).
4. Composition & Camera: Describe the camera angle and framing (e.g., dramatic low-angle shot, macro close-up showing fine dust particles, symmetrical centered composition, wide-angle cinematic panorama, telephoto eye-level perspective).
5. Background & Environment: Detail the environment and background elements (e.g., "clean neutral studio backdrop with soft shadows", "dense misty jungle with ancient glowing runes", "rain-slicked futuristic urban alleyway reflecting neon lights").
6. Color Palette: Choose a specific color scheme (e.g., complementary neon cyan and warm orange accents, monochromatic charcoal with a single gold focal point, rich earth tones with emerald green and copper highlights).
7. Make it realistic and natural.

CRITICAL RULES:
- The output MUST be a single, continuous, highly detailed paragraph of text.
- DO NOT use any list formatting, bullet points, headers, bold markers (**), or special characters. Combine all elements into one smooth description.
- DO NOT use words associated with decay, distress, horror, fear, or trademark/safety flags (such as "haunting", "hauntingly", "eerie", "eerily", "creepy", "spooky", "decaying", "ruined", "collapsed", "mystique"). Use positive, majestic, mysterious, alluring, or futuristic vocabulary instead.
- If the user's prompt is a webpage, website, user interface, mobile app screen, dashboard, or software screenshot:
  * The visual style must be a clean, realistic, front-facing 2D digital user interface mockup or a sharp browser viewport screenshot of a live webpage. Do NOT use 3D volumetric renders, painting styles, or fantasy illustrations.
  * Describe realistic structural UI elements: top navigation bar (with a clean logo, navigation links, and profile picture), sidebar menu, main dashboard/content panel, and organized cards, grids, buttons, or charts.
  * Explicitly request clean, legible modern sans-serif typography, sharp and readable text headers, UI buttons with text labels, and realistic dummy text.
  * Use a professional and harmonious color scheme (e.g., sleek dark mode with cool blue accents, or clean white and slate gray theme) and realistic soft drop shadows for cards and panels to make it look like a real production-ready website or application interface.
- If the user's prompt is a flowchart, diagram, or technical infographic:
  * Absolutely NO text labels, words, or letters (to prevent garbled AI text).
  * Use clear symbolic icons, glowing nodes, glossy spheres, and connecting pipeline rays to illustrate the structure.
- Never use generic quality buzzwords like "photorealistic", "hyperrealistic", "8k", "ultra realistic".
- Output ONLY the final visual prompt text. Do NOT include any introductory words, explanations, or quotes.

Output ONLY the enhanced prompt.`;

export default {
    name: 'generate_image',
    description: 'Generates a standalone image or diagram from a detailed text prompt. Params: { prompt: string }',
    schema: {
        prompt: { type: 'string', required: true, description: 'The description of the image/diagram to generate' }
    },
    async execute({ prompt, signal }, workspaceDir) {
        const ws = workspaceDir || process.cwd();

        // Read API key from .env file
        let apiKey = '';
        try {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const SERVER_DIR = path.join(__dirname, '..', '..');
            const envPaths = [
                path.join(ws, '.env'),
                path.join(process.cwd(), '.env'),
                path.join(SERVER_DIR, '.env')
            ];
            for (const envPath of envPaths) {
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const match = envContent.match(/image\s*=\s*["']?(nvapi-[^"'\s]+)["']?/);
                    if (match) {
                        apiKey = match[1];
                        break;
                    }
                }
            }
        } catch (e) {
            return `x Failed to read .env file: ${e.message}`;
        }

        if (!apiKey) {
            return `x No NVIDIA API key found in .env. Please configure image="nvapi-..." first.`;
        }

        // Analyze and enrich the input prompt using Ollama
        let descriptivePrompt = prompt;
        try {
            Logger.stage('GenerateImage', `Analyzing and enriching prompt: "${prompt}"`);
            const enriched = await callOllama([
                { role: 'system', content: PROMPT_ENHANCER_SYS },
                { role: 'user', content: prompt }
            ], MODELS.REACTIVE, false, signal);

            if (enriched && enriched.trim()) {
                let cleaned = enriched.trim();
                // Strip conversational intro phrases like "Here's the enhanced prompt:", "Sure! Here is...", etc.
                cleaned = cleaned.replace(/^(here's|here is|this is|enhanced prompt|expanded prompt|sure|ok|okay|concept)[^:]*:\s*/i, '');

                // Strip markdown formatting, headers, and bullet points
                cleaned = cleaned.replace(/\*\*/g, '');
                cleaned = cleaned.replace(/###?\s+/g, '');
                cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');

                // Replace section titles with spaces/commas to keep descriptions continuous
                cleaned = cleaned.replace(/(art style & medium|subject details|lighting & atmosphere|composition & camera|background & environment|color palette):\s*/gi, '');

                // Sanitize safety-filter trigger words to prevent false-positive black images
                const replacements = [
                    { pattern: /\bhauntingly\b/gi, replacement: 'majestically' },
                    { pattern: /\bhaunting\b/gi, replacement: 'majestic' },
                    { pattern: /\bhaunted\b/gi, replacement: 'mystical' },
                    { pattern: /\bhaunt\b/gi, replacement: 'charm' },

                    { pattern: /\beerily\b/gi, replacement: 'mystically' },
                    { pattern: /\beerie\b/gi, replacement: 'mystical' },

                    { pattern: /\bcreepily\b/gi, replacement: 'mystically' },
                    { pattern: /\bcreepy\b/gi, replacement: 'mysterious' },

                    { pattern: /\bspookily\b/gi, replacement: 'shadowily' },
                    { pattern: /\bspooky\b/gi, replacement: 'shadowy' },

                    { pattern: /\bmystique\b/gi, replacement: 'allure' },

                    { pattern: /\bdecaying\b/gi, replacement: 'weathered' },
                    { pattern: /\bdecayed\b/gi, replacement: 'ancient' },
                    { pattern: /\bdecay\b/gi, replacement: 'age' },

                    { pattern: /\bruined\b/gi, replacement: 'ancient' },
                    { pattern: /\bruins\b/gi, replacement: 'structures' },
                    { pattern: /\bruin\b/gi, replacement: 'relic' },

                    { pattern: /\bcollapsed\b/gi, replacement: 'historic' },
                    { pattern: /\bavatar\b/gi, replacement: 'profile picture' }
                ];
                for (const r of replacements) {
                    cleaned = cleaned.replace(r.pattern, r.replacement);
                }

                // Replace multiple newlines/spaces with a single space to format as a single paragraph
                cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

                descriptivePrompt = cleaned;
                Logger.success(`Enriched prompt generated: "${descriptivePrompt}"`);
            } else {
                Logger.warn('Prompt enrichment returned empty result. Using original prompt.');
            }
        } catch (err) {
            Logger.error(`Prompt enrichment failed: ${err.message}. Using original prompt.`);
        }

        let url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev";
        let payload = {
            "prompt": descriptivePrompt,
            "seed": 0,
            "steps": 28,
            "height": 1024,
            "width": 1024
        };

        let response;
        let b64;
        let isBlackImage = false;
        let finalPromptUsed = descriptivePrompt;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                Logger.stage('GenerateImage', `Requesting image generation using FLUX.1-dev (attempt ${attempt})...`);
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.log(`[GenerateImage] FLUX.1-dev failed with status ${response.status}. Falling back to FLUX.1-schnell...`);
                    throw new Error(`Status ${response.status}`);
                }
            } catch (err) {
                Logger.stage('GenerateImage', `FLUX.1-dev failed or is unavailable. Falling back to FLUX.1-schnell (4 steps)...`);
                url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";
                payload.steps = 4;
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }

            try {
                if (!response.ok) {
                    const errText = await response.text();
                    return `x NVIDIA API returned status ${response.status}: ${errText}`;
                }

                const data = await response.json();
                b64 = data.artifacts?.[0]?.base64 || data.data?.[0]?.b64_json;
                if (!b64) {
                    return `x No base64 image data found in the response. Response keys: ${Object.keys(data).join(', ')}`;
                }

                const buf = Buffer.from(b64, 'base64');
                if (buf.length === 6428) {
                    isBlackImage = true;
                    if (attempt === 1) {
                        Logger.warn(`NVIDIA safety filter triggered (black image returned). Retrying with original prompt...`);
                        payload.prompt = prompt; // Fallback to original prompt
                        finalPromptUsed = prompt;
                        continue;
                    }
                } else {
                    isBlackImage = false;
                    break;
                }
            } catch (err) {
                return `x Failed to process generated image: ${err.message}`;
            }
        }

        if (isBlackImage) {
            return `x NVIDIA API safety filter blocked the image generation for both enriched and original prompts.`;
        }

        try {

            // Ensure images folder exists in workspace
            const imagesDir = path.join(ws, 'images');
            if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
            }

            // Generate a descriptive, clean filename from the prompt
            const slug = prompt
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // remove special characters
                .trim()
                .replace(/\s+/g, '_') // replace spaces/hyphens with underscores
                .slice(0, 30) // limit length
                .replace(/_+$/, ''); // remove trailing underscores
            const filename = `gen_${slug || 'image'}_${Date.now()}.png`;
            const filepath = path.join(imagesDir, filename);
            fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));

            const usedModel = url.includes('flux.1-dev') ? 'FLUX.1-dev (28 steps, 1024x1024)' : 'FLUX.1-schnell (4 steps)';
            return `* Image successfully generated!\n- **Model Used**: ${usedModel}\n- **Saved to**: \`images/${filename}\`\n- **Original Prompt**: "${prompt}"\n- **Enriched Prompt used**: "${finalPromptUsed}"`;
        } catch (err) {
            return `x Failed to process generated image: ${err.message}`;
        }
    }
};

