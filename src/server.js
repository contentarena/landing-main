const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg'); // Import PostgreSQL client

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (e.g., CSS, images)
app.use(express.static('src'));

// Middleware to protect the /subscriptions route
const protectSubscriptions = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Subscriptions"');
        return res.status(401).send('Authentication required.');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Replace 'admin' and 'password123' with your desired username and password
    if (username === 'admin' && password === 'lukas321') {
        return next();
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Subscriptions"');
    return res.status(401).send('Invalid credentials.');
};

// Route to render the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/welcome', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Protect the /subscriptions route
app.get('/subscriptions', protectSubscriptions, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'subscriptions.html'));
});

// Endpoint to fetch all subscriptions
app.get('/api/subscriptions', async (req, res) => {
    const query = `SELECT email FROM subscriptions`; // Assuming you have a 'created_at' column
    try {
        const result = await pool.query(query);
        res.json(result.rows); // Send the rows as JSON response
    } catch (err) {
        console.error('Error fetching subscriptions:', err.message);
        res.status(500).send('Internal Server Error');
    }
});

// Route to handle subscription form submission
app.post('/subscribe', async (req, res) => {
    const email = req.body.email;

    // Insert the email into the database
    const query = `INSERT INTO subscriptions (email) VALUES ($1)`;
    try {
        await pool.query(query, [email]);
        res.redirect('/?success=true');
    } catch (err) {
        if (err.code === '23505') { // PostgreSQL unique constraint violation
            res.send(`
                <h1>Subscription Failed</h1>
                <p>The email <strong>${email}</strong> is already subscribed.</p>
                <a href="/">Go Back</a>
            `);
        } else {
            console.error('Error inserting email:', err.message);
            res.status(500).send('Internal Server Error');
        }
    }
});

// Handle 404 errors (unmatched routes)
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});