// Netlify Serverless Function for NYC 311 Service Requests
// Endpoint: GET /api/nyc-311
// Data source: https://data.cityofnewyork.us/resource/erm2-nwe9.json

const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';
const SERVICE_REQUESTS_DATASET_ID = 'erm2-nwe9';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching NYC 311 Service Requests data...');

        // Get recent 311 requests - last 7 days, aggregate by complaint type
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateFilter = sevenDaysAgo.toISOString().split('T')[0];

        // Query for aggregated complaint types
        const url = `${NYC_OPEN_DATA_BASE}/${SERVICE_REQUESTS_DATASET_ID}.json?$select=complaint_type,agency,count(*)&$where=created_date>'${dateFilter}'&$group=complaint_type,agency&$order=count DESC&$limit=50`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`NYC Open Data API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('311 data received:', data.length, 'records');

        // Also get recent individual requests for detail view
        const recentUrl = `${NYC_OPEN_DATA_BASE}/${SERVICE_REQUESTS_DATASET_ID}.json?$limit=20&$order=created_date DESC`;
        const recentResponse = await fetch(recentUrl, {
            headers: { 'Accept': 'application/json' }
        });

        let recentRequests = [];
        if (recentResponse.ok) {
            recentRequests = await recentResponse.json();
        }

        // Process and normalize the data
        const normalizedData = normalize311Data(data, recentRequests);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=1800, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error fetching 311 data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch 311 Service Requests',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: [],
                recentRequests: []
            })
        };
    }
}

function normalize311Data(aggregatedData, recentRequests) {
    const updatedAt = new Date().toISOString();

    // Process aggregated complaint types
    const byComplaintType = {};
    const byAgency = {};
    let totalComplaints = 0;

    aggregatedData.forEach(record => {
        const complaintType = record.complaint_type || 'Other';
        const agency = record.agency || 'Unknown';
        const count = parseInt(record.count || 0);

        totalComplaints += count;

        // Aggregate by complaint type
        if (!byComplaintType[complaintType]) {
            byComplaintType[complaintType] = 0;
        }
        byComplaintType[complaintType] += count;

        // Aggregate by agency
        if (!byAgency[agency]) {
            byAgency[agency] = { count: 0, types: [] };
        }
        byAgency[agency].count += count;
        byAgency[agency].types.push({ type: complaintType, count });
    });

    // Convert to sorted arrays
    const topComplaintTypes = Object.entries(byComplaintType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    const topAgencies = Object.entries(byAgency)
        .map(([agency, data]) => ({
            agency,
            count: data.count,
            topTypes: data.types.sort((a, b) => b.count - a.count).slice(0, 3)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // Process recent individual requests
    const recent = recentRequests.map(req => ({
        complaintType: req.complaint_type || 'Unknown',
        descriptor: req.descriptor || '',
        agency: req.agency || '',
        status: req.status || '',
        createdDate: formatDate(req.created_date),
        borough: req.borough || '',
        locationType: req.location_type || ''
    })).slice(0, 10);

    return {
        updatedAt,
        period: 'Last 7 days',
        totalComplaints,
        topComplaintTypes,
        topAgencies,
        recentRequests: recent,
        source: 'nyc-open-data',
        dataset: '311-service-requests'
    };
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}
