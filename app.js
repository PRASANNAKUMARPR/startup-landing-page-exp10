
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const PORT = 2000;
const client = new MongoClient(process.env.MONGO_URI);

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}

const server = http.createServer(async (req, res) => {

    // Display registration page
    if (req.method === "GET" && req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "text/html"
        });

        fs.createReadStream(
            path.join(__dirname, "home.html")
        ).pipe(res);

        return;
    }

    // Load CSS file
    if (req.method === "GET" && req.url === "/style.css") {
        res.writeHead(200, {
            "Content-Type": "text/css"
        });

        fs.createReadStream(
            path.join(__dirname, "style.css")
        ).pipe(res);

        return;
    }

    // Handle registration form submission
    if (req.method === "POST" && req.url === "/register") {

        let rawData = "";

        req.on("data", chunk => {
            rawData += chunk;

            if (rawData.length > 10000) {
                req.destroy();
            }
        });

        req.on("end", async () => {
            try {
                const formData = new URLSearchParams(rawData);

                const name = formData.get("name");
                const password = formData.get("password");
                const age = Number(formData.get("age"));
                const mobile = formData.get("mobile");
                const email = formData.get("email");
                const gender = formData.get("gender");
                const state = formData.get("state");
                const skills = formData.getAll("skills");

                if (!name || !password || !Number.isInteger(age) ||
                    age < 1 || !/^[0-9]{10}$/.test(mobile || "") ||
                    !email || !gender || !state) {
                    res.writeHead(400, {
                        "Content-Type": "text/plain"
                    });
                    res.end("Invalid registration details.");
                    return;
                }

                // Hash password before storing it
                const salt = crypto.randomBytes(16).toString("hex");
                const passwordHash = crypto.scryptSync(
                    password, salt, 64
                ).toString("hex");

                const registration = {
                    name,
                    passwordHash,
                    salt,
                    age,
                    mobile,
                    email,
                    gender,
                    state,
                    skills,
                    createdAt: new Date()
                };

                // Save registration in MongoDB
                const result = await client
                    .db("startupDB")
                    .collection("registrations")
                    .insertOne(registration);

                res.writeHead(200, {
                    "Content-Type": "text/html"
                });

                res.end(`
                    <html>
                    <head>
                        <title>Registration Successful</title>
                        <link rel="stylesheet" href="/style.css">
                    </head>
                    <body>
                        <section class="form-container">
                            <h2>Registration Successful!</h2>
                            <p>Name: ${escapeHTML(name)}</p>
                            <p>Age: ${age}</p>
                            <p>Mobile: ${escapeHTML(mobile)}</p>
                            <p>Email: ${escapeHTML(email)}</p>
                            <p>Gender: ${escapeHTML(gender)}</p>
                            <p>State: ${escapeHTML(state)}</p>
                            <p>Skills: ${escapeHTML(skills.join(", "))}</p>
                            <p>Your details have been saved in MongoDB.</p>
                            <a href="/">Register Another User</a>
                        </section>
                    </body>
                    </html>
                `);

                console.log("Saved registration:", result.insertedId);

            } catch (error) {
                console.error(error);

                res.writeHead(500, {
                    "Content-Type": "text/plain"
                });

                res.end("Registration failed. Please try again.");
            }
        });

        return;
    }

    res.writeHead(404);
    res.end("Page Not Found");
});

// Connect to MongoDB and start server
async function startServer() {
    try {
        await client.connect();

        console.log("MongoDB connected successfully!");

        server.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("MongoDB connection failed:", error);
    }
}

startServer();
