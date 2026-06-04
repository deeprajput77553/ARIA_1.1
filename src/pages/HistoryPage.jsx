import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ArrowLeft, MessageSquare, Database, FileText, Clock, Terminal, ChevronDown } from 'lucide-react';

function HistoryPage({
    sessions = [],
    activeSessionId,
    changeActiveSession,
    logs = []
}) {
    const [selectedSessionId, setSelectedSessionId] = useState(activeSessionId || (sessions[0]?.id));
    const [isRNA, setIsRNA] = useState(false);
    const [focusedMsgId, setFocusedMsgId] = useState(null);

    const bgCanvasRef = useRef(null);
    const webglCanvasRef = useRef(null);
    const hudCanvasRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const prevFocusedIdRef = useRef(null);

    // Keep state ref for three.js loop
    const isRnaRef = useRef(isRNA);
    useEffect(() => {
        isRnaRef.current = isRNA;
    }, [isRNA]);

    const selectedSession = sessions.find(s => s.id === selectedSessionId) || sessions[0] || null;

    // Synth tick sound using Web Audio API
    const playTickSound = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.type = 'sine';
            // Sci-fi synth click: start at 700Hz and sweep down to 150Hz in 0.08s
            osc.frequency.setValueAtTime(700, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {
            console.error("Audio Context tick failed:", e);
        }
    };

    // Extract generated items (Images/DOCX/MD) from messages of selected chat
    const getSessionAssets = (session) => {
        if (!session) return [];
        const assets = [];
        const imgRegex = /images\/[a-zA-Z0-9_-]+\.png/g;
        const docxRegex = /\b[a-zA-Z0-9_-]+\.docx\b/g;
        const mdRegex = /\b[a-zA-Z0-9_-]+\.md\b/g;

        session.messages.forEach(msg => {
            if (!msg.text) return;

            // Find images
            const images = msg.text.match(imgRegex);
            if (images) {
                images.forEach(img => {
                    if (!assets.some(a => a.path === img)) {
                        assets.push({ type: 'image', name: img.split('/').pop(), path: img, ts: msg.timestamp });
                    }
                });
            }

            // Find docx
            const docx = msg.text.match(docxRegex);
            if (docx) {
                docx.forEach(d => {
                    if (!assets.some(a => a.path === d)) {
                        assets.push({ type: 'docx', name: d, path: d, ts: msg.timestamp });
                    }
                });
            }

            // Find md
            const md = msg.text.match(mdRegex);
            if (md) {
                md.forEach(m => {
                    if (m !== 'plan.md' && m !== 'README.md' && !assets.some(a => a.path === m)) {
                        assets.push({ type: 'md', name: m, path: m, ts: msg.timestamp });
                    }
                });
            }
        });
        return assets;
    };

    // Extract session logs specifically from message traces, fallback to system logs
    const getSessionLogs = (session) => {
        if (!session) return [];
        let allLogs = [];
        session.messages.forEach(msg => {
            if (msg.logs && Array.isArray(msg.logs)) {
                allLogs = [...allLogs, ...msg.logs];
            }
        });
        if (allLogs.length === 0) {
            return logs;
        }
        return allLogs;
    };

    // Unified Scroll Listener for DNA and RNA modes
    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const selector = isRNA ? '.rna-timeline-row' : '.dna-timeline-row';
        const rows = container.querySelectorAll(selector);
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.top + container.clientHeight / 2;

        let closestRow = null;
        let minDistance = Infinity;

        rows.forEach(row => {
            const rowRect = row.getBoundingClientRect();
            const rowCenter = rowRect.top + rowRect.height / 2;
            const dist = Math.abs(rowCenter - containerCenter);
            if (dist < minDistance) {
                minDistance = dist;
                closestRow = row;
            }
        });

        if (closestRow) {
            const rowId = closestRow.dataset.id;

            if (isRNA) {
                setFocusedMsgId(rowId);
                if (prevFocusedIdRef.current !== rowId) {
                    if (prevFocusedIdRef.current !== null) {
                        playTickSound();
                    }
                    prevFocusedIdRef.current = rowId;
                }
            } else {
                setSelectedSessionId(rowId);
                if (prevFocusedIdRef.current !== rowId) {
                    if (prevFocusedIdRef.current !== null) {
                        playTickSound();
                    }
                    prevFocusedIdRef.current = rowId;
                }
            }
        }
    };

    // Auto-scroll to center items on entering pages / transitioning modes
    useEffect(() => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            setTimeout(() => {
                if (isRNA) {
                    const rows = container.querySelectorAll('.rna-timeline-row');
                    if (rows.length > 0) {
                        const lastRow = rows[rows.length - 1];
                        lastRow.scrollIntoView({ behavior: 'auto', block: 'center' });
                        setFocusedMsgId(lastRow.dataset.id);
                        prevFocusedIdRef.current = lastRow.dataset.id;
                    }
                } else {
                    const rows = container.querySelectorAll('.dna-timeline-row');
                    if (rows.length > 0) {
                        const targetRow = Array.from(rows).find(row => row.dataset.id === selectedSessionId) || rows[0];
                        targetRow.scrollIntoView({ behavior: 'auto', block: 'center' });
                        setSelectedSessionId(targetRow.dataset.id);
                        prevFocusedIdRef.current = targetRow.dataset.id;
                    }
                }
            }, 150);
        }
    }, [isRNA]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle session selection
    const handleSelectSession = (id) => {
        setSelectedSessionId(id);
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const rows = container.querySelectorAll('.dna-timeline-row');
            const targetRow = Array.from(rows).find(row => row.dataset.id === id);
            if (targetRow) {
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        changeActiveSession(id);
        setIsRNA(true);
    };

    // Open chat helper deleted (unused)

    // Close chat
    const handleCloseChat = () => {
        setIsRNA(false);
    };

    // Ported 3D DNA/RNA Helix (Three.js) & Space background (2D canvas)
    useEffect(() => {
        if (!bgCanvasRef.current || !webglCanvasRef.current) return;

        let animationFrameId;

        // ── 1. BACKGROUND NEBULA (2D Canvas) ──
        const bgCanvas = bgCanvasRef.current;
        const bgCtx = bgCanvas.getContext('2d');
        const parentEl = webglCanvasRef.current.parentElement;
        const W = bgCanvas.width = parentEl.clientWidth || (window.innerWidth - 260);
        const H = bgCanvas.height = parentEl.clientHeight || (window.innerHeight - 40);

        const nebulae = [];
        const nebulaColors = [
            'rgba(0, 119, 255, 0.08)',
            'rgba(0, 80, 200, 0.06)',
            'rgba(168, 85, 247, 0.06)',
            'rgba(255, 34, 51, 0.06)',
            'rgba(0, 60, 150, 0.04)'
        ];
        for (let i = 0; i < 20; i++) {
            nebulae.push({
                rx: 0.1 + Math.random() * 0.8,
                ry: 0.1 + Math.random() * 0.8,
                radius: 0.2 + Math.random() * 0.4,
                color: nebulaColors[i % nebulaColors.length]
            });
        }

        const stars = [];
        for (let i = 0; i < 150; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: 0.5 + Math.random() * 1.5,
                opacity: 0.1 + Math.random() * 0.9
            });
        }

        function drawBackground(time) {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            if (isLight) {
                // Soft cream sunset backdrop
                bgCtx.fillStyle = '#fff9f6';
                bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

                bgCtx.save();
                bgCtx.globalCompositeOperation = 'multiply';
                nebulae.forEach(n => {
                    const x = n.rx * bgCanvas.width;
                    const y = n.ry * bgCanvas.height;
                    const r = n.radius * Math.max(bgCanvas.width, bgCanvas.height);
                    const grad = bgCtx.createRadialGradient(x, y, 0, x, y, r);
                    
                    let lightColor;
                    if (n.color.includes('rgba(0, 119, 255')) {
                        lightColor = 'rgba(255, 182, 193, 0.12)';
                    } else if (n.color.includes('rgba(168, 85, 247')) {
                        lightColor = 'rgba(255, 222, 173, 0.12)';
                    } else {
                        lightColor = 'rgba(255, 239, 204, 0.12)';
                    }
                    grad.addColorStop(0, lightColor);
                    grad.addColorStop(0.5, lightColor.replace('0.12', '0.04'));
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    bgCtx.fillStyle = grad;
                    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
                });
                bgCtx.restore();

                // Warm sunset stars
                bgCtx.fillStyle = '#ff8c00';
                stars.forEach((s, idx) => {
                    const pulse = 0.5 + 0.5 * Math.sin(time * 3.0 + idx);
                    bgCtx.globalAlpha = s.opacity * pulse * 0.35;
                    bgCtx.fillRect(s.x, s.y, s.size * 1.5, s.size * 1.5);
                });
                bgCtx.globalAlpha = 1.0;
            } else {
                // Dark mode original drawing
                bgCtx.fillStyle = '#020308';
                bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

                bgCtx.save();
                bgCtx.globalCompositeOperation = 'screen';
                nebulae.forEach(n => {
                    const x = n.rx * bgCanvas.width;
                    const y = n.ry * bgCanvas.height;
                    const r = n.radius * Math.max(bgCanvas.width, bgCanvas.height);
                    const grad = bgCtx.createRadialGradient(x, y, 0, x, y, r);
                    grad.addColorStop(0, n.color);
                    grad.addColorStop(0.5, n.color.replace('0.', '0.0'));
                    grad.addColorStop(1, 'rgba(0,0,0,0)');
                    bgCtx.fillStyle = grad;
                    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
                });
                bgCtx.restore();

                bgCtx.fillStyle = '#ffffff';
                stars.forEach((s, idx) => {
                    const pulse = 0.5 + 0.5 * Math.sin(time * 3.0 + idx);
                    bgCtx.globalAlpha = s.opacity * pulse;
                    bgCtx.fillRect(s.x, s.y, s.size, s.size);
                });
                bgCtx.globalAlpha = 1.0;
            }
        }

        // ── 2. THREE.JS 3D DNA/RNA HELIX ──
        const canvas3d = webglCanvasRef.current;
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(45, canvas3d.clientWidth / canvas3d.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 9.0);

        const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, alpha: true });
        renderer.setSize(canvas3d.clientWidth, canvas3d.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;

        // Reflection Map
        function generateReflectionMap() {
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = isLight ? '#fff6f0' : '#02040c';
            ctx.fillRect(0, 0, 512, 256);
            for (let i = 0; i < 8; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 256;
                const r = 60 + Math.random() * 100;
                const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                const col = isLight 
                    ? (Math.random() < 0.5 ? 'rgba(255, 105, 180, 0.15)' : 'rgba(255, 165, 0, 0.15)')
                    : (Math.random() < 0.5 ? 'rgba(0, 119, 255, 0.25)' : 'rgba(168, 85, 247, 0.25)');
                grad.addColorStop(0, col);
                grad.addColorStop(1, isLight ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 512, 256);
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.mapping = THREE.EquirectangularReflectionMapping;
            return texture;
        }
        scene.environment = generateReflectionMap();

        // Shaders
        const vertexShader = `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec3 vColor;
            attribute vec3 color;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vWorldNormal = normalize(vec3(modelMatrix * vec4(normal, 0.0)));
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vColor = color;
                gl_Position = projectionMatrix * mvPosition;
            }
        `;

        const fragmentShader = `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec3 vWorldPosition;
            varying vec3 vWorldNormal;
            varying vec3 vColor;
            uniform float uTime;
            uniform float uOpacity;
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2);
                vec3 glassColor = mix(vColor, vColor * 1.5, fresnel * 0.85);
                glassColor = mix(glassColor, vec3(1.0, 1.0, 1.0), pow(fresnel, 5.0) * 0.5);
                vec3 lightDir1 = normalize(vec3(0.5, 1.0, 0.5));
                vec3 lightDir2 = normalize(vec3(-0.5, -0.8, -0.5));
                vec3 halfDir1 = normalize(lightDir1 + viewDir);
                vec3 halfDir2 = normalize(lightDir2 + viewDir);
                float spec1 = pow(max(dot(normal, halfDir1), 0.0), 40.0);
                float spec2 = pow(max(dot(normal, halfDir2), 0.0), 24.0);
                vec3 worldNormal = normalize(vWorldNormal);
                vec3 outwardDir = normalize(vec3(vWorldPosition.x, 0.0, vWorldPosition.z));
                float alignment = dot(worldNormal, outwardDir);
                float outerInnerBlend = alignment * 0.5 + 0.5;
                float specFactor = mix(0.12, 1.0, outerInnerBlend);
                vec3 finalColor = glassColor + vec3(spec1 * 0.75 * specFactor) + vec3(spec2 * 0.3 * specFactor) + vec3(fresnel * 0.25 * specFactor);
                float alpha = mix(0.18, 0.82, fresnel) * mix(0.06, 1.0, pow(outerInnerBlend, 1.4));
                gl_FragColor = vec4(finalColor, alpha * uOpacity);
            }
        `;

        function createTextSprite(text, isRnaColor = false) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 128, 64);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = isRnaColor ? '#a855f7' : '#0077ff';
            ctx.shadowBlur = 8;
            ctx.fillText(text, 64, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.5, 0.25, 1);
            return sprite;
        }

        class HelicalCurve extends THREE.Curve {
            constructor(radius, turns, height, phase = 0) {
                super();
                this.radius = radius;
                this.turns = turns;
                this.height = height;
                this.phase = phase;
            }
            getPoint(t, optionalTarget = new THREE.Vector3()) {
                const angle = t * Math.PI * 2 * this.turns + this.phase;
                const x = Math.cos(angle) * this.radius;
                const y = (t - 0.5) * this.height;
                const z = Math.sin(angle) * this.radius;
                return optionalTarget.set(x, y, z);
            }
        }

        const radius = 1.3;
        const turns = 1.8;
        const height = 8.5;
        const curveA = new HelicalCurve(radius, turns, height, 0);
        const curveB = new HelicalCurve(radius, turns, height, Math.PI);

        const dnaGroup = new THREE.Group();
        scene.add(dnaGroup);

        const colorCyan = new THREE.Color(0x0077ff);
        const colorMagenta = new THREE.Color(0xa855f7);

        const glassMatA = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.0 } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const glassMatB = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 1.0 } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const glassGeomA = new THREE.TubeGeometry(curveA, 100, 0.2, 4, false);
        const glassGeomB = new THREE.TubeGeometry(curveB, 100, 0.2, 4, false);

        function addStrandColors(geom, isA) {
            const count = geom.attributes.position.count;
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const col = isA ? colorCyan : colorMagenta;
                colors[i * 3] = col.r;
                colors[i * 3 + 1] = col.g;
                colors[i * 3 + 2] = col.b;
            }
            geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
        addStrandColors(glassGeomA, true);
        addStrandColors(glassGeomB, false);

        const glassStrandA = new THREE.Mesh(glassGeomA, glassMatA);
        const glassStrandB = new THREE.Mesh(glassGeomB, glassMatB);
        dnaGroup.add(glassStrandA, glassStrandB);

        // Outlines
        const edgesGeomA = new THREE.EdgesGeometry(glassGeomA, 30);
        const edgesGeomB = new THREE.EdgesGeometry(glassGeomB, 30);
        addStrandColors(edgesGeomA, true);
        addStrandColors(edgesGeomB, false);

        const lineMatA = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
        const lineMatB = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });

        const outlineA = new THREE.LineSegments(edgesGeomA, lineMatA);
        const outlineB = new THREE.LineSegments(edgesGeomB, lineMatB);
        dnaGroup.add(outlineA, outlineB);

        // Rungs
        const numRungs = 18;
        const rungsData = [];
        const rungCylRadius = 0.07;
        const rungCylGeom = new THREE.CylinderGeometry(rungCylRadius, rungCylRadius, 1, 8);
        const rungSphereGeom = new THREE.SphereGeometry(rungCylRadius, 8, 8);

        // Alpha Map Cylinders
        const canvasAlpha = document.createElement('canvas');
        canvasAlpha.width = 1;
        canvasAlpha.height = 256;
        const ctxAlpha = canvasAlpha.getContext('2d');
        const gradA = ctxAlpha.createLinearGradient(0, 0, 0, 256);
        gradA.addColorStop(0, '#ffffff');
        gradA.addColorStop(0.6, '#cccccc');
        gradA.addColorStop(1, '#222222');
        ctxAlpha.fillStyle = gradA;
        ctxAlpha.fillRect(0, 0, 1, 256);
        const rungAlphaMap = new THREE.CanvasTexture(canvasAlpha);

        const rungMatCyan = new THREE.MeshPhysicalMaterial({
            color: 0x0077ff, emissive: 0x0033aa, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.8, roughness: 0.1, transmission: 0.6, thickness: 0.4, alphaMap: rungAlphaMap
        });
        const capMatCyan = new THREE.MeshPhysicalMaterial({
            color: 0x0077ff, emissive: 0x0033aa, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.8, roughness: 0.1, transmission: 0.6, thickness: 0.4
        });
        const rungMatMagenta = new THREE.MeshPhysicalMaterial({
            color: 0xa855f7, emissive: 0x6611bb, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.8, roughness: 0.1, transmission: 0.6, thickness: 0.4, alphaMap: rungAlphaMap
        });
        const capMatMagenta = new THREE.MeshPhysicalMaterial({
            color: 0xa855f7, emissive: 0x6611bb, emissiveIntensity: 0.4,
            transparent: true, opacity: 0.8, roughness: 0.1, transmission: 0.6, thickness: 0.4
        });

        const basePairs = ['A-T', 'C-G', 'G-C', 'T-A', 'A-T', 'G-C', 'C-G', 'T-A', 'C-G', 'A-T', 'G-C', 'T-A', 'C-G', 'A-T', 'G-C', 'T-A', 'C-G', 'A-T'];

        for (let i = 0; i < numRungs; i++) {
            const t = i / (numRungs - 1);
            const pA = curveA.getPoint(t);
            const pB = curveB.getPoint(t);
            const pMid = pA.clone().add(pB).multiplyScalar(0.5);
            const dist = pA.distanceTo(pB);

            const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

            const label = basePairs[i % basePairs.length];
            const isLeftCyan = (label.charAt(0) === 'A' || label.charAt(0) === 'C');

            const lMat = isLeftCyan ? rungMatCyan : rungMatMagenta;
            const rMat = (isLeftCyan ? rungMatMagenta : rungMatCyan).clone();
            const lCapMat = isLeftCyan ? capMatCyan : capMatMagenta;
            const rCapMat = (isLeftCyan ? capMatMagenta : capMatCyan).clone();

            const gap = 0.5;
            const tubeRadius = 0.2;
            const leftLength = (dist - gap) / 2.0 - tubeRadius;

            // Left
            const posLeftCyl = pA.clone().add(dir.clone().multiplyScalar(tubeRadius + leftLength / 2.0));
            const leftRung = new THREE.Mesh(rungCylGeom, lMat);
            leftRung.scale.set(1, leftLength, 1);
            leftRung.position.copy(posLeftCyl);
            leftRung.quaternion.copy(quat);
            dnaGroup.add(leftRung);

            const posLeftCap = pMid.clone().sub(dir.clone().multiplyScalar(gap / 2.0));
            const leftCap = new THREE.Mesh(rungSphereGeom, lCapMat);
            leftCap.position.copy(posLeftCap);
            dnaGroup.add(leftCap);

            // Right
            const quatRight = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
            const posRightCyl = pB.clone().add(dir.clone().multiplyScalar(-(tubeRadius + leftLength / 2.0)));
            const rightRung = new THREE.Mesh(rungCylGeom, rMat);
            rightRung.scale.set(1, leftLength, 1);
            rightRung.position.copy(posRightCyl);
            rightRung.quaternion.copy(quatRight);
            dnaGroup.add(rightRung);

            const posRightCap = pMid.clone().add(dir.clone().multiplyScalar(gap / 2.0));
            const rightCap = new THREE.Mesh(rungSphereGeom, rCapMat);
            rightCap.position.copy(posRightCap);
            dnaGroup.add(rightCap);

            // Sprites
            const dnaSprite = createTextSprite(label);
            dnaSprite.position.copy(pMid);
            dnaGroup.add(dnaSprite);

            const rnaChar = label.charAt(0) === 'T' ? 'U' : label.charAt(0);
            const rnaSprite = createTextSprite(rnaChar, true);
            rnaSprite.position.copy(pMid);
            rnaSprite.material.opacity = 0;
            dnaGroup.add(rnaSprite);

            rungsData.push({
                leftRung, leftCap, rightRung, rightCap, dir,
                posLeftCylOrig: posLeftCyl.clone(),
                posLeftCapOrig: posLeftCap.clone(),
                posRightCylOrig: posRightCyl.clone(),
                posRightCapOrig: posRightCap.clone(),
                rightRungMat: rMat,
                rightCapMat: rCapMat,
                dnaSprite, rnaSprite, leftLength, pMid, pA
            });
        }

        // Particle System
        const particleCount = 700;
        const particleGeom = new THREE.BufferGeometry();
        const pPosArr = new Float32Array(particleCount * 3);
        const pColArr = new Float32Array(particleCount * 3);
        const pSpeeds = new Float32Array(particleCount);
        const pAngles = new Float32Array(particleCount);
        const pRadii = new Float32Array(particleCount);
        const pTValues = new Float32Array(particleCount);
        const pCurves = [];

        // Dynamic round dot texture
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 16; pCanvas.height = 16;
        const pCtx = pCanvas.getContext('2d');
        const pGrad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
        pGrad.addColorStop(0, '#ffffff');
        pGrad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        pGrad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
        pGrad.addColorStop(1, 'rgba(255,255,255,0)');
        pCtx.fillStyle = pGrad; pCtx.fillRect(0, 0, 16, 16);
        const pTexture = new THREE.CanvasTexture(pCanvas);

        for (let i = 0; i < particleCount; i++) {
            const t = Math.random();
            const curve = Math.random() < 0.5 ? curveA : curveB;
            pTValues[i] = t;
            pCurves.push(curve);

            const p = curve.getPoint(t);
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.16;

            pPosArr[i * 3] = p.x + Math.cos(angle) * r;
            pPosArr[i * 3 + 1] = p.y;
            pPosArr[i * 3 + 2] = p.z + Math.sin(angle) * r;

            const col = curve === curveA ? colorCyan : colorMagenta;
            pColArr[i * 3] = col.r;
            pColArr[i * 3 + 1] = col.g;
            pColArr[i * 3 + 2] = col.b;

            pSpeeds[i] = 0.005 + Math.random() * 0.006;
            pAngles[i] = angle;
            pRadii[i] = r;
        }

        particleGeom.setAttribute('position', new THREE.BufferAttribute(pPosArr, 3));
        particleGeom.setAttribute('color', new THREE.BufferAttribute(pColArr, 3));

        const pPointsMaterial = new THREE.PointsMaterial({
            size: 0.05, map: pTexture, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false
        });
        const particles = new THREE.Points(particleGeom, pPointsMaterial);
        dnaGroup.add(particles);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        const cyanLight = new THREE.PointLight(0x0077ff, 12, 15);
        cyanLight.position.set(-4, 3, 2);
        scene.add(cyanLight);
        const magentaLight = new THREE.PointLight(0xa855f7, 12, 15);
        magentaLight.position.set(4, -3, 2);
        scene.add(magentaLight);

        // Resize Helper
        function resize() {
            if (!webglCanvasRef.current) return;
            const parent = webglCanvasRef.current.parentElement;
            const width = parent.clientWidth || (window.innerWidth - 260);
            const height = parent.clientHeight || (window.innerHeight - 40);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);

            bgCanvas.width = width;
            bgCanvas.height = height;
        }

        // Setup Resize Listener
        window.addEventListener('resize', resize);
        resize();
        setTimeout(resize, 100);

        // Animation Loop
        let transitionProgress = 0.0;
        const clock = new THREE.Clock();

        function animate() {
            animationFrameId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();

            // Background rendering
            drawBackground(time);

            // Interpolate DNA -> RNA transition state
            const targetProgress = isRnaRef.current ? 1.0 : 0.0;
            transitionProgress += (targetProgress - transitionProgress) * 0.06;

            // Update strand materials opacities
            glassMatA.uniforms.uTime.value = time;
            glassMatB.uniforms.uTime.value = time;
            glassMatB.uniforms.uOpacity.value = 1.0 - transitionProgress;

            lineMatA.opacity = 0.8;
            lineMatB.opacity = 0.8 * (1.0 - transitionProgress);

            // Displace Strand B (RNA splits off the second helical curve)
            const strandBOffset = transitionProgress * 3.2;
            const strandBFloatUp = transitionProgress * 1.6;
            glassStrandB.position.set(strandBOffset, strandBFloatUp, 0);
            glassStrandB.rotation.z = transitionProgress * 0.45;
            outlineB.position.set(strandBOffset, strandBFloatUp, 0);
            outlineB.rotation.z = transitionProgress * 0.45;

            // Animate Rungs and cross‑fade DNA labels to RNA labels
            rungsData.forEach(rd => {
                const rightDrift = rd.dir.clone().multiplyScalar(transitionProgress * 3.2);
                rightDrift.y += transitionProgress * 1.6;

                rd.rightRung.position.copy(rd.posRightCylOrig).add(rightDrift);
                rd.rightCap.position.copy(rd.posRightCapOrig).add(rightDrift);

                const rightFade = 1.0 - transitionProgress;
                rd.rightRungMat.opacity = 0.8 * rightFade;
                rd.rightCapMat.opacity = 0.8 * rightFade;
                rd.rightRung.scale.set(rightFade, rd.leftLength * rightFade, rightFade);

                // Left rungs stay intact
                rd.leftRung.scale.set(1, rd.leftLength, 1);

                // Cross fade labels
                rd.dnaSprite.position.copy(rd.pMid).add(rd.dir.clone().multiplyScalar(transitionProgress * 0.4));
                rd.dnaSprite.material.opacity = 1.0 - transitionProgress;

                const currentCapPos = rd.pA.clone().add(rd.dir.clone().multiplyScalar(0.2 + rd.leftLength));
                const targetLabelPos = currentCapPos.clone().add(rd.dir.clone().multiplyScalar(0.18));
                rd.rnaSprite.position.copy(rd.pMid).lerp(targetLabelPos, transitionProgress);
                rd.rnaSprite.material.opacity = transitionProgress;
            });

            // Animate point particles flowing along curve rails
            const posArr = particleGeom.attributes.position.array;
            const colArr = particleGeom.attributes.color.array;

            for (let i = 0; i < particleCount; i++) {
                let tVal = pTValues[i];
                tVal += pSpeeds[i] * 2.8;
                if (tVal > 1.0) tVal = 0;
                pTValues[i] = tVal;

                const curve = pCurves[i];
                const p = curve.getPoint(tVal);

                pAngles[i] += pSpeeds[i] * 6.0;
                const r = pRadii[i] * (1.0 + 0.12 * Math.sin(time * 3.5 + i));

                let px = p.x + Math.cos(pAngles[i]) * r;
                let py = p.y;
                let pz = p.z + Math.sin(pAngles[i]) * r;

                const baseCol = curve === curveA ? colorCyan : colorMagenta;
                let particleOpacity = 1.0;

                if (curve === curveB) {
                    px += transitionProgress * 3.2;
                    py += transitionProgress * 1.6;
                    particleOpacity = 1.0 - transitionProgress;
                }

                posArr[i * 3] = px;
                posArr[i * 3 + 1] = py;
                posArr[i * 3 + 2] = pz;

                colArr[i * 3] = baseCol.r * particleOpacity;
                colArr[i * 3 + 1] = baseCol.g * particleOpacity;
                colArr[i * 3 + 2] = baseCol.b * particleOpacity;
            }
            particleGeom.attributes.position.needsUpdate = true;
            particleGeom.attributes.color.needsUpdate = true;

            // Auto-rotate DNA Group
            dnaGroup.rotation.y = time * 0.7;

            // Render 3D Scene
            renderer.render(scene, camera);
        }

        animate();

        // Drag‑to‑rotate listener on HUD Canvas overlay
        let isDragging = false;
        let prevMouseX = 0;
        const onMouseDown = (e) => {
            isDragging = true;
            prevMouseX = e.clientX;
        };
        const onMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - prevMouseX;
            dnaGroup.rotation.y += deltaX * 0.015;
            prevMouseX = e.clientX;
        };
        const onMouseUp = () => { isDragging = false; };

        const canvasHUD = hudCanvasRef.current;
        canvasHUD.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Cleanup
        return () => {
            window.removeEventListener('resize', resize);
            canvasHUD.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            cancelAnimationFrame(animationFrameId);

            // Dispose geometries and materials
            glassGeomA.dispose();
            glassGeomB.dispose();
            edgesGeomA.dispose();
            edgesGeomB.dispose();
            rungCylGeom.dispose();
            rungSphereGeom.dispose();
            particleGeom.dispose();

            glassMatA.dispose();
            glassMatB.dispose();
            lineMatA.dispose();
            lineMatB.dispose();
            rungMatCyan.dispose();
            rungMatMagenta.dispose();
            capMatCyan.dispose();
            capMatMagenta.dispose();
            pPointsMaterial.dispose();

            rungAlphaMap.dispose();
            pTexture.dispose();
            renderer.dispose();
        };
    }, []);

    // Format prompt text lines nicely
    const formatMessageText = (text) => {
        if (!text) return '';
        let clean = text.replace(/\*\*(.*?)\*\*/g, '$1');
        clean = clean.replace(/`(.*?)`/g, '$1');
        return clean;
    };

    return (
        <div className={`history-page-dna-layout ${isRNA ? 'rna-mode-active' : ''}`}>

            {/* Canvases rendering space backdrop, 3D WebGL Helix, and HUD overlay */}
            <div className="dna-visualizer-viewport">
                <canvas ref={bgCanvasRef} className="space-backdrop-canvas" />
                <canvas ref={webglCanvasRef} className="webgl-dna-canvas" />
                <canvas ref={hudCanvasRef} className="hud-overlay-canvas" />
            </div>

            {/* ── DNA MODE: OVERLAYS (Conversations lists and assets scroll synced flanking DNA) ── */}
            {!isRNA && (
                <div
                    ref={scrollContainerRef}
                    className="dna-timeline-scroll-container"
                    onScroll={handleScroll}
                >
                    {/* Immersive Scroll spacing spacer */}
                    <div className="timeline-top-spacer" />

                    {sessions.length === 0 ? (
                        <div className="empty-panel-placeholder glassmorphic">
                            <MessageSquare size={32} className="opacity-20 mb-8" />
                            <p>No chat history available. Start a chat in the Messages page.</p>
                        </div>
                    ) : (
                        sessions.map(session => {
                            const isFocused = selectedSessionId === session.id;
                            const sessionAssets = getSessionAssets(session);
                            const sessionLogs = getSessionLogs(session);

                            return (
                                <div
                                    key={session.id}
                                    data-id={session.id}
                                    className={`dna-timeline-row ${isFocused ? 'focused' : 'faded'}`}
                                >
                                    {/* Left Column: Chat History Sessions */}
                                    <div className="timeline-col left-col">
                                        <div className="session-inspect-card-container">
                                            <div
                                                className={`session-inspect-card ${isFocused ? 'selected' : ''}`}
                                                onClick={() => handleSelectSession(session.id)}
                                            >
                                                <div className="session-card-header-group">
                                                    <MessageSquare size={16} className="card-icon" />
                                                    <span className="card-title-label" title={session.title}>{session.title}</span>
                                                </div>
                                                <div className="session-card-details">
                                                    <Clock size={12} />
                                                    <span>{session.messages.length} messages</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center Column: Empty space showing the 3D rotating DNA Helix */}
                                    <div className="timeline-col center-col-gap" />

                                    {/* Right Column: Selected Session Assets & Logs */}
                                    <div className="timeline-col right-col">
                                        <div className="assets-inspections-viewport">
                                            {/* Asset List */}
                                            <div className="assets-section">
                                                <h4 className="assets-section-title">
                                                    <Database size={12} /> Files & Media ({sessionAssets.length})
                                                </h4>
                                                {sessionAssets.length === 0 ? (
                                                    <div className="no-assets-notice">No files generated.</div>
                                                ) : (
                                                    <div className="assets-horizontal-list">
                                                        {sessionAssets.map((asset, idx) => {
                                                            const isDev = window.location.hostname === 'localhost' && window.location.port !== '4200';
                                                            const apiBase = isDev ? 'http://localhost:4200' : window.location.origin;
                                                            const assetUrl = `${apiBase}/workspace/${asset.path}`;

                                                            return (
                                                                <div key={idx} className="asset-media-card">
                                                                    {asset.type === 'image' ? (
                                                                        <div className="asset-media-preview image-preview-box">
                                                                            <img src={assetUrl} alt={asset.name} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="asset-media-preview file-preview-box">
                                                                            <FileText size={20} className={asset.type} />
                                                                        </div>
                                                                    )}
                                                                    <div className="asset-media-details">
                                                                        <span className="asset-media-name" title={asset.name}>{asset.name}</span>
                                                                        <a href={assetUrl} download className="asset-download-btn">Download</a>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* logs list */}
                                            <div className="logs-section">
                                                <details className="traces-dropdown" open={isFocused}>
                                                    <summary className="traces-dropdown-summary">
                                                        <Terminal size={12} />
                                                        <span>Trace Logs ({sessionLogs.length})</span>
                                                        <ChevronDown size={12} className="dropdown-chevron" />
                                                    </summary>
                                                    <div className="logs-trace-viewport">
                                                        {sessionLogs.length === 0 ? (
                                                            <div className="no-assets-notice">No logs recorded.</div>
                                                        ) : (
                                                            sessionLogs.slice(-15).reverse().map((log, idx) => (
                                                                <div key={idx} className="log-row-compact">
                                                                    <span className="log-time">{log.time}</span>
                                                                    <span className={`log-badge ${log.level}`}>{log.level.toUpperCase()}</span>
                                                                    <span className="log-msg" title={log.message}>{log.message}</span>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </details>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Immersive Scroll spacing spacer */}
                    <div className="timeline-bottom-spacer" />
                </div>
            )}

            {/* ── RNA MODE: FLANKING MESSAGES VIEWPORT ── */}
            {isRNA && selectedSession && (
                <div className="rna-messages-overlay-view">

                    {/* Header Back Button */}
                    <div className="rna-navigation-header">
                        <button className="back-to-dna-btn" onClick={handleCloseChat}>
                            <ArrowLeft size={16} /> Back to Conversations (DNA Mode)
                        </button>
                        <div className="active-chat-title-badge">
                            Active Analysis: {selectedSession.title}
                        </div>
                    </div>

                    {/* Timeline Scroll Viewport: alternatings flanking user & AI messages */}
                    <div
                        ref={scrollContainerRef}
                        className="rna-timeline-scroll-container"
                        onScroll={handleScroll}
                    >
                        {/* Padded Top Spacer to allow first element centering */}
                        <div className="timeline-top-spacer" />

                        {selectedSession.messages.map((msg) => {
                            const isFocused = focusedMsgId === String(msg.id);

                            return (
                                <div
                                    key={msg.id}
                                    data-id={msg.id}
                                    className={`rna-timeline-row ${msg.sender} ${isFocused ? 'focused' : 'faded'}`}
                                >
                                    {/* Left Column: User messages */}
                                    <div className="timeline-col left-col">
                                        {msg.sender === 'user' && (
                                            <div className="flanked-bubble user">
                                                <div className="bubble-meta">
                                                    <span className="bubble-sender">You</span>
                                                    <span className="bubble-time">{msg.timestamp}</span>
                                                </div>
                                                <p className="bubble-content-text">
                                                    {formatMessageText(msg.text)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Center Column: Empty space showing the single RNA Helix strand */}
                                    <div className="timeline-col center-col-gap" />

                                    {/* Right Column: AI Responses */}
                                    <div className="timeline-col right-col">
                                        {msg.sender === 'ai' && (
                                            <div className="flanked-bubble ai">
                                                <div className="bubble-meta">
                                                    <span className="bubble-sender">Aria</span>
                                                    <span className="bubble-time">{msg.timestamp}</span>
                                                </div>
                                                <p className="bubble-content-text">
                                                    {formatMessageText(msg.text)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Padded Bottom Spacer to allow last element centering */}
                        <div className="timeline-bottom-spacer" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default HistoryPage;
