// Simple Search Service (non-module)
(function (global) {
    function parseCSV(csvText) {
        const rows = csvText.split(/\r?\n/).filter(Boolean);
        if (rows.length <= 1) return [];
        const header = rows[0].split(',');
        const dataRows = rows.slice(1);
        return dataRows.map(row => {
            const cols = row.split(',');
            return {
                // Adjust indices according to your CSV structure
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

    global.SearchService = {
        parseCSV,
        search
    };
})(window);

// Example usage
// Fetch the CSV data and initialize the SearchService
fetch('/src/data/horarios-das-linhas.csv')
    .then(response => response.text())
    .then(csvText => {
        const lines = this.parseCSV(csvText);
        const searchService = new SearchService(lines);
        // You can now use searchService to search for bus lines
    });