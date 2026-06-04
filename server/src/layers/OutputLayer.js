// src/layers/OutputLayer.js
// Ollama API caller with real-time token streaming + typed display helpers

import Logger from '../utils/Logger.js';
import { bus, AGENT_EVENTS } from '../core/EventBus.js';

export const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';

// ── Model Registry ──────────────────────────────────────────────────────────
export const MODELS = {
    ROUTER:   'llama3.2:1b',       // fast JSON classifier
    REACTIVE: 'llama3:latest',     // chat / quick answers
    COMPLEX:  'qwen2.5-coder:7b',  // code + multi-step planning
    VERIFY:   'codellama:latest',  // code review
};

export async function getInstalledModels() {
    try {
        const tagsUrl = OLLAMA_URL.replace('/chat', '/tags');
        const res = await fetch(tagsUrl, { method: 'GET' });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.models || []).map(m => ({
            name: m.name,
            size: m.size,
            format: m.details?.format || 'gguf',
            parameterSize: m.details?.parameter_size || 'N/A',
            quantizationLevel: m.details?.quantization_level || 'N/A'
        }));
    } catch {
        return [];
    }
}

let cachedInstalledModels = null;
let lastCheckTime = 0;

export async function refreshInstalledModels() {
    const now = Date.now();
    if (cachedInstalledModels && (now - lastCheckTime < 15000)) {
        return cachedInstalledModels;
    }
    const list = await getInstalledModels();
    cachedInstalledModels = list;
    lastCheckTime = now;
    return list;
}

export async function resolveModelFallback(requestedModel) {
    try {
        const installedList = await refreshInstalledModels();
        if (!installedList || installedList.length === 0) {
            return requestedModel;
        }
        
        const installed = installedList.map(m => typeof m === 'string' ? m : m.name);
        
        // Exact match
        if (installed.includes(requestedModel)) {
            return requestedModel;
        }
        
        // Match without tag
        const cleanName = requestedModel.split(':')[0];
        const matchWithoutTag = installed.find(m => m.split(':')[0] === cleanName);
        if (matchWithoutTag) return matchWithoutTag;

        // Try standard category matches
        if (requestedModel.includes('coder') || requestedModel.includes('qwen')) {
            const fallback = installed.find(m => m.includes('coder') || m.includes('qwen') || m.includes('llama3'));
            if (fallback) return fallback;
        } else if (requestedModel.includes('1b') || requestedModel.includes('router') || requestedModel.includes('3.2')) {
            const fallback = installed.find(m => m.includes('1b') || m.includes('3b') || m.includes('8b') || m.includes('llama3.2') || m.includes('llama3'));
            if (fallback) return fallback;
        }

        // Return first installed model as ultimate fallback
        return installed[0];
    } catch {
        return requestedModel;
    }
}

// ── JSON Extractor ──────────────────────────────────────────────────────────
export function extractJson(text) {
    if (!text) return null;
    // Strip Qwen3/think blocks
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    try { return JSON.parse(cleaned); } catch {}
    const stripped = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try { return JSON.parse(stripped); } catch {}
    // Brace scan
    let depth = 0, start = -1, inStr = false, esc = false;
    for (let i = 0; i < cleaned.length; i++) {
        const c = cleaned[i];
        if (inStr)  { esc = !esc && c === '\\'; if (!esc && c === '"') inStr = false; }
        else if (c === '"') inStr = true;
        else if (c === '{') { if (start === -1) start = i; depth++; }
        else if (c === '}' && start !== -1) {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(cleaned.slice(start, i + 1)); }
                catch { start = -1; }
            }
        }
    }
    return null;
}

// ── Non-streaming call (JSON mode) ─────────────────────────────────────────
export async function callOllama(messages, model = MODELS.REACTIVE, jsonFormat = false, signal = null) {
    const resolvedModel = await resolveModelFallback(model);
    if (resolvedModel !== model) {
        Logger.warn(`[Model Fallback] Requested model "${model}" not found. Using "${resolvedModel}".`);
    }
    const payload    = { model: resolvedModel, messages, stream: false };
    if (jsonFormat) payload.format = 'json';
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), 120_000);
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', () => controller.abort());
        }
    }
    try {
        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        return data.message?.content ?? null;
    } catch (err) {
        clearTimeout(timer);
        const cause = err.cause ? ` | ${err.cause.code ?? err.cause.message ?? err.cause}` : '';
        Logger.error(`Ollama [${model}] unreachable: ${err.message}${cause}`);
        Logger.warn('→ Make sure Ollama is running: ollama serve');
        return null;
    }
}

// ── Streaming call — emits tokens in real-time ──────────────────────────────
export async function callOllamaStream(messages, model = MODELS.REACTIVE, onToken = null, signal = null) {
    const resolvedModel = await resolveModelFallback(model);
    if (resolvedModel !== model) {
        Logger.warn(`[Model Fallback] Requested model "${model}" not found. Using "${resolvedModel}".`);
    }
    const payload = { model: resolvedModel, messages, stream: true };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            signal.addEventListener('abort', () => controller.abort());
        }
    }

    try {
        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${res.statusText}`);

        let fullText = '';
        const decoder = new TextDecoder();
        let buf = '';

        for await (const chunk of res.body) {
            buf += decoder.decode(chunk, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop(); // keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const data = JSON.parse(trimmed);
                    const token = data.message?.content || '';
                    if (token) {
                        fullText += token;
                        if (onToken) onToken(token);
                        else Logger.token(token);
                        bus.emit(AGENT_EVENTS.STREAM_TOKEN, { token });
                    }
                    if (data.done) {
                        bus.emit(AGENT_EVENTS.STREAM_DONE, { totalTokens: fullText.length });
                    }
                } catch { /* skip malformed JSON line */ }
            }
        }

        // Flush remaining buffer
        if (buf.trim()) {
            try {
                const data = JSON.parse(buf.trim());
                const token = data.message?.content || '';
                if (token) {
                    fullText += token;
                    if (onToken) onToken(token);
                    else Logger.token(token);
                }
            } catch {}
        }

        return fullText;
    } catch (err) {
        clearTimeout(timer);
        const cause = err.cause ? ` | ${err.cause.code ?? err.cause.message}` : '';
        Logger.error(`Ollama Stream [${model}] error: ${err.message}${cause}`);
        return null;
    }
}

// ── Convenience model wrappers ──────────────────────────────────────────────
export const routerModel   = (msgs, json = true, signal = null) => callOllama(msgs, MODELS.ROUTER,   json, signal);
export const reactModel    = (msgs, signal = null)              => callOllamaStream(msgs, MODELS.REACTIVE, null, signal);
export const complexModel  = (msgs, json = true, signal = null) => callOllama(msgs, MODELS.COMPLEX,  json, signal);
export const verifyModel   = (msgs, signal = null)              => callOllama(msgs, MODELS.VERIFY,   false, signal);

// ── Output Stage ────────────────────────────────────────────────────────────
export class OutputLayer {
    get name() { return 'OutputLayer'; }

    async process(ctx) {
        if (!ctx.finalOutput) return;

        Logger.nl();
        Logger.divider('─', 62);
        Logger.banner([
            `\x1b[1m\x1b[96m> Aria\x1b[0m`,
        ]);

        // The output was already streamed token-by-token during reactive mode.
        // For complex/terminal modes, display the final result now.
        if (ctx.routeDecision?.mode !== 'reactive') {
            console.log(`\x1b[93m${ctx.finalOutput}\x1b[0m`);
        }

        Logger.nl();
        Logger.divider('─', 62);

        bus.emit(AGENT_EVENTS.OUTPUT_READY, { output: ctx.finalOutput });
    }
}

export default OutputLayer;
