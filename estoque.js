// js/estoque.js
let estoque = [];
let _bloqueioEstoque = false;

function abrirModalEstoque() {
    const select = document.getElementById("est_select_existente");
    select.innerHTML =
        '<option value="">— Criar Novo Item —</option>' +
        estoque.map(i =>
            `<option value="${i.id}">#${i.id} - ${i.nome} (Atual: ${i.quantidade})</option>`
        ).join("");

    document.getElementById("est_nome").value = "";
    document.getElementById("est_nome").disabled = false;
    document.getElementById("est_qtd").value = "";
    document.getElementById("est_custo").value = "";
    openModal("modal-estoque");
}

function selecionarEstoqueExistente() {
    const id = document.getElementById("est_select_existente").value;
    const inputNome  = document.getElementById("est_nome");
    const inputCusto = document.getElementById("est_custo");

    if (id) {
        const item = estoque.find(e => e.id == id);
        inputNome.value    = item.nome;
        inputNome.disabled = true;
        inputCusto.value   = item.custo;
    } else {
        inputNome.value    = "";
        inputNome.disabled = false;
        inputCusto.value   = "";
    }
}

function salvarNoEstoque() {
    if (_bloqueioEstoque) return;

    const idExistente = document.getElementById("est_select_existente").value;
    const nome        = document.getElementById("est_nome").value.trim();
    const qtdAdd      = parseInt(document.getElementById("est_qtd").value);
    const custo       = parseFloat(document.getElementById("est_custo").value);

    if (!nome || isNaN(qtdAdd) || isNaN(custo) || qtdAdd <= 0 || custo < 0) {
        toast("Preencha todos os campos corretamente!", "error");
        return;
    }

    _bloqueioEstoque = true;
    const tx    = db.transaction("estoque", "readwrite");
    const store = tx.objectStore("estoque");

    if (idExistente) {
        store.get(parseInt(idExistente)).onsuccess = e => {
            let item = e.target.result;
            if (item) {
                item.quantidade += qtdAdd;
                item.custo = custo;
                store.put(item);
            }
        };
    } else {
        store.add({ nome, quantidade: qtdAdd, custo });
    }

    tx.oncomplete = () => {
        _bloqueioEstoque = false;
        carregarEstoque(() => {
            closeModal("modal-estoque");
            toast(`Estoque atualizado: +${qtdAdd} ${nome}`, "success");
        });
    };

    tx.onerror = () => {
        _bloqueioEstoque = false;
        toast("Erro ao salvar no estoque!", "error");
    };
}

function carregarEstoque(callback) {
    if (!db) return;
    const tx = db.transaction("estoque", "readonly");
    tx.objectStore("estoque").getAll().onsuccess = e => {
        estoque = e.target.result;
        renderEstoque();
        if (callback) callback();
    };
}

function removerQuantidadeEstoque(id) {
    const input = document.getElementById(`qtd_rem_${id}`);
    const qtdParaRemover = parseInt(input ? input.value : 1);

    if (isNaN(qtdParaRemover) || qtdParaRemover <= 0) {
        toast("Quantidade inválida!", "error");
        return;
    }

    const tx    = db.transaction("estoque", "readwrite");
    const store = tx.objectStore("estoque");

    store.get(id).onsuccess = e => {
        let item = e.target.result;
        if (item) {
            if (qtdParaRemover > item.quantidade) {
                toast("Quantidade a remover maior que o estoque!", "error");
                return;
            }
            item.quantidade = Math.max(0, item.quantidade - qtdParaRemover);
            store.put(item);
        }
    };

    tx.oncomplete = () => {
        carregarEstoque();
        toast("Quantidade removida do estoque.", "info");
    };
}

function deletarItemEstoque(id) {
    const item = estoque.find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Remover "${item.nome}" permanentemente do estoque?`)) return;

    const tx = db.transaction("estoque", "readwrite");
    tx.objectStore("estoque").delete(id);
    tx.oncomplete = () => {
        carregarEstoque();
        toast("Item removido do estoque.", "info");
    };
}

function openEstoqueRelatorio() {
    renderEstoque();
    openModal("modal-estoque-rel");
}

function renderEstoque() {
    // Atualiza relatório se o modal estiver aberto
    const corpo = document.getElementById("corpoRelatorioEstoque");
    if (!corpo) return;

    let valorTotal = 0;
    let baixoEstoque = 0;

    corpo.innerHTML = estoque.map(i => {
        valorTotal += i.quantidade * i.custo;
        let badge = "";
        if (i.quantidade === 0)       { badge = `<span class="badge badge-red">Zerado</span>`; baixoEstoque++; }
        else if (i.quantidade < 10)   { badge = `<span class="badge badge-red">Baixo</span>`;  baixoEstoque++; }
        else if (i.quantidade > 100)  badge = `<span class="badge badge-green">Alto</span>`;
        else                          badge = `<span class="badge badge-gold">Normal</span>`;

        return `
            <tr>
                <td><span style="color:var(--text3);font-family:var(--font-mono)">#${i.id}</span></td>
                <td><strong>${i.nome}</strong>${badge ? " " + badge : ""}</td>
                <td style="font-family:var(--font-mono)">${i.quantidade}</td>
                <td style="font-family:var(--font-mono);color:var(--gold)">R$ ${i.custo.toFixed(2)}</td>
                <td style="font-family:var(--font-mono)">R$ ${(i.quantidade * i.custo).toFixed(2)}</td>
                <td>
                    <div style="display:flex;gap:6px;align-items:center">
                        <input type="number" id="qtd_rem_${i.id}" value="1" min="1"
                            style="width:52px;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;font-family:var(--font-mono);font-size:12px;outline:none"
                        >
                        <button class="btn btn-ghost btn-sm" onclick="removerQuantidadeEstoque(${i.id})">−</button>
                        <button class="btn btn-danger btn-sm" onclick="deletarItemEstoque(${i.id})">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    corpo.innerHTML += `
        <tr class="total-row">
            <td colspan="4"><strong>VALOR TOTAL EM ESTOQUE</strong></td>
            <td colspan="2"><strong>R$ ${valorTotal.toFixed(2)}</strong></td>
        </tr>
    `;

    // Analytics
    const analytics = document.getElementById("estoque-rel-analytics");
    if (analytics) {
        analytics.innerHTML = `
            <div class="analytic-card">
                <span class="ac-label">Total Itens</span>
                <div class="ac-value">${estoque.length}</div>
                <div class="ac-sub">tipos cadastrados</div>
            </div>
            <div class="analytic-card">
                <span class="ac-label">Valor Total</span>
                <div class="ac-value" style="font-size:18px">R$ ${valorTotal.toFixed(2)}</div>
                <div class="ac-sub">em estoque</div>
            </div>
            <div class="analytic-card">
                <span class="ac-label">Alertas</span>
                <div class="ac-value" style="color:${baixoEstoque > 0 ? '#ff6b6b' : 'var(--green)'}">${baixoEstoque}</div>
                <div class="ac-sub">itens baixos/zerados</div>
            </div>
        `;
    }
}
