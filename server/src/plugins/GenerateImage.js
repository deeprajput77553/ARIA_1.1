// src/plugins/GenerateImage.js
// Standalone image generation plugin using NVIDIA FLUX.1-schnell

import fs from 'fs';
import path from 'path';
import Logger from '../utils/Logger.js';
import { fileURLToPath } from 'url';


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

        // Use user's raw prompt directly (prompt enhancer disabled)
        let descriptivePrompt = prompt;

        // Ensure prompt length is within the 800-character limit of the NVIDIA API (specifically for FLUX.2-klein-4b)
        if (descriptivePrompt.length > 790) {
            descriptivePrompt = descriptivePrompt.slice(0, 790).trim();
            const lastSpace = descriptivePrompt.lastIndexOf(' ');
            if (lastSpace > 700) {
                descriptivePrompt = descriptivePrompt.slice(0, lastSpace).trim();
            }
        }

        let payload = {
            "prompt": descriptivePrompt,
            "seed": 0,
            "height": 1024,
            "width": 1024
        };

        const modelsToTry = [
            { name: 'FLUX.2-klein-4b', url: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b", steps: 4 },
            { name: 'FLUX.1-dev', url: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev", steps: 28 },
            { name: 'FLUX.1-schnell', url: "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell", steps: 4 }
        ];

        let response;
        let b64;
        let isBlackImage = false;
        let finalPromptUsed = descriptivePrompt;
        let usedModelName = '';

        for (let attempt = 1; attempt <= 2; attempt++) {
            // Try each model in sequence
            for (const model of modelsToTry) {
                try {
                    Logger.stage('GenerateImage', `Requesting image generation using ${model.name} (attempt ${attempt})...`);
                    payload.steps = model.steps;
                    response = await fetch(model.url, {
                        method: 'POST',
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        usedModelName = model.name;
                        break;
                    }
                    console.log(`[GenerateImage] ${model.name} failed with status ${response.status}. Trying next fallback...`);
                } catch (err) {
                    console.log(`[GenerateImage] Error calling ${model.name}: ${err.message}. Trying next fallback...`);
                }
            }

            if (!response || !response.ok) {
                const statusText = response ? `NVIDIA API returned status ${response.status}` : 'Fetch error';
                return `x NVIDIA API generation failed: ${statusText}`;
            }

            try {
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
                .slice(0, 40) // limit length
                .replace(/_+$/, ''); // remove trailing underscores
            
            const baseName = slug || 'generated_image';
            let filename = `${baseName}.png`;
            let counter = 1;
            while (fs.existsSync(path.join(imagesDir, filename))) {
                filename = `${baseName}_${counter}.png`;
                counter++;
            }
            const filepath = path.join(imagesDir, filename);
            fs.writeFileSync(filepath, Buffer.from(b64, 'base64'));

            const usedModelInfo = `${usedModelName} (steps: ${payload.steps}, 1024x1024)`;
            return `* Image successfully generated!\n- **Model Used**: ${usedModelInfo}\n- **Saved to**: \`images/${filename}\`\n- **Original Prompt**: "${prompt}"\n- **Enriched Prompt used**: "${finalPromptUsed}"`;
        } catch (err) {
            return `x Failed to process generated image: ${err.message}`;
        }
    }
};

