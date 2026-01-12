// Netlify Serverless Function for NYC Expense Budget
// Endpoint: GET /api/nyc-budget
// Data source: https://data.cityofnewyork.us/resource/mwzb-yiwb.json

const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';
const BUDGET_DATASET_ID = 'mwzb-yiwb';

export async function handler(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Fetching NYC Expense Budget data...');

        // Fetch budget data - get recent fiscal year, group by agency
        const url = `${NYC_OPEN_DATA_BASE}/${BUDGET_DATASET_ID}.json?$limit=500&$order=fiscal_year DESC`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`NYC Open Data API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Budget data received:', data.length, 'records');

        // Process and normalize the data
        const normalizedData = normalizeBudgetData(data);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate'
            },
            body: JSON.stringify(normalizedData)
        };

    } catch (error) {
        console.error('Error fetching budget data:', error);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch Expense Budget',
                message: error.message,
                updatedAt: new Date().toISOString(),
                items: []
            })
        };
    }
}

function normalizeBudgetData(data) {
    const updatedAt = new Date().toISOString();

    // Group by agency and calculate totals
    const agencyBudgets = {};
    let latestFiscalYear = '';

    data.forEach(record => {
        const agency = record.agency_name || record.agency || 'Unknown';
        const fiscalYear = record.fiscal_year || record.publication_date || '';
        // Handle different field naming conventions from NYC Open Data
        const adopted = parseFloat(record.adopted_budget_amount || record.adopted_budget || record.adopted || 0);
        const modified = parseFloat(record.current_modified_budget_amount || record.current_modified_budget || record.modified || 0);
        const budgetCode = record.budget_code_name || record.unit_appropriation_name || record.budget_code || '';

        if (!latestFiscalYear || fiscalYear > latestFiscalYear) {
            latestFiscalYear = fiscalYear;
        }

        if (!agencyBudgets[agency]) {
            agencyBudgets[agency] = {
                agency,
                fiscalYear,
                adoptedTotal: 0,
                modifiedTotal: 0,
                categories: []
            };
        }

        agencyBudgets[agency].adoptedTotal += adopted;
        agencyBudgets[agency].modifiedTotal += modified;

        if (budgetCode && (adopted > 0 || modified > 0)) {
            agencyBudgets[agency].categories.push({
                name: budgetCode,
                adopted,
                modified
            });
        }
    });

    // Convert to array, sort by budget size, and format
    const items = Object.values(agencyBudgets)
        .map(agency => ({
            agency: agency.agency,
            fiscalYear: agency.fiscalYear,
            adoptedBudget: formatCurrency(agency.adoptedTotal),
            modifiedBudget: formatCurrency(agency.modifiedTotal),
            adoptedRaw: agency.adoptedTotal,
            modifiedRaw: agency.modifiedTotal,
            change: calculateChange(agency.adoptedTotal, agency.modifiedTotal),
            topCategories: agency.categories
                .sort((a, b) => b.adopted - a.adopted)
                .slice(0, 3)
                .map(c => ({
                    name: c.name,
                    adopted: formatCurrency(c.adopted)
                }))
        }))
        .filter(agency => agency.adoptedRaw > 0)
        .sort((a, b) => b.adoptedRaw - a.adoptedRaw)
        .slice(0, 20);

    // Calculate totals
    const totalAdopted = items.reduce((sum, item) => sum + item.adoptedRaw, 0);
    const totalModified = items.reduce((sum, item) => sum + item.modifiedRaw, 0);

    return {
        updatedAt,
        fiscalYear: latestFiscalYear,
        totalAdopted: formatCurrency(totalAdopted),
        totalModified: formatCurrency(totalModified),
        items,
        source: 'nyc-open-data',
        dataset: 'expense-budget',
        count: items.length
    };
}

function formatCurrency(amount) {
    if (amount >= 1e9) {
        return '$' + (amount / 1e9).toFixed(2) + 'B';
    } else if (amount >= 1e6) {
        return '$' + (amount / 1e6).toFixed(1) + 'M';
    } else if (amount >= 1e3) {
        return '$' + (amount / 1e3).toFixed(0) + 'K';
    }
    return '$' + amount.toFixed(0);
}

function calculateChange(adopted, modified) {
    if (!adopted || adopted === 0) return '0%';
    const change = ((modified - adopted) / adopted) * 100;
    const sign = change >= 0 ? '+' : '';
    return sign + change.toFixed(1) + '%';
}
