// js/ui.js
// ==============================
// VARIÁVEIS GLOBAIS DE UI
// ==============================
let itensSelecionadosParaProduto = [];
let vendaAtual  = null;
let clientes    = [];
let pendencias  = {};
let clientePendenciaAtual = null;

// ==============================
// MODAL HELPERS
// ==============================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add("active"); }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove("active"); }
}

// Fechar ao clicar fora
document.addEventListener("click", e => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("active");
    }
});

// Fechar com ESC
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
    }
});

// ==============================
// TOAST
// ==============================
function toast(msg, type = "info") {
    const container = document.getElementById("toast-container");
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transition = "opacity 0.3s";
        setTimeout(() => el.remove(), 300);
    }, 2800);
}

// ==============================
// CLIENTES
// ==============================
function carregarClientes() {
    if (!db) return;
    const tx = db.transaction("clientes", "readonly");
    tx.objectStore("clientes").getAll().onsuccess = e => {
        clientes = e.target.result;
        renderClientesSelect();
        renderListaClientesPendentes();
    };
}

function renderClientesSelect() {
    const select = document.getElementById("select_cliente_venda");
    if (!select) return;
    const valAtual = select.value;
    select.innerHTML =
        '<option value="">Selecione o cliente...</option>' +
        clientes.map(c =>
            `<option value="${c.id}">${c.nome}${c.telefone ? " · " + c.telefone : ""}</option>`
        ).join("");
    if (valAtual && clientes.find(c => c.id == valAtual)) select.value = valAtual;
}

function abrirModalCliente() {
    document.getElementById("cli_nome").value     = "";
    document.getElementById("cli_telefone").value = "";
    openModal("modal-cliente");
}

function salvarCliente() {
    const nome     = document.getElementById("cli_nome").value.trim();
    const telefone = document.getElementById("cli_telefone").value.trim();
    if (!nome) { toast("Informe o nome do cliente!", "error"); return; }

    const tx = db.transaction("clientes", "readwrite");
    tx.objectStore("clientes").add({ nome, telefone });
    tx.oncomplete = () => {
        closeModal("modal-cliente");
        carregarClientes();
        toast(`Cliente "${nome}" cadastrado!`, "success");
    };
}

function openClientesList() {
    const corpo = document.getElementById("corpoClientesList");
    if (!corpo) return;
    if (clientes.length === 0) {
        corpo.innerHTML = `<tr><td colspan="4" style="color:var(--text3);text-align:center;padding:20px">Nenhum cliente cadastrado.</td></tr>`;
    } else {
        corpo.innerHTML = clientes.map(c => `
            <tr>
                <td style="font-family:var(--font-mono);color:var(--text3)">#${c.id}</td>
                <td><strong>${c.nome}</strong></td>
                <td style="font-family:var(--font-mono)">${c.telefone || "—"}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deletarCliente(${c.id})">🗑</button>
                </td>
            </tr>
        `).join("");
    }
    openModal("modal-clientes-list");
}

function deletarCliente(id) {
    const c = clientes.find(cl => cl.id === id);
    if (!c) return;
    if (!confirm(`Remover cliente "${c.nome}"?`)) return;
    const tx = db.transaction("clientes", "readwrite");
    tx.objectStore("clientes").delete(id);
    tx.oncomplete = () => {
        delete pendencias[id];
        carregarClientes();
        toast("Cliente removido.", "info");
    };
}

// ==============================
// PENDÊNCIAS
// ==============================
function adicionarAPendencia() {
    if (!vendaAtual) return;
    const clienteId = document.getElementById("select_cliente_venda").value;
    if (!clienteId) { toast("Selecione um cliente!", "error"); return; }

    if (!pendencias[clienteId]) pendencias[clienteId] = [];
    pendencias[clienteId].push(JSON.parse(JSON.stringify(vendaAtual)));

    renderListaClientesPendentes();
    closeModal("modal-venda-prod");
    toast("Adicionado à pendência!", "success");
}

function renderListaClientesPendentes() {
    const lista = document.getElementById("listaClientesPendentes");
    if (!lista) return;

    let temPendencia = false;
    let totalGeral   = 0;
    let countGeral   = 0;

    lista.innerHTML = "";

    for (let clienteId in pendencias) {
        if (pendencias[clienteId] && pendencias[clienteId].length > 0) {
            temPendencia = true;
            const cliente = clientes.find(c => c.id == clienteId);
            const total   = pendencias[clienteId].reduce((acc, item) => acc + parseFloat(item.preco), 0);
            totalGeral   += total;
            countGeral   += pendencias[clienteId].length;

            lista.innerHTML += `
                <div class="client-pendencia-card" onclick="abrirModalPendenciaCliente(${clienteId})">
                    <div class="client-nome">${cliente ? cliente.nome : "Cliente #" + clienteId}</div>
                    <div class="client-info">
                        <span>${pendencias[clienteId].length} item(s)</span>
                        <span class="client-total">R$ ${total.toFixed(2)}</span>
                    </div>
                </div>
            `;
        }
    }

    if (!temPendencia) {
        lista.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <p>Nenhuma pendência<br>aberta</p>
            </div>
        `;
    }

    // Stats footer
    const statPend  = document.getElementById("stat-pendentes");
    const statTotal = document.getElementById("stat-total-pend");
    if (statPend)  statPend.textContent  = countGeral;
    if (statTotal) statTotal.textContent = "R$" + totalGeral.toFixed(0);
}

function abrirModalPendenciaCliente(clienteId) {
    clientePendenciaAtual = clienteId;
    const cliente = clientes.find(c => c.id == clienteId);
    document.getElementById("tituloModalPendenciaCliente").textContent =
        `Pendências — ${cliente ? cliente.nome : "Cliente"}`;
    document.getElementById("checkTodasPendencias").checked = false;
    renderTabelaPendenciasCliente();
    openModal("modal-pendencia-cliente");
}

function renderTabelaPendenciasCliente() {
    const corpo = document.getElementById("corpoTabelaPendenciasCliente");
    const itens = pendencias[clientePendenciaAtual] || [];

    corpo.innerHTML = itens.map((item, index) => `
        <tr>
            <td>
                <input type="checkbox" class="chk check-item-pendencia" value="${index}"
                    onchange="calcularTotalSelecionadoPendencia()">
            </td>
            <td>
                <strong>${item.nome}</strong><br>
                <small style="color:var(--text3);font-family:var(--font-mono);font-size:10px">
                    ${(item.composicao || []).map(c => `${c.nome} ×${c.qtdConsumo}`).join(", ")}
                </small>
            </td>
            <td>
                <input type="number" step="0.01" min="0"
                    value="${parseFloat(item.preco).toFixed(2)}"
                    style="width:90px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);
                           color:var(--gold2);border-radius:6px;font-family:var(--font-mono);font-size:13px;outline:none"
                    onchange="atualizarValorPendencia(${index}, this.value)">
            </td>
            <td style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">
                R$ ${(item.custoCalculado || 0).toFixed(2)}
            </td>
            <td>
                <button class="btn btn-success btn-sm" onclick="finalizarPendenciaIndividual(${index})">
                    ✓ Pagar
                </button>
            </td>
        </tr>
    `).join("");

    calcularTotalSelecionadoPendencia();
}

function atualizarValorPendencia(index, novoValor) {
    const valor = parseFloat(novoValor);
    if (!isNaN(valor) && valor >= 0) {
        pendencias[clientePendenciaAtual][index].preco = valor;
        calcularTotalSelecionadoPendencia();
        renderListaClientesPendentes();
    }
}

function toggleTodasPendencias(checkbox) {
    document.querySelectorAll(".check-item-pendencia").forEach(c => c.checked = checkbox.checked);
    calcularTotalSelecionadoPendencia();
}

function calcularTotalSelecionadoPendencia() {
    const checks = document.querySelectorAll(".check-item-pendencia:checked");
    let total = 0;
    checks.forEach(c => {
        const idx = parseInt(c.value);
        if (pendencias[clientePendenciaAtual] && pendencias[clientePendenciaAtual][idx]) {
            total += pendencias[clientePendenciaAtual][idx].preco;
        }
    });
    const span = document.getElementById("spanTotalSelecionadoPendencia");
    if (span) span.textContent = total.toFixed(2);
}

// ==============================
// RENDER PRODUTOS (GRID)
// ==============================
function renderProdutosVenda() {
    const lista = document.getElementById("listaProdutos");
    if (!lista) return;

    const sub = document.getElementById("produtos-sub");
    if (sub) sub.textContent = `${produtosVenda.length} produto(s) cadastrado(s)`;

    if (produtosVenda.length === 0) {
        lista.innerHTML = `
            <div class="empty-cart" style="grid-column:1/-1;height:200px">
                <div class="empty-cart-icon">🍷</div>
                <p>Nenhum produto criado.<br>Use "Novo Produto" para começar.</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = produtosVenda.map(p => {
        const custo = calcularCustoProduto(p);
        const estMin = calcularEstoqueMinimo(p);

        return `
            <div class="product-card" onclick="abrirVenda(${p.id})">
                <button class="product-delete" onclick="event.stopPropagation(); deletarProduto(${p.id})">✕</button>
                <div class="product-name">${p.nome}</div>
                <div class="product-price">R$ ${p.preco.toFixed(2)}</div>
                <div class="product-cost">custo: R$ ${custo.toFixed(2)}</div>
                <div class="product-stock-badge ${estMin > 0 ? "stock-ok" : "stock-low"}">
                    ${estMin > 0 ? `${estMin}× disponível` : "sem estoque"}
                </div>
            </div>
        `;
    }).join("");
}

function calcularCustoProduto(p) {
    let custo = 0;
    (p.composicao || []).forEach(comp => {
        const est = estoque.find(e => e.id === comp.id);
        if (est) custo += est.custo * comp.qtdConsumo;
    });
    return custo;
}

function calcularEstoqueMinimo(p) {
    if (!p.composicao || p.composicao.length === 0) return 0;
    let min = Infinity;
    p.composicao.forEach(comp => {
        const est = estoque.find(e => e.id === comp.id);
        if (est) min = Math.min(min, Math.floor(est.quantidade / comp.qtdConsumo));
        else min = 0;
    });
    return min === Infinity ? 0 : min;
}

function filtrarProdutos(query) {
    const q = query.toLowerCase().trim();
    const lista = document.getElementById("listaProdutos");
    if (!lista) return;

    const filtrado = q
        ? produtosVenda.filter(p => p.nome.toLowerCase().includes(q))
        : produtosVenda;

    if (filtrado.length === 0) {
        lista.innerHTML = `
            <div class="empty-cart" style="grid-column:1/-1;height:150px">
                <div class="empty-cart-icon">🔍</div>
                <p>Nenhum produto encontrado.</p>
            </div>
        `;
        return;
    }

    lista.innerHTML = filtrado.map(p => {
        const custo  = calcularCustoProduto(p);
        const estMin = calcularEstoqueMinimo(p);
        return `
            <div class="product-card" onclick="abrirVenda(${p.id})">
                <button class="product-delete" onclick="event.stopPropagation(); deletarProduto(${p.id})">✕</button>
                <div class="product-name">${p.nome}</div>
                <div class="product-price">R$ ${p.preco.toFixed(2)}</div>
                <div class="product-cost">custo: R$ ${custo.toFixed(2)}</div>
                <div class="product-stock-badge ${estMin > 0 ? "stock-ok" : "stock-low"}">
                    ${estMin > 0 ? `${estMin}× disponível` : "sem estoque"}
                </div>
            </div>
        `;
    }).join("");
}

// ==============================
// ABRIR VENDA
// ==============================
function abrirVenda(id) {
    const p = produtosVenda.find(p => p.id === id);
    if (!p) return;
    vendaAtual = JSON.parse(JSON.stringify(p));
    document.getElementById("venda-prod-title").textContent = p.nome;

    // Populate extra item select
    const sel = document.querySelector("#modal-venda-prod select[onchange*='adicionarItemAoComboVenda']");
    if (sel) {
        sel.innerHTML =
            '<option value="">Selecione para adicionar...</option>' +
            estoque.map(e =>
                `<option value="${e.id}">#${e.id} - ${e.nome} (Disp: ${e.quantidade} | R$${e.custo.toFixed(2)})</option>`
            ).join("");
    }

    renderClientesSelect();
    renderItensVendaAtuais();
    openModal("modal-venda-prod");
}

function renderItensVendaAtuais() {
    if (!vendaAtual) return;

    // Calcular custo
    let custoTotal = 0;
    vendaAtual.composicao.forEach(comp => {
        const est = estoque.find(e => e.id === comp.id);
        if (est) custoTotal += est.custo * comp.qtdConsumo;
    });

    const lucro  = vendaAtual.preco - custoTotal;
    const margem = vendaAtual.preco > 0 ? ((lucro / vendaAtual.preco) * 100).toFixed(1) : 0;
    vendaAtual.custoCalculado = custoTotal;

    // Info bar
    const infoBar = document.getElementById("venda-info-bar");
    if (infoBar) {
        infoBar.innerHTML = `
            <div>
                <span class="vi-label">Preço Base</span>
                <span class="vi-val">R$ ${vendaAtual.preco.toFixed(2)}</span>
            </div>
            <div>
                <span class="vi-label">Custo</span>
                <span class="vi-val cost">R$ ${custoTotal.toFixed(2)}</span>
            </div>
            <div>
                <span class="vi-label">Lucro ${margem}%</span>
                <span class="vi-val ${lucro >= 0 ? "profit" : ""}" style="${lucro < 0 ? "color:#ff6b6b" : ""}">
                    R$ ${lucro.toFixed(2)}
                </span>
            </div>
        `;
    }

    // Itens da composição
    const corpo = document.getElementById("corpoItensVenda");
    if (corpo) {
        corpo.innerHTML = vendaAtual.composicao.map((item, index) => {
            const est = estoque.find(e => e.id === item.id);
            return `
                <span class="comp-tag">
                    #${item.id} ${item.nome}
                    <input type="number" min="1" class="qty-inp" value="${item.qtdConsumo}"
                        onchange="vendaAtual.composicao[${index}].qtdConsumo = Math.max(1, parseInt(this.value)||1); renderItensVendaAtuais();">
                    ${est ? `<span style="color:var(--text3);font-size:10px">(${est.quantidade})</span>` : ""}
                    <button class="remove-comp" onclick="vendaAtual.composicao.splice(${index},1); renderItensVendaAtuais();">✕</button>
                </span>
            `;
        }).join("");
    }
}

function adicionarItemAoComboVenda(idStr) {
    if (!idStr || !vendaAtual) return;
    const id      = parseInt(idStr);
    const itemEst = estoque.find(e => e.id === id);
    if (!itemEst) return;

    const existing = vendaAtual.composicao.find(c => c.id === id);
    if (existing) existing.qtdConsumo++;
    else vendaAtual.composicao.push({ id: itemEst.id, nome: itemEst.nome, qtdConsumo: 1 });

    renderItensVendaAtuais();
}

// ==============================
// VENDAS MODAL
// ==============================
function openVendas() {
    renderVendas();
    openModal("modal-vendas");
}

function renderVendas() {
    const corpo = document.getElementById("corpoVendas");
    if (!corpo || !db) return;

    const tx = db.transaction("vendas", "readonly");
    tx.objectStore("vendas").getAll().onsuccess = e => {
        const vendas = e.target.result;

        let totalBruto   = 0;
        let totalCustos  = 0;
        let totalLiquido = 0;

        corpo.innerHTML = vendas.map(v => {
            totalBruto   += v.valor || 0;
            totalCustos  += v.custoProducao || 0;
            const lucro   = (v.valor || 0) - (v.custoProducao || 0);
            totalLiquido += lucro;
            return `
                <tr>
                    <td><strong>${v.produto}</strong></td>
                    <td>${v.cliente || "Balcão"}</td>
                    <td style="font-family:var(--font-mono);color:var(--gold2)">R$ ${(v.valor || 0).toFixed(2)}</td>
                    <td style="font-family:var(--font-mono);color:var(--text3)">R$ ${(v.custoProducao || 0).toFixed(2)}</td>
                    <td style="font-family:var(--font-mono);color:${lucro >= 0 ? "var(--green)" : "#ff6b6b"}">
                        R$ ${lucro.toFixed(2)}
                    </td>
                    <td style="font-size:11px;color:var(--text3)">${v.data}</td>
                </tr>
            `;
        }).reverse().join("");

        corpo.innerHTML += `
            <tr class="total-row">
                <td colspan="2"><strong>TOTAIS</strong></td>
                <td>R$ ${totalBruto.toFixed(2)}</td>
                <td>R$ ${totalCustos.toFixed(2)}</td>
                <td>R$ ${totalLiquido.toFixed(2)}</td>
                <td>${vendas.length} vendas</td>
            </tr>
        `;

        // Analytics
        const analytics = document.getElementById("vendas-analytics");
        if (analytics) {
            analytics.innerHTML = `
                <div class="analytic-card">
                    <span class="ac-label">Total Bruto</span>
                    <div class="ac-value" style="font-size:18px">R$ ${totalBruto.toFixed(2)}</div>
                    <div class="ac-sub">${vendas.length} vendas</div>
                </div>
                <div class="analytic-card">
                    <span class="ac-label">Custos</span>
                    <div class="ac-value" style="font-size:18px;color:var(--text2)">R$ ${totalCustos.toFixed(2)}</div>
                    <div class="ac-sub">produção total</div>
                </div>
                <div class="analytic-card">
                    <span class="ac-label">Lucro Líquido</span>
                    <div class="ac-value" style="font-size:18px;color:${totalLiquido >= 0 ? "var(--green)" : "#ff6b6b"}">
                        R$ ${totalLiquido.toFixed(2)}
                    </div>
                    <div class="ac-sub">${totalBruto > 0 ? ((totalLiquido / totalBruto) * 100).toFixed(1) : 0}% margem</div>
                </div>
            `;
        }
    };
}

// ==============================
// DASHBOARD
// ==============================
function openDashboard() {
    const body = document.getElementById("dashboard-body");
    if (!db || !body) return;

    const tx = db.transaction("vendas", "readonly");
    tx.objectStore("vendas").getAll().onsuccess = e => {
        const vendas = e.target.result;

        let totalBruto   = 0;
        let totalLiquido = 0;
        const porProduto = {};
        const porCliente = {};

        vendas.forEach(v => {
            totalBruto   += v.valor || 0;
            totalLiquido += (v.valor || 0) - (v.custoProducao || 0);
            porProduto[v.produto] = (porProduto[v.produto] || 0) + (v.valor || 0);
            if (v.cliente) porCliente[v.cliente] = (porCliente[v.cliente] || 0) + (v.valor || 0);
        });

        const topProdutos = Object.entries(porProduto).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topClientes = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const totalEstoque = estoque.reduce((acc, i) => acc + i.quantidade * i.custo, 0);
        const pendTotal    = Object.values(pendencias).flat().reduce((acc, i) => acc + i.preco, 0);

        body.innerHTML = `
            <div class="analytics-grid" style="grid-template-columns:repeat(4,1fr)">
                <div class="analytic-card">
                    <span class="ac-label">Receita Total</span>
                    <div class="ac-value" style="font-size:18px">R$ ${totalBruto.toFixed(2)}</div>
                    <div class="ac-sub">${vendas.length} vendas</div>
                </div>
                <div class="analytic-card">
                    <span class="ac-label">Lucro Líquido</span>
                    <div class="ac-value" style="font-size:18px;color:var(--green)">R$ ${totalLiquido.toFixed(2)}</div>
                    <div class="ac-sub">após custos</div>
                </div>
                <div class="analytic-card">
                    <span class="ac-label">Estoque</span>
                    <div class="ac-value" style="font-size:18px">R$ ${totalEstoque.toFixed(2)}</div>
                    <div class="ac-sub">${estoque.length} itens</div>
                </div>
                <div class="analytic-card">
                    <span class="ac-label">Pendências</span>
                    <div class="ac-value" style="font-size:18px;color:var(--gold2)">R$ ${pendTotal.toFixed(2)}</div>
                    <div class="ac-sub">a receber</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
                <div>
                    <div class="section-label" style="font-family:var(--font-mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">
                        Top Produtos
                    </div>
                    ${topProdutos.length === 0
                        ? `<p style="color:var(--text3);font-size:12px">Sem dados</p>`
                        : topProdutos.map(([nome, val], i) => `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                                <span style="font-size:13px">${i + 1}. ${nome}</span>
                                <span style="font-family:var(--font-mono);color:var(--gold2);font-size:12px">R$ ${val.toFixed(2)}</span>
                            </div>
                        `).join("")
                    }
                </div>
                <div>
                    <div class="section-label" style="font-family:var(--font-mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">
                        Top Clientes
                    </div>
                    ${topClientes.length === 0
                        ? `<p style="color:var(--text3);font-size:12px">Sem dados</p>`
                        : topClientes.map(([nome, val], i) => `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                                <span style="font-size:13px">${i + 1}. ${nome}</span>
                                <span style="font-family:var(--font-mono);color:var(--gold2);font-size:12px">R$ ${val.toFixed(2)}</span>
                            </div>
                        `).join("")
                    }
                </div>
            </div>

            <div style="margin-top:16px;padding:14px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius)">
                <div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">
                    Clientes com Pendências em Aberto
                </div>
                ${Object.entries(pendencias).filter(([,v]) => v.length > 0).length === 0
                    ? `<p style="color:var(--text3);font-size:12px">Nenhuma pendência aberta.</p>`
                    : Object.entries(pendencias).filter(([,v]) => v.length > 0).map(([cId, items]) => {
                        const c   = clientes.find(cl => cl.id == cId);
                        const tot = items.reduce((a, i) => a + i.preco, 0);
                        return `
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                                <span style="font-size:13px">${c ? c.nome : "Cliente"} — ${items.length} item(s)</span>
                                <span style="font-family:var(--font-mono);color:var(--gold2)">R$ ${tot.toFixed(2)}</span>
                            </div>
                        `;
                    }).join("")
                }
            </div>
        `;

        openModal("modal-dashboard");
    };
}
