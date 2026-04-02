const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "adega_db",
    password: "123",
    port: 5432
});

// TESTE
app.get("/", (req, res) => {
    res.send("API rodando 🚀");
});

// LISTAR CLIENTES
app.get("/clientes", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clientes");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro no servidor");
    }
});

// INSERIR CLIENTE
app.post("/clientes", async (req, res) => {
    const { nome, cpf } = req.body;

    try {
        await pool.query(
            "INSERT INTO clientes (nome, cpf) VALUES ($1, $2)",
            [nome, cpf]
        );
        res.send("Cliente criado!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Erro ao inserir");
    }
});

app.listen(3000, () => {
    console.log("Servidor rodando em http://localhost:3000");
}); 