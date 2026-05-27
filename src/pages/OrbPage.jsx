import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle, Play, Square, RefreshCw, X } from 'lucide-react';

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

function OrbPage({ messages, setMessages, connected, wsRef }) {
    const canvasContainerRef = useRef(null);
    const [orbState, setOrbState] = useState(0); // 0: Idle, 1: Listen, 2: Speak
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [autoMode, setAutoMode] = useState(true);
    const [recognitionText, setRecognitionText] = useState('');
    const [systemStatus, setSystemStatus] = useState('AWAITING INPUT...');
    const [errorMessage, setErrorMessage] = useState('');
    
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
            setOrbState(1);
            setSystemStatus('LISTENING...');
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

            if (finalTranscript.trim()) {
                console.log('[STT] Final Speech Detected:', finalTranscript);
                sendVoicePrompt(finalTranscript);
                rec.stop(); // Stop recognition while backend responds and voice speaks
            }
        };

        rec.onerror = (event) => {
            console.error('[STT] Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                setErrorMessage('Microphone access denied. Please enable mic permissions.');
                setIsListening(false);
                if (orbState === 1) setOrbState(0);
            }
            isRecognitionActiveRef.current = false;
        };

        rec.onend = () => {
            console.log('[STT] Speech recognition ended');
            isRecognitionActiveRef.current = false;
            setIsListening(false);
            
            // If we are in autoMode and not speaking or waiting, restart listening
            if (autoMode && !isSpeaking && orbState !== 2) {
                // Short timeout to prevent immediate restart loops
                setTimeout(() => {
                    if (autoMode && !isSpeaking && !isRecognitionActiveRef.current) {
                        try {
                            rec.start();
                        } catch (err) {
                            console.warn('[STT] Failed to auto-restart recognition:', err);
                        }
                    }
                }, 400);
            } else if (!isSpeaking && orbState === 1) {
                setOrbState(0);
                setSystemStatus('IDLE');
            }
        };

        recognitionRef.current = rec;

        // Auto-start if permitted
        if (autoMode) {
            try {
                rec.start();
            } catch (e) {
                console.log('[STT] Initial auto-start failed (likely waiting for user interaction)');
            }
        }

        return () => {
            rec.abort();
        };
    }, [autoMode, isSpeaking]);

    // Track AI replies to read aloud
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        // Only trigger if last message is from AI, fully finalized (not pending), and not already spoken
        if (lastMsg.sender === 'ai' && lastMsg.id !== 'welcome' && lastMsg.id !== 'ai-pending' && lastMsg.id !== lastSpokenMsgIdRef.current) {
            lastSpokenMsgIdRef.current = lastMsg.id;
            speakText(lastMsg.text);
        }
    }, [messages]);

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
        if (!promptText.trim() || !connected) return;

        setSystemStatus('THINKING...');
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

        // Transmit via WS to backend
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat:message',
                prompt: promptText
            }));
        }
    };

    // Text to Speech
    const speakText = (text) => {
        if (!text) return;
        
        // Stop current speaking
        window.speechSynthesis.cancel();

        // Stop recognition so it doesn't transcribe the speaker output
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }

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

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
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
            setIsSpeaking(true);
            setOrbState(2);
            setSystemStatus('SPEAKING...');
        };

        utterance.onend = () => {
            setIsSpeaking(false);
            setOrbState(0);
            setSystemStatus(autoMode ? 'LISTENING...' : 'IDLE');
            setRecognitionText('');

            // Restart recognition if autoMode is active
            if (autoMode && recognitionRef.current && !isRecognitionActiveRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.log('[STT] Auto-restart failed:', e);
                }
            }
        };

        utterance.onerror = () => {
            setIsSpeaking(false);
            setOrbState(0);
            setSystemStatus('IDLE');
        };

        window.speechSynthesis.speak(utterance);
    };

    const handleStopResponse = () => {
        // Cancel Speech Synthesis
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        setOrbState(0);
        setSystemStatus('IDLE');

        // Stop STT recognition if active
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {}
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
                text: finalizedText
            };
            return updated;
        });

        // Trigger socket reconnection to abort generation immediately
        window.dispatchEvent(new CustomEvent('system:reconnect_ws'));
    };

    // Manual status buttons handlers
    const handleIdleClick = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
        setOrbState(0);
        setSystemStatus('IDLE');
        setRecognitionText('');
    };

    const handleListenClick = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        if (recognitionRef.current) {
            recognitionRef.current.abort();
            setTimeout(() => {
                try {
                    recognitionRef.current.start();
                } catch(e) {
                    console.error('[STT] Manual start failed:', e);
                }
            }, 300);
        }
    };

    const handleSpeakClick = () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
        speakText("I am listening and speaking ready. How can I help you today?");
    };

    const toggleAutoMode = () => {
        const nextMode = !autoMode;
        setAutoMode(nextMode);
        
        if (nextMode) {
            if (recognitionRef.current && !isRecognitionActiveRef.current && !isSpeaking) {
                try { recognitionRef.current.start(); } catch(e) {}
            }
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        }
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
        camera.position.z = 4.8;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls - lock orbit/rotate for visual display
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = false;
        controls.enableZoom = false;
        controls.enablePan = false;
        controlsRef.current = controls;

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

            // Wobble scene slightly
            scene.rotation.y = Math.sin(elapsedTime * 0.08) * 0.08;
            scene.rotation.x = Math.cos(elapsedTime * 0.04) * 0.04;

            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        // Resize handler
        const handleResize = () => {
            if (!container || !camera || !renderer) return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        };
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
            controls.dispose();
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

    return (
        <div className="orb-page-layout">
            {/* 3D WebGL Canvas container */}
            <div ref={canvasContainerRef} className="orb-3d-canvas-viewport" />
            
            {/* Status overlay */}
            <div className="orb-status-display-group">
                <div className={`orb-status-badge ${orbState === 1 ? 'listen' : orbState === 2 ? 'speak' : ''}`}>
                    {orbState === 1 ? 'Listening' : orbState === 2 ? 'Speaking' : 'System Ready'}
                </div>
                <div className="orb-status-title-text">{systemStatus}</div>
                {(orbState !== 0 || isSpeaking || systemStatus === 'THINKING...') && (
                    <button className="orb-stop-response-btn" onClick={handleStopResponse}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ marginRight: '6px' }}>
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4 14H8V8h8v8z"/>
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
                                <span className="speaker-name">{m.sender === 'ai' ? 'Aria' : 'You'}:</span>
                                <span className="speaker-message">{m.text || '...'}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Controls panel */}
            <div className="orb-controls-floating-panel">
                <button 
                    onClick={handleIdleClick}
                    className={`control-btn ${orbState === 0 ? 'active' : ''}`}
                    title="Idle State"
                >
                    <Square size={14} />
                    <span>Idle</span>
                </button>
                
                <button 
                    onClick={handleListenClick}
                    className={`control-btn ${orbState === 1 ? 'active' : ''}`}
                    title="Start Listening"
                >
                    <Mic size={14} />
                    <span>Listen</span>
                </button>
                
                <button 
                    onClick={handleSpeakClick}
                    className={`control-btn ${orbState === 2 ? 'active' : ''}`}
                    title="Test Voice Output"
                >
                    <Volume2 size={14} />
                    <span>Speak</span>
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
            </div>
        </div>
    );
}

export default OrbPage;
