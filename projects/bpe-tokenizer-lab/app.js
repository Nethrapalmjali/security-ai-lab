import { train, encode, decode, label, stats } from "./bpe.js";

const $ = id => document.getElementById(id);
const EX = [
  "Security researchers study how attackers move through networks. Attackers scan networks, attackers escalate privileges, and defenders monitor networks for attackers. Monitoring and detection help defenders respond quickly. ".repeat(3),
  "Failed password for root from 10.0.0.5 port 22\nFailed password for admin from 10.0.0.5 port 22\nAccepted password for alice from 10.0.0.9 port 22\nFailed password for root from 10.0.0.7 port 22\n",
  "function add(a, b) {\n  return a + b;\n}\nfunction sub(a, b) {\n  return a - b;\n}\nfunction mul(a, b) {\n  return a * b;\n}\n"
];
const SAMPLE = ["Defenders monitor attackers on networks.", "Failed password for root from 10.0.0.5", "function div(a, b) { return a / b; }"];
let model = null, timer = null, last = "";

function color(id) { return `hsl(${(id * 47) % 360} 70% 70%)`; }

function render() {
  if (!model) return;
  const k = +$("k").value, text = $("inp").value;
  $("kv").textContent = k + " / " + model.merges.length;
  const ids = encode(text, model, k);
  const box = $("tokens"); box.textContent = "";
  for (const id of ids) {
    const s = document.createElement("span");
    s.className = "tok"; s.textContent = label(id, model); s.style.background = color(id);
    s.title = "id " + id; box.appendChild(s);
  }
  const st = stats(text, ids);
  $("stats").textContent = "";
  for (const [n, v] of [["Bytes", st.bytes], ["Tokens", st.tokens], ["Bytes/token", st.bytesPerToken.toFixed(2)]]) {
    const sp = document.createElement("span"); sp.append(n + ": ");
    const b = document.createElement("b"); b.textContent = v; sp.appendChild(b); $("stats").appendChild(sp);
  }
  $("ids").textContent = "[" + ids.join(", ") + "]";
  const ok = decode(ids, model) === text;
  $("rt").textContent = ok ? "✓ Lossless: decoding the IDs reproduces the input exactly." : "✗ Round-trip mismatch";
  $("rt").className = ok ? "sub ok" : "sub";
  [...$("mt").tBodies[0].rows].forEach((r, i) => { r.className = i < k ? "on" : "off"; });
}

function buildTable() {
  const tb = $("mt").tBodies[0]; tb.textContent = "";
  model.merges.forEach((m, i) => {
    const tr = tb.insertRow();
    tr.insertCell().textContent = i + 1;
    const t = tr.insertCell(); t.className = "t"; t.textContent = label(m.id, model);
    tr.insertCell().textContent = label(m.a, model) + " + " + label(m.b, model);
    tr.insertCell().textContent = m.count;
  });
}

function doTrain() {
  const n = Math.max(0, Math.min(2000, parseInt($("nm").value, 10) || 0));
  const text = $("corpus").value;
  if (!text.trim()) { $("status").textContent = "Enter some training text first."; return; }
  model = train(text, n);
  $("status").textContent = `Learned ${model.merges.length} merges → vocabulary of ${model.vocab.length} tokens (256 bytes + merges).` +
    (model.merges.length < n ? " Training stopped early: no adjacent pair occurs twice." : "");
  $("lab").hidden = false;
  $("k").max = model.merges.length; $("k").value = model.merges.length;
  buildTable(); render();
}

$("train").onclick = doTrain;
$("k").oninput = () => { stop(); render(); };
$("inp").oninput = render;
document.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => {
  const i = +b.dataset.ex; $("corpus").value = EX[i]; $("inp").value = SAMPLE[i]; doTrain();
});
function stop() { clearInterval(timer); timer = null; $("play").textContent = "▶ Play"; }
$("play").onclick = () => {
  if (timer) return stop();
  if (!model) return;
  $("k").value = 0; render(); $("play").textContent = "⏸ Pause";
  timer = setInterval(() => {
    if (+$("k").value >= model.merges.length) return stop();
    $("k").value = +$("k").value + 1; render();
  }, 250);
};
$("corpus").value = EX[0]; $("inp").value = SAMPLE[0]; doTrain();
