// This file manages the user interface for the search functionality, including input handling and displaying search results.

// UI logic for searching bus lines
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const input = document.getElementById('busLineSearch');
        const button = document.getElementById('searchButton');
        const resultsEl = document.getElementById('searchResults');

        let cachedLines = [];

        function ensureDataLoaded() {
            if (cachedLines.length) return Promise.resolve(cachedLines);
            return fetch('src/data/horarios-das-linhas.csv')
                .then(r => r.text())
                .then(t => {
                    cachedLines = window.SearchService ? SearchService.parseCSV(t) : [];
                    return cachedLines;
                })
                .catch(err => {
                    console.error('Erro ao carregar CSV:', err);
                    return [];
                });
        }

        function renderResults(items) {
            resultsEl.innerHTML = '';
            if (!items.length) {
                resultsEl.textContent = 'Nenhum resultado.';
                return;
            }
            const frag = document.createDocumentFragment();
            items.slice(0, 50).forEach(item => {
                const div = document.createElement('div');
                div.className = 'result-item';
                div.textContent = `${item.cd_linha || '---'} - ${item.nm_operadora || ''}`;
                frag.appendChild(div);
            });
            resultsEl.appendChild(frag);
        }

        function doSearch() {
            ensureDataLoaded().then(lines => {
                const q = (input.value || '').trim();
                const results = window.SearchService ? SearchService.search(lines, q) : [];
                renderResults(results);
            });
        }

        if (button) button.addEventListener('click', doSearch);
        if (input) input.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
    });
})();