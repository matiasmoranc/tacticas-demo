const ZONES = ["DEF", "MED", "ATA"];
const MAX_ROUNDS = 8;

const initialTeams = [
  {
    id: "a", name: "Verdes", color: "#62dc86", keeper: 82,
    players: [
      { name: "L. Silva", natural: "DL", attack: 89, midfield: 69, defense: 34, zone: "ATA" },
      { name: "M. Costa", natural: "MD", attack: 75, midfield: 86, defense: 68, zone: "MED" },
      { name: "T. Núñez", natural: "DF", attack: 44, midfield: 65, defense: 88, zone: "DEF" },
      { name: "R. Lima", natural: "MD", attack: 78, midfield: 80, defense: 61, zone: "MED" }
    ]
  },
  {
    id: "b", name: "Naranjas", color: "#ff914d", keeper: 79,
    players: [
      { name: "J. Pereira", natural: "DL", attack: 86, midfield: 65, defense: 29, zone: "ATA" },
      { name: "A. Gómez", natural: "MD", attack: 72, midfield: 83, defense: 66, zone: "MED" },
      { name: "F. Soto", natural: "DF", attack: 38, midfield: 61, defense: 90, zone: "DEF" },
      { name: "B. Torres", natural: "DL", attack: 84, midfield: 71, defense: 39, zone: "ATA" }
    ]
  }
];

let state;
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const statKey = zone => ({ DEF: "defense", MED: "midfield", ATA: "attack" })[zone];

function reset() {
  state = { teams: clone(initialTeams), round: 0, goals: [0, 0], started: false, finished: false, changes: [0, 0], events: [] };
  render();
}

function baseRating(team) {
  const field = team.players.reduce((total, p) => total + Math.max(p.attack, p.midfield, p.defense), 0);
  return (field + team.keeper) / 5;
}

function advantageBonuses() {
  const ratings = state.teams.map(baseRating);
  const diff = Math.abs(ratings[0] - ratings[1]);
  const bonus = diff <= 1 ? 0 : diff <= 3 ? 3 : diff <= 4.5 ? 5 : 7;
  return ratings[0] >= ratings[1] ? [bonus, 0] : [0, bonus];
}

function teamPower(team, teamIndex) {
  const grouped = Object.fromEntries(ZONES.map(z => [z, team.players.filter(p => p.zone === z)]));
  const sum = (zone, key) => grouped[zone].reduce((n, p) => n + p[key], 0);
  const line = (zone, key) => grouped[zone].length ? sum(zone, key) / 4 : 5;
  const midfield = line("MED", "midfield");
  const bonus = advantageBonuses()[teamIndex];
  return {
    attack: Math.round(line("ATA", "attack") + midfield * .3 + bonus),
    midfield: Math.round(midfield),
    defense: Math.round(line("DEF", "defense") + midfield * .3 + team.keeper * .15 + bonus),
    bonus,
    formation: `${grouped.DEF.length}-${grouped.MED.length}-${grouped.ATA.length}`,
    empty: ZONES.filter(z => !grouped[z].length)
  };
}

function scoringChance(attackerIndex, defenderIndex) {
  const atk = teamPower(state.teams[attackerIndex], attackerIndex);
  const def = teamPower(state.teams[defenderIndex], defenderIndex);
  return Math.round(clamp(16 + (atk.attack - def.defense) * .72 + atk.midfield * .12, 2, 78));
}

function renderTeam(team, index) {
  const p = teamPower(team, index);
  const warning = p.empty.length ? `<p class="warning">⚠ Línea casi anulada: ${p.empty.map(z => ({DEF:"defensa",MED:"medio",ATA:"ataque"})[z]).join(", ")}.</p>` : "";
  return `<article class="team-card" style="--team:${team.color}">
    <div class="team-head"><div class="team-title"><span class="team-dot"></span><h3>${team.name}</h3></div><span class="formation">${p.formation}</span></div>
    <div class="players">${team.players.map((player, playerIndex) => `<div class="player">
      <div class="player-top"><div><div class="player-name">${player.name}</div><div class="natural">Perfil natural: ${player.natural}</div></div>
      <div class="stats"><span class="stat"><b>${player.defense}</b><small>DEF</small></span><span class="stat"><b>${player.midfield}</b><small>MED</small></span><span class="stat"><b>${player.attack}</b><small>ATA</small></span></div></div>
      <div class="position-picker" aria-label="Posición de ${player.name}">${ZONES.map(zone => `<button type="button" class="${player.zone === zone ? "active" : ""}" data-team="${index}" data-player="${playerIndex}" data-zone="${zone}" ${state.finished || (state.started && state.changes[index] >= 1) ? "disabled" : ""}>${zone}</button>`).join("")}</div>
    </div>`).join("")}</div>
    ${warning}
    <div class="power-grid"><div class="power"><strong>${p.attack}</strong><small>Ataque</small></div><div class="power"><strong>${p.midfield}</strong><small>Medio</small></div><div class="power"><strong>${p.defense}</strong><small>Defensa</small></div><div class="power"><strong>+${p.bonus}</strong><small>Ventaja</small></div></div>
  </article>`;
}

function renderDuels() {
  const powers = state.teams.map(teamPower);
  const rows = [
    ["Ataque verde", powers[0].attack, powers[1].defense, "Defensa naranja"],
    ["Ataque naranja", powers[1].attack, powers[0].defense, "Defensa verde"],
    ["Mediocampo", powers[0].midfield, powers[1].midfield, "Control central"]
  ];
  return rows.map(([label,a,b,sub]) => { const total = Math.max(1,a+b); return `<div class="duel"><div class="duel-label"><b>${label}</b><small>${sub}</small></div><div class="meter"><span class="meter-a" style="width:${a/total*100}%"></span><span class="meter-b" style="width:${b/total*100}%"></span></div><div class="duel-score">${a}:${b}</div></div>`; }).join("");
}

function renderOdds() {
  return state.teams.map((team,i) => `<div class="odds-card" style="--team:${team.color}"><div><span>Probabilidad de gol por ataque</span><strong>${scoringChance(i,1-i)}%</strong></div><p>${teamPower(team,i).formation} · calidad original ${baseRating(team).toFixed(1)} · ventaja +${teamPower(team,i).bonus}</p></div>`).join("");
}

function render() {
  document.querySelector("#teams").innerHTML = state.teams.map(renderTeam).join("");
  document.querySelector("#duels").innerHTML = renderDuels();
  document.querySelector("#odds").innerHTML = renderOdds();
  document.querySelector("#scoreA").textContent = state.goals[0];
  document.querySelector("#scoreB").textContent = state.goals[1];
  document.querySelector("#scoreNameA").textContent = state.teams[0].name;
  document.querySelector("#scoreNameB").textContent = state.teams[1].name;
  document.querySelector("#roundLabel").textContent = state.finished ? "Final" : state.started ? `Ronda ${state.round} de ${MAX_ROUNDS}` : "Preparación";
  document.querySelector("#statusText").textContent = state.finished ? resultText() : state.started ? "Podés hacer un único cambio por equipo" : "Armá ambos equipos";
  const playBtn = document.querySelector("#playBtn");
  playBtn.textContent = state.finished ? "Jugar revancha" : state.started ? "Jugar siguiente ronda" : "Comenzar partido";
  document.querySelector("#commentary").innerHTML = `<p>${state.events[0]?.summary || "Acomodá los jugadores y comenzá el partido. Cada ronda genera un ataque por equipo."}</p>`;
  document.querySelector("#eventLog").innerHTML = state.events.slice(0,8).map(e => `<div class="event" style="--team:${e.color}"><b>${e.title}</b> ${e.detail}</div>`).join("");
  bindPositionButtons();
}

function bindPositionButtons() {
  document.querySelectorAll("[data-zone]").forEach(button => button.addEventListener("click", () => {
    const teamIndex = Number(button.dataset.team);
    const playerIndex = Number(button.dataset.player);
    const player = state.teams[teamIndex].players[playerIndex];
    if (player.zone === button.dataset.zone) return;
    if (state.started) state.changes[teamIndex]++;
    player.zone = button.dataset.zone;
    render();
  }));
}

function playRound() {
  if (state.finished) return reset();
  state.started = true;
  state.round++;
  const roundEvents = [];
  state.teams.forEach((team, i) => {
    const chance = scoringChance(i, 1-i);
    const roll = Math.random() * 100;
    const goal = roll < chance;
    if (goal) state.goals[i]++;
    roundEvents.push({ color: team.color, title: goal ? `⚽ Gol de ${team.name}.` : `${team.name} no convirtió.`, detail: `Tenía ${chance}% de probabilidad.`, summary: "" });
  });
  const goalsThisRound = roundEvents.filter(e => e.title.includes("Gol")).length;
  const summary = goalsThisRound === 2 ? "¡Gol de los dos equipos en la misma ronda!" : goalsThisRound === 1 ? roundEvents.find(e => e.title.includes("Gol")).title : "Las dos defensas resistieron esta ronda.";
  roundEvents[0].summary = summary;
  state.events.unshift(...roundEvents);
  if (state.round >= MAX_ROUNDS) state.finished = true;
  render();
}

function resultText() {
  if (state.goals[0] === state.goals[1]) return "Empate";
  return `Ganó ${state.teams[state.goals[0] > state.goals[1] ? 0 : 1].name}`;
}

document.querySelector("#playBtn").addEventListener("click", playRound);
document.querySelector("#resetBtn").addEventListener("click", reset);
reset();
