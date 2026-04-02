// js/calc.js
let calcExpr = "";
let calcJustEvaled = false;

function toggleCalc() {
    const el = document.getElementById("calc-float");
    el.style.display = el.style.display === "block" ? "none" : "block";
}

function calcNum(v) {
    if (calcJustEvaled && !isNaN(v)) {
        calcExpr = "";
        calcJustEvaled = false;
    }
    if (v === "." && calcExpr.split(/[\+\-\*\/]/).pop().includes(".")) return;
    calcExpr += v;
    updateCalcDisplay();
}

function calcOp(op) {
    calcJustEvaled = false;
    if (op === "backspace") {
        calcExpr = calcExpr.slice(0, -1);
        updateCalcDisplay();
        return;
    }
    if (calcExpr === "" && op === "-") { calcExpr = "-"; updateCalcDisplay(); return; }
    if (calcExpr === "") return;
    const lastChar = calcExpr.slice(-1);
    if (["+", "-", "*", "/", "%"].includes(lastChar)) {
        calcExpr = calcExpr.slice(0, -1);
    }
    calcExpr += op;
    updateCalcDisplay();
}

function calcEquals() {
    if (!calcExpr) return;
    try {
        const result = Function('"use strict"; return (' + calcExpr + ')')();
        document.getElementById("calc-expr").textContent = calcExpr + " =";
        calcExpr = String(parseFloat(result.toFixed(10)));
        document.getElementById("calc-result").textContent = formatCalcNum(calcExpr);
        calcJustEvaled = true;
    } catch {
        document.getElementById("calc-result").textContent = "Erro";
        calcExpr = "";
        calcJustEvaled = false;
    }
}

function calcClear() {
    calcExpr = "";
    calcJustEvaled = false;
    document.getElementById("calc-expr").textContent = "0";
    document.getElementById("calc-result").textContent = "0";
}

function updateCalcDisplay() {
    document.getElementById("calc-expr").textContent = calcExpr || "0";
    try {
        if (calcExpr && !calcExpr.endsWith("op")) {
            const preview = Function('"use strict"; return (' + calcExpr + ')')();
            if (isFinite(preview))
                document.getElementById("calc-result").textContent = formatCalcNum(preview);
        }
    } catch { /* keep last */ }
}

function formatCalcNum(n) {
    const num = parseFloat(n);
    if (isNaN(num)) return "0";
    if (num % 1 === 0) return num.toLocaleString("pt-BR");
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

// Keyboard support for calc
document.addEventListener("keydown", e => {
    const calcEl = document.getElementById("calc-float");
    if (calcEl.style.display !== "block") return;
    if (e.key >= "0" && e.key <= "9") { e.preventDefault(); calcNum(e.key); }
    else if (e.key === ".") { e.preventDefault(); calcNum("."); }
    else if (["+", "-", "*", "/", "%"].includes(e.key)) { e.preventDefault(); calcOp(e.key); }
    else if (e.key === "Enter" || e.key === "=") { e.preventDefault(); calcEquals(); }
    else if (e.key === "Backspace") { e.preventDefault(); calcOp("backspace"); }
    else if (e.key === "Escape") { e.preventDefault(); calcClear(); }
});
