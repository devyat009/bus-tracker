// Simple Search Service (non-module)
(function (global) {
    function parseCSV(csvText) {
        const rows = csvText.split(/\r?\n/).filter(Boolean);
        if (rows.length <= 1) return [];
        const dataRows = rows.slice(1);
        return dataRows.map(row => {
            const cols = row.split(',');
            return {
                id_linha: cols[1],
                cd_linha: cols[3],
                nm_operadora: cols[4],
                raw: cols
            };
        });
    }

    function search(lines, query) {
        if (!query) return lines;
        const q = query.toLowerCase();
        return lines.filter(l =>
            (l.cd_linha || '').toLowerCase().includes(q) ||
            (l.nm_operadora || '').toLowerCase().includes(q)
        );
    }

    global.SearchService = { parseCSV, search };
})(window);