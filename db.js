const API = "http://localhost:3000";

// LISTAR CLIENTES
export async function listarClientes() {
    const res = await fetch(`${API}/clientes`);
    return await res.json();
}

// SALVAR CLIENTE
export async function salvarCliente(cliente) {
    await fetch(`${API}/clientes`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(cliente)
    });
}