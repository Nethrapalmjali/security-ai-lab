import { summarize } from "./textrank.js";
const $ = (id) => document.getElementById(id);
const EX = [
"Solar power converts sunlight into electricity using solar panels. Solar panels are made of photovoltaic cells that convert sunlight directly into electricity. The cost of solar panels has fallen sharply over the last decade. My neighbour has a very friendly cat. Falling costs make solar power competitive with fossil fuels in many regions. Photovoltaic cells in solar panels generate electricity without emitting carbon. Governments also offer subsidies that encourage households to install solar panels.",
"Phishing is a social engineering attack that tricks people into revealing credentials. Attackers send emails that imitate trusted brands and urge victims to click a link. The link leads to a fake login page that harvests credentials. Spear phishing targets specific individuals using personal details gathered from social media. Multi-factor authentication limits the damage when credentials are stolen by phishing. Security awareness training teaches employees to inspect sender addresses and links before clicking. Hardware security keys can stop credentials from being replayed on fake login pages.",
];
function run() {
  const text = $("txt").value;
  const n = Math.max(1, Math.min(20, parseInt($("n").value, 10) || 3));
  const r = summarize(text, n);
  $("sum").hidden = $("all").hidden = !r.sentences.length;
  $("sumtxt").textContent = r.picked.map((i) => r.sentences[i]).join(" ");
  const list = $("list"); list.textContent = "";
  const max = Math.max(...r.scores, 1e-9);
  const rank = new Map(r.scores.map((s, i) => [i, s]).sort((a, b) => b[1] - a[1]).map(([i], k) => [i, k + 1]));
  r.sentences.forEach((s, i) => {
    const row = document.createElement("div"); row.className = "sent" + (r.picked.includes(i) ? " pick" : "");
    const rk = document.createElement("span"); rk.className = "rank"; rk.textContent = "#" + rank.get(i);
    const bar = document.createElement("span"); bar.className = "bar"; bar.title = r.scores[i].toFixed(4);
    const f = document.createElement("i"); f.style.width = (r.scores[i] / max * 100) + "%"; bar.append(f);
    const t = document.createElement("span"); t.textContent = s;
    row.append(rk, bar, t); list.append(row);
  });
}
$("go").onclick = run;
document.querySelectorAll("[data-ex]").forEach((b) => b.onclick = () => { $("txt").value = EX[+b.dataset.ex]; run(); });
$("txt").value = EX[0]; run();
