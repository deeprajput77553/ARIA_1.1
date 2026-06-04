// aria.js — Aria Local Workflow AI — Structured Pipeline Entry Point
// Replaces the monolithic ollama_agent.js with a clean 6-stage pipeline.

import fs       from 'fs';
import path     from 'path';
import http     from 'http';
import readline from 'readline';
import crypto   from 'crypto';
import { fileURLToPath } from 'url';

// ── Core ──────────────────────────────────────────────────────────────────
import { Pipeline }        from './src/core/Pipeline.js';
import { AgentContext }    from './src/core/AgentContext.js';
import { bus, AGENT_EVENTS } from './src/core/EventBus.js';
import Logger, { setWsBroadcast } from './src/utils/Logger.js';

// ── Pipeline Stages ───────────────────────────────────────────────────────
import { InputParser }     from './src/layers/InputParser.js';
import { contextManager }  from './src/layers/ContextManager.js';
import { RouterLayer }     from './src/layers/RouterLayer.js';
import { ExecutionLayer }  from './src/layers/ExecutionLayer.js';
import { ReflectionLayer } from './src/layers/ReflectionLayer.js';
import { OutputLayer, refreshInstalledModels } from './src/layers/OutputLayer.js';
import { runTerminal }     from './src/layers/ExecutionLayer.js';

// ── Plugins ───────────────────────────────────────────────────────────────
import { pluginManager }   from './src/plugins/PluginManager.js';
import WebSearch   from './src/plugins/WebSearch.js';
import Timer       from './src/plugins/Timer.js';
import Installer   from './src/plugins/Installer.js';
import OllamaPull  from './src/plugins/OllamaPull.js';
import RunCommand  from './src/plugins/RunCommand.js';
import FileReader  from './src/plugins/FileReader.js';
import GenerateImage from './src/plugins/GenerateImage.js';

// ── Register Plugins ──────────────────────────────────────────────────────
pluginManager.register(WebSearch);
pluginManager.register(Timer);
pluginManager.register(Installer);
pluginManager.register(OllamaPull);
pluginManager.register(RunCommand);
pluginManager.register(FileReader);
pluginManager.register(GenerateImage);

// ── Build Pipeline ────────────────────────────────────────────────────────
const pipeline = new Pipeline()
    .use(new InputParser())
    .use(contextManager)          // ContextManager acts as its own stage
    .use(new RouterLayer())
    .use(new ExecutionLayer())
    .use(new ReflectionLayer())
    .use(new OutputLayer());

// ── Global State ──────────────────────────────────────────────────────────
let WORKSPACE_DIR = process.cwd();
let activeAgentContext = null;
let activeAgentSocket = null;
const activeProcesses = new Map();

// ── Live Dashboard (HTTP + WebSocket) ────────────────────────────────────
const WS_PORT    = 4200;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let DASH_PATH = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(DASH_PATH)) {
    DASH_PATH = path.join(__dirname, 'dashboard', 'index.html');
}
if (!fs.existsSync(DASH_PATH)) {
    DASH_PATH = path.join(process.cwd(), 'dashboard', 'index.html');
}

let wsClients    = new Set();

function listWorkspaceFiles(dir, baseDir) {
    let results = [];
    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of list) {
            const resPath = path.join(dir, entry.name);
            const relPath = path.relative(baseDir, resPath).replace(/\\/g, '/');
            if (entry.isDirectory()) {
                if (['node_modules', '.git', '.gemini', 'dist', 'build', 'public/assets'].includes(entry.name)) continue;
                results.push({
                    name: entry.name,
                    path: relPath,
                    isDir: true
                });
                results = results.concat(listWorkspaceFiles(resPath, baseDir));
            } else {
                if (['package-lock.json', '.DS_Store', 'eslint.config.js'].includes(entry.name)) continue;
                const stats = fs.statSync(resPath);
                results.push({
                    name: entry.name,
                    path: relPath,
                    isDir: false,
                    size: stats.size,
                    mtime: stats.mtime
                });
            }
        }
    } catch (e) {
        console.error("[listWorkspaceFiles] error:", e.message);
    }
    results.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
    });
    return results;
}

async function handleClientMessage(socket, rawText) {
    try {
        console.log("[WebSocket] Raw text received from client:", rawText);
        const data = JSON.parse(rawText);
        if (data.type === 'chat:message' && data.prompt) {
            // Abort active context if it exists
            if (activeAgentContext && activeAgentContext.abortController) {
                console.log("[WebSocket] Aborting previous active AgentContext before starting new prompt");
                activeAgentContext.abortController.abort();
            }

            console.log(`[WebSocket] Processing prompt: "${data.prompt}"`);
            Logger.info(`[Chat UI] Received prompt: "${data.prompt}"`);

            const ctx = new AgentContext(data.prompt, {
                workspaceDir:     WORKSPACE_DIR,
                history:          contextManager.getHistory(),
                userProfile:      contextManager.getProfile(),
            });
            activeAgentContext = ctx;
            activeAgentSocket = socket;

            // Emit input:received event so dashboard UI updates immediately
            bus.emit(AGENT_EVENTS.INPUT_RECEIVED, { input: data.prompt });

            // Run pipeline
            try {
                await pipeline.run(ctx);
            } finally {
                if (activeAgentContext === ctx) {
                    activeAgentContext = null;
                }
                if (activeAgentSocket === socket) {
                    activeAgentSocket = null;
                }
            }
            console.log(`[WebSocket] Pipeline execution complete for prompt: "${data.prompt}"`);
        }
        else if (data.type === 'chat:stop') {
            if (activeAgentContext && activeAgentContext.abortController) {
                console.log("[WebSocket] Explicit Stop Request received. Aborting active generation...");
                activeAgentContext.abortController.abort();
                activeAgentContext = null;
            }
            activeAgentSocket = null;
        }
        else if (data.type === 'chat:sync_history' && Array.isArray(data.history)) {
            contextManager.setHistory(data.history);
            Logger.success(`[Chat UI] Synchronized conversation history with backend (${data.history.length} messages)`);
        }
        else if (data.type === 'settings:update_workspace' && data.path) {
            WORKSPACE_DIR = path.resolve(data.path);
            if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
            
            const profile = contextManager.getProfile();
            profile.workspace_dir = WORKSPACE_DIR;
            contextManager.saveProfile(profile);

            contextManager.invalidateSnapshot();
            Logger.success(`[Chat UI] Workspace changed: ${WORKSPACE_DIR}`);
            broadcastWs({ type: 'system:workspace_changed', payload: { workspaceDir: WORKSPACE_DIR } });
            
            // Broadcast files list for new workspace
            const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
            broadcastWs({ type: 'workbench:files_list', payload: { files } });
        }
        else if (data.type === 'settings:update_profile' && data.profile) {
            contextManager.saveProfile(data.profile);
            Logger.success(`[Chat UI] Profile updated`);
            broadcastWs({ type: 'system:profile_updated', payload: { profile: data.profile } });
        }
        else if (data.type === 'settings:clear_memory') {
            contextManager.clearAll();
            Logger.success(`[Chat UI] Memory and context cleared`);
            broadcastWs({ type: 'system:memory_cleared' });
            
            // Broadcast profile update as well to sync frontend
            broadcastWs({ type: 'system:profile_updated', payload: { profile: contextManager.getProfile() } });
        }
        else if (data.type === 'settings:pull_model' && data.model) {
            Logger.info(`[Chat UI] Pulling model: ${data.model}`);
            broadcastWs({
                type: 'log',
                level: 'info',
                message: `Starting pull for model: ${data.model}...`,
                ts: new Date().toISOString()
            });
            pluginManager.execute('ollama_pull', { model: data.model })
                .then(async res => {
                    Logger.success(`[Chat UI] Model pulled: ${data.model}`);
                    broadcastWs({ type: 'settings:pull_model_done', payload: { success: true, result: res, model: data.model } });
                    // Refresh and broadcast installed models list
                    const installedModels = await refreshInstalledModels().catch(() => []);
                    broadcastWs({ type: 'settings:installed_models', payload: { installedModels } });
                })
                .catch(err => {
                    Logger.error(`[Chat UI] Failed to pull model: ${err.message}`);
                    broadcastWs({ type: 'settings:pull_model_done', payload: { success: false, error: err.message, model: data.model } });
                });
        }
        // Workbench WebSocket Commands
        else if (data.type === 'workbench:list_files') {
            const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
            sendWs(socket, { type: 'workbench:files_list', payload: { files } });
        }
        else if (data.type === 'workbench:run_terminal_command' && data.command) {
            Logger.info(`[Terminal] User command execution requested: "${data.command}"`);
            
            // Kill any currently active process on this socket first
            if (activeProcesses.has(socket)) {
                try { activeProcesses.get(socket).kill(); } catch (e) {}
            }

            try {
                const { exec } = await import('child_process');
                const proc = exec(data.command, {
                    cwd: WORKSPACE_DIR,
                    shell: true,
                    encoding: 'utf-8'
                });
                
                activeProcesses.set(socket, proc);

                proc.stdout.on('data', (chunk) => {
                    sendWs(socket, { type: 'workbench:terminal_output', payload: { data: chunk } });
                });

                proc.stderr.on('data', (chunk) => {
                    sendWs(socket, { type: 'workbench:terminal_output', payload: { data: chunk, isError: true } });
                });

                proc.on('close', (code) => {
                    activeProcesses.delete(socket);
                    sendWs(socket, { type: 'workbench:terminal_done', payload: { code } });
                });
                
                proc.on('error', (err) => {
                    activeProcesses.delete(socket);
                    sendWs(socket, { type: 'workbench:terminal_output', payload: { data: `Process error: ${err.message}\n`, isError: true } });
                    sendWs(socket, { type: 'workbench:terminal_done', payload: { code: 1 } });
                });
            } catch (err) {
                sendWs(socket, { type: 'workbench:terminal_output', payload: { data: `Error executing command: ${err.message}\n`, isError: true } });
                sendWs(socket, { type: 'workbench:terminal_done', payload: { code: 1 } });
            }
        }
        else if (data.type === 'workbench:kill_terminal_command') {
            if (activeProcesses.has(socket)) {
                try {
                    activeProcesses.get(socket).kill();
                    sendWs(socket, { type: 'workbench:terminal_output', payload: { data: `\n[Process Terminated by User]\n` } });
                } catch (e) {
                    sendWs(socket, { type: 'workbench:terminal_output', payload: { data: `Error terminating process: ${e.message}\n`, isError: true } });
                }
                activeProcesses.delete(socket);
                sendWs(socket, { type: 'workbench:terminal_done', payload: { code: null } });
            }
        }
        else if (data.type === 'workbench:save_file' && data.path) {
            try {
                const targetPath = path.resolve(WORKSPACE_DIR, data.path);
                const safeBase = path.resolve(WORKSPACE_DIR);
                if (!targetPath.startsWith(safeBase)) {
                    throw new Error('Access Denied: Cannot write outside workspace directory');
                }
                fs.writeFileSync(targetPath, data.content || '', 'utf-8');
                Logger.success(`[Workbench] Saved file: ${data.path}`);
                sendWs(socket, { type: 'workbench:save_done', payload: { success: true, path: data.path } });
                
                const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
                broadcastWs({ type: 'workbench:files_list', payload: { files } });
            } catch (err) {
                Logger.error(`[Workbench] Save file failed: ${err.message}`);
                sendWs(socket, { type: 'workbench:save_done', payload: { success: false, error: err.message, path: data.path } });
            }
        }
        else if (data.type === 'workbench:create_file' && data.path) {
            try {
                const targetPath = path.resolve(WORKSPACE_DIR, data.path);
                const safeBase = path.resolve(WORKSPACE_DIR);
                if (!targetPath.startsWith(safeBase)) {
                    throw new Error('Access Denied: Cannot create outside workspace directory');
                }
                if (data.isDir) {
                    fs.mkdirSync(targetPath, { recursive: true });
                } else {
                    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                    fs.writeFileSync(targetPath, '', 'utf-8');
                }
                Logger.success(`[Workbench] Created: ${data.path}`);
                sendWs(socket, { type: 'workbench:create_done', payload: { success: true, path: data.path } });
                
                const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
                broadcastWs({ type: 'workbench:files_list', payload: { files } });
            } catch (err) {
                Logger.error(`[Workbench] Create failed: ${err.message}`);
                sendWs(socket, { type: 'workbench:create_done', payload: { success: false, error: err.message, path: data.path } });
            }
        }
        else if (data.type === 'workbench:delete_file' && data.path) {
            try {
                const targetPath = path.resolve(WORKSPACE_DIR, data.path);
                const safeBase = path.resolve(WORKSPACE_DIR);
                if (!targetPath.startsWith(safeBase)) {
                    throw new Error('Access Denied: Cannot delete outside workspace directory');
                }
                if (fs.existsSync(targetPath)) {
                    const stats = fs.statSync(targetPath);
                    if (stats.isDirectory()) {
                        fs.rmSync(targetPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(targetPath);
                    }
                    Logger.success(`[Workbench] Deleted: ${data.path}`);
                    sendWs(socket, { type: 'workbench:delete_done', payload: { success: true, path: data.path } });
                    
                    const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
                    broadcastWs({ type: 'workbench:files_list', payload: { files } });
                } else {
                    throw new Error('File not found');
                }
            } catch (err) {
                Logger.error(`[Workbench] Delete failed: ${err.message}`);
                sendWs(socket, { type: 'workbench:delete_done', payload: { success: false, error: err.message, path: data.path } });
            }
        }
        else if (data.type === 'workbench:execute_tool' && data.name && data.params) {
            Logger.info(`[Workbench] Executing plugin "${data.name}" directly`);
            broadcastWs({
                type: 'log',
                level: 'info',
                message: `[Workbench API] Direct tool execute started: ${data.name}...`,
                ts: new Date().toISOString()
            });
            pluginManager.execute(data.name, data.params, WORKSPACE_DIR)
                .then(result => {
                    Logger.success(`[Workbench API] Direct tool execute complete: ${data.name}`);
                    sendWs(socket, { type: 'workbench:execute_done', payload: { success: true, name: data.name, result } });
                    
                    // If image was generated or file created, update files list
                    if (data.name === 'generate_image' || data.name === 'run_command' || data.name === 'installer') {
                        const files = listWorkspaceFiles(WORKSPACE_DIR, WORKSPACE_DIR);
                        broadcastWs({ type: 'workbench:files_list', payload: { files } });
                    }
                })
                .catch(err => {
                    Logger.error(`[Workbench API] Direct tool execute failed: ${err.message}`);
                    sendWs(socket, { type: 'workbench:execute_done', payload: { success: false, name: data.name, error: err.message } });
                });
        }
    } catch (err) {
        console.error("[WebSocket] Error in handleClientMessage:", err);
        Logger.error(`[WebSocket] Error handling client message: ${err.message}`);
    }
}

function decodeWsFrame(buf) {
    if (buf.length < 2) return null;
    const firstByte = buf[0];
    const opcode = firstByte & 0x0f;
    
    if (opcode === 8) return { type: 'close', length: 2 };
    
    const secondByte = buf[1];
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLen = secondByte & 0x7f;
    let offset = 2;
    
    if (payloadLen === 126) {
        if (buf.length < 4) return null;
        payloadLen = buf.readUInt16BE(2);
        offset = 4;
    } else if (payloadLen === 127) {
        if (buf.length < 10) return null;
        payloadLen = buf.readUInt32BE(6); // lower 32-bits of 64-bit length
        offset = 10;
    }
    
    let maskingKeyOffset = offset;
    if (isMasked) {
        offset += 4;
    }
    
    if (buf.length < offset + payloadLen) {
        return null;
    }
    
    const data = Buffer.alloc(payloadLen);
    if (isMasked) {
        const mask = buf.slice(maskingKeyOffset, maskingKeyOffset + 4);
        for (let i = 0; i < payloadLen; i++) {
            data[i] = buf[offset + i] ^ mask[i % 4];
        }
    } else {
        buf.copy(data, 0, offset, offset + payloadLen);
    }
    
    return {
        type: opcode === 1 ? 'text' : 'binary',
        payload: data.toString('utf8'),
        length: offset + payloadLen
    };
}

function startDashboard() {
    if (!fs.existsSync(DASH_PATH)) {
        Logger.debug('Dashboard HTML not found — skipping dashboard server.');
        return;
    }
    const DASH_DIR = path.dirname(DASH_PATH);
    const server = http.createServer((req, res) => {
        // Enable CORS for local development requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const urlPath = req.url.split('?')[0];

        if (urlPath === '/' || urlPath === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            fs.createReadStream(DASH_PATH).pipe(res);
        } else if (urlPath.startsWith('/workspace/')) {
            // Serve files from the workspace directory securely
            try {
                const relativePath = decodeURIComponent(urlPath.slice(11));
                const targetPath = path.resolve(WORKSPACE_DIR, relativePath);
                const safeBase = path.resolve(WORKSPACE_DIR);
                
                // Security check: ensure path does not escape the workspace directory
                if (!targetPath.startsWith(safeBase)) {
                    res.writeHead(403);
                    res.end('Access Denied');
                    return;
                }
                
                if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
                    const ext = path.extname(targetPath).toLowerCase();
                    let contentType = 'application/octet-stream';
                    let headers = {};
                    
                    if (ext === '.png') contentType = 'image/png';
                    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                    else if (ext === '.gif') contentType = 'image/gif';
                    else if (ext === '.svg') contentType = 'image/svg+xml';
                    
                    headers['Content-Type'] = contentType;
                    
                    // If it is a docx document or markdown file, download as attachment
                    if (ext === '.docx' || ext === '.md' || ext === '.pdf' || ext === '.txt') {
                        headers['Content-Disposition'] = `attachment; filename="${path.basename(targetPath)}"`;
                    }
                    
                    res.writeHead(200, headers);
                    fs.createReadStream(targetPath).pipe(res);
                } else {
                    res.writeHead(404);
                    res.end('File Not Found');
                }
            } catch (err) {
                res.writeHead(500);
                res.end(`Internal Server Error: ${err.message}`);
            }
        } else {
            const filePath = path.join(DASH_DIR, urlPath);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath);
                let contentType = 'text/plain';
                if (ext === '.js') contentType = 'application/javascript';
                else if (ext === '.css') contentType = 'text/css';
                else if (ext === '.svg') contentType = 'image/svg+xml';
                else if (ext === '.png') contentType = 'image/png';
                
                res.writeHead(200, { 'Content-Type': contentType });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404); res.end('Not found');
            }
        }
    });

    // Minimal WebSocket upgrade handling (no external dep)
    server.on('upgrade', async (req, socket) => {
        const key    = req.headers['sec-websocket-key'];
        const hash   = crypto.createHash('sha1')
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');
        socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${hash}`,
            '\r\n'
        ].join('\r\n'));

        socket.resume();

        let socketBuf = Buffer.alloc(0);
        socket.on('data', (chunk) => {
            console.log(`[WebSocket] TCP data chunk received, size: ${chunk.length} bytes`);
            socketBuf = Buffer.concat([socketBuf, chunk]);
            while (true) {
                const frame = decodeWsFrame(socketBuf);
                if (!frame) {
                    console.log(`[WebSocket] Incomplete frame in buffer, remaining size: ${socketBuf.length} bytes`);
                    break;
                }
                
                console.log(`[WebSocket] Frame decoded successfully, type: ${frame.type}, size: ${frame.length} bytes`);
                if (frame.type === 'close') {
                    wsClients.delete(socket);
                    socket.end();
                    break;
                }
                
                if (frame.type === 'text') {
                    handleClientMessage(socket, frame.payload);
                }
                
                socketBuf = socketBuf.slice(frame.length);
            }
        });

        const handleClientDisconnect = () => {
            wsClients.delete(socket);
            if (activeProcesses.has(socket)) {
                try { activeProcesses.get(socket).kill(); } catch (e) {}
                activeProcesses.delete(socket);
            }
            if (activeAgentSocket === socket) {
                if (activeAgentContext && activeAgentContext.abortController) {
                    console.log("[WebSocket] Active client disconnected. Aborting active generation...");
                    activeAgentContext.abortController.abort();
                }
                activeAgentContext = null;
                activeAgentSocket = null;
            } else if (wsClients.size === 0 && activeAgentContext && activeAgentContext.abortController) {
                console.log("[WebSocket] No clients connected. Aborting active generation...");
                activeAgentContext.abortController.abort();
                activeAgentContext = null;
                activeAgentSocket = null;
            }
        };

        socket.on('error', () => {
            handleClientDisconnect();
            socket.destroy();
        });
        socket.on('end', () => {
            handleClientDisconnect();
            socket.end();
        });
        socket.on('close', () => {
            handleClientDisconnect();
        });
        wsClients.add(socket);

        // Send initial state sync event
        const installedModels = await refreshInstalledModels().catch(() => []);
        sendWs(socket, {
            type: 'system:sync',
            payload: {
                workspaceDir: WORKSPACE_DIR,
                profile: contextManager.getProfile(),
                history: contextManager.getHistory(),
                installedModels,
                plugins: pluginManager.getAll().map(p => ({
                    name: p.name,
                    description: p.description,
                    schema: p.schema || {}
                }))
            }
        });

        // Replay recent event history to new client
        const history = bus.getHistory(30);
        history.forEach(evt => sendWs(socket, evt));

        Logger.debug(`[Dashboard] WebSocket client connected (total: ${wsClients.size})`);
        bus.emit(AGENT_EVENTS.WS_CLIENT_CONNECTED, { clientCount: wsClients.size });
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            Logger.warn(`Dashboard port ${WS_PORT} is already in use (likely by another Aria instance). Dashboard will not start, but Aria will continue to work.`);
        } else {
            Logger.error(`Dashboard server error: ${e.message}`);
        }
    });

    server.listen(WS_PORT, () => {
        Logger.info(`@ Dashboard: http://localhost:${WS_PORT}`);
    });
}

function sendWs(socket, data) {
    try {
        const msg = JSON.stringify(data);
        const buf = Buffer.from(msg);
        let header;
        
        if (buf.length < 126) {
            header = Buffer.alloc(2);
            header[0] = 0x81; // text frame
            header[1] = buf.length;
        } else if (buf.length < 65536) {
            header = Buffer.alloc(4);
            header[0] = 0x81;
            header[1] = 126;
            header.writeUInt16BE(buf.length, 2);
        } else {
            header = Buffer.alloc(10);
            header[0] = 0x81;
            header[1] = 127;
            header.writeUInt32BE(0, 2); // High 32 bits
            header.writeUInt32BE(buf.length, 6); // Low 32 bits
        }
        
        socket.write(Buffer.concat([header, buf]));
    } catch (err) {
        wsClients.delete(socket);
    }
}

function broadcastWs(data) {
    wsClients.forEach(s => sendWs(s, data));
}

// Wire EventBus → WebSocket broadcast
bus.on('*', (evt) => broadcastWs(evt));
setWsBroadcast(broadcastWs);

// ── Built-in Command Handler ──────────────────────────────────────────────
async function handleBuiltin(ctx) {
    const cmd = ctx.parsedCommand;
    switch (cmd.type) {
    case 'exit':
        Logger.info('Goodbye!');
        process.exit(0);
        break;
    case 'models': {
        const { stdout } = runTerminal('ollama list');
        console.log(`\n+ Ollama Models:\n${stdout}\n`);
        ctx.builtinResult = stdout;
        break;
    }
    case 'profile': {
        const p = contextManager.getProfile();
        console.log(`\n@ User Profile:\n${JSON.stringify(p, null, 2)}\n`);
        ctx.builtinResult = JSON.stringify(p);
        break;
    }
    case 'clear':
        contextManager.clearAll();
        console.log('\n~ Memory, history, and user profile have been cleared and reset.\n');
        ctx.builtinResult = 'cleared';
        break;
    case 'run': {
        const { stdout, stderr, code } = runTerminal(cmd.args);
        const out = (stdout + stderr).trim();
        console.log(`\n${code === 0 ? '✅' : '❌'} Exit ${code}:\n${out}\n`);
        ctx.builtinResult = out;
        break;
    }
    case 'install': {
        const result = await pluginManager.execute('install', { manager: 'npm', package: cmd.args });
        console.log(`\n${result}\n`);
        ctx.builtinResult = result;
        break;
    }
    case 'pull': {
        const result = await pluginManager.execute('ollama_pull', { model: cmd.args });
        console.log(`\n${result}\n`);
        ctx.builtinResult = result;
        break;
    }
    case 'workspace':
        WORKSPACE_DIR = path.resolve(cmd.args);
        if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
        contextManager.invalidateSnapshot();
        console.log(`\n🔒  Workspace changed to: ${WORKSPACE_DIR}\n`);
        ctx.builtinResult = WORKSPACE_DIR;
        break;
    case 'help':
        printHelp();
        ctx.builtinResult = 'help';
        break;
    case 'status':
        printStatus();
        ctx.builtinResult = 'status';
        break;
    default:
        ctx.builtinResult = 'unknown command';
    }
}

function printHelp() {
    console.log(`
\x1b[1m\x1b[96m━━━  Aria — Command Reference  ━━━\x1b[0m

  \x1b[93mexit\x1b[0m              Quit Aria
  \x1b[93m/models\x1b[0m           List installed Ollama models
  \x1b[93m/profile\x1b[0m          Show current user profile
  \x1b[93m/clear\x1b[0m            Reset memory, history & profile
  \x1b[93m/run <cmd>\x1b[0m        Execute a shell command directly
  \x1b[93m/install <pkg>\x1b[0m    Install an npm package
  \x1b[93m/pull <model>\x1b[0m     Download an Ollama model
  \x1b[93m/workspace <dir>\x1b[0m  Change workspace directory
  \x1b[93m/status\x1b[0m           Show system status
  \x1b[93m/help\x1b[0m             Show this help

  \x1b[2mPlugins: ${pluginManager.getNames().join(', ')}\x1b[0m
  \x1b[2mDashboard: http://localhost:${WS_PORT}\x1b[0m
`);
}

function printStatus() {
    const profile = contextManager.getProfile();
    const history = contextManager.getHistory();
    console.log(`
\x1b[1m\x1b[96m━━━  Aria — System Status  ━━━\x1b[0m

  Workspace : ${WORKSPACE_DIR}
  User      : ${profile.user_name} | ${profile.operating_system}
  Memory    : ${history.length} messages stored
  Plugins   : ${pluginManager.getNames().join(', ')}
  Dashboard : http://localhost:${WS_PORT}
  WS Clients: ${wsClients.size}
`);
}

// ── Main Interaction Loop ─────────────────────────────────────────────────
async function startServer() {
    let profile = contextManager.getProfile();
    let detectedWs = profile.workspace_dir;
    if (!detectedWs) {
        const userHome = process.env.USERPROFILE || process.env.HOME || process.cwd();
        detectedWs = path.join(userHome, 'Desktop', 'AriaWorkspace');
        profile.workspace_dir = detectedWs;
        contextManager.saveProfile(profile);
    }
    WORKSPACE_DIR = path.resolve(detectedWs);
    if (!fs.existsSync(WORKSPACE_DIR)) {
        fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
    }

    // Banner
    Logger.banner([
        '\x1b[1m\x1b[96m🚀  Aria AI Backend Server  v2.0\x1b[0m',
        '\x1b[2m  Structured Pipeline · Web UI Chat Workspace\x1b[0m',
        '',
        `  🔵 Router   : llama3.2:1b`,
        `  🟢 Reactive  : llama3:latest  (streaming)`,
        `  🟡 Complex   : qwen2.5-coder:7b`,
        `  🟠 Verify    : codellama:latest`,
        `  🌐 Dashboard : http://localhost:4200`,
        `  📁 Workspace : ${WORKSPACE_DIR}`,
    ]);

    // Start dashboard server
    startDashboard();
}

startServer();
