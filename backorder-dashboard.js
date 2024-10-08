
document.getElementById('fileInput').addEventListener('change', handleFile);

let backorderData = [];
let filteredData = [];

function handleFile(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

        processData(jsonData);
    };
    reader.readAsArrayBuffer(file);
}

function processData(data) {
    // Extract headers
    const headers = data[0];

    // Filter out necessary columns
    const schoolIndex = headers.indexOf('ufSchool');
    const moduleIndex = headers.indexOf('ufModule');
    const skuIndex = headers.indexOf('SKU');
    const itemNameIndex = headers.indexOf('ItemName');
    const quantityIndex = headers.indexOf('Quantity');
    const reasonIndex = headers.indexOf('ufReason');
    const orderDateIndex = headers.indexOf('OrderDate');
    const packingStatusIndex = headers.indexOf('PackingStatus');

    // Filter rows and collect data
    backorderData = data.slice(1).filter(row => row[skuIndex] && row[itemNameIndex] && row[quantityIndex]).map(row => ({
        school: row[schoolIndex] || 'KS WAREHOUSE',
        module: row[moduleIndex] || 'Unknown Module',
        sku: row[skuIndex],
        itemName: row[itemNameIndex],
        quantity: row[quantityIndex],
        reason: row[reasonIndex],
        orderDate: row[orderDateIndex],
        packingStatus: row[packingStatusIndex],
        trackingNumber: '0123456789'
    }));

    // Set filteredData to the initial data (all orders)
    filteredData = [...backorderData];

    // Exclude KS WAREHOUSE from total order count
    const totalNonWarehouseOrders = backorderData.filter(order => order.school !== 'KS WAREHOUSE').length;
    document.getElementById('totalOrders').textContent = totalNonWarehouseOrders;

    // Save data to Airtable via Vercel API
    //saveToAirtable(backorderData);

    // Display all data initially
    displayCollapsibleData(filteredData);
}

function saveToAirtable(data) {
    const batchSize = 10; // Airtable's limit of 10 records per request
    const batches = [];

    // Helper function to format date to YYYY-MM-DD
    const formatDate = (date) => {
        const d = new Date(date);
        const month = '' + (d.getMonth() + 1);
        const day = '' + d.getDate();
        const year = d.getFullYear();

        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    };

    // Split data into batches of 10 records each
    for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize).map(item => ({
            fields: {
                "School": item.school,
                "Module": item.module,
                "SKU": String(item.sku), // Ensure SKU is sent as a string
                "Item Name": item.itemName,
                "Quantity": String(item.quantity), // Ensure Quantity is sent as a string
                "Reason": item.reason,
                "Order Date": formatDate(item.orderDate), // Format date as YYYY-MM-DD
                "Packing Status": item.packingStatus,
                "Tracking": Number(item.tracking) // Ensure Tracking is sent as a string
            }
        }));
        batches.push(batch);
    }

    // Send each batch sequentially to Airtable
    const sendBatch = (batch) => {
        return fetch('/api/airtable', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records: batch }),
        })
        .then((response) => response.json())
        .then((data) => {
            if (data.error) {
                console.error('Airtable Error:', data.error);
            } else {
                console.log('Batch added:', data);
            }
        })
        .catch((error) => console.error('Error adding batch:', error));
    };

    // Send all batches sequentially using Promises
    batches.reduce((promise, batch) => {
        return promise.then(() => sendBatch(batch));
    }, Promise.resolve())
    .then(() => {
        console.log('All batches sent successfully');
    })
    .catch((error) => {
        console.error('Error sending batches:', error);
    });
}



function fetchFromAirtable() {
    fetch('/api/airtable')
    .then((response) => response.json())
    .then((data) => {
        if (data && data.records && data.records.length > 0) {
            const airtableData = data.records.map((record) => ({
                school: record.fields['School'],
                module: record.fields['Module'],
                sku: record.fields['SKU'],
                itemName: record.fields['Item Name'],
                quantity: record.fields['Quantity'],
                reason: record.fields['Reason'],
                orderDate: record.fields['Order Date'],
                packingStatus: record.fields['Packing Status'],
            }));
            displayCollapsibleData(airtableData);
        } else {
            console.log('No records found in Airtable');
            displayCollapsibleData([]);  
        }
    })
    .catch((error) => console.error('Error fetching data:', error));
}



document.addEventListener('DOMContentLoaded', () => {
    fetchFromAirtable();
});

function filterByStatus(status) {
    if (status === 'All') {
        filteredData = [...backorderData];
    } else {
        filteredData = backorderData.filter(order => order.packingStatus === status);
    }
    displayCollapsibleData(filteredData);
}

function displayCollapsibleData(data) {
    const collapsibleList = document.getElementById('collapsibleList');
    collapsibleList.innerHTML = '';

    // Group data by school and then by module
    let schools = {};
    data.forEach(order => {
        if (!schools[order.school]) {
            schools[order.school] = {};
        }
        if (!schools[order.school][order.module]) {
            schools[order.school][order.module] = [];
        }
        schools[order.school][order.module].push(order);
    });

    // Sort school names alphabetically
    const sortedSchools = Object.keys(schools).sort();

    // Create collapsible elements in alphabetical order
    sortedSchools.forEach(school => {
        const schoolItemCount = Object.values(schools[school]).flat().length;

        // Create school button
        const schoolButton = document.createElement('button');
        schoolButton.classList.add('collapsible');
        schoolButton.textContent = `${school} (${schoolItemCount} line items)`;
        collapsibleList.appendChild(schoolButton);

        // Create school content
        const schoolContent = document.createElement('div');
        schoolContent.classList.add('content');
        collapsibleList.appendChild(schoolContent);

        // Add modules inside the school content
        for (let module in schools[school]) {
            const moduleButton = document.createElement('button');
            moduleButton.classList.add('collapsible');
            moduleButton.textContent = `Module: ${module}`;
            schoolContent.appendChild(moduleButton);

            // Create module content with item table
            const moduleContent = document.createElement('div');
            moduleContent.classList.add('content');
            schoolContent.appendChild(moduleContent);

            const table = document.createElement('table');
            moduleContent.appendChild(table);

            // Table headers
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Item Name</th>
                        <th>Quantity</th>
                        <th>Reason</th>
                        <th>Order Date</th>
                        <th>Packing Status</th>
                        <th>Tracking</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;

            const tableBody = table.querySelector('tbody');

            // Add items to the table
            schools[school][module].forEach(item => {
                const tr = document.createElement('tr');

                // Create a table row with the packing status conditionally colored
                let packingStatusCell = `<td>${item.packingStatus}</td>`;
                if (item.packingStatus === 'Pending') {
                    packingStatusCell = `<td style="background-color: red;">${item.packingStatus}</td>`;
                } else if (item.packingStatus === 'Partially Packing Complete') {
                    packingStatusCell = `<td style="background-color: yellow;">${item.packingStatus}</td>`;
                } else {
                    packingStatusCell = `<td style="background-color: green;">${item.packingStatus}</td>`;
                }

                tr.innerHTML = `
                    <td>${item.sku}</td>
                    <td>${item.itemName}</td>
                    <td>${item.quantity}</td>
                    <td>${item.reason}</td>
                    <td>${item.orderDate}</td>
                    ${packingStatusCell}
                    <td><a href="https://www.ups.com/track?tracknum=${item.trackingNumber}" target="_blank">${item.trackingNumber}</a></td>
                `;
                tableBody.appendChild(tr);
            });
        }
    });

    // Add collapsible functionality
    const coll = document.getElementsByClassName('collapsible');
    for (let i = 0; i < coll.length; i++) {
        coll[i].addEventListener('click', function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
            }
        });
    }
}

// Filter buttons event listeners
document.getElementById('filterAll').addEventListener('click', () => filterByStatus('All'));
document.getElementById('filterPending').addEventListener('click', () => filterByStatus('Pending'));
document.getElementById('filterPartiallyPackingComplete').addEventListener('click', () => filterByStatus('Partially Packing Complete'));
document.getElementById('filterCompleted').addEventListener('click', () => filterByStatus('Completed'));
