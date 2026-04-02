// js/produto.js
let produtosVenda = [];

// ==============================
// CRIAÇÃO DE PRODUTO
// ==============================
function abrirModalProduto() {
    if (!estoque || estoque.length === 0) {
        toast("Adicione itens no estoque primeiro!", "error");
        return;
    }
    document.getElementById("prod_nome").value  = "";
    document.getElementById("prod_preco").value = "";
    itensSelecionadosParaProduto = [];
    renderComposicaoTags();
    atualizarSelectEstoqueProd();
    openModal("modal-produto");
}

function atualizarSelectEstoqueProd() {
    const sel = document.getElementById("est_select_prod");
    if (!sel) return;
    sel.innerHTML =
        '<option value="">Selecione para adicionar...</option>' +
        estoque.map(i =>
            `<option value="${i.id}">#${i.id} - ${i.nome} (Disp: ${i.quantidade} | R$${i.custo.toFixed(2)})</option>`
        ).join("");
}

function adicionarItemAoProduto(idStr) {
    if (!idStr) return;
    const id   = parseInt(idStr);
    const item = itensSelecionadosParaProduto.find(i => i.id === id);
    if (item) { item.qtdConsumo++; }
    else {
        const est = estoque.find(e => e.id === id);
        if (est) itensSelecionadosParaProduto.push({ id, nome: est.nome, qtdConsumo: 1 });
    }
    renderComposicaoTags();
    atualizarPrevCusto();
}

function renderComposicaoTags() {
    const container = document.getElementById("composicao-tags");
    if (!container) return;

    if (itensSelecionadosParaProduto.length === 0) {
        container.innerHTML = `<span style="color:var(--text3);font-size:12px;font-family:var(--font-mono)">Nenhum item adicionado</span>`;
        return;
    }

    container.innerHTML = itensSelecionadosParaProduto.map((item, index) => `
        <span class="comp-tag">
            #${item.id} ${item.nome}
            <input type="number" min="1" class="qty-inp" value="${item.qtdConsumo}"
                onchange="itensSelecionadosParaProduto[${index}].qtdConsumo = Math.max(1, parseInt(this.value)||1); atualizarPrevCusto();">
            <button class="remove-comp" onclick="itensSelecionadosParaProduto.splice(${index},1); renderComposicaoTags(); atualizarPrevCusto();">✕</button>
        </span>
    `).join("");
}

function atualizarPrevCusto() {
    const preco = parseFloat(document.getElementById("prod_preco").value) || 0;
    let custo = 0;
    itensSelecionadosParaProduto.forEach(item => {
        const est = estoque.find(e => e.id === item.id);
        if (est) custo += est.custo * item.qtdConsumo;
    });
    const preview = document.getElementById("custo-preview");
    if (itensSelecionadosParaProduto.length > 0) {
        preview.style.display = "block";
        document.getElementById("prev-custo").textContent   = `R$ ${custo.toFixed(2)}`;
        const margem = preco - custo;
        const prevMargem = document.getElementById("prev-margem");
        prevMargem.textContent = `R$ ${margem.toFixed(2)}`;
        prevMargem.style.color = margem >= 0 ? "var(--green)" : "#ff6b6b";
    } else {
        preview.style.display = "none";
    }
}

function salvarProdutoFinal() {
    const nome  = document.getElementById("prod_nome").value.trim();
    const preco = parseFloat(document.getElementById("prod_preco").value);

    if (!nome) { toast("Preencha o nome do produto!", "error"); return; }
    if (isNaN(preco) || preco < 0) { toast("Preço inválido!", "error"); return; }
    if (itensSelecionadosParaProduto.length === 0) { toast("Adicione ao menos um item da composição!", "error"); return; }

    const tx = db.transaction("produtos", "readwrite");
    tx.objectStore("produtos").add({
        nome,
        preco,
        composicao: itensSelecionadosParaProduto.map(i => ({...i}))
    });

    tx.oncomplete = () => {
        closeModal("modal-produto");
        carregarProdutos();
        toast(`Produto "${nome}" criado com sucesso!`, "success");
    };
    tx.onerror = () => toast("Erro ao salvar produto!", "error");
}

function carregarProdutos() {
    if (!db) return;
    const tx = db.transaction("produtos", "readonly");
    tx.objectStore("produtos").getAll().onsuccess = e => {
        produtosVenda = e.target.result;
        renderProdutosVenda();
    };
}

function deletarProduto(id) {
    const prod = produtosVenda.find(p => p.id === id);
    if (!prod) return;
    if (!confirm(`Remover "${prod.nome}" do catálogo?`)) return;

    const tx = db.transaction("produtos", "readwrite");
    tx.objectStore("produtos").delete(id);
    tx.oncomplete = () => {
        carregarProdutos();
        toast("Produto removido.", "info");
    };
}

// ==============================
// FINALIZAÇÃO DE PENDÊNCIAS
// ==============================
function finalizarPendenciaIndividual(index) {
    processarFinalizacao(clientePendenciaAtual, [index]);
}

function finalizarPendenciasSelecionadas() {
    const checks = document.querySelectorAll(".check-item-pendencia:checked");
    if (checks.length === 0) {
        toast("Selecione ao menos um item!", "error");
        return;
    }
    const indices = Array.from(checks).map(c => parseInt(c.value));
    processarFinalizacao(clientePendenciaAtual, indices);
}

function processarFinalizacao(clienteId, indicesArray) {
    const cliente          = clientes.find(c => c.id == clienteId);
    const itensParaFinalizar = indicesArray.map(idx => pendencias[clienteId][idx]);

    // 1. Verificar estoque global
    let necessidadeEstoque = {};
    itensParaFinalizar.forEach(item => {
        (item.composicao || []).forEach(comp => {
            if (!necessidadeEstoque[comp.id]) necessidadeEstoque[comp.id] = 0;
            necessidadeEstoque[comp.id] += comp.qtdConsumo;
        });
    });

    for (let estId in necessidadeEstoque) {
        const itemEst = estoque.find(e => e.id == estId);
        const need    = necessidadeEstoque[estId];
        const have    = itemEst ? itemEst.quantidade : 0;
        if (!itemEst || have < need) {
            toast(`Estoque insuficiente: item #${estId} precisa ${need}, tem ${have}`, "error");
            return;
        }
    }

    // 2. Gravar no banco
    const tx         = db.transaction(["estoque", "vendas"], "readwrite");
    const storeEst   = tx.objectStore("estoque");
    const storeVendas = tx.objectStore("vendas");

    let totalVendas = 0;
    itensParaFinalizar.forEach(venda => {
        totalVendas += venda.preco;
        storeVendas.add({
            produto:      venda.nome,
            valor:        venda.preco,
            custoProducao: venda.custoCalculado || 0,
            cliente:      cliente ? cliente.nome : "Balcão",
            clienteId:    clienteId,
            data:         new Date().toLocaleString("pt-BR")
        });
    });

    for (let estId in necessidadeEstoque) {
        storeEst.get(parseInt(estId)).onsuccess = e => {
            let est = e.target.result;
            if (est) {
                est.quantidade -= necessidadeEstoque[estId];
                storeEst.put(est);
            }
        };
    }

    tx.oncomplete = () => {
        // 3. Remover do array (maior índice primeiro)
        indicesArray.sort((a, b) => b - a).forEach(idx => {
            pendencias[clienteId].splice(idx, 1);
        });

        renderListaClientesPendentes();
        carregarEstoque();

        if (pendencias[clienteId].length === 0) {
            closeModal("modal-pendencia-cliente");
        } else {
            renderTabelaPendenciasCliente();
            document.getElementById("checkTodasPendencias").checked = false;
        }

        toast(`Venda finalizada! R$ ${totalVendas.toFixed(2)}`, "success");
    };

    tx.onerror = () => toast("Erro ao finalizar venda!", "error");
}
