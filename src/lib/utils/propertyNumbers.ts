export function compressPropertyNumbers(raw: string | null | undefined): string {
    if (!raw) return '';

    // split by common separators
    const parts = raw
        .split(/\s*[\/,\n]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (parts.length === 0) return '';

    // parse entries into {prefix, num, width, original}
    const parsed = parts.map((p) => {
        const m = p.match(/^(.*?)-(\d+)$/);
        if (m) {
            return { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length, original: p };
        }
        return { prefix: p, num: null as number | null, width: 0, original: p };
    });

    // group by prefix when numeric
    const groups: Record<string, Array<{ num: number | null; width: number; original: string }>> = {};
    const nonNumeric: string[] = [];
    for (const p of parsed) {
        if (p.num === null) {
            nonNumeric.push(p.original);
            continue;
        }
        const key = p.prefix;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ num: p.num, width: p.width, original: p.original });
    }

    const resultParts: string[] = [];

    for (const [prefix, items] of Object.entries(groups)) {
        items.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
        let start = items[0].num as number;
        let end = start;
        let width = items[0].width;

        const flushRange = () => {
            if (start === end) {
                resultParts.push(`${prefix}-${String(start).padStart(width, '0')}`);
            } else {
                // show prefix once, and only display ending sequence for the second value
                resultParts.push(`${prefix}-${String(start).padStart(width, '0')}/${String(end).padStart(width, '0')}`);
            }
        };

        for (let i = 1; i < items.length; i++) {
            const current = items[i].num as number;
            if (current === end + 1) {
                end = current;
                width = Math.max(width, items[i].width);
            } else {
                flushRange();
                start = current;
                end = current;
                width = items[i].width;
            }
        }
        flushRange();
    }

    // append non-numeric originals at end
    if (nonNumeric.length > 0) {
        resultParts.push(...nonNumeric);
    }

    return resultParts.join(' / ');
}
