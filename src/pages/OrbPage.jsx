import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, Play, Square, RefreshCw, X, MessageSquare, Database, ChevronDown, User, Copy, Check, Download, Printer, ZoomIn, ZoomOut, FileText } from 'lucide-react';

// --- GLSL Shaders ---

const vertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uState; // 0: idle, 1: listen, 2: speak
    uniform float uAudioData;

    // Simplex 3D Noise by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        float noiseFreq = 1.5;
        float noiseAmp = 0.2;
        vec3 noisePos = vec3(position.x * noiseFreq + uTime, position.y * noiseFreq + uTime, position.z * noiseFreq);
        
        float distortion = snoise(noisePos) * noiseAmp;
        
        if (uState == 1.0) { // Listen
            distortion += snoise(noisePos * 2.0) * 0.35 * uAudioData;
        } else if (uState == 2.0) { // Speak
            distortion += sin(position.y * 10.0 + uTime * 6.0) * 0.15 * uAudioData;
        }

        vec3 newPosition = position + normal * distortion;
        vPosition = newPosition;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uState;

    void main() {
        vec3 colorDark = vec3(0.08, 0.02, 0.4); // Deep Purple/Indigo
        vec3 colorLight = vec3(0.0, 0.8, 1.0); // Cyan/Teal
        vec3 colorAccent = vec3(1.0, 0.0, 1.0); // Neon Magenta
        
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnelTerm = dot(viewDirection, vNormal);
        fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
        fresnelTerm = pow(fresnelTerm, 2.0);

        float mixValue = sin(vPosition.y * 2.0 + uTime) * 0.5 + 0.5;
        vec3 color = mix(colorDark, colorLight, mixValue);
        
        if (uState == 1.0) { // Listen
            color = mix(color, colorAccent, fresnelTerm * 1.6);
        } else if (uState == 2.0) { // Speak
            vec3 colorA = vec3(1.0, 0.0, 0.5); // Pink
            vec3 colorB = vec3(0.0, 1.0, 0.6); // Emerald Mint
            vec3 colorC = vec3(1.0, 0.8, 0.0); // Solar Gold
            
            float colorMix = sin(vPosition.x * 2.0 + uTime * 5.0) * 0.5 + 0.5;
            vec3 speakColor = mix(colorA, colorB, colorMix);
            speakColor = mix(speakColor, colorC, sin(uTime * 3.0) * 0.5 + 0.5);
            
            color = mix(color, speakColor, fresnelTerm * 1.8);
        } else {
            color = mix(color, colorAccent, fresnelTerm);
        }

        gl_FragColor = vec4(color + fresnelTerm * 1.3, 0.95);
    }
`;

const layerFragmentShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uColor;

    void main() {
        vec3 color1 = vec3(0.5, 0.0, 1.0); // Purple
        vec3 color2 = vec3(0.0, 1.0, 0.8); // Teal
        vec3 color3 = vec3(1.0, 0.35, 0.0); // Orange
        
        vec3 baseColor = color1;
        if(uColor > 0.5) baseColor = color2;
        if(uColor > 1.5) baseColor = color3;

        float fresnel = pow(1.0 - dot(vec3(0,0,1), vNormal), 3.0);
        float pulse = sin(uTime * 2.0 + vPosition.x) * 0.5 + 0.5;
        
        gl_FragColor = vec4(baseColor, fresnel * pulse * 0.6);
    }
`;

const particleVertexShader = `
    uniform float uTime;
    uniform float uState;
    uniform float uAudioData;
    attribute vec3 aRandom;
    varying float vAlpha;
    varying vec3 vPosition;

    void main() {
        vPosition = position;
        vec3 pos = position;
        
        float waveSpeed = 0.8 + aRandom.x * 1.2;
        float waveAmp = 0.15 + aRandom.y * 0.15;
        
        if (uState == 1.0) { // Listen
            waveSpeed *= 1.8;
            waveAmp *= (1.0 + uAudioData * 1.6);
        } else if (uState == 2.0) { // Speak
            waveSpeed *= 2.6;
            waveAmp *= (1.0 + uAudioData * 2.6);
        }
        
        vec3 dir = normalize(pos);
        float timeFactor = uTime * waveSpeed;
        
        float displacement = sin(pos.y * 2.0 + timeFactor + aRandom.z * 6.28) * 
                             cos(pos.x * 2.0 + timeFactor * 0.8 + aRandom.y * 6.28) * waveAmp;
                             
        pos += dir * displacement;
        
        float angle = uTime * 0.08 * (aRandom.x - 0.5);
        float cosAngle = cos(angle);
        float sinAngle = sin(angle);
        float rx = pos.x * cosAngle - pos.z * sinAngle;
        float rz = pos.x * sinAngle + pos.z * cosAngle;
        pos.x = rx;
        pos.z = rz;
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        gl_PointSize = (4.0 + aRandom.z * 6.0) * (3.0 / -mvPosition.z);
        vAlpha = 0.4 + aRandom.z * 0.6;
    }
`;

const particleFragmentShader = `
    uniform float uTime;
    uniform float uState;
    varying float vAlpha;
    varying vec3 vPosition;

    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.45) discard;
        
        float edgeAlpha = smoothstep(0.45, 0.40, dist);
        
        vec3 colorCyan = vec3(0.0, 0.8, 1.0);
        vec3 colorPurple = vec3(0.5, 0.0, 1.0);
        vec3 colorMagenta = vec3(1.0, 0.0, 0.5);
        vec3 colorGold = vec3(1.0, 0.8, 0.0);
        
        vec3 baseColor = colorCyan;
        
        if (uState == 1.0) { // Listen
            baseColor = mix(colorCyan, colorMagenta, sin(uTime * 3.0 + vPosition.y) * 0.5 + 0.5);
        } else if (uState == 2.0) { // Speak
            baseColor = mix(colorMagenta, colorGold, sin(uTime * 5.0 + vPosition.x) * 0.5 + 0.5);
        } else { // Idle
            baseColor = mix(colorPurple, colorCyan, sin(uTime * 0.5 + vPosition.z) * 0.5 + 0.5);
        }
        
        gl_FragColor = vec4(baseColor, edgeAlpha * vAlpha * 0.95);
    }
`;

const atmosphereVertexShader = `
    varying vec3 vPosition;
    varying float vNoise;
    varying float vAlpha;
    uniform float uTime;
    uniform float uState;
    uniform float uAudioData;
    attribute vec3 aRandom;

    // Simplex 3D Noise by Ian McEwan, Ashima Arts
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        float n_ = 1.0/7.0;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vPosition = position;
        
        float speed = 0.4 + aRandom.x * 0.6;
        float timeFactor = uTime * speed;
        float noiseVal = snoise(position * 0.8 + vec3(0.0, 0.0, timeFactor));
        vNoise = noiseVal * 0.5 + 0.5;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        gl_PointSize = 8.0 * (3.0 / -mvPosition.z);
        vAlpha = 0.35 + aRandom.y * 0.35;
    }
`;

const atmosphereFragmentShader = `
    varying vec3 vPosition;
    varying float vNoise;
    varying float vAlpha;
    uniform float uTime;
    uniform float uState;
    uniform float uAudioData;

    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);
        if (dist > 0.45) discard;
        
        float edgeAlpha = smoothstep(0.45, 0.40, dist);
        
        vec3 colorCyan = vec3(0.0, 0.8, 1.0);
        vec3 colorPurple = vec3(0.4, 0.0, 0.9);
        vec3 colorMagenta = vec3(1.0, 0.0, 0.6);
        vec3 colorGold = vec3(1.0, 0.7, 0.0);
        
        vec3 baseColor = colorPurple;
        float opacity = vAlpha;
        
        if (uState == 1.0) { // Listen
            baseColor = mix(colorCyan, colorMagenta, vNoise);
            opacity *= (1.0 + uAudioData * 0.4);
        } else if (uState == 2.0) { // Speak
            baseColor = mix(colorMagenta, colorGold, vNoise);
            opacity *= (1.0 + uAudioData * 0.6);
        } else { // Idle
            baseColor = mix(colorPurple, colorCyan, vNoise * 0.5);
        }
        
        gl_FragColor = vec4(baseColor, edgeAlpha * opacity * 0.8);
    }
`;

function OrbPage({ messages, setMessages, connected, wsRef, profile, orbSentPrompt, setOrbSentPrompt }) {
    const canvasContainerRef = useRef(null);
    const [orbState, setOrbState] = useState(1); // 0: Idle, 1: Listen, 2: Speak
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [autoMode, setAutoMode] = useState(true);
    const [manuallyPaused, setManuallyPaused] = useState(false);
    const [recognitionText, setRecognitionText] = useState('');
    const [systemStatus, setSystemStatus] = useState('LISTENING');
    const [errorMessage, setErrorMessage] = useState('');

    const [previewFile, setPreviewFile] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [zoom, setZoom] = useState(100);
    const [paperTheme, setPaperTheme] = useState('light');
    const [expandedPipelines, setExpandedPipelines] = useState({});
    const [copiedId, setCopiedId] = useState(null);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('aria_orb_view_mode') || 'minimal');
    const previewContainerRef = useRef(null);

    // Refs to track states in real-time inside Web Speech event callbacks (prevent stale closures)
    const isSpeakingRef = useRef(isSpeaking);
    const autoModeRef = useRef(autoMode);
    const orbStateRef = useRef(orbState);
    const systemStatusRef = useRef(systemStatus);
    const manuallyPausedRef = useRef(manuallyPaused);

    useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
    useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
    useEffect(() => { orbStateRef.current = orbState; }, [orbState]);
    useEffect(() => { systemStatusRef.current = systemStatus; }, [systemStatus]);
    useEffect(() => { manuallyPausedRef.current = manuallyPaused; }, [manuallyPaused]);


    useEffect(() => {
        if (!previewFile || !previewContainerRef.current) return;
        
        let active = true;
        setLoadingPreview(true);
        
        // Clear previous content
        previewContainerRef.current.innerHTML = '';
        
        const loadDocx = async () => {
            try {
                const response = await fetch(previewFile.url);
                if (!response.ok) throw new Error("Failed to fetch document");
                const arrayBuffer = await response.arrayBuffer();
                
                if (!active) return;
                
                // Import docx-preview dynamically
                const docx = await import('docx-preview');
                
                if (!active) return;
                
                await docx.renderAsync(arrayBuffer, previewContainerRef.current, null, {
                    className: "docx-preview-container",
                    inWrapper: false,
                    ignoreWidth: true,
                    ignoreHeight: true,
                });
            } catch (err) {
                console.error("Failed to render docx:", err);
                if (active && previewContainerRef.current) {
                    previewContainerRef.current.innerHTML = `<div class="preview-error">Failed to load and render document: ${err.message}</div>`;
                }
            } finally {
                if (active) setLoadingPreview(false);
            }
        };
        
        loadDocx();
        
        return () => {
            active = false;
        };
    }, [previewFile]);

    const renderMessageContent = (msg) => {
        if (!msg.text) {
            if (msg.id === 'ai-pending') {
                return (
                    <span className="thinking-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                );
            }
            return '';
        }

        const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
        const apiBase = isDev ? 'http://localhost:4200' : window.location.origin;

        const imgRegex = /images\/[a-zA-Z0-9_\-]+\.png/g;
        const imagesFound = [...new Set([...msg.text.matchAll(imgRegex)].map(m => m[0]))];

        const docxRegex = /\b[a-zA-Z0-9_\-]+\.docx\b/g;
        const docxFound = [...new Set([...msg.text.matchAll(docxRegex)].map(m => m[0]))];
        
        const mdRegex = /\b[a-zA-Z0-9_\-]+\.md\b/g;
        const mdFound = [...new Set([...msg.text.matchAll(mdRegex)].map(m => m[0]))].filter(f => f !== 'plan.md' && f !== 'README.md');

        const renderLineInline = (str) => {
            const regex = /(!\[.*?\]\(.*?\))|(\[.*?\]\(.*?\))|(\*\*.*?\*\*)|(\`.*?\`)/g;
            const parts = str.split(regex);
            
            return parts.map((part, partIdx) => {
                if (!part) return null;
                
                // 1. Scraped Web Image
                if (part.startsWith('![') && part.endsWith(')')) {
                    const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
                    if (imgMatch) {
                        const alt = imgMatch[1];
                        const url = imgMatch[2];
                        return (
                            <div key={partIdx} className="scraped-image-card-inline">
                                <div className="scraped-image-wrapper">
                                    <img 
                                        src={url} 
                                        alt={alt} 
                                        className="scraped-image-element" 
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }} 
                                    />
                                    <div className="scraped-image-error" style={{ display: 'none' }}>
                                        <span>Failed to load image</span>
                                    </div>
                                </div>
                                <div className="scraped-image-title">{alt || 'Scraped Image'}</div>
                            </div>
                        );
                    }
                }
                
                // 2. Clickable Web Link
                if (part.startsWith('[') && part.endsWith(')')) {
                    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
                    if (linkMatch) {
                        const label = linkMatch[1];
                        const url = linkMatch[2];
                        return (
                            <a 
                                key={partIdx} 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="scraped-link-element"
                            >
                                {label}
                            </a>
                        );
                    }
                }
                
                // 3. Bold Text
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={partIdx} className="md-bold">{part.slice(2, -2)}</strong>;
                }
                
                // 4. Inline Code
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={partIdx} className="md-inline-code">{part.slice(1, -1)}</code>;
                }
                
                // Plain Text
                return <span key={partIdx}>{part}</span>;
            });
        };

        const parseMarkdownToReact = (text) => {
            const lines = text.split('\n');
            return lines.map((line, lineIdx) => {
                // Headers
                if (line.startsWith('### ')) {
                    return <h4 key={lineIdx} className="md-h4">{renderLineInline(line.slice(4))}</h4>;
                }
                if (line.startsWith('## ')) {
                    return <h3 key={lineIdx} className="md-h3">{renderLineInline(line.slice(3))}</h3>;
                }
                if (line.startsWith('# ')) {
                    return <h2 key={lineIdx} className="md-h2">{renderLineInline(line.slice(2))}</h2>;
                }
                
                // Lists
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    return (
                        <div key={lineIdx} className="md-list-item">
                            <span className="md-bullet">•</span>
                            <span className="md-list-text">{renderLineInline(line.slice(2))}</span>
                        </div>
                    );
                }
                
                const numListMatch = line.match(/^(\d+)\.\s(.*)/);
                if (numListMatch) {
                    const num = numListMatch[1];
                    const content = numListMatch[2];
                    return (
                        <div key={lineIdx} className="md-list-item numbered">
                            <span className="md-number">{num}.</span>
                            <span className="md-list-text">{renderLineInline(content)}</span>
                        </div>
                    );
                }
                
                return <div key={lineIdx} className="chat-text-line">{renderLineInline(line)}</div>;
            });
        };

        return (
            <div className="rendered-message-body">
                <div className="message-text-paragraphs">{parseMarkdownToReact(msg.text)}</div>
                
                {/* Render local NVIDIA FLUX generated images */}
                {imagesFound.length > 0 && (
                    <div className="generated-images-gallery">
                        {imagesFound.map((imgName, idx) => {
                            const imgSrc = `${apiBase}/workspace/${imgName}`;
                            return (
                                <div key={idx} className="generated-image-card">
                                    <div className="image-card-preview-wrapper">
                                        <img 
                                            src={imgSrc} 
                                            alt="Generated by Aria" 
                                            className="generated-image-element"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div className="image-error-fallback" style={{ display: 'none' }}>
                                            <span>Image failed to load</span>
                                        </div>
                                    </div>
                                    <a 
                                        href={imgSrc} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="image-card-action-btn"
                                    >
                                        Open Full Image
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Render docx files */}
                {docxFound.length > 0 && (
                    <div className="generated-files-list">
                        {docxFound.map((fileName, idx) => {
                            const fileUrl = `${apiBase}/workspace/${fileName}`;
                            return (
                                <div key={idx} className="generated-file-download-card">
                                    <div className="file-info-group">
                                        <div className="file-icon-wrapper docx">
                                            <Database size={20} />
                                        </div>
                                        <div className="file-details">
                                            <div className="file-name-label">{fileName}</div>
                                            <div className="file-meta-label">Microsoft Word Document (.docx)</div>
                                        </div>
                                    </div>
                                    <div className="file-actions-group">
                                        <button 
                                            onClick={() => setPreviewFile({ name: fileName, url: fileUrl })}
                                            className="file-preview-action-btn"
                                        >
                                            Preview
                                        </button>
                                        <a 
                                            href={fileUrl} 
                                            download 
                                            className="file-download-action-btn"
                                        >
                                            Download
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Render md files */}
                {mdFound.length > 0 && (
                    <div className="generated-files-list">
                        {mdFound.map((fileName, idx) => {
                            const fileUrl = `${apiBase}/workspace/${fileName}`;
                            return (
                                <div key={idx} className="generated-file-download-card">
                                    <div className="file-info-group">
                                        <div className="file-icon-wrapper md">
                                            <MessageSquare size={20} />
                                        </div>
                                        <div className="file-details">
                                            <div className="file-name-label">{fileName}</div>
                                            <div className="file-meta-label">Markdown Document (.md)</div>
                                        </div>
                                    </div>
                                    <a 
                                        href={fileUrl} 
                                        download 
                                        className="file-download-action-btn"
                                    >
                                        Download Markdown
                                    </a>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderMinimalMessageContent = (msg) => {
        if (!msg) return null;
        if (!msg.text) {
            if (msg.id === 'ai-pending') {
                return (
                    <span className="thinking-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                );
            }
            return '';
        }
        
        const renderLineInline = (str) => {
            const regex = /(\*\*.*?\*\*)|(\`.*?\`)/g;
            const parts = str.split(regex);
            return parts.map((part, idx) => {
                if (!part) return null;
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={idx} className="md-bold">{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                    return <code key={idx} className="md-inline-code">{part.slice(1, -1)}</code>;
                }
                return <span key={idx}>{part}</span>;
            });
        };

        const lines = msg.text.split('\n');
        return (
            <div className="minimal-text-body">
                {lines.map((line, idx) => {
                    if (line.startsWith('### ')) return <h4 key={idx} className="md-h4">{renderLineInline(line.slice(4))}</h4>;
                    if (line.startsWith('## ')) return <h3 key={idx} className="md-h3">{renderLineInline(line.slice(3))}</h3>;
                    if (line.startsWith('# ')) return <h2 key={idx} className="md-h2">{renderLineInline(line.slice(2))}</h2>;
                    if (line.startsWith('- ') || line.startsWith('* ')) {
                        return (
                            <div key={idx} className="md-list-item">
                                <span className="md-bullet">•</span>
                                <span className="md-list-text">{renderLineInline(line.slice(2))}</span>
                            </div>
                        );
                    }
                    return <div key={idx} className="chat-text-line">{renderLineInline(line)}</div>;
                })}
            </div>
        );
    };

    const togglePipeline = (msgId) => {
        setExpandedPipelines(prev => ({
            ...prev,
            [msgId]: !prev[msgId]
        }));
    };

    const handleCopyMessage = (msgId, text) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(msgId);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const renderInlinePipeline = (msg) => {
        if (!msg.logs || msg.logs.length === 0) return null;
        const isExpanded = expandedPipelines[msg.id];

        return (
            <div className="inline-pipeline-box">
                <button className="pipeline-toggle-header" onClick={() => togglePipeline(msg.id)}>
                    <Sparkles size={14} className="sparkle-gold" style={{ marginRight: '6px' }} />
                    <span className="pipeline-header-label">Reasoning & Execution Trace</span>
                    <ChevronDown size={14} style={{ marginLeft: 'auto', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                </button>

                {isExpanded && (
                    <div className="pipeline-expanded-steps log-trace-mode">
                        {[...msg.logs].reverse().map((log, index) => (
                            <div key={log.id || index} className="inline-log-row-stacked">
                                <div className="log-time">{log.time}</div>
                                <div className={`log-level-badge-stacked ${log.level.toLowerCase()}`}>
                                    {log.level.toUpperCase()}
                                </div>
                                <div className="log-msg-text">{log.message}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const clockRef = useRef(null);
    const uniformsRef = useRef(null);
    const sphereRef = useRef(null);
    const midSphereRef = useRef(null);
    const innerSphereRef = useRef(null);
    const shellRef = useRef(null);
    const particlesRef = useRef(null);
    const atmosphereRef = useRef(null);
    const midMaterialRef = useRef(null);
    const innerMaterialRef = useRef(null);
    const particleMaterialRef = useRef(null);
    const atmosphereMaterialRef = useRef(null);
    const materialRef = useRef(null);
    const controlsRef = useRef(null);

    // Audio animation refs
    const targetAudioDataRef = useRef(0.2);
    const currentAudioDataRef = useRef(0.2);

    // Speech APIs refs
    const recognitionRef = useRef(null);
    const isRecognitionActiveRef = useRef(false);
    const lastSpokenMsgIdRef = useRef(null);
    const activeUtteranceRef = useRef(null);

    const startListening = () => {
        if (!recognitionRef.current) return;
        if (isSpeakingRef.current || isRecognitionActiveRef.current) return;
        try {
            isRecognitionActiveRef.current = true;
            recognitionRef.current.start();
        } catch (e) {
            isRecognitionActiveRef.current = false;
            console.warn('[STT] Failed to start recognition:', e);
        }
    };

    const stopListening = () => {
        if (!recognitionRef.current) return;
        try {
            recognitionRef.current.abort();
        } catch (e) { }
        isRecognitionActiveRef.current = false;
        setIsListening(false);
    };

    // --- Speech Recognition Setup ---
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setErrorMessage('Web Speech API is not supported in this browser. Please try Chrome.');
            return;
        }

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
            console.log('[STT] Speech recognition started');
            isRecognitionActiveRef.current = true;
            setIsListening(true);
            orbStateRef.current = 1;
            setOrbState(1);
            systemStatusRef.current = 'LISTENING';
            setSystemStatus('LISTENING');
            setErrorMessage('');
        };

        rec.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const currentText = finalTranscript || interimTranscript;
            setRecognitionText(currentText);

            if (currentText.trim() && systemStatusRef.current !== 'ANALYZING') {
                systemStatusRef.current = 'ANALYZING';
                setSystemStatus('ANALYZING');
            }

            if (finalTranscript.trim()) {
                console.log('[STT] Final Speech Detected:', finalTranscript);
                sendVoicePrompt(finalTranscript);
                rec.abort(); // Stop listening immediately while backend responds and voice speaks
            }
        };

        rec.onerror = (event) => {
            console.error('[STT] Speech recognition error:', event.error);
            let errMsg = '';
            if (event.error === 'not-allowed') {
                errMsg = 'Microphone access denied. Please enable mic permissions.';
                manuallyPausedRef.current = true;
                setManuallyPaused(true);
                systemStatusRef.current = 'PAUSED';
                setSystemStatus('PAUSED');
                orbStateRef.current = 0;
                setOrbState(0);
            } else if (event.error === 'network') {
                errMsg = 'Speech recognition network error. Please check connection.';
            } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
                errMsg = `Speech recognition error: ${event.error}`;
            }
            if (errMsg) {
                setErrorMessage(errMsg);
            }
            isRecognitionActiveRef.current = false;
        };

        rec.onend = () => {
            console.log('[STT] Speech recognition ended');
            isRecognitionActiveRef.current = false;
            setIsListening(false);

            // Go to LISTENING if we are not speaking and not thinking/paused
            if (
                systemStatusRef.current !== 'THINKING' &&
                systemStatusRef.current !== 'SPEAKING' &&
                !manuallyPausedRef.current
            ) {
                orbStateRef.current = 1;
                setOrbState(1);
                systemStatusRef.current = 'LISTENING';
                setSystemStatus('LISTENING');
            }

            // Auto-restart if in autoMode and not paused/speaking/thinking
            const shouldRestart = autoModeRef.current &&
                                  !manuallyPausedRef.current &&
                                  !isSpeakingRef.current &&
                                  systemStatusRef.current !== 'THINKING' &&
                                  systemStatusRef.current !== 'SPEAKING';
            if (shouldRestart) {
                console.log('[STT] Auto-restarting speech recognition...');
                setTimeout(() => {
                    const stillShouldRestart = autoModeRef.current &&
                                               !manuallyPausedRef.current &&
                                               !isSpeakingRef.current &&
                                               systemStatusRef.current !== 'THINKING' &&
                                               systemStatusRef.current !== 'SPEAKING' &&
                                               !isRecognitionActiveRef.current;
                    if (stillShouldRestart) {
                        startListening();
                    }
                }, 300);
            }
        };

        recognitionRef.current = rec;

        return () => {
            rec.abort();
        };
    }, []);

    // Declaratively manage start/stop based on system state
    useEffect(() => {
        const shouldBeListening = autoMode && !manuallyPaused && !isSpeaking && systemStatus !== 'THINKING' && systemStatus !== 'SPEAKING';
        if (shouldBeListening) {
            startListening();
        } else {
            stopListening();
        }
    }, [autoMode, manuallyPaused, isSpeaking, systemStatus]);

    // Track AI replies to read aloud (only those triggered by Orb itself)
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        console.log('[TTS Debug] messages changed. lastMsg.id:', lastMsg?.id, 'sender:', lastMsg?.sender, 'hasText:', !!lastMsg?.text, 'orbSentPrompt:', orbSentPrompt);

        // Only trigger TTS if:
        // - Last message is from AI, fully finalized (not pending)
        // - Not the welcome message
        // - Not already spoken
        // - Has actual text content
        // - Orb page itself triggered the request (not Chat page)
        if (
            lastMsg.sender === 'ai' &&
            lastMsg.id !== 'welcome' &&
            lastMsg.id !== 'ai-pending' &&
            lastMsg.id !== lastSpokenMsgIdRef.current &&
            lastMsg.text &&
            !lastMsg.text.includes('[Stopped]') &&
            !lastMsg.text.includes('[Generation stopped]') &&
            orbSentPrompt // only speak if Orb sent the request
        ) {
            console.log('[TTS Debug] Speaking message:', lastMsg.id);
            lastSpokenMsgIdRef.current = lastMsg.id;
            setOrbSentPrompt(false); // reset after consuming
            speakText(lastMsg.text);
        }
    }, [messages, orbSentPrompt]);

    // Pre-load voices for SpeechSynthesis
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => {
                    window.speechSynthesis.getVoices();
                };
            }
        }
    }, []);

    // Send voice prompts to the WebSocket
    const sendVoicePrompt = (promptText) => {
        if (!promptText.trim()) return;

        // Check actual WS state, not stale React prop
        const wsReady = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
        if (!wsReady) {
            setErrorMessage('Not connected to Aria backend. Please wait...');
            setTimeout(() => setErrorMessage(''), 3000);
            // Also restore back to listening so user can try again
            systemStatusRef.current = 'LISTENING';
            setSystemStatus('LISTENING');
            orbStateRef.current = 1;
            setOrbState(1);
            return;
        }

        systemStatusRef.current = 'THINKING';
        setSystemStatus('THINKING');
        orbStateRef.current = 0;
        setOrbState(0); // Go back to idle/quiet while thinking

        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: promptText,
            timestamp: new Date().toLocaleTimeString()
        };

        const pendingAiMsg = {
            id: 'ai-pending',
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString(),
            logs: [],
            pipeline: {
                input: { status: 'active', detail: 'Waiting...', badge: 'ACTIVE' },
                context: { status: '', detail: '-', badge: '-' },
                router: { status: '', detail: '-', badge: '-' },
                exec: { status: '', detail: '-', badge: '-' },
                reflect: { status: '', detail: '-', badge: '-' },
                output: { status: '', detail: '-', badge: '-' }
            }
        };

        // Append to React state so user sees it in their history
        setMessages(prev => [...prev, userMsg, pendingAiMsg]);

        window.playUISound('send');
        setOrbSentPrompt(true); // mark that Orb sent this

        // Transmit via WS to backend
        wsRef.current.send(JSON.stringify({
            type: 'chat:message',
            prompt: promptText
        }));
    };

    // Text to Speech
    const speakText = (text) => {
        if (!text) return;

        // Clean up markdown tags, URLs, and code blocks before speaking
        let cleanText = text
            .replace(/```[\s\S]*?```/g, '') // remove block code
            .replace(/`[^`]+`/g, '') // remove inline code
            .replace(/\*\*([^*]+)\*\*/g, '$1') // bold tags
            .replace(/images\/[a-zA-Z0-9_\-]+\.png/g, 'image generated')
            .replace(/[a-zA-Z0-9_\-]+\.docx/g, 'document generated')
            .replace(/[a-zA-Z0-9_\-]+\.md/g, 'markdown document generated')
            .replace(/[-*#_]/g, ' ')
            .trim();

        if (!cleanText) return;

        console.log('[TTS Debug] speakText initiated with text length:', cleanText.length);

        // Synchronously update speaking states to prevent race conditions on STT abort
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        orbStateRef.current = 2;
        setOrbState(2);
        systemStatusRef.current = 'SPEAKING';
        setSystemStatus('SPEAKING');

        // Stop current speaking
        window.speechSynthesis.cancel();

        // Stop recognition so it doesn't transcribe the speaker output
        stopListening();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        activeUtteranceRef.current = utterance; // Keep a strong reference to prevent garbage collection
        
        utterance.rate = profile?.preferences?.voiceRate || 1.0;
        utterance.pitch = profile?.preferences?.voicePitch || 1.0;

        // Select female voice
        const voices = window.speechSynthesis.getVoices();
        const femaleNames = [
            'zira', 'sabina', 'haruka', 'heera', 'elsa', 'susan', 'julie', 'paulina',
            'huihui', 'yaoyao', 'hanhan', 'helena', 'katarina', 'tatiana', 'samantha',
            'hazel', 'karen', 'moira', 'tessa', 'fiona', 'veena', 'victoria', 'google us english',
            'jenny', 'aria', 'michelle', 'linda', 'catherine', 'helen', 'elizabeth', 'jessica',
            'stephanie', 'sara', 'siri', 'cortana', 'natural', 'female'
        ];

        // Find English female voice first
        let femaleVoice = voices.find(v => {
            const name = v.name.toLowerCase();
            const lang = v.lang.toLowerCase();
            const isEnglish = lang.startsWith('en');
            return isEnglish && femaleNames.some(fn => name.includes(fn));
        });

        // Fallback to any female voice in any language
        if (!femaleVoice) {
            femaleVoice = voices.find(v => {
                const name = v.name.toLowerCase();
                return femaleNames.some(fn => name.includes(fn));
            });
        }

        // Fallback to Google voices (which are high quality online voices on Chrome)
        if (!femaleVoice) {
            femaleVoice = voices.find(v => v.name.toLowerCase().includes('google'));
        }

        // Fallback to default
        if (!femaleVoice) {
            femaleVoice = voices[0];
        }

        if (femaleVoice) {
            utterance.voice = femaleVoice;
            console.log('[TTS] Using voice:', femaleVoice.name);
        }

        utterance.onstart = () => {
            console.log('[TTS Debug] utterance onstart fired');
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            orbStateRef.current = 2;
            setOrbState(2);
            systemStatusRef.current = 'SPEAKING';
            setSystemStatus('SPEAKING');
        };

        utterance.onend = () => {
            console.log('[TTS Debug] utterance onend fired');
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            
            if (autoModeRef.current && !manuallyPausedRef.current) {
                orbStateRef.current = 1;
                setOrbState(1);
                systemStatusRef.current = 'LISTENING';
                setSystemStatus('LISTENING');
            } else {
                orbStateRef.current = 0;
                setOrbState(0);
                systemStatusRef.current = 'PAUSED';
                setSystemStatus('PAUSED');
            }
            setRecognitionText('');
            activeUtteranceRef.current = null;
        };

        utterance.onerror = (e) => {
            console.error('[TTS Debug] utterance onerror fired:', e);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            
            if (autoModeRef.current && !manuallyPausedRef.current) {
                orbStateRef.current = 1;
                setOrbState(1);
                systemStatusRef.current = 'LISTENING';
                setSystemStatus('LISTENING');
            } else {
                orbStateRef.current = 0;
                setOrbState(0);
                systemStatusRef.current = 'PAUSED';
                setSystemStatus('PAUSED');
            }
            activeUtteranceRef.current = null;
        };

        // Delay slightly to prevent Chrome cancel race condition
        setTimeout(() => {
            console.log('[TTS Debug] Calling window.speechSynthesis.speak');
            window.speechSynthesis.speak(utterance);
        }, 50);
    };

    const handleStopResponse = () => {
        window.playUISound('error');

        // Cancel Speech Synthesis
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        isSpeakingRef.current = false;
        setIsSpeaking(false);

        // Stop STT recognition if active
        stopListening();

        if (autoModeRef.current && !manuallyPausedRef.current) {
            orbStateRef.current = 1;
            setOrbState(1);
            systemStatusRef.current = 'LISTENING';
            setSystemStatus('LISTENING');
        } else {
            orbStateRef.current = 0;
            setOrbState(0);
            systemStatusRef.current = 'PAUSED';
            setSystemStatus('PAUSED');
        }

        // Send explicit stop command to backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(JSON.stringify({ type: 'chat:stop' }));
            } catch (err) {
                console.warn("[WebSocket] Failed to send chat:stop:", err);
            }
        }

        // Finalize pending AI message
        setMessages(prev => {
            const pendingIdx = prev.findIndex(m => m.id === 'ai-pending');
            if (pendingIdx === -1) return prev;
            const pendingMsg = prev[pendingIdx];
            const finalizedText = pendingMsg.text ? pendingMsg.text + " [Stopped]" : "[Generation stopped]";
            const updated = [...prev];
            updated[pendingIdx] = {
                ...pendingMsg,
                id: Date.now() + Math.random(),
                text: finalizedText,
                pipeline: {
                    input: { status: 'done', detail: 'Stopped', badge: 'IDLE' },
                    context: { status: '', detail: '-', badge: '-' },
                    router: { status: '', detail: '-', badge: '-' },
                    exec: { status: '', detail: '-', badge: '-' },
                    reflect: { status: '', detail: '-', badge: '-' },
                    output: { status: '', detail: '-', badge: '-' }
                }
            };
            return updated;
        });
    };

    // Manual status buttons handlers
    // "Listening" mode = mic open, waiting for speech
    const handleListeningClick = () => {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        manuallyPausedRef.current = false;
        setManuallyPaused(false);
        orbStateRef.current = 1;
        setOrbState(1);
        systemStatusRef.current = 'LISTENING';
        setSystemStatus('LISTENING');
        setTimeout(() => {
            startListening();
        }, 100);
    };

    // "Pause" = stop mic, stop speaking, go fully paused
    const handlePauseClick = () => {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        manuallyPausedRef.current = true;
        setManuallyPaused(true);
        stopListening();
        orbStateRef.current = 0;
        setOrbState(0);
        systemStatusRef.current = 'PAUSED';
        setSystemStatus('PAUSED');
        setRecognitionText('');
    };

    // Keep legacy aliases so nothing else breaks
    const handleIdleClick = handlePauseClick;
    const handleListenClick = handleListeningClick;

    const handleSpeakClick = () => {
        manuallyPausedRef.current = true;
        setManuallyPaused(true);
        stopListening();
        speakText("I am listening and ready to help. How can I assist you today?");
    };

    const toggleAutoMode = () => {
        const nextMode = !autoMode;
        autoModeRef.current = nextMode;
        setAutoMode(nextMode);
        manuallyPausedRef.current = false;
        setManuallyPaused(false);
        if (nextMode) {
            orbStateRef.current = 1;
            setOrbState(1);
            systemStatusRef.current = 'LISTENING';
            setSystemStatus('LISTENING');
        } else {
            orbStateRef.current = 0;
            setOrbState(0);
            systemStatusRef.current = 'PAUSED';
            setSystemStatus('PAUSED');
            stopListening();
        }
    };

    const toggleViewMode = () => {
        let nextMode;
        if (viewMode === 'minimal') {
            nextMode = 'full';
        } else if (viewMode === 'full') {
            nextMode = 'hidden';
        } else {
            nextMode = 'minimal';
        }
        setViewMode(nextMode);
        localStorage.setItem('aria_orb_view_mode', nextMode);
        window.playUISound('click');
    };

    // Load voices in browser
    useEffect(() => {
        window.speechSynthesis.getVoices();
    }, []);

    // --- Three.js WebGL Scene Initialization ---
    useEffect(() => {
        const container = canvasContainerRef.current;
        if (!container) return;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 5.6;
        camera.position.y = 0.0;
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        // Anchor canvas to top-left — do NOT set CSS width/height as it conflicts with
        // Three.js pixel dimensions set by setSize(), which causes the orb to shift off-center.
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        rendererRef.current = renderer;

        // --- Shader Materials ---
        const uniforms = {
            uTime: { value: 0 },
            uState: { value: 0 },
            uAudioData: { value: 0.2 }
        };
        uniformsRef.current = uniforms;

        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: uniforms,
            transparent: true,
            wireframe: false
        });
        materialRef.current = material;

        // Core Orb Mesh
        const geometry = new THREE.IcosahedronGeometry(2, 64);
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
        sphereRef.current = sphere;

        // Middle Energy Layer
        const midMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: layerFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: 1.0 },
                uState: { value: 0 },
                uAudioData: { value: 0.2 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        midMaterialRef.current = midMaterial;

        const midSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 64), midMaterial);
        scene.add(midSphere);
        midSphereRef.current = midSphere;

        // Inner Vibrant Core
        const innerMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: layerFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: 2.0 },
                uState: { value: 0 },
                uAudioData: { value: 0.2 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        innerMaterialRef.current = innerMaterial;

        const innerSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 64), innerMaterial);
        scene.add(innerSphere);
        innerSphereRef.current = innerSphere;

        // Wireframe Shell
        const shellMaterial = new THREE.MeshBasicMaterial({
            color: 0x4400ff,
            wireframe: true,
            transparent: true,
            opacity: 0.08
        });
        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 10), shellMaterial);
        scene.add(shell);
        shellRef.current = shell;

        // --- Particle Dust Layer ---
        const particleCount = 1000;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleRandoms = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = 2.2 + Math.random() * 0.7;

            particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            particlePositions[i * 3 + 2] = r * Math.cos(phi);

            particleRandoms[i * 3] = Math.random();
            particleRandoms[i * 3 + 1] = Math.random();
            particleRandoms[i * 3 + 2] = Math.random();
        }

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute('aRandom', new THREE.BufferAttribute(particleRandoms, 3));

        const particleMaterial = new THREE.ShaderMaterial({
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uState: { value: 0 },
                uAudioData: { value: 0.2 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        particleMaterialRef.current = particleMaterial;

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        scene.add(particles);
        particlesRef.current = particles;

        // --- Atmospheric Nebula Cloud ---
        const atmosphereCount = 2000;
        const atmosphereGeometry = new THREE.BufferGeometry();
        const atmospherePositions = new Float32Array(atmosphereCount * 3);
        const atmosphereRandoms = new Float32Array(atmosphereCount * 3);

        for (let i = 0; i < atmosphereCount; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = 2.45;

            atmospherePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            atmospherePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            atmospherePositions[i * 3 + 2] = r * Math.cos(phi);

            atmosphereRandoms[i * 3] = Math.random();
            atmosphereRandoms[i * 3 + 1] = Math.random();
            atmosphereRandoms[i * 3 + 2] = Math.random();
        }

        atmosphereGeometry.setAttribute('position', new THREE.BufferAttribute(atmospherePositions, 3));
        atmosphereGeometry.setAttribute('aRandom', new THREE.BufferAttribute(atmosphereRandoms, 3));

        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: atmosphereVertexShader,
            fragmentShader: atmosphereFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uState: { value: 0 },
                uAudioData: { value: 0.2 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        atmosphereMaterialRef.current = atmosphereMaterial;

        const atmospherePoints = new THREE.Points(atmosphereGeometry, atmosphereMaterial);
        scene.add(atmospherePoints);
        atmosphereRef.current = atmospherePoints;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xff00ff, 2.5, 10);
        pointLight.position.set(0, 0, 0);
        scene.add(pointLight);

        // Clock
        const clock = new THREE.Clock();
        clockRef.current = clock;

        // Animation Y tracking refs
        let targetY = 0.0;
        let currentY = 0.0;

        // Animation Frame loop
        let animationFrameId;
        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const elapsedTime = clock.getElapsedTime();

            // Sync uniform times
            uniforms.uTime.value = elapsedTime;
            midMaterial.uniforms.uTime.value = elapsedTime;
            innerMaterial.uniforms.uTime.value = elapsedTime;
            particleMaterial.uniforms.uTime.value = elapsedTime;
            atmosphereMaterial.uniforms.uTime.value = elapsedTime;

            // Sync state uniform
            uniforms.uState.value = uniformsRef.current.uState.value;
            particleMaterial.uniforms.uState.value = uniforms.uState.value;
            atmosphereMaterial.uniforms.uState.value = uniforms.uState.value;

            // Simulate waveform audio data
            if (uniformsRef.current.uState.value === 1) { // Listen
                targetAudioDataRef.current = 0.5 + Math.random() * 0.5;
            } else if (uniformsRef.current.uState.value === 2) { // Speak
                targetAudioDataRef.current = 0.85 + Math.sin(elapsedTime * 11.5) * 0.45;
            } else { // Idle
                targetAudioDataRef.current = 0.12 + Math.sin(elapsedTime * 1.5) * 0.05;
            }

            // Smooth interpolation
            currentAudioDataRef.current += (targetAudioDataRef.current - currentAudioDataRef.current) * 0.1;

            // Apply audio amplitude to shaders
            const curAudio = currentAudioDataRef.current;
            uniforms.uAudioData.value = curAudio;
            midMaterial.uniforms.uAudioData.value = curAudio;
            innerMaterial.uniforms.uAudioData.value = curAudio;
            particleMaterial.uniforms.uAudioData.value = curAudio;
            atmosphereMaterial.uniforms.uAudioData.value = curAudio;

            // Spin meshes slowly
            sphere.rotation.y += 0.0012;
            sphere.rotation.z += 0.0004;

            midSphere.rotation.y -= 0.0016;
            midSphere.rotation.x += 0.0008;

            innerSphere.rotation.y += 0.0025;
            innerSphere.rotation.x -= 0.0015;

            shell.rotation.y -= 0.0004;

            particles.rotation.y += 0.001;
            particles.rotation.x += 0.0005;

            // Atmosphere speed scaled by state
            let atmosphereSpeed = 0.0006;
            if (uniforms.uState.value === 1) {
                atmosphereSpeed = 0.0025 + curAudio * 0.0025;
            } else if (uniforms.uState.value === 2) {
                atmosphereSpeed = 0.006 + curAudio * 0.005;
            }
            atmospherePoints.rotation.y -= atmosphereSpeed;
            atmospherePoints.rotation.x += atmosphereSpeed * 0.5;

            // State-driven Y offset:
            // At start/idle/listening: stays at center (0.0).
            // When Analyzing/Thinking: moves up (0.6)
            // When Speaking: comes down slowly back to 0.0.
            if (systemStatusRef.current === 'ANALYZING' || systemStatusRef.current === 'THINKING') {
                targetY = 0.6; // moves up
            } else {
                targetY = 0.0; // returns to center
            }

            // Lerp currentY towards targetY.
            // When moving down, make the interpolation slower (0.015 instead of 0.05).
            const lerpSpeed = currentY > targetY ? 0.015 : 0.05;
            currentY += (targetY - currentY) * lerpSpeed;

            // Apply slow bobbing/floating animation
            const bobbing = Math.sin(elapsedTime * 1.5) * 0.12;
            const totalY = currentY + bobbing;

            // Apply positions to all meshes & lights
            sphere.position.y = totalY;
            midSphere.position.y = totalY;
            innerSphere.position.y = totalY;
            shell.position.y = totalY;
            particles.position.y = totalY;
            atmospherePoints.position.y = totalY;
            pointLight.position.y = totalY;

            // Wobble scene slightly
            scene.rotation.y = Math.sin(elapsedTime * 0.08) * 0.08;
            scene.rotation.x = Math.cos(elapsedTime * 0.04) * 0.04;

            renderer.render(scene, camera);
        };

        animate();

        // Resize handler — also call immediately to ensure correct size at mount
        const handleResize = () => {
            if (!container || !camera || !renderer) return;
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w === 0 || h === 0) return;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        // Immediate sync after mount so the orb is centered from frame 1
        handleResize();
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            if (renderer && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
            // Dispose geometries/materials
            geometry.dispose();
            material.dispose();
            midMaterial.dispose();
            innerMaterial.dispose();
            shellMaterial.dispose();
            particleGeometry.dispose();
            particleMaterial.dispose();
            atmosphereGeometry.dispose();
            atmosphereMaterial.dispose();
        };
    }, []);

    // Sync orb state updates to the ref immediately for the animate loop to capture
    useEffect(() => {
        if (uniformsRef.current) {
            uniformsRef.current.uState.value = orbState;

            // Adjust mesh wireframes based on state for visual changes
            if (materialRef.current) {
                materialRef.current.wireframe = (orbState === 0); // wireframe in idle, solid organic in active
            }
        }
    }, [orbState]);

    const lastMessage = messages.filter(m => m.id !== 'welcome').slice(-1)[0];

    return (
        <div className="orb-page-layout">
            {/* Animated background grid lines and glows */}
            <div className="orb-page-bg-grid" />
            <div className="orb-ambient-glow glow-1" />
            <div className="orb-ambient-glow glow-2" />
            <div className="orb-ambient-glow glow-3" />
            <div className="orb-halo-blur-bg" />
            <div className="orb-halo-blur-bg-secondary" />

            {/* 3D WebGL Canvas container */}
            <div ref={canvasContainerRef} className="orb-3d-canvas-viewport" />

            {/* Status overlay */}
            <div className="orb-status-display-group">
                <div className={`orb-status-badge ${
                    systemStatus === 'SPEAKING' ? 'speak' :
                    (systemStatus === 'ANALYZING' || systemStatus === 'THINKING') ? 'listen' :
                    ''
                }`}>
                    {systemStatus === 'SPEAKING' ? 'Speaking' :
                     (systemStatus === 'ANALYZING' || systemStatus === 'THINKING') ? 'Analyzing' :
                     systemStatus === 'PAUSED' ? 'Paused' : 'Listening'}
                </div>
                <div className="orb-status-title-text">
                    {systemStatus === 'SPEAKING' ? 'SPEAKING...' :
                     systemStatus === 'ANALYZING' ? 'ANALYZING...' :
                     systemStatus === 'THINKING' ? 'THINKING...' :
                     systemStatus === 'PAUSED' ? 'PAUSED' : 'LISTENING...'}
                </div>
                {(systemStatus === 'SPEAKING' || systemStatus === 'ANALYZING' || systemStatus === 'THINKING') && (
                    <button className="orb-stop-response-btn" onClick={handleStopResponse}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ marginRight: '6px' }}>
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z" />
                        </svg>
                        Stop Response
                    </button>
                )}
                {recognitionText && (
                    <div className="orb-realtime-transcript">
                        "{recognitionText}"
                    </div>
                )}
                {errorMessage && (
                    <div className="orb-error-badge">
                        <AlertCircle size={14} />
                        <span>{errorMessage}</span>
                    </div>
                )}
            </div>

            {/* Conversation logger overlay card */}
            {viewMode === 'full' && (
                <div className="orb-conversation-log-card">
                    <div className="card-header">
                        <Sparkles size={14} className="text-cyan" />
                        <span>Live Transcript</span>
                    </div>
                    <div className="card-logs-viewport">
                        {messages.length <= 1 ? (
                            <div className="logs-empty-tip">No recent conversation logs. Speak to start the dialog.</div>
                        ) : (
                            messages.filter(m => m.id !== 'welcome').map((m, idx) => (
                                <div key={m.id || idx} className={`log-row ${m.sender}`}>
                                    <div className="log-row-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', gap: '8px' }}>
                                        <span className="speaker-name">{m.sender === 'ai' ? 'Aria' : 'You'}</span>
                                        <span className="message-time" style={{ fontSize: '0.7rem', opacity: 0.5 }}>{m.timestamp}</span>
                                        {m.id !== 'ai-pending' && (
                                            <button 
                                                className="copy-msg-btn-orb"
                                                onClick={() => handleCopyMessage(m.id, m.text)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-dark)', marginLeft: 'auto', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                title="Copy text"
                                            >
                                                {copiedId === m.id ? <Check size={10} className="text-green" /> : <Copy size={10} />}
                                            </button>
                                        )}
                                    </div>
                                    <div className="speaker-message">
                                        {renderMessageContent(m)}
                                    </div>
                                    {m.sender === 'ai' && renderInlinePipeline(m)}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Minimal captions bubble */}
            {viewMode === 'minimal' && lastMessage && (
                <div className={`orb-minimal-captions-container ${lastMessage.sender}`}>
                    <div className="captions-header">
                        <span className="captions-speaker-label">
                            {lastMessage.sender === 'ai' ? 'Aria' : 'You'}
                        </span>
                        <span className="captions-time">{lastMessage.timestamp}</span>
                    </div>
                    <div className="captions-content">
                        {renderMinimalMessageContent(lastMessage)}
                    </div>
                </div>
            )}

            {/* Controls panel */}
            <div className="orb-controls-floating-panel">
                {/* Listening = mic open & waiting */}
                <button
                    onClick={handleListeningClick}
                    className={`control-btn ${systemStatus === 'LISTENING' ? 'active' : ''}`}
                    title="Open mic and listen"
                >
                    <Mic size={14} />
                    <span>Listening</span>
                </button>

                {/* Analyzing = currently transcribing speech */}
                <button
                    className={`control-btn ${(systemStatus === 'ANALYZING' || systemStatus === 'THINKING') ? 'active' : ''}`}
                    style={{ pointerEvents: 'none', opacity: (systemStatus === 'ANALYZING' || systemStatus === 'THINKING') ? 1 : 0.45 }}
                    title="Actively analyzing your speech"
                    tabIndex={-1}
                >
                    <Sparkles size={14} />
                    <span>Analyzing</span>
                </button>

                {/* Speak = test TTS voice */}
                <button
                    onClick={handleSpeakClick}
                    className={`control-btn ${systemStatus === 'SPEAKING' ? 'active' : ''}`}
                    title="Test Voice Output"
                >
                    <Volume2 size={14} />
                    <span>Speak</span>
                </button>

                {/* Pause = mute mic & stop everything */}
                <button
                    onClick={handlePauseClick}
                    className={`control-btn ${systemStatus === 'PAUSED' ? 'active' : ''}`}
                    title="Pause — stop mic and speech"
                >
                    <MicOff size={14} />
                    <span>Pause</span>
                </button>

                <div className="panel-divider" />

                <button
                    onClick={toggleAutoMode}
                    className={`control-btn auto-toggle ${autoMode ? 'active-auto' : ''}`}
                    title="Toggle hands-free auto mode"
                >
                    {autoMode ? <Mic size={14} /> : <MicOff size={14} />}
                    <span>{autoMode ? 'Auto: ON' : 'Auto: OFF'}</span>
                </button>

                <div className="panel-divider" />

                <button
                    onClick={toggleViewMode}
                    className={`control-btn view-toggle-btn ${viewMode !== 'hidden' ? 'active' : ''}`}
                    title="Toggle chat overlay mode"
                >
                    <MessageSquare size={14} />
                    <span>{viewMode === 'full' ? 'Full Chat' : viewMode === 'minimal' ? 'Captions' : 'Chat: Off'}</span>
                </button>
            </div>

            {/* Document Preview Modal */}
            {previewFile && (
                <div className="docx-preview-modal-overlay" onClick={() => { setPreviewFile(null); setZoom(100); setPaperTheme('light'); }} style={{ zIndex: 100 }}>
                    <div className="docx-preview-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="docx-preview-modal-header">
                            <div className="modal-title-group">
                                <FileText className="modal-docx-icon" size={18} />
                                <span className="modal-filename">{previewFile.name}</span>
                            </div>
                            
                            {/* Sticky Premium Reading Controls */}
                            <div className="modal-reading-controls">
                                <button className="control-btn-preview" onClick={() => setZoom(prev => Math.max(50, prev - 10))} title="Zoom Out">
                                    <ZoomOut size={14} />
                                </button>
                                <span className="zoom-level-text">{zoom}%</span>
                                <button className="control-btn-preview" onClick={() => setZoom(prev => Math.min(200, prev + 10))} title="Zoom In">
                                    <ZoomIn size={14} />
                                </button>
                                <button className="control-btn-preview" onClick={() => setZoom(100)} title="Reset Zoom">
                                    100%
                                </button>
                                
                                <div className="control-divider" />
                                
                                <button 
                                    className={`theme-dot light ${paperTheme === 'light' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('light')} 
                                    title="Light Theme" 
                                />
                                <button 
                                    className={`theme-dot sepia ${paperTheme === 'sepia' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('sepia')} 
                                    title="Sepia Theme" 
                                />
                                <button 
                                    className={`theme-dot dark ${paperTheme === 'dark' ? 'active' : ''}`} 
                                    onClick={() => setPaperTheme('dark')} 
                                    title="Dark Theme" 
                                />
                                
                                <div className="control-divider" />
                                
                                <button 
                                    className="control-btn-preview" 
                                    onClick={() => {
                                        const content = previewContainerRef.current?.innerHTML;
                                        if (!content) return;
                                        const printWindow = window.open('', '_blank');
                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>${previewFile.name}</title>
                                                    <style>
                                                        body {
                                                            font-family: Calibri, Arial, sans-serif;
                                                            padding: 40px;
                                                            color: #2D3748;
                                                        }
                                                        table {
                                                            border-collapse: collapse;
                                                            width: 100%;
                                                            margin: 16px 0;
                                                        }
                                                        th, td {
                                                            border: 1px solid #D2D6DC;
                                                            padding: 8px 12px;
                                                        }
                                                        th {
                                                            background-color: #1A365D;
                                                            color: white;
                                                            font-weight: bold;
                                                        }
                                                    </style>
                                                </head>
                                                <body onload="window.print(); window.close();">
                                                    ${content}
                                                </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                    }} 
                                    title="Print Document"
                                >
                                    <Printer size={14} />
                                </button>
                            </div>

                            <div className="modal-header-actions">
                                <a href={previewFile.url} download className="modal-btn" title="Download Document">
                                    <Download size={16} />
                                </a>
                                <button className="modal-btn close-btn" onClick={() => { setPreviewFile(null); setZoom(100); setPaperTheme('light'); }} title="Close Preview">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className={`docx-preview-modal-body paper-theme-${paperTheme}`}>
                            {loadingPreview && (
                                <div className="modal-loading-overlay">
                                    <RefreshCw className="modal-loading-spinner spin" size={24} />
                                    <span className="modal-loading-text">Loading document preview...</span>
                                </div>
                            )}
                            <div className="docx-viewer-output-wrapper" style={{ width: `${800 * (zoom / 100)}px`, maxWidth: '100%' }}>
                                <div ref={previewContainerRef}></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default OrbPage;
