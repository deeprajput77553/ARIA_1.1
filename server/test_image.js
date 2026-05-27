import fs from 'fs';
import path from 'path';

// Read API key from .env file
const envPath = "C:\\Users\\AJINKYA\\Desktop\\aria\\server\\.env";
const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/image\s*=\s*["']?(nvapi-[^"'\s]+)["']?/);
if (!match) {
    console.error("No API key found in .env!");
    process.exit(1);
}
const apiKey = match[1];
console.log("Using API key:", apiKey.substring(0, 15) + "...");

const url = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell";
const payload = {
    "prompt": "A beautiful glowing neon logo of a four-pointed star inside a circle, cyber aesthetic, glassmorphism, dark blue background",
    "seed": 0,
    "steps": 4
};

async function test() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log("Status:", response.status);
        if (!response.ok) {
            const text = await response.text();
            console.error("Error response:", text);
            return;
        }

        const data = await response.json();
        console.log("Response keys:", Object.keys(data));
        if (data.artifacts) {
            console.log("artifacts length:", data.artifacts.length);
            console.log("artifacts[0] keys:", Object.keys(data.artifacts[0]));
            const b64 = data.artifacts[0].base64;
            console.log("Base64 length:", b64 ? b64.length : "null");
            if (b64) {
                // Save it to test.png
                fs.writeFileSync("test.png", Buffer.from(b64, 'base64'));
                console.log("Saved to test.png");
            }
        } else if (data.data) {
            console.log("data length:", data.data.length);
            console.log("data[0] keys:", Object.keys(data.data[0]));
            const b64 = data.data[0].b64_json;
            console.log("Base64 length:", b64 ? b64.length : "null");
            if (b64) {
                fs.writeFileSync("test.png", Buffer.from(b64, 'base64'));
                console.log("Saved to test.png");
            }
        } else {
            console.log("Full response data:", JSON.stringify(data).substring(0, 500));
        }
    } catch (e) {
        console.error("Network or script error:", e);
    }
}

test();
