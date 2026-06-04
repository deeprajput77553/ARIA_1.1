// src/plugins/WebSearch.js
// Advanced multi-engine (Yandex/DuckDuckGo) network web search plugin with SafeSearch OFF.
// Scrapes web links, images, and videos.

async function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// Scrape DuckDuckGo
async function searchDuckDuckGo(query, page = 1) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    };

    console.log(`[Plugin: WebSearch] Attempting DuckDuckGo fallback for: "${query}" (Page ${page})`);

    const start = (page - 1) * 30; // DDG uses offset for web links
    const imgStart = (page - 1) * 15; // DDG uses offset for images

    // 1. Web links (HTML)
    let webLinks = [];
    try {
        const webUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kp=-2&s=${start}&dc=${start}`;
        const res = await fetchWithTimeout(webUrl, { headers }, 6000);
        const html = await res.text();

        // Extract all result__a links (title links)
        const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        let match;
        const rawLinks = [];
        while ((match = linkRegex.exec(html)) !== null && rawLinks.length < 15) {
            rawLinks.push({ rawHref: match[1], rawTitle: match[2] });
        }

        // Extract all result__snippet links (snippets)
        const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
        const rawSnippets = [];
        let sm;
        while ((sm = snippetRegex.exec(html)) !== null) {
            rawSnippets.push(sm[1]);
        }

        for (let i = 0; i < rawLinks.length && webLinks.length < 10; i++) {
            let href = rawLinks[i].rawHref;
            // DuckDuckGo uses //duckduckgo.com/l/?uddg=<encoded_url>&... format
            // The HTML uses &amp; for '&' so split on both
            if (href.includes('uddg=')) {
                const parts = href.split('uddg=');
                const encoded = parts[1].split('&')[0].split('&amp;')[0];
                href = decodeURIComponent(encoded);
            }
            // Skip internal DDG links
            if (href.startsWith('//duckduckgo.com') || href.startsWith('/') || !href.startsWith('http')) continue;

            const title = rawLinks[i].rawTitle.replace(/<[^>]*>/g, '').trim();
            const snippet = rawSnippets[i] ? rawSnippets[i].replace(/<[^>]*>/g, '').trim() : '';
            if (title) {
                webLinks.push({ title, url: href, snippet });
            }
        }
    } catch (err) {
        console.error(`[Plugin: WebSearch] DuckDuckGo Web Links failed:`, err.message);
    }

    // 2. Images & Videos (JSON via VQD token)
    let images = [];
    let videos = [];
    try {
        const tokenUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&kp=-2`;
        const res = await fetchWithTimeout(tokenUrl, { headers }, 5000);
        const html = await res.text();
        const vqdMatch = html.match(/vqd=([\d-]+)/);
        if (vqdMatch && vqdMatch[1]) {
            const vqd = vqdMatch[1];

            // Get Images (use /i.js endpoint)
            try {
                const imgUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json&s=${imgStart}&kp=-2`;
                const imgRes = await fetchWithTimeout(imgUrl, { headers: { ...headers, 'Accept': 'application/json' } }, 5000);
                const imgJson = await imgRes.json();
                images = (imgJson.results || []).slice(0, 8).map(r => ({
                    title: r.title || 'Scraped Image',
                    image: r.image,
                    thumbnail: r.thumbnail,
                    url: r.url
                }));
            } catch (imgErr) {
                console.error(`[Plugin: WebSearch] DuckDuckGo Images search failed:`, imgErr.message);
            }

            // Get Videos (use /v.js endpoint)
            try {
                const videoUrl = `https://duckduckgo.com/v.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json&s=${imgStart}&kp=-2`;
                const videoRes = await fetchWithTimeout(videoUrl, { headers: { ...headers, 'Accept': 'application/json' } }, 5000);
                const videoJson = await videoRes.json();
                videos = (videoJson.results || []).slice(0, 5).map(r => ({
                    title: r.title || 'Scraped Video',
                    description: r.description || '',
                    url: r.content || r.url,
                    thumbnail: r.images?.large || r.image,
                    duration: r.duration || ''
                }));
            } catch (vidErr) {
                console.error(`[Plugin: WebSearch] DuckDuckGo Videos search failed:`, vidErr.message);
            }
        }
    } catch (err) {
        console.error(`[Plugin: WebSearch] DuckDuckGo VQD extraction failed:`, err.message);
    }

    return { webLinks, images, videos, source: 'DuckDuckGo' };
}

// Scrape Yandex
async function searchYandex(query, page = 1) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    };

    console.log(`[Plugin: WebSearch] Attempting Yandex query: "${query}" (Page ${page})`);

    const yandexPage = page - 1;

    // 1. Web links
    const webUrl = `https://yandex.com/search/?text=${encodeURIComponent(query)}&family=no&fy=1&family=0&safe=off&p=${yandexPage}`;
    const res = await fetchWithTimeout(webUrl, { headers }, 6000);
    const html = await res.text();

    if (html.includes('Captcha') || html.includes('captcha') || html.includes('smartcaptcha')) {
        throw new Error('Yandex CAPTCHA triggered');
    }

    const webLinks = [];
    const linkRegex = /<a[^>]+href="([^"]+)"[^>]+class="[^"]*organic__url[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = linkRegex.exec(html)) !== null && webLinks.length < 10) {
        const url = m[1];
        const title = m[2].replace(/<[^>]*>/g, '').trim();
        webLinks.push({ title, url, snippet: '' });
    }

    if (webLinks.length === 0) {
        throw new Error('No organic links parsed from Yandex');
    }

    // 2. Images
    let images = [];
    try {
        const imgUrl = `https://yandex.com/images/search?text=${encodeURIComponent(query)}&family=no&fy=1&family=0&safe=off&p=${yandexPage}`;
        const imgRes = await fetchWithTimeout(imgUrl, { headers }, 5000);
        const imgHtml = await imgRes.text();
        const imgRegex = /data-bem='({"serp-item":[\s\S]*?})'/g;
        let im;
        while ((im = imgRegex.exec(imgHtml)) !== null && images.length < 8) {
            try {
                const data = JSON.parse(im[1]);
                const item = data['serp-item'];
                if (item && item.img_href) {
                    images.push({
                        title: item.title || query,
                        image: item.img_href,
                        thumbnail: item.preview?.[0]?.url || item.thumb_url,
                        url: item.url || item.img_href
                    });
                }
            } catch (e) {}
        }
    } catch (imgErr) {
        console.error(`[Plugin: WebSearch] Yandex Images search failed:`, imgErr.message);
    }

    // 3. Videos
    let videos = [];
    try {
        const vidUrl = `https://yandex.com/video/search?text=${encodeURIComponent(query)}&p=${yandexPage}`;
        const vidRes = await fetchWithTimeout(vidUrl, { headers }, 5000);
        const vidHtml = await vidRes.text();
        const vidRegex = /"url":"(https?:\/\/[^"]+)"[^}]+"title":"([^"]+)"/g;
        let v;
        while ((v = vidRegex.exec(vidHtml)) !== null && videos.length < 5) {
            const url = v[1];
            const title = v[2];
            if (!videos.some(x => x.url === url)) {
                videos.push({
                    title,
                    url,
                    description: '',
                    thumbnail: '',
                    duration: ''
                });
            }
        }
    } catch (vidErr) {
        console.error(`[Plugin: WebSearch] Yandex Videos search failed:`, vidErr.message);
    }

    return { webLinks, images, videos, source: 'Yandex' };
}

export default {
    name:        'websearch',
    description: 'Searches the network (Yandex/DuckDuckGo fallback) for web links, images, and videos with SafeSearch OFF. Params: { query: string, page?: number }',
    schema: {
        query: { type: 'string', required: true, description: 'The search query or topic to search' },
        page: { type: 'number', required: false, description: 'Page number (default: 1)' }
    },
    async execute(params) {
        const query = params.query || params.topic;
        const page = parseInt(params.page) || 1;
        if (!query) {
            return 'Error: No query provided for search.';
        }

        console.log(`[Plugin: WebSearch] Initiating search for: "${query}" (SafeSearch: OFF, Page: ${page})`);
        
        let results;
        try {
            // Attempt Yandex first
            results = await searchYandex(query, page);
        } catch (e) {
            console.log(`[Plugin: WebSearch] Yandex failed: ${e.message}. Falling back to DuckDuckGo.`);
            try {
                // Fallback to DuckDuckGo
                results = await searchDuckDuckGo(query, page);
            } catch (err) {
                return JSON.stringify({
                    type: "websearch",
                    success: false,
                    error: `WebSearch failed on both Yandex and DuckDuckGo. Error: ${err.message}`
                });
            }
        }

        const { webLinks, images, videos, source } = results;

        // Build Markdown response (for fallback context injection)
        let md = `## 🔍 Search Results for "${query}" (via ${source}, Page ${page})\n\n`;

        if (webLinks.length > 0) {
            md += `### 🌐 Web Links\n`;
            webLinks.forEach((link, idx) => {
                const snip = link.snippet ? ` - ${link.snippet}` : '';
                md += `${idx + 1}. **[${link.title}](${link.url})**${snip}\n`;
            });
            md += '\n';
        } else {
            md += `*No web links found.*\n\n`;
        }

        if (images.length > 0) {
            md += `### 🖼️ Scraped Images\n`;
            images.forEach((img) => {
                md += `- **[${img.title}](${img.url})**\n  ![${img.title}](${img.image || img.thumbnail})\n`;
            });
            md += '\n';
        }

        if (videos.length > 0) {
            md += `### 🎥 Scraped Videos\n`;
            videos.forEach((vid) => {
                const durationStr = vid.duration ? ` (Duration: ${vid.duration})` : '';
                const desc = vid.description ? `\n  *${vid.description}*` : '';
                md += `- **[${vid.title}](${vid.url})**${durationStr}${desc}\n`;
            });
            md += '\n';
        }

        return JSON.stringify({
            type: "websearch",
            success: true,
            query,
            page,
            source,
            webLinks,
            images,
            videos,
            markdown: md
        }, null, 2);
    }
};
