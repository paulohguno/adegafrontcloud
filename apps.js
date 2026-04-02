// js/apps.js
function carregarDados() {
    carregarClientes();
    carregarEstoque();
    carregarProdutos();
}

// Atualizar preview custo ao digitar preço no modal produto
document.addEventListener("input", e => {
    if (e.target && e.target.id === "prod_preco") {
        atualizarPrevCusto();
    }
});
