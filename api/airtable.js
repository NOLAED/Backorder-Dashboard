export default async function handler(req, res) {
    const airtableApiKey = 'patbTxyjZU7JPEKnF.a1e73fc5e35e43725eca664a269942d3dcbb789d2aa6d05635d46e05adb18bc2'; // Your Airtable API key
    const airtableBaseId = 'app0PbYAWyZl9oiw8'; // Your Airtable Base ID
    const tableId = 'tblfBrBk9zx7aAIYQ'; // Your correct table ID

    if (req.method === 'POST') {
        const { records } = req.body;

        console.log("Saving records:", records);

        try {
            const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${tableId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${airtableApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Airtable POST Error Response:', errorText);
                throw new Error(`Airtable POST failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Airtable POST Success:', data);
            res.status(200).json(data);
        } catch (error) {
            console.error('Airtable POST Error:', error);
            res.status(500).json({ error: `Failed to save records to Airtable: ${error.message}` });
        }
    } else if (req.method === 'GET') {
        console.log('Fetching records from Airtable...');

        try {
            const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${tableId}`, {
                headers: {
                    Authorization: `Bearer ${airtableApiKey}`,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Airtable GET Error Response:', errorText);
                throw new Error(`Airtable GET failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Airtable GET Success:', data);
            res.status(200).json(data);
        } catch (error) {
            console.error('Airtable GET Error:', error);
            res.status(500).json({ error: `Failed to fetch records from Airtable: ${error.message}` });
        }
    } else {
        res.status(405).json({ error: 'Method Not Allowed' });
    }
}
