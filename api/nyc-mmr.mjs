// Netlify Serverless Function for NYC Mayor's Management Report
// Endpoint: GET /api/nyc-mmr
// Data source: https://data.cityofnewyork.us/resource/2jrp-puwz.json

const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';
const MMR_DATASET_ID = '2jrp-puwz';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching NYC Mayor Management Report data...');

        // Fetch latest MMR data - limit to recent fiscal years
        const url = `${NYC_OPEN_DATA_BASE}/${MMR_DATASET_ID}.json?$limit=100&$order=fiscal_year DESC`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`NYC Open Data API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('MMR data received:', data.length, 'records');

        // Process and normalize the data
        const normalizedData = normalizeMMRData(data);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error fetching MMR data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch Mayor Management Report',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: []
            })
        };
    }
}

function normalizeMMRData(data) {
    const updatedAt = new Date().toISOString();

    // Group by agency and get key metrics
    const agencyMetrics = {};

    data.forEach(record => {
        const agency = record.agency_name || record.agency || 'Unknown Agency';
        const indicator = record.indicator_name || record.indicator || '';
        const fiscalYear = record.fiscal_year || '';
        const actual = record.actual || record.value || '';
        const target = record.target || '';

        if (!agencyMetrics[agency]) {
            agencyMetrics[agency] = {
                agency,
                metrics: [],
                fiscalYear
            };
        }

        if (indicator && actual) {
            agencyMetrics[agency].metrics.push({
                indicator,
                actual,
                target,
                fiscalYear
            });
        }
    });

    // Convert to array and limit metrics per agency
    const items = Object.values(agencyMetrics)
        .map(agency => ({
            agency: agency.agency,
            fiscalYear: agency.fiscalYear,
            metrics: agency.metrics.slice(0, 5), // Top 5 metrics per agency
            metricCount: agency.metrics.length
        }))
        .filter(agency => agency.metrics.length > 0)
        .slice(0, 15); // Top 15 agencies

    return {
        updatedAt,
        items,
        source: 'nyc-open-data',
        dataset: 'mayors-management-report',
        count: items.length,
        totalRecords: data.length
    };
}
