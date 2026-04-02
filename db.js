// js/db.js
let db;

const request = indexedDB.open("adegaDB", 3);

request.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("estoque"))
        db.createObjectStore("estoque", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("produtos"))
        db.createObjectStore("produtos", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("vendas"))
        db.createObjectStore("vendas", { keyPath: "id", autoIncrement: true });
    if (!db.objectStoreNames.contains("clientes"))
        db.createObjectStore("clientes", { keyPath: "id", autoIncrement: true });
};

request.onsuccess = e => {
    db = e.target.result;
    carregarDados();
};

request.onerror = e => {
    console.error("IndexedDB erro:", e);
    toast("Erro ao abrir banco de dados!", "error");
};
