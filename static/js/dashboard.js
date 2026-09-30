const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];
const SEVERITY_COLORS = {
    low: '#f4c430',
    medium: '#f77f00',
    high: '#d62828',
    critical: '#6a040f'
};

let severityChart, regionChart, timeChart;

function buildSeverityChart(bySeverity) {
    const labels = SEVERITY_ORDER;
    const data = labels.map((s) => bySeverity[s] || 0);
    const colors = labels.map((s) => SEVERITY_COLORS[s]);

    if (severityChart) {
        severityChart.data.datasets[0].data = data;
        severityChart.update();
        return;
    }

    const ctx = document.getElementById('severityChart');
    severityChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels.map((s) => s[0].toUpperCase() + s.slice(1)),
            datasets: [{ data, backgroundColor: colors, borderColor: 'white', borderWidth: 2 }]
        },
        options: {
            plugins: { legend: { position: 'bottom' } },
            animation: { animateScale: true, animateRotate: true }
        }
    });
}

function buildRegionChart(byRegion) {
    const entries = Object.entries(byRegion).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([name]) => name);
    const data = entries.map(([, count]) => count);

    if (regionChart) {
        regionChart.data.labels = labels;
        regionChart.data.datasets[0].data = data;
        regionChart.update();
        return;
    }

    const ctx = document.getElementById('regionChart');
    regionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data, backgroundColor: '#2d6a4f', borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function buildTimeChart(byMonth) {
    const labels = Object.keys(byMonth).sort();
    const data = labels.map((m) => byMonth[m]);

    if (timeChart) {
        timeChart.data.labels = labels;
        timeChart.data.datasets[0].data = data;
        timeChart.update();
        return;
    }

    const ctx = document.getElementById('timeChart');
    timeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: '#2d6a4f',
                backgroundColor: 'rgba(45, 106, 79, 0.15)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2d6a4f'
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        const total = Object.values(data.by_severity).reduce((sum, n) => sum + n, 0);
        document.getElementById('totalCount').textContent = total;

        buildSeverityChart(data.by_severity);
        buildRegionChart(data.by_region);
        buildTimeChart(data.by_month);
    } catch (err) {
        document.getElementById('totalCount').textContent = '!';
    }
}

loadStats();
setInterval(loadStats, 30000);