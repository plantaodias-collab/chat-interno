const STORAGE_KEY = "chamador-senha-state-v1";
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("chamador-senha") : null;

const initialState = {
  nextNumber: 1,
  queue: [],
  currentCall: null,
  calledTickets: [],
  updatedAt: Date.now(),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") {
      return structuredClone(initialState);
    }
    return {
      ...structuredClone(initialState),
      ...saved,
      nextNumber: Number(saved.nextNumber) || 1,
      queue: Array.isArray(saved.queue) ? saved.queue.map(normalizeTicket) : [],
      calledTickets: Array.isArray(saved.calledTickets)
        ? saved.calledTickets.map(normalizeTicket)
        : Array.isArray(saved.history)
          ? saved.history.map(normalizeTicket)
          : [],
    };
  } catch {
    return structuredClone(initialState);
  }
}

function normalizeTicket(ticket) {
  const rawCode = String(ticket?.code || "");
  const numberFromCode = Number(rawCode.replace(/\D/g, "")) || null;
  const fallbackNumber = Number(ticket?.number) || numberFromCode || 0;
  return {
    ...ticket,
    code: rawCode || `S${String(fallbackNumber).padStart(3, "0")}`,
    kind: "normal",
    number: fallbackNumber,
  };
}

let state = loadState();
let lastAnnouncedCallId = null;

function saveState() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (channel) {
    channel.postMessage(state);
  }
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function createTicket() {
  const number = state.nextNumber++;
  const code = `S${String(number).padStart(3, "0")}`;
  const ticket = {
    id: `${code}-${Date.now()}`,
    code,
    kind: "normal",
    number,
    issuedAt: Date.now(),
  };

  state.queue.push(ticket);
  saveState();
  render();

  const lastIssued = document.getElementById("last-issued");
  const lastIssuedMeta = document.getElementById("last-issued-meta");
  if (lastIssued && lastIssuedMeta) {
    lastIssued.textContent = code;
    lastIssuedMeta.textContent = `Senha emitida as ${formatTime(ticket.issuedAt)}.`;
  }
}

function callNext(counter) {
  if (!state.queue.length) {
    alert("Nao ha senhas aguardando na fila.");
    return;
  }

  const ticket = state.queue.shift();

  state.currentCall = {
    ...ticket,
    counter,
    calledAt: Date.now(),
  };

  state.calledTickets.unshift({
    ...state.currentCall,
    statusLabel: "Ja chamada",
  });
  state.calledTickets = state.calledTickets.slice(0, 20);
  saveState();
  render();
}

function repeatCall() {
  if (!state.currentCall) {
    alert("Nenhuma chamada para repetir.");
    return;
  }

  state.currentCall = {
    ...state.currentCall,
    calledAt: Date.now(),
    repeated: true,
  };

  state.calledTickets.unshift({
    ...state.currentCall,
    statusLabel: "Rechamada",
  });
  state.calledTickets = state.calledTickets.slice(0, 20);
  saveState();
  render();
}

function resetSystem() {
  const confirmed = window.confirm("Tem certeza que deseja zerar a fila e reiniciar a numeracao?");
  if (!confirmed) {
    return;
  }

  state = structuredClone(initialState);
  saveState();
  render();
}

function queueMarkup(items, emptyMessage) {
  if (!items.length) {
    return emptyMessage;
  }

  return items
    .map((ticket) => `<div class="queue-item normal">${ticket.code}</div>`)
    .join("");
}

function historyMarkup(items, emptyMessage) {
  if (!items.length) {
    return emptyMessage;
  }

  return items
    .map(
      (item) => `
        <div class="history-item">
          <strong>${item.code}</strong>
          <span class="history-status">${item.statusLabel || "Ja chamada"}</span>
          <span>${item.counter}</span>
          <span>${formatTime(item.calledAt)}</span>
        </div>
      `
    )
    .join("");
}

function renderAdmin() {
  const currentTicket = document.getElementById("current-ticket");
  const currentCounter = document.getElementById("current-counter");
  const queueTotal = document.getElementById("queue-total");
  const singleQueueEl = document.getElementById("single-queue");
  const calledList = document.getElementById("called-list");

  if (!currentTicket || !currentCounter || !queueTotal || !singleQueueEl || !calledList) {
    return;
  }

  currentTicket.textContent = state.currentCall ? state.currentCall.code : "Nenhuma";
  currentCounter.textContent = state.currentCall
    ? `${state.currentCall.counter} chamado as ${formatTime(state.currentCall.calledAt)}`
    : "Aguardando atendimento.";
  queueTotal.textContent = String(state.queue.length);
  singleQueueEl.innerHTML = queueMarkup(state.queue, "Nenhuma senha aguardando.");
  calledList.innerHTML = historyMarkup(state.calledTickets, "Nenhuma senha chamada ate agora.");
}

function renderPublic() {
  const publicTicket = document.getElementById("public-ticket");
  const publicCounter = document.getElementById("public-counter");
  const publicCalledList = document.getElementById("public-called-list");
  const publicQueue = document.getElementById("public-queue");

  if (!publicTicket || !publicCounter || !publicCalledList || !publicQueue) {
    return;
  }

  publicTicket.textContent = state.currentCall ? state.currentCall.code : "Aguardando";
  publicCounter.textContent = state.currentCall
    ? `${state.currentCall.counter} - ${formatTime(state.currentCall.calledAt)}`
    : "O proximo atendimento aparecera aqui.";
  publicCalledList.innerHTML = historyMarkup(state.calledTickets, "Sem chamadas ainda.");
  publicQueue.innerHTML = queueMarkup(state.queue, "Nenhuma");

  announceCall();
}

function announceCall() {
  if (!state.currentCall || state.currentCall.id === lastAnnouncedCallId) {
    return;
  }

  lastAnnouncedCallId = state.currentCall.id;
  playChime();
}

function playChime() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now + index * 0.16);
    gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.16 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now + index * 0.16);
    oscillator.stop(now + index * 0.16 + 0.24);
  });

  window.setTimeout(() => context.close(), 1000);
}

function render() {
  renderAdmin();
  renderPublic();
}

function bindAdminEvents() {
  const issueNext = document.getElementById("issue-next");
  const callNextButton = document.getElementById("call-next");
  const repeatCallButton = document.getElementById("repeat-call");
  const resetButton = document.getElementById("reset-system");
  const counterSelect = document.getElementById("counter-select");

  if (!issueNext || !callNextButton || !repeatCallButton || !resetButton || !counterSelect) {
    return;
  }

  issueNext.addEventListener("click", createTicket);
  callNextButton.addEventListener("click", () => callNext(counterSelect.value));
  repeatCallButton.addEventListener("click", repeatCall);
  resetButton.addEventListener("click", resetSystem);
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) {
    return;
  }

  state = JSON.parse(event.newValue);
  render();
});

if (channel) {
  channel.addEventListener("message", (event) => {
    state = event.data;
    render();
  });
}

bindAdminEvents();
render();
