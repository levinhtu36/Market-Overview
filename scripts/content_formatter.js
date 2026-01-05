// Content Formatter - Transform plain text to visual data

class ContentFormatter {
    constructor() {
        this.patterns = {
            // Numbers: prices, percentages, ratios
            price: /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/g,
            percentage: /([+-]?\d+\.?\d*)%/g,
            number: /\b(\d+\.?\d*)\b/g,

            // Technical indicators - Enhanced patterns
            rsi: /RSI[ -]?(\d+)[\s=:]*(-?\d+\.?\d*)?/gi,
            atr: /ATR[ -]?(\d+)[\s=:]*(-?\d+\.?\d*)?/gi,
            // Volume moving average (often written as "VMA10 (804M)" or "trên VMA20")
            vma: /\bVMA[ -]?(\d+)(?:\s*[\(=:]\s*([+-]?[\d,]+(?:\.\d+)?)(?:\s*([KMB]))?\s*\)?)?/gi,
            ma: /\bMA[ -]?(\d+)[\s\(=:]*(-?[\d,]+\.?\d*)?/gi,
            momentum: /Mom[ -]?(\d+)[\s\(=:]*([+-]?\d+\.?\d*)?/gi,
            adx: /ADX[ -]?(\d+)[\s=:]*(-?[\d,]+\.?\d*)?/gi,
            vwma: /VWAP[ -]?(\d+)[\s\(=:]*(-?[\d,]+\.?\d*)?/gi,

            // Keywords - Enhanced to avoid false positives
            bullish: /\btăng\b|bullish|positive|kháng cự|sức mạnh|hồi phục|phục hồi|đột biến|phòng thủ|ổn định/gi,
            bearish: /\bgiảm\b|bearish|negative|áp lực|\bbán\b|tháo chạy|\bđiều chỉnh\b|yếu(?!\s*tố)|xấu/gi,
            warning: /\bcảnh báo\b|rủi ro|thận trọng|canh giác|nguy hiểm/gi,

            // Section markers (non-global to avoid RegExp.lastIndex bugs)
            conclusion: /^kết\s+luận\s*:/mi,
            conclusionShort: /^kết\s+luận\s+ngắn\s*:/mi,
            evidence: /^dẫn\s+chứng\b/mi,
            action: /^(ý\s+nghĩa(?:\/hành\s+động)?|hành\s+động(?:\s+đề\s+xuất)?)\s*:/mi,
            invalidation: /^điều\s+kiện\s+(khiến\s+kết\s+luận\s+sai|sai)\s*:/mi,
            risk: /^(rủi\s+ro|cảnh\s+báo\s+rủi\s+ro)\s*:/mi,
            recommendationHeader: /^khuyến\s+nghị\s+vị\s+thế\b/mi
        };

        // Index codes (presentation): keep tickers visually distinct without leaking calculation rails.
        // This should be broad enough to cover sector indices (VNREAL, VNFIN, ...) and composites (VN30, VN100, ...).
        this.indexCodeRe = /\bVN[A-Z0-9]{2,12}\b/g;

        // Safety: cap number of callouts per formatted section (prevents UI flooding/slowness).
        // Reset for each `format()` call.
        this.calloutLimits = {
            // Focus only on conclusion-adjacent signals.
            total: 4,
            hero: 0,
            conclusion: 2,
            action: 1,
            risk: 1,
            invalidation: 1,
            // Disabled to keep highlight density low.
            levels: 0,
            scenario: 0,
            confidence: 0,
            metrics: 0,
            evidence: 0,
        };
    }

    insertStructuredBreaksVI(text) {
        let s = String(text || '');

        // Fix common DOCX flattening artifact: a dangling "Ý nghĩa/" line.
        // Prefer merging into a single actionable label so it renders as an action callout.
        // Example:
        //   "Ý nghĩa/\nHành động: ..."  -> "Ý nghĩa/Hành động: ..."
        //   "Ý nghĩa/ Hành động: ..."  -> "Ý nghĩa/Hành động: ..."
        s = s.replace(
            /\bÝ\s+nghĩa\s*[\/／⁄]\s*(?:\n+\s*|\s+)Hành\s+động(?:\s+đề\s+xuất)?\s*:\s*/gi,
            'Ý nghĩa/Hành động: '
        );
        // If "Ý nghĩa/" stands alone as a heading, normalize it to "Ý nghĩa:".
        // Handle slash variants from DOCX (/, ／, ⁄) and allow end-of-string.
        s = s.replace(/(^|\n)\s*Ý\s+nghĩa\s*[\/／⁄]\s*(?=\n|$)/gi, (_m, lead) => `${lead}Ý nghĩa:`);

        // Break long single-paragraph outputs into smaller, Word-like chunks.
        // This is purely presentation: it does NOT change numbers, only inserts line breaks.
        const breaks = [
            /(\s*)(Dẫn\s+chứng(?:\s+từ\s+dữ\s+liệu)?\s*:)/gi,
            /(\s*)(Dẫn\s+chứng\s*&\s*Phân\s+tích\s*:)/gi,
            /(\s*)(Bối\s+cảnh\s+chung\s*:)/gi,
            /(\s*)(Ý\s+nghĩa\/Hành\s+động\s*:)/gi,
            /(\s*)(Ý\s+nghĩa\s*:)/gi,
            /(\s*)(Hành\s+động(?:\s+đề\s+xuất)?\s*:)/gi,
            /(\s*)(Cảnh\s+báo\s+rủi\s+ro\s*:)/gi,
            /(\s*)(Rủi\s+ro\s*:)/gi,
            /(\s*)(Mức\s+quan\s+trọng\s+cần\s+theo\s+dõi\s*:)/gi,
            /(\s*)(Kháng\s+cự(?:\s*\(Bán\s*\/\s*Chốt\s+lời\))?\s*:)/gi,
            /(\s*)(Hỗ\s+trợ(?:\s*\(Mua\s*\/\s*Tích\s+lũy\))?\s*:)/gi,
            /(\s*)(Đề\s+xuất\s+định\s+vị\s+danh\s+mục\s*:)/gi,
            /(\s*)(Độ\s+tin\s+cậy(?:\s+mô\s+hình)?\s*:)/gi,
            /(\s*)(TTM\s+Squeeze\s*:)/gi,
            /(\s*)(Mô\s+hình\s+giá\s*:)/gi,
            /(\s*)(Mô\s+hình\s+nến\s*:)/gi,
            /(\s*)(Kịch\s+bản\s+giảm\s*\(Bearish\s+Correction\)\s*:)/gi,
            /(\s*)(Snapshot\s+các\s+ngành\s+còn\s+lại\s*:)/gi,
            /(\s*)(Điều\s+kiện\s+khiến\s+kết\s+luận\s+sai\s*:)/gi,
            /(\s*)(Điều\s+kiện\s+kết\s+luận\s+sai\s*:)/gi,
            /(\s*)(Điều\s+kiện\s+sai\s*:)/gi,
        ];

        for (const re of breaks) {
            s = s.replace(re, (_m, ws, label) => `\n\n${label}`);
        }

        // The breaks above can split the composite label "Ý nghĩa/Hành động:" into two lines:
        //   "Ý nghĩa/\n\nHành động: ..." (because "Hành động:" is also a break head).
        // Repair it into a clean heading + action label:
        //   "Ý nghĩa:\n\nHành động: ..."
        s = s.replace(
            /\bÝ\s+nghĩa\s*[\/／⁄]\s*(\n+\s*Hành\s+động(?:\s+đề\s+xuất)?\s*:)/gi,
            'Ý nghĩa:$1'
        );
        // Also normalize any remaining standalone "Ý nghĩa/" headings (created after the break loop).
        s = s.replace(/(^|\n)\s*Ý\s+nghĩa\s*[\/／⁄]\s*(?=\n|$)/gi, (_m, lead) => `${lead}Ý nghĩa:`);

        // Normalize some common headers to keep bullet labels short & consistent.
        s = s.replace(/\bThanh\s+khoản\s+tăng\s+nhưng\s+không\s+đồng\s+bộ\s*:/gi, 'Thanh khoản:');
        s = s.replace(/\bSức\s+mạnh\s+trung\s+hạn\s+còn\s+duy\s+trì\s*:/gi, 'Sức mạnh trung hạn:');
        s = s.replace(/\bĐộ\s+rộng\s+nghiêng\b/gi, 'Độ rộng: nghiêng');

        // Common "overview" labels that often appear mid-paragraph after DOCX->TXT conversion.
        // Turn them into paragraph starters so they can become bullets later.
        const overviewLabels = [
            'Độ rộng',
            'Dòng tiền',
            'Điểm nhấn',
            'Thanh khoản',
            'Sức mạnh',
            'Phân hóa',
            'Điểm đáng chú ý',
            'Nhận định nhanh',
        ];
        const overviewRe = new RegExp(
            String.raw`([.!?])\s+(${overviewLabels.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\s*:\s*`,
            'g'
        );
        s = s.replace(overviewRe, (_m, end, label) => `${end}\n\n${label}: `);

        // Also split on these heads even when they don't end with ":" (common in narrative text).
        // Example: "... tạo lực cản. Độ rộng nghiêng ... Thanh khoản tăng ..."
        const looseHeadRe = /([.!?])\s+((?:Độ\s+rộng|Dòng\s+tiền|Điểm\s+nhấn|Thanh\s+khoản|Sức\s+mạnh)\b)/gi;
        s = s.replace(looseHeadRe, (_m, end, head) => `${end}\n\n${head}`);

        // Ensure "Top N ..." headings become their own paragraphs (prevents them from sticking to the previous sentence/list item).
        s = s.replace(
            /([.!?])\s+(Top\s+\d+\s+ngành\s+(?:mạnh|yếu)[^:\n]*:)/gi,
            (_m, end, head) => `${end}\n\n${head}`
        );

        // Make "Key levels / Portfolio positioning" read like mini-sections (common in "NHẬN ĐỊNH").
        s = s.replace(
            /([.!?])\s+(Mức\s+quan\s+trọng\s+cần\s+theo\s+dõi\s*:)/gi,
            (_m, end, head) => `${end}\n\n${head}`
        );
        s = s.replace(
            /([.!?])\s+(Đề\s+xuất\s+định\s+vị\s+danh\s+mục\s*:)/gi,
            (_m, end, head) => `${end}\n\n${head}`
        );

        // Promote standalone "Cảnh báo" line into a mini-section header (only when it's a heading line).
        s = s.replace(/(^|\n)\s*(Cảnh\s+báo)\s*(?=\n)/gi, (_m, lead, head) => `${lead}${head}\n\n`);

        // Split "Mức quan trọng ...: Kháng cự: ... Hỗ trợ: ..." into separate paragraphs for UI parsing.
        s = s.replace(/(Mức\s+quan\s+trọng\s+cần\s+theo\s+dõi\s*:)\s*/gi, '$1\n\n');
        s = s.replace(/(Đề\s+xuất\s+định\s+vị\s+danh\s+mục\s*:)\s*/gi, '$1\n\n');
        s = s.replace(/(Snapshot\s+các\s+ngành\s+còn\s+lại\s*:)\s*/gi, '$1\n\n');
        s = s.replace(/(\n\n)(Kháng\s+cự\s*:)/gi, '$1$2');
        s = s.replace(/(\bKháng\s+cự\s*:)\s*/gi, '$1 ');
        s = s.replace(/([.!?])\s+(Hỗ\s+trợ\s*:)/gi, (_m, end, head) => `${end}\n\n${head}`);

        // NOTE: Avoid splitting on lowercase nouns like "độ rộng của kênh..." by only splitting
        // on explicit head tokens that are capitalized and have a colon.
        const headTokens = [
            'Độ rộng:',
            'Dòng tiền:',
            'Điểm nhấn:',
            'Thanh khoản:',
            'Sức mạnh trung hạn:',
            'Sức mạnh:',
            'Mức quan trọng cần theo dõi:',
            'Đề xuất định vị danh mục:',
        ];
        const headTokenRe = new RegExp(
            String.raw`([^\n])\s+(${headTokens.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
            'g'
        );
        s = s.replace(headTokenRe, (_m, prev, head) => `${prev}\n\n${head}`);

        // Ensure "Top 3 quan sát quan trọng" is a proper ordered list (some sources omit "1)").
        // Example: "Top 3 quan sát quan trọng: <item1>. 2) <item2>. 3) <item3>."
        s = s.replace(
            /Top\s+3\s+quan\s+sát\s+quan\s+trọng\s*:\s*(?!1\s*[\.\)])/gi,
            'Top 3 quan sát quan trọng:\n1) '
        );

        // Make 3-metric block more scannable by splitting common labels into separate lines.
        // (Still keeps the numbers; only adjusts presentation/newlines.)
        s = s.replace(
            /3\s*[-–]\s*METRIC\s+LEADERSHIP\s*\(vs\s+VNINDEX\)\s*:\s*/gi,
            '3-METRIC LEADERSHIP (vs VNINDEX):\n'
        );
        const metricHeads = [
            'Nhịp dẫn dắt',
            'Vượt trội 20 phiên (so với VNINDEX)',
            'Tụt hậu 20 phiên (so với VNINDEX)',
            'Đồng thuận 5 & 20 phiên',
            'Ghi chú',
        ];
        const metricHeadRe = new RegExp(
            String.raw`([^\n])\s+(${metricHeads.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\s*:\s*`,
            'gi'
        );
        s = s.replace(metricHeadRe, (_m, prev, head) => `${prev}\n\n${head}: `);

        // Split inline numbered lists that often get flattened from Word (e.g. "Top ...: 1 . ... 2 . ... 3 . ...").
        // Accept both "1." and "1 ." variants; decimals won't match because they don't have the trailing whitespace.
        // Also supports ")": "1) ..." and "1 ) ...".
        s = s.replace(/([:;])\s*(\d{1,2})\s*\.\s+(?=[0-9A-ZÀ-Ỵ])/g, (_m, p, n) => `${p}\n${n}. `);
        s = s.replace(/(^|\n)\s*(\d{1,2})\s*\.\s+(?=[0-9A-ZÀ-Ỵ])/gm, (_m, lead, n) => `${lead}${n}. `);
        s = s.replace(/([:;])\s*(\d{1,2})\s*\)\s+(?=[0-9A-ZÀ-Ỵ])/g, (_m, p, n) => `${p}\n${n}) `);
        s = s.replace(/(^|\n)\s*(\d{1,2})\s*\)\s+(?=[0-9A-ZÀ-Ỵ])/gm, (_m, lead, n) => `${lead}${n}) `);
        // Also split when a new list item starts after an end-of-sentence punctuation.
        // Example: "... tăng 3.75%. 2. VNDIAMOND: ..."  ->  "... tăng 3.75%.\n2. VNDIAMOND: ..."
        // This avoids false positives like "trên 75," because it requires `.?!` before the marker.
        s = s.replace(
            /([.!?])\s+(\d{1,2})\s*([.)])\s+(?=[0-9A-ZÀ-Ỵ])/g,
            (_m, end, n, mark) => `${end}\n${n}${mark} `
        );

        // Snapshot: make each remaining sector line its own paragraph (helps UI scanning).
        // Example: "Tài chính (VNFIN): ...%. Chăm sóc ...: ...%." -> split after the dot.
        s = s.replace(/(Snapshot\s+các\s+ngành\s+còn\s+lại\s*:\s*\n\n[\s\S]{0,2000}?%[.!?])\s+(?=[A-ZÀ-Ỵ])/g, '$1\n\n');

        // If a paragraph is still too long, split into sentences for readability.
        // This is a last resort to avoid "bê nguyên khối" from Word.
        const paras0 = s.split(/\n{2,}/g);
        const rebuilt = [];
        for (const raw of paras0) {
            const p = raw.trim();
            if (!p) continue;
            // If the paragraph already has list-like line breaks, keep them.
            // Otherwise treat single newlines as soft-wrapping and reflow for sentence splitting.
            const hasListLines = p
                .split('\n')
                .some(line => /^[\-\•]\s+/.test(line.trim()) || /^\d{1,2}[\.\)]\s+/.test(line.trim()));

	            if (hasListLines) {
	                // Often DOCX->TXT flattens: "Sentence. Top N ...: \n1. ...\n2. ...".
	                // Keep the list lines, but split the preface into readable paragraphs.
	                const splitAt = p.search(/\n(?:[\-\•]\s+|\d{1,2}[\.\)]\s+)/);
	                if (splitAt > 0) {
	                    const prefaceRaw = p.slice(0, splitAt).trim();
	                    const listRaw = p.slice(splitAt).trim();
	                    // If the paragraph itself already starts with a list item (e.g. "1. VN30 ...\n2. ..."),
	                    // don't peel the first item into a "preface" (it breaks list parsing).
	                    if (/^(?:[\-\•]\s+|\d{1,2}[\.\)]\s+)/.test(prefaceRaw)) {
	                        rebuilt.push(p);
	                        continue;
	                    }
	                    const preface = prefaceRaw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
	                    const parts = preface
	                        .split(/(?<=[.!?])\s+(?=[0-9A-ZÀ-Ỵ])/g)
	                        .map(x => x.trim())
	                        .filter(Boolean);
                    if (parts.length >= 2) {
                        rebuilt.push(`${parts.join('\n\n')}\n\n${listRaw}`);
                        continue;
                    }
                    rebuilt.push(`${preface}\n\n${listRaw}`);
                    continue;
                }

                rebuilt.push(p);
                continue;
            }

            const pForSplit = hasListLines
                ? p
                : p.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

            if (pForSplit.length < 220) {
                rebuilt.push(p);
                continue;
            }
            // Split on end-of-sentence punctuation followed by a capital letter or a digit (e.g. "%... . 2. ...").
            const parts = pForSplit.split(/(?<=[.!?])\s+(?=[0-9A-ZÀ-Ỵ])/g).map(x => x.trim()).filter(Boolean);
            if (parts.length >= 2) {
                rebuilt.push(parts.join('\n\n'));
            } else {
                rebuilt.push(p);
            }
        }
        s = rebuilt.join('\n\n');

        // Convert timeframe lines into bullets for easier scanning (if they start a paragraph).
        const bulletHeads = [
            /^Độ\s+rộng\s*:/g,
            /^Dòng\s+tiền\s*:/g,
            /^Điểm\s+nhấn\s*:/g,
            /^Thanh\s+khoản\b/g,
            /^Sức\s+mạnh\b/g,
            /^Kháng\s+cự\s*:/g,
            /^Hỗ\s+trợ\s*:/g,
            /^Nhịp\s+dẫn\s+dắt\s*:/g,
            /^Vượt\s+trội\s+20\s+phiên\b/gi,
            /^Tụt\s+hậu\s+20\s+phiên\b/gi,
            /^Đồng\s+thuận\s+5\s*&\s*20\s+phiên\b/gi,
            /^Ghi\s+chú\s*:/g,
            /^Ngắn\s+hạn\b/g,
            /^Trung\s+hạn\b/g,
            /^Dài\s+hạn\b/g,
            /^Trung\/Dài\s+hạn\b/g,
            /^Kịch\s+bản\b/g,
            /^Diễn\s+biến\s*:/g,
            /^Điểm\s+vào\b/g,
            /^Điểm\s+thoát\b/g,
            /^Mức\s+độ\s+tự\s+tin\b/g,
        ];

        const paras = s.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
        const out = [];
        for (const p of paras) {
            const lines = p.split('\n').map(x => x.trim()).filter(Boolean);
            if (lines.length === 1) {
                const line = lines[0];
                const shouldBullet = bulletHeads.some(re => re.test(line));
                if (shouldBullet && !/^[\-•]\s+/.test(line)) {
                    out.push(`- ${line}`);
                } else {
                    out.push(line);
                }
                continue;
            }
            out.push(lines.join('\n'));
        }

        // Auto-capitalize the first letter of each new line (presentation only).
        // Helps remove "word dump" feel when the generator starts a sentence with lowercase.
        const capitalized = out
            .join('\n\n')
            .split('\n')
            .map((line) => {
                const m = line.match(/^(\s*(?:[-•]\s+|\d{1,2}[\.\)]\s+)?)(.)/);
                if (!m) return line;
                const prefix = m[1] || '';
                const ch = m[2] || '';
                // Only uppercase when the first visible character is a letter and currently lowercase.
                if (ch === ch.toLowerCase() && ch !== ch.toUpperCase()) {
                    return `${prefix}${ch.toUpperCase()}${line.slice(prefix.length + 1)}`;
                }
                return line;
            })
            .join('\n');

        return capitalized;
    }

    sanitizePresentationVI(text) {
        let s = String(text || '');

        // 1) Drivers: make "kéo lên/kéo xuống" human-readable (keep tickers, hide mechanics).
        s = s.replace(
            /Điểm\s+nhấn\s+đóng\s+góp:\s*kéo\s+lên:\s*([^;\n]+?)\s*;\s*kéo\s+xuống:\s*([^\n]+?)\s*(?:$|\n)/gi,
            (m, up, down) =>
                `Điểm nhấn: chỉ số được nâng đỡ chủ yếu bởi ${up.trim()}, trong khi ${down.trim()} tạo lực cản.\n`
        );

        // 2) Redact concentration / "top contributors" mechanics (keep meaning, drop raw % and counts).
        s = s.replace(
            /Chỉ\s*\d+\s*mã[\s\S]{0,80}?chiếm\s+tới\s*\d+(?:\.\d+)?%[\s\S]*?(?=\n|$)/gi,
            'Đà tăng/giảm đang khá tập trung vào một nhóm cổ phiếu trụ.'
        );
        s = s.replace(/Top\s*10\s*concentration\s*[0-9.]+%/gi, 'Mức độ tập trung của nhóm cổ phiếu trụ đang cao.');

        // 3) Hide exact breadth thresholds (keep intent).
        s = s.replace(/\(\s*số\s+mã\s+tăng\s*>\s*\d+\s*\)/gi, '');
        s = s.replace(/\(Total\s*=\s*\d+[^)]*\)/gi, '');
        s = s.replace(/A\/D\s*\d+\s*\/\s*\d+/gi, 'độ rộng nghiêng về phe giảm');

        // 4) Replace explicit "đường xu hướng ... (N phiên)" wording with generic support/resistance language.
        s = s.replace(/\bđường\s+trung\s+bình\s+xu\s+hướng\s+ngắn\s+hạn\s*\(\s*20\s*phiên\s*\)\s*\(\s*([0-9][0-9,.\s]+)\s*\)/gi, (_m, level) => {
            const v = String(level).trim();
            return `vùng hỗ trợ ngắn hạn (quanh ${v})`;
        });
        s = s.replace(/\bđường\s+xu\s+hướng\s+\d+\s*phiên\s*\(\s*([0-9][0-9,.\s]+)\s*\)/gi, (_m, level) => `vùng hỗ trợ (quanh ${String(level).trim()})`);
        s = s.replace(/\bđường\s+xu\s+hướng\s+\d+\s*phiên\s+ở\s*([0-9][0-9,.\s]+)/gi, (_m, level) => `mốc hỗ trợ quanh ${String(level).trim()}`);
        s = s.replace(/\(\s*đường\s+xu\s+hướng\s+\d+\s*phiên\s*\)/gi, '');
        s = s.replace(/\bđường\s+trung\s+bình\s+xu\s+hướng\s+ngắn\s+hạn\s*\(\s*20\s*phiên\s*\)/gi, 'vùng xu hướng ngắn hạn');
        s = s.replace(/\bđường\s+trung\s+bình\s+xu\s+hướng\s+trung\s+hạn\s*\(\s*50\s*phiên\s*\)/gi, 'vùng xu hướng trung hạn');
        s = s.replace(/\bđường\s+trung\s+bình\s+xu\s+hướng\s+dài\s+hạn\s*\(\s*200\s*phiên\s*\)/gi, 'vùng xu hướng dài hạn');

        // 5) Reduce hard indicator naming (keep numbers where already present).
        s = s.replace(/\bmức\s+quá\s+mua\s*\/\s*quá\s*bán\b/gi, 'tín hiệu hưng phấn');
        s = s.replace(/\bchỉ\s+báo\s+độ\s+mạnh\s+xu\s+hướng\b/gi, 'độ bền của xu hướng');
        s = s.replace(/\bđộ\s+mạnh\s+xu\s+hướng\b/gi, 'độ bền xu hướng');
        s = s.replace(/\bđộng\s+lượng\b/gi, 'xung lực');

        // 6) Fix a common "Điều kiện sai" wording that mixes positive/negative with a single conclusion.
        s = s.replace(
            /Điều\s+kiện\s+sai:\s*Nếu\s+phiên\s+sau\s+VNINDEX\s+đóng\s+cửa\s+dưới[\s\S]{0,120}?\(\s*([0-9][0-9,.\s]+)\s*\)[\s\S]{0,120}?\s+hoặc\s+độ\s+rộng\s+cải\s+thiện\s+mạnh[\s\S]{0,80}?,\s*bức\s+tranh\s+có\s+thể\s+lạc\s+quan\s+hơn\.?/gi,
            (_m, level) =>
                `Điều kiện sai: Nếu độ rộng cải thiện rõ rệt, bức tranh có thể tích cực hơn; ngược lại nếu VNINDEX thủng vùng hỗ trợ ngắn hạn quanh ${String(level).trim()}, rủi ro điều chỉnh sẽ tăng.`
        );

        // 7) Hide raw correlation coefficients if present.
        s = s.replace(/\(~?\s*0\.\d+\s*\)/g, '');
        s = s.replace(/\btương\s+quan\s+rất\s+cao\s+với\s+VNINDEX\b/gi, 'đi sát VNINDEX');
        s = s.replace(/\btương\s+quan\b/gi, 'độ đồng pha');

        // Minor cleanups after redaction (preserve paragraph breaks)
        s = s.replace(/[ \t]{2,}/g, ' ');
        s = s.replace(/[ \t]+\n/g, '\n');
        s = s.replace(/\n{3,}/g, '\n\n');
        return s.trim();
    }

    resetCalloutState() {
        this._calloutTotal = 0;
        this._calloutByType = Object.create(null);
    }

    canEmitCallout(type) {
        if (!this._calloutByType) this.resetCalloutState();

        const limitTotal = this.calloutLimits.total ?? 0;
        if (limitTotal > 0 && this._calloutTotal >= limitTotal) return false;

        const limitType = this.calloutLimits[type];
        if (typeof limitType === 'number' && limitType >= 0) {
            const current = this._calloutByType[type] || 0;
            if (current >= limitType) return false;
        }

        this._calloutTotal += 1;
        this._calloutByType[type] = (this._calloutByType[type] || 0) + 1;
        return true;
    }

    stripTagsUnsafe(html) {
        return String(html || '').replace(/<[^>]*>/g, '');
    }

    hasMeaningfulText(html) {
        return this.stripTagsUnsafe(html).replace(/\s+/g, ' ').trim().length > 0;
    }

    escapeRegExp(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    stripPrefix(htmlText, prefix) {
        const re = new RegExp(`^\\s*${this.escapeRegExp(prefix)}\\s*`, 'i');
        return htmlText.replace(re, '');
    }

    isAllCapsHeadline(rawLine) {
        const line = (rawLine || '').trim();
        if (line.length < 10 || line.length > 120) return false;
        if (/^PHẦN\s+[IVX]+\b/i.test(line)) return false;

        // Browser-safe all-caps detection without Unicode property escapes.
        const letters = Array.from(line).filter(ch => ch.toLowerCase() !== ch.toUpperCase());
        if (letters.length < 6) return false;
        return letters.every(ch => ch === ch.toUpperCase());
    }

    renderCallout({ boxClass, icon, iconClass, textClass }, htmlText) {
        return `<div class="${boxClass}">
            <span class="${iconClass}">${icon}</span>
            <span class="${textClass}">${htmlText}</span>
        </div>`;
    }

    tryRenderCalloutParagraph(htmlParagraph) {
        const raw = this.stripTagsUnsafe(htmlParagraph).trim();
        if (!raw) return null;

        // Intentionally no HERO highlighting (too noisy for daily reports).

        if (this.patterns.conclusionShort.test(raw)) {
            const body = this.stripPrefix(htmlParagraph, 'Kết luận ngắn:');
            if (!this.hasMeaningfulText(body)) return null;
            if (!this.canEmitCallout('conclusion')) return null;
            return this.renderCallout(
                { boxClass: 'conclusion-box', icon: '📌', iconClass: 'conclusion-icon', textClass: 'conclusion-text' },
                body
            );
        }

        if (this.patterns.conclusion.test(raw)) {
            const body = this.stripPrefix(htmlParagraph, 'Kết luận:');
            if (!this.hasMeaningfulText(body)) return null;
            if (!this.canEmitCallout('conclusion')) return null;
            return this.renderCallout(
                { boxClass: 'conclusion-box', icon: '📌', iconClass: 'conclusion-icon', textClass: 'conclusion-text' },
                body
            );
        }

        if (this.patterns.action.test(raw)) {
            // Prefer the more specific prefix first.
            let body = htmlParagraph;
            body = this.stripPrefix(body, 'Ý nghĩa/Hành động:');
            body = this.stripPrefix(body, 'Ý nghĩa:');
            body = this.stripPrefix(body, 'Hành động đề xuất:');
            body = this.stripPrefix(body, 'Hành động:');
            if (!this.hasMeaningfulText(body)) return null;
            if (!this.canEmitCallout('action')) return null;
            return this.renderCallout(
                { boxClass: 'action-box', icon: '🎯', iconClass: 'action-icon', textClass: 'action-text' },
                body
            );
        }

        if (this.patterns.recommendationHeader.test(raw)) {
            if (!this.hasMeaningfulText(htmlParagraph)) return null;
            if (!this.canEmitCallout('action')) return null;
            return this.renderCallout(
                { boxClass: 'action-box', icon: '🎯', iconClass: 'action-icon', textClass: 'action-text' },
                htmlParagraph
            );
        }

        if (this.patterns.risk.test(raw)) {
            let body = htmlParagraph;
            body = this.stripPrefix(body, 'Rủi ro:');
            body = this.stripPrefix(body, 'Cảnh báo rủi ro:');
            if (!this.hasMeaningfulText(body)) return null;
            if (!this.canEmitCallout('risk')) return null;
            return this.renderCallout(
                { boxClass: 'risk-box', icon: '⛔', iconClass: 'risk-icon', textClass: 'risk-text' },
                body
            );
        }

        if (this.patterns.invalidation.test(raw) || /^3\s+điều\s+kiện\b/i.test(raw)) {
            let body = htmlParagraph;
            body = this.stripPrefix(body, 'Điều kiện khiến kết luận sai:');
            body = this.stripPrefix(body, 'Điều kiện sai:');
            if (!this.hasMeaningfulText(body)) return null;
            if (!this.canEmitCallout('invalidation')) return null;
            return this.renderCallout(
                { boxClass: 'conditions-box', icon: '⚠️', iconClass: 'conditions-icon', textClass: 'conditions-text' },
                body
            );
        }

        return null;
    }

    // Format content với visual elements
    format(content) {
        if (!content) return '';

        this.resetCalloutState();

        // Strip existing HTML tags to get plain text
        let plainText = this.stripHtml(content);

        let formatted = plainText;

        // Remove backticks from title
        formatted = formatted.replace(/`([^`]+)`/g, '$1');

        // Presentation-layer sanitizer (keep meaning, reduce raw reasoning/indicator dumps)
        formatted = this.sanitizePresentationVI(formatted);

        // Re-introduce Word-like structure so sections don't become one big highlighted block.
        formatted = this.insertStructuredBreaksVI(formatted);

        // Format numbers
        formatted = this.formatNumbers(formatted);

        // Format percentages
        formatted = this.formatPercentages(formatted);

        // Format technical indicators
        formatted = this.formatIndicators(formatted);

        // Format lists
        formatted = this.formatLists(formatted);

        // Add color coding
        formatted = this.colorCode(formatted);

        return formatted;
    }

    // Strip HTML tags to get plain text, but preserve structure
    stripHtml(html) {
        // Remove the outer info-box div but keep inner content
        let cleaned = html.replace(/<div class=['"]info-box['"]>/gi, '');
        cleaned = cleaned.replace(/<\/div>\s*$/gi, ''); // Remove closing div at end

        // Preserve basic structure for lists & line breaks before extracting text.
        cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
        cleaned = cleaned.replace(/<li>/gi, '- ');
        cleaned = cleaned.replace(/<\/li>/gi, '\n');
        cleaned = cleaned.replace(/<\/(ul|ol)>/gi, '\n\n');

        // Convert <p> tags to newlines
        cleaned = cleaned.replace(/<p>/gi, '');
        cleaned = cleaned.replace(/<\/p>/gi, '\n\n');

        // Remove any remaining HTML tags
        // Browser path: use DOM to decode entities and preserve newlines.
        // Node path (tests/CI): fall back to regex-only stripping.
        if (typeof document !== 'undefined' && document && document.createElement) {
            const tmp = document.createElement('div');
            tmp.innerHTML = cleaned;
            // Prefer innerText to keep newlines from the structure above.
            return tmp.innerText || tmp.textContent || '';
        }

        // Fallback: strip tags and decode the most common entities.
        let text = cleaned.replace(/<[^>]*>/g, '');
        text = text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        return text;
    }

    formatNumbers(text) {
        return text.replace(this.patterns.price, (match, number, offset, full) => {
            // Don't wrap digits inside alphanumeric tickers/labels (e.g., VN30, 1D, 20D, MA20, T-4).
            // This prevents breaking index codes and keeps post-processing stable.
            try {
                const prev = offset > 0 ? full[offset - 1] : '';
                const prev2 = offset > 1 ? full[offset - 2] : '';
                const next = full[offset + match.length] || '';
                const isLetterOrDigit = (ch) => /[A-Za-z0-9À-ỹ]/.test(ch || '');

                if (isLetterOrDigit(prev) || isLetterOrDigit(next)) return match;
                if (prev === '-' && /[A-Za-zÀ-ỹ]/.test(prev2 || '')) return match;
            } catch (_) {}

            // Don't wrap ordered list markers like "\n1." or "\n2)" — this breaks list detection later.
            try {
                const prev = offset > 0 ? full[offset - 1] : '\n';
                const next = full[offset + match.length] || '';
                const next2 = full[offset + match.length + 1] || '';
                const isListMarkerNumber = /^\d{1,2}$/.test(String(number)) &&
                    (prev === '\n' || prev === '\r' || offset === 0) &&
                    (next === '.' || next === ')') &&
                    (next2 === ' ' || next2 === '\n' || next2 === '\r');
                if (isListMarkerNumber) return match;
            } catch (_) {}

            const num = parseFloat(number.replace(/,/g, ''));
            if (isNaN(num)) return match;

            // Format based on magnitude
            // CHỈ convert số cực lớn (>= 1M) thành M/K format
            // Giá chỉ số (1,000-10,000) giữ nguyên dấu phẩy
            if (num >= 1000000) {
                return `<span class="metric-number">${(num/1000000).toFixed(2)}M</span>`;
            } else if (num >= 10000) {
                // Số 5 chữ số trở lên: format with K
                return `<span class="metric-number">${(num/1000).toFixed(1)}K</span>`;
            } else if (num >= 1000) {
                // Số 4 chữ số (giá chỉ số): GIỮ NGUYÊN dấu phẩy
                // Nếu match có dấu phẩy, giữ nguyên, ngược lại add dấu phẩy
                if (match.includes(',')) {
                    return `<span class="metric-number">${match}</span>`;
                }
                return `<span class="metric-number">${num.toLocaleString('en-US')}</span>`;
            } else if (num >= 1) {
                return `<span class="metric-number">${num.toLocaleString('en-US')}</span>`;
            }
            return match;
        });
    }

    formatPercentages(text) {
        return text.replace(this.patterns.percentage, (match, pct) => {
            const num = parseFloat(pct);
            if (isNaN(num)) return match;

            const className = num > 0 ? 'bullish' : num < 0 ? 'bearish' : 'neutral';
            const icon = num > 0 ? '📈' : num < 0 ? '📉' : '➡️';

            return `<span class="percentage ${className}" title="${pct}">${icon} ${pct}</span>`;
        });
    }

    formatIndicators(text) {
        // Format VMA (Volume Moving Average) first so we don't accidentally style the inner "MA" token.
        text = text.replace(this.patterns.vma, (match, period, value, unit) => {
            if (!value) return `<span class="ma-indicator"><strong>VMA${period}</strong></span>`;
            const num = parseFloat(String(value).replace(/,/g, ''));
            if (isNaN(num)) return match;
            const suffix = unit ? String(unit).trim() : '';
            return `<span class="ma-indicator"><strong>VMA${period}:</strong> <span class="ma-value">${num.toLocaleString('en-US')}${suffix}</span></span>`;
        });

        // Format RSI with progress bar - pattern: /RSI[ -]?(\d+)[\s=:]*(-?\d+\.?\d*)?/gi
        text = text.replace(this.patterns.rsi, (match, period, value) => {
            if (!value) return match; // No value provided
            const num = parseFloat(value);
            if (isNaN(num)) return match;

            const level = num > 70 ? 'overbought' : num < 30 ? 'oversold' : 'neutral';
            const color = num > 70 ? 'var(--danger)' : num < 30 ? 'var(--success)' : 'var(--warning)';
            const label = num > 70 ? 'Quá mua' : num < 30 ? 'Quá bán' : 'Trung tính';

            return `
                <div class="indicator-container">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div class="indicator-label">RSI${period}</div>
                        <div class="indicator-value" style="font-size: 1.2rem;">${num.toFixed(2)}</div>
                    </div>
                    <div class="progress-bar">
                        <div class="fill ${level}" style="width: ${Math.min(100, num)}%; background: ${color};"></div>
                    </div>
                    <div style="text-align: center; font-size: 0.75rem; margin-top: 4px; color: var(--text-secondary);">${label}</div>
                </div>
            `;
        });

        // Format MA with level
        text = text.replace(this.patterns.ma, (match, period, value) => {
            if (!value) return `<span class="ma-indicator"><strong>MA${period}</strong></span>`;
            const num = parseFloat(value.replace(/,/g, ''));
            if (isNaN(num)) return match;

            return `<span class="ma-indicator"><strong>MA${period}:</strong> <span class="ma-value">${num.toLocaleString('en-US')}</span></span>`;
        });

        // Format Momentum
        text = text.replace(this.patterns.momentum, (match, period, value) => {
            if (!value) return `<span class="momentum">Mom${period}</span>`;
            const num = parseFloat(value);
            if (isNaN(num)) return match;

            const className = num > 0 ? 'bullish' : num < 0 ? 'bearish' : 'neutral';
            const icon = num > 0 ? '📈' : num < 0 ? '📉' : '➡️';

            return `<span class="momentum ${className}">${icon} Mom${period}: ${value}</span>`;
        });

        // Format ADX
        text = text.replace(this.patterns.adx, (match, period, value) => {
            if (!value) return `<span class="ma-indicator"><strong>ADX${period}</strong></span>`;
            const num = parseFloat(value.replace(/,/g, ''));
            if (isNaN(num)) return match;

            const strength = num > 25 ? 'Mạnh' : num > 20 ? 'Trung bình' : 'Yếu';
            const color = num > 25 ? 'var(--success)' : num > 20 ? 'var(--warning)' : 'var(--text-secondary)';

            return `<span class="ma-indicator"><strong>ADX${period}:</strong> <span class="ma-value" style="color: ${color};">${num.toFixed(2)} (${strength})</span></span>`;
        });

        // Format ATR
        text = text.replace(this.patterns.atr, (match, period, value) => {
            if (!value) return `<span class="ma-indicator"><strong>ATR${period}</strong></span>`;
            const num = parseFloat(value);
            if (isNaN(num)) return match;

            return `<span class="ma-indicator"><strong>ATR${period}:</strong> <span class="ma-value">${num.toFixed(2)}</span></span>`;
        });

        // Format VWAP
        text = text.replace(this.patterns.vwma, (match, period, value) => {
            if (!value) return `<span class="ma-indicator"><strong>VWAP${period}</strong></span>`;
            const num = parseFloat(value.replace(/,/g, ''));
            if (isNaN(num)) return match;

            return `<span class="ma-indicator"><strong>VWAP${period}:</strong> <span class="ma-value">${num.toLocaleString('en-US')}</span></span>`;
        });

        return text;
    }

    formatLists(text) {
        // Split by paragraphs first
        const paragraphs = text.split('\n\n');

        return paragraphs.map(para => {
            // Check if it's a numbered list
            const lines = para.split('\n');
            const nonEmptyLines = lines.map(l => l.trim()).filter(Boolean);
            const strippedNonEmpty = nonEmptyLines.map(l => this.stripTagsUnsafe(l).trim());

            const renderSubsectionHeader = (rawLine) => {
                const original = this.stripTagsUnsafe(rawLine).trim();
                if (!original) return null;
                // Head text shown in the header (avoid swallowing the whole data line after ":")
                const line = original.replace(/:\s*$/, '');
                let icon = null;
                if (/^Top\s+\d+\s+ngành\s+mạnh\b/i.test(line)) icon = '🏭';
                else if (/^Top\s+\d+\s+ngành\s+yếu\b/i.test(line)) icon = '🏭';
                else if (/^Top\s+\d+\s+quan\s+sát\s+quan\s+trọng\b/i.test(line)) icon = '🎯';
                else if (/^3\s*[-–]\s*METRIC\s+LEADERSHIP\b/i.test(line)) icon = '🔗';
                else if (/^Snapshot\s+các\s+ngành\s+còn\s+lại\b/i.test(line)) icon = '🧾';
                else if (/^Mức\s+quan\s+trọng\s+cần\s+theo\s+dõi\b/i.test(line)) icon = '📍';
                else if (/^Đề\s+xuất\s+định\s+vị\s+danh\s+mục\b/i.test(line)) icon = '🧭';
                else if (/^Cảnh\s+báo\b/i.test(line)) icon = '⚠️';
                if (!icon) return null;
                let head = line;
                const colonIdx = head.indexOf(':');
                if (colonIdx >= 0) head = head.slice(0, colonIdx).trim();
                return `<div class="subsection-box"><span class="subsection-icon">${icon}</span><span class="subsection-header">${this.formatInline(head)}</span></div>`;
            };

            const renderPrefixParagraphs = (prefixLines) => {
                if (!prefixLines || !prefixLines.length) return '';
                return prefixLines
                    .map(l => {
                        const sub = renderSubsectionHeader(l);
                        if (sub) return sub;
                        return `<p class="content-paragraph">${this.formatInline(l)}</p>`;
                    })
                    .join('\n\n');
            };

            // Special-case: "Cảnh báo" heading line followed by one or more lines.
            if (strippedNonEmpty.length >= 2 && /^Cảnh\s+báo$/i.test(strippedNonEmpty[0])) {
                const header = renderSubsectionHeader(nonEmptyLines[0]) || `<p class="content-paragraph">${this.formatInline(nonEmptyLines[0])}</p>`;
                const rest = nonEmptyLines.slice(1).map(l => {
                    const callout = this.tryRenderCalloutParagraph(this.formatInline(l));
                    if (callout) return callout;
                    return `<p class="content-paragraph">${this.formatInline(l)}</p>`;
                }).join('\n\n');
                return `${header}\n\n${rest}`;
            }

            const firstNumberedIdx = strippedNonEmpty.findIndex(line => /^(\d+)[\.\)]\s/.test(line));
            const firstBulletedIdx = nonEmptyLines.findIndex(line => /^[\-\•]\s/.test(line));

            // Check for numbered items
            if (firstNumberedIdx >= 0) {
                const prefix = nonEmptyLines.slice(0, firstNumberedIdx);
                const listLines = nonEmptyLines.slice(firstNumberedIdx);
                const prefixHtml = renderPrefixParagraphs(prefix);
                const listHtml = `<div class="formatted-list numbered">${listLines.map(line => {
                    const stripped = this.stripTagsUnsafe(line).trim();
                    const match = stripped.match(/^(\d+)[\.\)]\s+(.*)/);
                    if (match) {
                        // Check if content has a header like "Ngắn hạn:", "Trung hạn:"
                        // Keep original line HTML for inner formatting, but use stripped text for parsing.
                        const content = this.stripTagsUnsafe(line).trim().replace(/^(\d+)[\.\)]\s+/, '');
                        const headerMatch = content.match(/^([^:]+):\s*(.*)/);

                    if (headerMatch) {
                        const header = headerMatch[1];
                        const body = headerMatch[2];
                        return `<div class="list-item numbered">
                                <span class="list-number">${match[1]}</span>
                                <span class="list-content">
                                    <span class="list-header">${this.formatInline(header)}</span>
                                    <span class="list-body">${this.formatInline(body)}</span>
                                </span>
                            </div>`;
                    }

                        return `<div class="list-item numbered"><span class="list-number">${match[1]}</span><span class="list-content">${this.formatInline(content)}</span></div>`;
                    }
                    return `<div class="list-item">${line}</div>`;
                }).join('')}</div>`;
                return prefixHtml ? `${prefixHtml}\n\n${listHtml}` : listHtml;
            }

            // Check for bullet points
            if (firstBulletedIdx >= 0) {
                const prefix = nonEmptyLines.slice(0, firstBulletedIdx);
                const listLines = nonEmptyLines.slice(firstBulletedIdx);
                const prefixHtml = renderPrefixParagraphs(prefix);
                const listHtml = `<div class="formatted-list bulleted">${listLines.map(line => {
                    const match = line.match(/^[\-\•]\s+(.*)/);
                    if (match) {
                        // Check if content has a header
                        const content = match[1];
                        const headerMatch = content.match(/^([^:]+):\s*(.*)/);

                        if (headerMatch) {
                            const header = headerMatch[1];
                            const body = headerMatch[2];
                            return `<div class="list-item bulleted">
                                <span class="list-bullet">•</span>
                                <span class="list-content">
                                    <span class="list-header">${this.formatInline(header)}:</span>
                                    <span class="list-body">${this.formatInline(body)}</span>
                                </span>
                            </div>`;
                        }

                        return `<div class="list-item bulleted"><span class="list-bullet">•</span><span class="list-content">${this.formatInline(content)}</span></div>`;
                    }
                    return `<div class="list-item">${line}</div>`;
                }).join('')}</div>`;
                return prefixHtml ? `${prefixHtml}\n\n${listHtml}` : listHtml;
            }

            // Regular paragraph (single-line callouts)
            if (nonEmptyLines.length === 1) {
                const sub = renderSubsectionHeader(nonEmptyLines[0]);
                if (sub) return sub;
                const callout = this.tryRenderCalloutParagraph(this.formatInline(nonEmptyLines[0]));
                if (callout) return callout;
            }

            // Standalone subsection headings (not part of a list paragraph)
            if (nonEmptyLines.length >= 1) {
                const sub = renderSubsectionHeader(nonEmptyLines.join(' '));
                if (sub) return sub;
            }

            return `<p class="content-paragraph">${this.formatInline(para)}</p>`;
        }).join('\n\n');
    }

    formatInline(text) {
        let out = String(text ?? '');

        // Bold key terms
        out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Highlight index codes (VNINDEX, VN30, VNREAL, ...) while avoiding HTML tag content.
        // Also avoid double-wrapping when already inside an idx-inline span.
        const parts = out.split(/(<[^>]+>)/g);
        let insideIdxInline = false;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;
            if (part.startsWith('<')) {
                if (/<span\b[^>]*class=['"][^'"]*\bidx-inline\b/i.test(part)) insideIdxInline = true;
                else if (insideIdxInline && /<\/span>/i.test(part)) insideIdxInline = false;
                continue;
            }
            if (!insideIdxInline) {
                parts[i] = part.replace(this.indexCodeRe, (m) => `<span class="idx-inline">${m}</span>`);
            }
        }
        out = parts.join('');

        // Emphasize key headings/labels (presentation only).
        // Keeps the prose readable while making structure obvious in UI.
        const labelAlternation = [
            'Dẫn\\s+chứng\\s*&\\s*Phân\\s+tích',
            'Dẫn\\s+chứng\\s+từ\\s+dữ\\s+liệu',
            'Điều\\s+kiện\\s+(?:khiến\\s+)?kết\\s+luận\\s+sai',
            'Kháng\\s+cự(?:\\s*\\(Bán\\s*\\/\\s*Chốt\\s+lời\\))?',
            'Hỗ\\s+trợ(?:\\s*\\(Mua\\s*\\/\\s*Tích\\s+lũy\\))?',
            'Độ\\s+tin\\s+cậy(?:\\s+mô\\s+hình)?',
            'Kịch\\s+bản\\s+giảm\\s*\\(Bearish\\s+Correction\\)',
            'TTM\\s+Squeeze',
            'Mô\\s+hình\\s+giá',
            'Mô\\s+hình\\s+nến',
            'Dẫn\\s+chứng',
            'Ý\\s+nghĩa',
            'Hành\\s+động',
        ].join('|');

        const canonicalizeLabel = (rawLabel) => {
            const s = String(rawLabel || '').replace(/\s+/g, ' ').trim();
            if (!s) return s;

            // Keep canonical casing for key labels (reduces "lowercase headings" feel).
            if (/^ttm squeeze$/i.test(s)) return 'TTM Squeeze';
            if (/^dẫn chứng\s*&\s*phân tích$/i.test(s)) return 'Dẫn chứng & Phân tích';
            if (/^dẫn chứng từ dữ liệu$/i.test(s)) return 'Dẫn chứng từ dữ liệu';
            if (/^dẫn chứng$/i.test(s)) return 'Dẫn chứng';
            if (/^ý nghĩa$/i.test(s)) return 'Ý nghĩa';
            if (/^hành động$/i.test(s)) return 'Hành động';
            if (/^độ tin cậy mô hình$/i.test(s)) return 'Độ tin cậy mô hình';
            if (/^độ tin cậy$/i.test(s)) return 'Độ tin cậy';
            if (/^mô hình giá$/i.test(s)) return 'Mô hình giá';
            if (/^mô hình nến$/i.test(s)) return 'Mô hình nến';
            if (/^kịch bản giảm\s*\(bearish correction\)$/i.test(s)) return 'Kịch bản giảm (Bearish Correction)';
            if (/^điều kiện(?: khiến)? kết luận sai$/i.test(s)) return 'Điều kiện kết luận sai';

            // Support/Resistance with optional action hints.
            if (/^kháng cự\s*\(.*\)$/i.test(s)) return 'Kháng cự (Bán/Chốt lời)';
            if (/^kháng cự$/i.test(s)) return 'Kháng cự';
            if (/^hỗ trợ\s*\(.*\)$/i.test(s)) return 'Hỗ trợ (Mua/Tích lũy)';
            if (/^hỗ trợ$/i.test(s)) return 'Hỗ trợ';

            // Fallback: uppercase the first letter.
            return s.charAt(0).toUpperCase() + s.slice(1);
        };

        const parts2 = out.split(/(<[^>]+>)/g);
        for (let i = 0; i < parts2.length; i++) {
            const part = parts2[i];
            if (!part || part.startsWith('<')) continue;
            const lines = String(part).split('\n');
            const processed = lines.map((line) => {
                let t = line;
                t = t.replace(
                    new RegExp(`^(\\s*)(${labelAlternation})(\\s*:)`, 'i'),
                    (_m, lead, label, colon) => `${lead}<strong class="label-inline">${canonicalizeLabel(label)}</strong>${colon}`
                );
                t = t.replace(
                    new RegExp(`^(\\s*)(${labelAlternation})\\s*$`, 'i'),
                    (_m, lead, label) => `${lead}<strong class="label-inline">${canonicalizeLabel(label)}</strong>`
                );
                return t;
            });
            let t = processed.join('\n');
            parts2[i] = t;
        }
        out = parts2.join('');

        // NOTE: Disabled keyword highlighting due to false positives
        // Vietnamese has many context-dependent words that don't work well
        // with simple pattern matching. Kept code for reference only.

        // Highlight keywords - DISABLED
        // text = text.replace(this.patterns.bullish, '<span class="text-success">$&</span>');
        // text = text.replace(this.patterns.bearish, '<span class="text-danger">$&</span>');
        // text = text.replace(this.patterns.warning, '<span class="text-warning">$&</span>');

        return out;
    }

    colorCode(text) {
        return text;
    }

    // Kept for backward compatibility; callouts are now handled in `formatLists()`.
    formatSections(text) { return text; }
}

// Export for browser + Node smoke tests
if (typeof window !== 'undefined') {
    window.ContentFormatter = ContentFormatter;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentFormatter;
}
