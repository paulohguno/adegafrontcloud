const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "adega",
    password: "123",
    port: 5432
});

app.get("/clientes", async (req, res) => {
    const result = await pool.query("SELECT * FROM clientes");
    res.json(result.rows);
});

app.listen(3000, () => {
    console.log("API rodando em http://localhost:3000");
});