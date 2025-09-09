<!-- SDKs do Firebase -->
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<script>
// =========================
// CONFIGURAÇÃO DO FIREBASE
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyDqHXjI3lTXMgRWItxaP7An-JZe04YQ-Sg",
  authDomain: "gfconcursos-app.firebaseapp.com",
  databaseURL: "https://gfconcursos-app-default-rtdb.firebaseio.com",
  projectId: "gfconcursos-app",
  storageBucket: "gfconcursos-app.firebasestorage.app",
  messagingSenderId: "615439428502",
  appId: "1:615439428502:web:b399549c3969e052098bb7"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// =========================
// 1. MENU DE DISCIPLINAS E ASSUNTOS
// =========================
function carregarDisciplinas() {
  db.collection("disciplinas").orderBy("nome").get().then(snapshot => {
    const seletor = document.getElementById("seletorDisciplina");
    seletor.innerHTML = '<option value="">-- Escolha uma disciplina --</option>';
    snapshot.forEach(doc => {
      const d = doc.data();
      seletor.innerHTML += `<option value="${doc.id}">${d.nome}</option>`;
    });
  });
}

function carregarAssuntos() {
  const idDisciplina = document.getElementById("seletorDisciplina").value;
  if (!idDisciplina) {
    document.getElementById("listaAssuntos").innerHTML = "";
    return;
  }
  db.collection("disciplinas").doc(idDisciplina).collection("assuntos")
    .orderBy("nome").get().then(snapshot => {
      const container = document.getElementById("listaAssuntos");
      container.innerHTML = "";
      snapshot.forEach(doc => {
        const a = doc.data();
        container.innerHTML += `
          <div class="border p-3 rounded">
            <h4 class="font-bold">${a.nome}</h4>
            <p class="text-sm text-gray-600 mb-2">${a.resumo}</p>
            <button onclick="praticarQuestoes('${idDisciplina}', '${a.nome}')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded">Praticar por assunto</button>
          </div>
        `;
      });
      container.innerHTML += `
        <div class="mt-4">
          <button onclick="praticarQuestoes('${idDisciplina}', null)" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">Praticar toda a disciplina</button>
        </div>
      `;
    });
}

// =========================
// 2. METAS DE HORAS E PROGRESSO
// =========================
function calcularProgresso(metaHoras, horasEstudadas) {
  return Math.min((horasEstudadas / metaHoras) * 100, 100);
}

function carregarProgressoDisciplinas() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection("disciplinas").get().then(snapshot => {
    const container = document.getElementById("progressoDisciplinas");
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      const metaHoras = d.metaHoras || 0;
      db.collection("registro_tempo")
        .where("usuarioId", "==", user.uid)
        .where("disciplinaId", "==", doc.id)
        .get().then(registros => {
          let horasEstudadas = 0;
          registros.forEach(r => horasEstudadas += r.data().minutos / 60);
          const percentual = calcularProgresso(metaHoras, horasEstudadas);
          container.innerHTML += `
            <div class="mb-4 cursor-pointer" onclick="abrirDetalheDisciplina('${doc.id}', '${d.nome}')">
              <p class="font-semibold">${d.nome} – ${horasEstudadas.toFixed(1)}h / ${metaHoras}h</p>
              <div class="w-full bg-gray-200 rounded-full h-4">
                <div class="bg-green-500 h-4 rounded-full" style="width: ${percentual}%;"></div>
              </div>
            </div>
          `;
        });
    });
  });
}

// =========================
// 3. PAINEL DE EVOLUÇÃO E GRÁFICO DE PIZZA
// =========================
function carregarEvolucaoQuestoes() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection("historico_questoes").where("usuarioId", "==", user.uid).get().then(snapshot => {
    let hoje = 0, semana = 0, mes = 0, total = 0;
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay());
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    snapshot.forEach(doc => {
      const r = doc.data();
      const data = r.dataResposta.toDate();
      total++;
      if (data >= inicioHoje) hoje++;
      if (data >= inicioSemana) semana++;
      if (data >= inicioMes) mes++;
    });
    document.getElementById("evolucaoDiaria").textContent = hoje;
    document.getElementById("evolucaoSemanal").textContent = semana;
    document.getElementById("evolucaoMensal").textContent = mes;
    document.getElementById("evolucaoTotal").textContent = total;
    gerarGraficoPizza([hoje, semana, mes, total]);
  });
}

function gerarGraficoPizza(valores) {
  const ctx = document.getElementById("graficoEvolucaoPizza").getContext("2d");
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Hoje', 'Semana', 'Mês', 'Total'],
      datasets: [{
        data: valores,
        backgroundColor: ['#4BC0C0', '#FFCE56', '#36A2EB', '#FF6384']
      }]
    }
  });
}

// =========================
// 4. PRÁTICA DE QUESTÕES
// =========================
function praticarQuestoes(idDisciplina, nomeAssunto) {
  const dificuldade = document.getElementById("nivelDificuldade")?.value || "";
  const quantidade = parseInt(document.getElementById("quantidadeQuestoes")?.value) || 10;
  let query = db.collection("questoes").where("disciplinaId", "==", idDisciplina);
  if (nomeAssunto) query = query.where("nomeAssunto", "==", nomeAssunto);
  if (dificuldade) query = query.where("dificuldade", "==", dificuldade);
  query.get().then(snapshot => {
    let questoes = snapshot.docs.map(doc => doc.data());
    questoes.sort((a, b) => ((b.errosUsuario || 0) - (b.acertosUsuario || 0)) - ((a.errosUsuario || 0) - (a.acertosUsuario || 0)));
    questoes = questoes.slice(0, quantidade);
    iniciarSimulado(questoes);
  });
}

// =========================
// 5. REVISÃO INTELIGENTE
// =========================
function iniciarRevisaoInteligente() {
  const quantidade = parseInt(document.getElementById("quantidadeQuestoesInteligente").value) || 20;
  db.collection("questoes").get().then(snapshot => {
    let questoes = snapshot.docs.map(doc => doc.data());
    questoes.sort((a, b) => ((b.errosUsuario || 0) - (b.acertosUsuario || 0)) - ((a.errosUsuario || 0) - (a.acertosUsuario || 0)));
    const faceis = questoes.filter(q => q.dificuldade === "facil").slice(0, Math.ceil(quantidade * 0.3));
    const medias = questoes.filter(q => q.dificuldade === "medio").slice(0, Math.ceil(quantidade * 0.4));
    const dificeis = questoes.filter(q => q.dificuldade === "dificil").slice(0, Math.ceil(quantidade * 0

let temaRedacaoAtual = "";

function carregarTemasRedacao() {
  const temas = [
    { titulo: "A influência das redes sociais no comportamento juvenil", ano: 2022, banca: "ENEM" },
    { titulo: "Desafios da mobilidade urbana no Brasil", ano: 2021, banca: "Fuvest" },
    { titulo: "O papel da tecnologia na educação contemporânea", ano: 2023, banca: "Unicamp" }
  ];

  const container = document.getElementById("temas-redacao");
  container.innerHTML = "";

  temas.forEach((tema) => {
    const div = document.createElement("div");
    div.className = "tema-redacao";
    div.innerHTML = `
      <h3>${tema.titulo}</h3>
      <p>Ano: ${tema.ano} | Banca: ${tema.banca}</p>
      <button class="btn-redacao">Escrever Redação</button>
    `;
    const botao = div.querySelector(".btn-redacao");
    botao.addEventListener("click", () => abrirModalRedacao(tema.titulo));
    container.appendChild(div);
  });
}

function abrirModalRedacao(titulo) {
  temaRedacaoAtual = titulo;
  document.getElementById("titulo-redacao").textContent = titulo;
  document.getElementById("modal-redacao").style.display = "block";
}

function fecharModalRedacao() {
  document.getElementById("modal-redacao").style.display = "none";
}

async function salvarRedacao() {
  const texto = document.getElementById("texto-redacao").value;
  const tema = temaRedacaoAtual;

  if (!texto.trim()) {
    alert("Digite sua redação antes de salvar.");
    return;
  }

  try {
    await db.collection("redacoes").add({
      tema: tema,
      texto: texto,
      data: new Date()
    });
    alert("Redação salva com sucesso!");
    fecharModalRedacao();
  } catch (erro) {
    console.error("Erro ao salvar redação:", erro);
    alert("Ocorreu um erro ao salvar. Tente novamente.");
  }
}

// Inicialização do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let temaRedacaoAtual = "";

// =========================
// 12. REDAÇÃO
// =========================

async function carregarTemasRedacao() {
  const temas = [
    { titulo: "A influência das redes sociais no comportamento juvenil", ano: 2022, banca: "ENEM" },
    { titulo: "Desafios da mobilidade urbana no Brasil", ano: 2021, banca: "Fuvest" },
    { titulo: "O papel da tecnologia na educação contemporânea", ano: 2023, banca: "Unicamp" }
  ];

  const container = document.getElementById("temas-redacao");
  if (!container) return;

  container.innerHTML = "";

  temas.forEach((tema) => {
    const div = document.createElement("div");
    div.className = "p-4 bg-white rounded shadow";

    div.innerHTML = `
      <h3 class="text-lg font-semibold">${tema.titulo}</h3>
      <p class="text-sm text-gray-600">Ano: ${tema.ano} | Banca: ${tema.banca}</p>
      <button class="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Escrever Redação
      </button>
    `;

    div.querySelector("button").addEventListener("click", () => abrirModalRedacao(tema.titulo));
    container.appendChild(div);
  });
}

function abrirModalRedacao(titulo) {
  temaRedacaoAtual = titulo;
  document.getElementById("titulo-redacao").textContent = titulo;
  document.getElementById("modal-redacao").classList.remove("hidden");
}

function fecharModalRedacao() {
  document.getElementById("modal-redacao").classList.add("hidden");
}

async function salvarRedacao() {
  const texto = document.getElementById("texto-redacao").value.trim();
  if (!texto) {
    alert("Digite sua redação antes de salvar.");
    return;
  }

  try {
    await addDoc(collection(db, "redacoes"), {
      tema: temaRedacaoAtual,
      texto: texto,
      data: serverTimestamp(),
      usuarioId: auth.currentUser ? auth.currentUser.uid : null
    });
    alert("Redação salva com sucesso!");
    fecharModalRedacao();
  } catch (erro) {
    console.error("Erro ao salvar redação:", erro);
    alert("Erro ao salvar. Tente novamente.");
  }
}

function corrigirRedacao() {
  const texto = document.getElementById("texto-redacao").value.trim();
  const resultado = document.getElementById("resultado-correcao");

  if (!texto) {
    alert("Digite sua redação antes de corrigir.");
    return;
  }

  let nota = 100;
  let observacoes = [];

  if (texto.length < 500) {
    nota -= 20;
    observacoes.push("O texto está muito curto. Desenvolva mais os argumentos.");
  }
  if (!texto.includes("portanto") && !texto.includes("conclui-se")) {
    nota -= 10;
    observacoes.push("A conclusão está pouco clara ou ausente.");
  }
  if (!texto.includes("porque") && !texto.includes("pois")) {
    nota -= 10;
    observacoes.push("Faltam conectivos que indiquem causa e consequência.");
  }
  if (nota > 90) {
    observacoes.push("Excelente estrutura e argumentação. Continue assim!");
  }

  resultado.innerHTML = `
    <div class="mt-4 p-4 bg-gray-100 rounded">
      <h3 class="text-lg font-semibold mb-2">Resultado da Correção</h3>
      <p><strong>Nota estimada:</strong> ${nota}/100</p>
      <ul class="list-disc ml-5 mt-2">
        ${observacoes.map(obs => `<li>${obs}</li>`).join("")}
      </ul>
    </div>
  `;

  document.getElementById("btn-imprimir").style.display = "inline-block";
}

function imprimirRedacao() {
  const { jsPDF } = window.jspdf;
  const elemento = document.getElementById("texto-redacao");

  html2canvas(elemento).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`redacao-${temaRedacaoAtual}.pdf`);
  });
}

// =========================
// Chamadas iniciais
// =========================
onAuthStateChanged(auth, (user) => {
  if (user) {
    carregarTemasRedacao();
  }
});
