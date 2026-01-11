// Netlify Serverless Function for NYC City Council Legislation
// Endpoint: GET /api/nyc-legislation
// Data source: https://data.cityofnewyork.us/resource/6ctv-n46c.json

const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';
const LEGISLATION_DATASET_ID = '6ctv-n46c';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching NYC City Council Legislation data...');

        // Fetch recent legislation - order by date
        const url = `${NYC_OPEN_DATA_BASE}/${LEGISLATION_DATASET_ID}.json?$limit=50&$order=intro_date DESC`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`NYC Open Data API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Legislation data received:', data.length, 'records');

        // Process and normalize the data
        const normalizedData = normalizeLegislationData(data);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error fetching legislation data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch City Council Legislation',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: []
            })
        };
    }
}

function normalizeLegislationData(data) {
    const updatedAt = new Date().toISOString();

    const items = data.map(record => {
        // Extract relevant fields (field names may vary)
        const introNumber = record.int_no || record.intro_number || record.file_number || '';
        const name = record.name || record.title || record.local_law || '';
        const status = record.status || record.current_status || '';
        const introDate = record.intro_date || record.introduced_date || '';
        const sponsor = record.sponsor || record.prime_sponsor || '';
        const committee = record.committee || '';
        const localLaw = record.local_law || record.local_law_number || '';
        const enactmentDate = record.enactment_date || '';

        return {
            introNumber,
            name: truncate(name, 150),
            status,
            introDate: formatDate(introDate),
            sponsor,
            committee,
            localLaw,
            enactmentDate: formatDate(enactmentDate),
            isLocalLaw: !!localLaw
        };
    }).filter(item => item.name);

    // Separate into local laws and pending bills
    const localLaws = items.filter(item => item.isLocalLaw).slice(0, 10);
    const pendingBills = items.filter(item => !item.isLocalLaw).slice(0, 15);

    return {
        updatedAt,
        localLaws,
        pendingBills,
        source: 'nyc-open-data',
        dataset: 'city-council-legislation',
        count: items.length
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
